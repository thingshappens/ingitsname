const Stripe=require('stripe');
const model=require('./model');
const storage=require('./store');
const rendering=require('./render');
function settings(){
  const production=process.env.VERCEL_ENV==='production';
  const key=process.env.THE_EDIT_STRIPE_SECRET_KEY;
  const enabled=process.env.THE_EDIT_ENABLED==='true'&&(!production||process.env.THE_EDIT_QA_APPROVED_VERSION===model.VERSION);
  if(production&&!process.env.THE_EDIT_TERMS_URL)throw new Error('Commercial terms unavailable');
  if(!enabled||!key||!process.env.THE_EDIT_WEBHOOK_SECRET||!process.env.ELEVENLABS_API_KEY||!process.env.STRIPE_PRICE_THE_EDIT_2||!model.voices().length)throw new Error('The Edit is not open for orders yet.');
  if(!new RegExp(`^[sr]k_${production?'live':'test'}_`).test(key))throw new Error('Payment environment mismatch');
  const origin=process.env.THE_EDIT_ORIGIN;
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Invalid order origin');
  if(production&&!['theedit.hautesoundcouture.com','atelier.hautesoundcouture.com'].includes(url.hostname))throw new Error('Invalid production origin');
  return {production,origin:url.origin,stripe:new Stripe(key)};
}
function createService({store=storage,renderer=rendering}={}){
  async function checkout(input,requestId,token,{stripe,origin,production}){
    if(!/^[a-f0-9-]{36}$/.test(requestId)||!/^[a-f0-9]{64}$/.test(token))throw new model.InputError('Please reload and try again.');
    const selection=model.validate(input);
    const fingerprint=model.hash(JSON.stringify({...selection,cuts:selection.cuts.map(({id,...c})=>c)}));
    await store.create({...selection,id:requestId,fingerprint,accessHash:model.hash(token),status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    const owner=await store.lock(requestId);if(!owner)throw new Error('Checkout is already being prepared. Try again shortly.');
    try{
      const order=await store.get(requestId);
      if(!model.tokenMatches(token,order.accessHash)||order.fingerprint!==fingerprint)throw new model.InputError('This order has already been started. Restore the original choices or start a new order.');
      if(order.stripeCheckoutSessionId){const old=await stripe.checkout.sessions.retrieve(order.stripeCheckoutSessionId);return {url:old.url,orderId:order.id,status:order.status};}
      const priceId=process.env[`STRIPE_PRICE_THE_EDIT_${order.cutCount}`];
      const price=await stripe.prices.retrieve(priceId);
      if(!price.active||price.livemode!==production||price.currency!=='usd'||price.unit_amount!==model.PRICES[order.cutCount]||price.type!=='one_time')throw new Error('The Edit price is unavailable');
      order.priceId=priceId;order.expectedAmount=price.unit_amount;order.livemode=production;
      // Save the draft before Stripe; a request retry reuses the same Stripe key.
      await store.save(order,owner);
      const session=await stripe.checkout.sessions.create({mode:'payment',managed_payments:{enabled:false},allow_promotion_codes:false,line_items:[{price:priceId,quantity:1}],metadata:{order_id:order.id},integration_identifier:'hsc_the_edit_qmzvtrka',success_url:`${origin}/edit/?order=${order.id}#access=${token}`,cancel_url:`${origin}/edit/?cancelled=1`},{idempotencyKey:`the-edit-${order.id}`});
      order.stripeCheckoutSessionId=session.id;order.status='awaiting_payment';await store.save(order,owner);
      return {url:session.url,orderId:order.id,status:order.status};
    }finally{await store.unlock(requestId,owner);}
  }
  async function paid(session,stripe){
    const id=session.metadata?.order_id;
    if(!id||!/^[a-f0-9-]{36}$/.test(id))return;
    const owner=await store.lock(id);if(!owner)throw new Error('Order is busy; retry webhook');
    try{
      const order=await store.get(id);if(!order||order.product!=='the_edit')return;
      if(order.stripeCheckoutSessionId!==session.id||session.mode!=='payment'||session.livemode!==order.livemode||session.currency!=='usd'||session.amount_total!==order.expectedAmount)throw new Error('Payment does not match order');
      if(session.payment_status!=='paid')return;
      const lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:5});
      if(lines.has_more||lines.data.length!==1||lines.data[0].price.id!==order.priceId||lines.data[0].quantity!==1)throw new Error('Payment items do not match');
      if(order.status==='ready')return;
      const firstPayment=!order.paidAt;order.paidAt ||= new Date().toISOString();
      order.status='paid';order.stripePaymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id;await store.save(order,owner);
      if(firstPayment)console.info(JSON.stringify({event:'the_edit_paid',cutCount:order.cutCount}));
      await store.redis().sadd('hsc:edit:pending',id);
      try{
        order.status='rendering';order.lastError=null;await store.save(order,owner);
        let pcm;
        if(order.source)pcm=await store.audio(order.source);
        else {pcm=await renderer.generate(order);order.source=await store.putAudio(id,'source',pcm);await store.save(order,owner);}
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
module.exports={settings,createService};
