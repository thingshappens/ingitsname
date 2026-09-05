const {test}=require('node:test');const assert=require('node:assert/strict');const {Readable}=require('node:stream');const Stripe=require('stripe');const {createWebhook}=require('../lib/edit/webhook');
const env={THE_EDIT_WEBHOOK_SECRET:'whsec_local_test_fixture',THE_EDIT_STRIPE_SECRET_KEY:'sk_test_local_fixture',VERCEL_ENV:'preview'};
async function invoke({valid=true,live=false,fail=false,type='checkout.session.completed',timestamp=Math.floor(Date.now()/1000)}={}){
  let calls=0;const payload=JSON.stringify({id:'evt_fixture',livemode:live,type,data:{object:{id:'cs_fixture'}}});
  const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:env.THE_EDIT_WEBHOOK_SECRET,timestamp});
  const req=Readable.from([Buffer.from(payload)]);req.method='POST';req.headers={'stripe-signature':valid?signature:'invalid'};
  const res={status(c){this.code=c;return this;},end(){return this;},json(body){this.body=body;return this;}};
  await createWebhook({env,service:{paid:async()=>{calls++;if(fail)throw new Error('worker failed');}}})(req,res);
  return {code:res.code,calls};
}
test('raw webhook signature and timestamp must validate',async()=>{assert.deepEqual(await invoke({valid:false}),{code:400,calls:0});assert.deepEqual(await invoke({timestamp:1}),{code:400,calls:0});assert.deepEqual(await invoke(),{code:200,calls:1});});
test('live events cannot enter preview; unrelated events do not fulfil',async()=>{assert.deepEqual(await invoke({live:true}),{code:400,calls:0});assert.deepEqual(await invoke({type:'customer.created'}),{code:200,calls:0});});
test('delayed payment success is accepted and worker failure requests Stripe retry',async()=>{assert.deepEqual(await invoke({type:'checkout.session.async_payment_succeeded'}),{code:200,calls:1});assert.deepEqual(await invoke({fail:true}),{code:503,calls:1});});
