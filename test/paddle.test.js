const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const paddle=require('../lib/edit/paddle');

test('Paddle checkout sends only order metadata and returns transaction checkout URL',async()=>{
  let request;
  const transaction=await paddle.createCheckout({id:'11111111-1111-4111-8111-111111111111',cutCount:4,accessToken:'a'.repeat(64)},{origin:'https://theedit.hautesoundcouture.com',env:{PADDLE_API_KEY:'pdl_test_1234567890123456',PADDLE_ENVIRONMENT:'sandbox',PADDLE_PRICE_THE_EDIT_4:'pri_12345678901234567890'},fetchImpl:async(url,options)=>{
    request={url,body:JSON.parse(options.body)};
    return {ok:true,json:async()=>({data:{id:'txn_12345678901234567890',checkout:{url:'https://sandbox-checkout.paddle.com/checkout'}}})};
  }});
  assert.equal(transaction.id,'txn_12345678901234567890');
  assert.equal(transaction.priceId,'pri_12345678901234567890');
  assert.equal(request.url,'https://sandbox-api.paddle.com/transactions');
  assert.deepEqual(request.body.custom_data,{order_id:'11111111-1111-4111-8111-111111111111',product:'the_edit'});
  assert.equal(request.body.checkout.url,'https://theedit.hautesoundcouture.com/edit/?order=11111111-1111-4111-8111-111111111111#access='+'a'.repeat(64));
});

test('Paddle webhook signature verifies and normalizes a paid transaction',()=>{
  const raw=Buffer.from(JSON.stringify({event_type:'transaction.completed',data:{id:'txn_12345678901234567890',status:'completed',currency_code:'USD',custom_data:{order_id:'11111111-1111-4111-8111-111111111111'},details:{totals:{total:'1500'}},items:[{price:{id:'pri_12345678901234567890'},quantity:1}]}}));
  const ts=String(Math.floor(Date.now()/1000));
  const secret='pdl_ntfset_1234567890123456';
  const h1=crypto.createHmac('sha256',secret).update(Buffer.concat([Buffer.from(`${ts}:`),raw])).digest('hex');
  paddle.verifyWebhook(raw,`ts=${ts};h1=${h1}`,secret);
  const event=JSON.parse(raw.toString('utf8'));
  assert.deepEqual(paddle.normalizePaidEvent(event),{
    id:'txn_12345678901234567890',
    metadata:{order_id:'11111111-1111-4111-8111-111111111111'},
    mode:'payment',
    livemode:undefined,
    currency:'usd',
    amount_total:1500,
    payment_status:'paid',
    payment_intent:'txn_12345678901234567890',
    provider:'paddle',
    priceId:'pri_12345678901234567890',
    quantity:1
  });
  assert.throws(()=>paddle.verifyWebhook(raw,`ts=${ts};h1=${'0'.repeat(64)}`,secret));
});
