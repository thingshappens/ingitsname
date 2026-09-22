const Stripe=require('stripe');
const model=require('./model');
const storage=require('./store');
const rendering=require('./render');
const paddle=require('./paddle');
function settings(){
  const production=process.env.VERCEL_ENV==='production';
  const provider=process.env.THE_EDIT_PAYMENT_PROVIDER==='paddle'?'paddle':'stripe';
  const key=process.env.THE_EDIT_STRIPE_SECRET_KEY;
  const enabled=process.env.THE_EDIT_ENABLED==='true'&&(!production||process.env.THE_EDIT_QA_APPROVED_VERSION===model.VERSION);
  if(production&&!process.env.THE_EDIT_TERMS_URL)throw new Error('Commercial terms unavailable');
  if(!enabled||!process.env.THE_EDIT_RUNPOD_ENDPOINT_ID||!process.env.THE_EDIT_RUNPOD_API_KEY||!model.voices().length)throw new Error('The Edit is not open for orders yet.');
  if(provider==='stripe'&&(!key||!process.env.THE_EDIT_WEBHOOK_SECRET||!process.env.STRIPE_PRICE_THE_EDIT_4))throw new Error('The Edit is not open for orders yet.');
  if(provider==='paddle'&&(!process.env.PADDLE_API_KEY||!process.env.PADDLE_WEBHOOK_SECRET||!process.env.PADDLE_PRICE_THE_EDIT_4))throw new Error('The Edit is not open for orders yet.');
  if(provider==='stripe'&&!new RegExp(`^[sr]k_${production?'live':'test'}_`).test(key))throw new Error('Payment environment mismatch');
  const origin=process.env.THE_EDIT_ORIGIN;
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Invalid order origin');
  if(production&&!['hautesoundcouture.com','theedit.hautesoundcouture.com','atelier.hautesoundcouture.com'].includes(url.hostname))throw new Error('Invalid production origin');
  return {production,origin:url.origin,provider,stripe:provider==='stripe'?new Stripe(key):null};
}
function previewSettings(request){
  // A protected preview is an audio-evaluation surface, not a checkout. Keep
  // it independent from Stripe/Paddle, price IDs and webhook configuration so
  // an unfinished commercial stack cannot block Felix A/B listening.
  if(process.env.VERCEL_ENV==='production'||!process.env.THE_EDIT_RUNPOD_ENDPOINT_ID||!process.env.THE_EDIT_RUNPOD_API_KEY||!model.voices().length)throw new Error('The Edit preview is not configured.');
  const origin=request?.headers?.origin;
  const host=String(request?.headers?.host||'').toLowerCase();
  let url;try{url=new URL(origin);}catch{throw new Error('Invalid preview origin');}
  if(url.protocol!=='https:'||url.host.toLowerCase()!==host||!host.endsWith('.vercel.app'))throw new Error('Invalid preview origin');
  return {origin:url.origin};
}
function createService({store=storage,renderer=rendering}={}){
  async function checkout(input,requestId,token,{stripe,origin,production,provider='stripe'}){
    if(!/^[a-f0-9-]{36}$/.test(requestId)||!/^[a-f0-9]{64}$/.test(token))throw new model.InputError('Please reload and try again.');
    const selection=model.validate(input);
    const fingerprint=model.hash(JSON.stringify({...selection,cuts:selection.cuts.map(({id,...c})=>c)}));
    await store.create({...selection,id:requestId,fingerprint,accessHash:model.hash(token),status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    const owner=await store.lock(requestId);if(!owner)throw new Error('Checkout is already being prepared. Try again shortly.');
    try{
      const order=await store.get(requestId);
      if(!model.tokenMatches(token,order.accessHash)||order.fingerprint!==fingerprint)throw new model.InputError('This order has already been started. Restore the original choices or start a new order.');
      if(order.checkoutSessionId){
        if(order.paymentProvider==='stripe'){const old=await stripe.checkout.sessions.retrieve(order.checkoutSessionId);return {url:old.url,orderId:order.id,status:order.status};}
        return {url:order.checkoutUrl,orderId:order.id,status:order.status};
      }
      order.paymentProvider=provider;
      order.livemode=production;
      if(provider==='paddle'){
        order.accessToken=token;
        const checkout=await paddle.createCheckout(order,{origin});
        delete order.accessToken;
        order.priceId=checkout.priceId;order.expectedAmount=model.PRICES[order.cutCount];order.checkoutSessionId=checkout.id;order.checkoutUrl=checkout.url;
      }else{
        const priceId=process.env[`STRIPE_PRICE_THE_EDIT_${order.cutCount}`];
        const price=await stripe.prices.retrieve(priceId);
        if(!price.active||price.livemode!==production||price.currency!=='usd'||price.unit_amount!==model.PRICES[order.cutCount]||price.type!=='one_time')throw new Error('The Edit price is unavailable');
        order.priceId=priceId;order.expectedAmount=price.unit_amount;
      }
      // Save the draft before the payment provider; a request retry reuses it.
      await store.save(order,owner);
      if(provider==='stripe'){
        const session=await stripe.checkout.sessions.create({mode:'payment',managed_payments:{enabled:false},allow_promotion_codes:false,line_items:[{price:order.priceId,quantity:1}],metadata:{order_id:order.id},integration_identifier:'hsc_the_edit_qmzvtrka',success_url:`${origin}/edit/?order=${order.id}#access=${token}`,cancel_url:`${origin}/edit/?cancelled=1`},{idempotencyKey:`the-edit-${order.id}`});
        order.checkoutSessionId=session.id;order.stripeCheckoutSessionId=session.id;order.checkoutUrl=session.url;
      }
      order.status='awaiting_payment';await store.save(order,owner);
      return {url:order.checkoutUrl,orderId:order.id,status:order.status};
    }finally{await store.unlock(requestId,owner);}
  }
  async function paid(session,stripe){
    const id=session.metadata?.order_id;
    if(!id||!/^[a-f0-9-]{36}$/.test(id))return;
    const owner=await store.lock(id);if(!owner)throw new Error('Order is busy; retry webhook');
    try{
      const order=await store.get(id);if(!order||order.product!=='the_edit')return;
      const provider=order.paymentProvider||'stripe';
      if(order.checkoutSessionId&&order.checkoutSessionId!==session.id)throw new Error('Payment does not match order');
      if(!order.checkoutSessionId&&order.stripeCheckoutSessionId!==session.id)throw new Error('Payment does not match order');
      if(session.mode!=='payment'||session.currency!=='usd'||session.amount_total!==order.expectedAmount)throw new Error('Payment does not match order');
      if(session.payment_status!=='paid')return;
      if(provider==='stripe'){
        if(session.livemode!==order.livemode)throw new Error('Payment does not match order');
        const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:5});
        if(lines.has_more||lines.data.length!==1||lines.data[0].price.id!==order.priceId||lines.data[0].quantity!==1)throw new Error('Payment items do not match');
      }else if(session.priceId!==order.priceId||session.quantity!==1)throw new Error('Payment items do not match');
      if(order.status==='ready')return;
      const firstPayment=!order.paidAt;order.paidAt ||= new Date().toISOString();
      order.status='paid';order.stripePaymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;await store.save(order,owner);
      if(firstPayment)console.info(JSON.stringify({event:'the_edit_paid',cutCount:order.cutCount}));
      await store.redis().sadd('hsc:edit:pending',id);
      try{
        order.status='rendering';order.lastError=null;await store.save(order,owner);
        let pcm;
        if(order.source)pcm=await store.audio(order.source);
        else {
          const generated=await renderer.generate(order);
          pcm=Buffer.isBuffer(generated)?generated:generated.pcm;
          if(!Buffer.isBuffer(pcm))throw new Error('Voice rendering returned no source audio');
          if(!Buffer.isBuffer(generated)){order.voiceboxGenerationId=generated.generationId;order.voiceboxEngine=generated.engine;order.voiceboxModelSize=generated.modelSize;order.voiceboxSampleRate=generated.sampleRate;}
          order.source=await store.putAudio(id,'source',pcm);await store.save(order,owner);
        }
        const deadline=Date.now()+180000;
        for(const cut of order.cuts){
          if(Date.now()>deadline)throw new Error('Continue rendering on webhook retry');
          if(cut.renderStatus==='ready')continue;
          const output=await renderer.render(pcm,cut,order);
          cut.asset=await store.putAudio(id,cut.id,output.buffer);cut.metrics=output.metrics;cut.renderStatus='ready';await store.save(order,owner);
        }
        order.status='ready';order.downloadExpiresAt=Math.min(...order.cuts.map(c=>c.asset.expiresAt));await store.save(order,owner);
        console.info(JSON.stringify({event:'the_edit_render_ready',cutCount:order.cutCount}));
        await store.redis().srem('hsc:edit:pending',id);
      }catch(error){order.status='failed';order.lastError='Rendering paused. Your payment is saved; delivery will retry.';await store.save(order,owner);throw error;}
    }finally{await store.unlock(id,owner);}
  }
  async function authorized(id,token){const order=await store.get(id);if(!order||!model.tokenMatches(token,order.accessHash))return null;return order;}
  return {checkout,paid,authorized};
}
module.exports={settings,previewSettings,createService};
