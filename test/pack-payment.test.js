const test=require('node:test');const assert=require('node:assert');
const paddle=require('../lib/edit/paddle');
const {validPackId,packProviderReady,paidPack}=require('../lib/pack-payment');
const TXN='txn_01abcdefghijklmnopqrstuvwxyz';
function stub(t){paddle.request=async(path)=>{assert.match(path,/^\/transactions\/txn_.*include=customer$/);return t;};}

test('Producer Pack accepts Stripe and Paddle IDs only',()=>{
  assert.ok(validPackId('cs_live_'+'a'.repeat(24)));assert.ok(validPackId(TXN));
  assert.ok(!validPackId('pri_01abc'));assert.ok(!validPackId('txn_short'));assert.ok(!validPackId(''));
});
test('Paddle pack needs the Paddle API key',()=>{
  const k=process.env.PADDLE_API_KEY;delete process.env.PADDLE_API_KEY;assert.ok(!packProviderReady(TXN));
  process.env.PADDLE_API_KEY='x';assert.ok(packProviderReady(TXN));if(k)process.env.PADDLE_API_KEY=k;else delete process.env.PADDLE_API_KEY;
});
test('paid Paddle Producer Pack becomes a credit session',async()=>{
  stub({id:TXN,status:'completed',custom_data:{product_key:'hsc_sample_atelier_producer_pack',generation_id:'g1'},customer:{email:'a@b.c'}});
  assert.deepEqual(await paidPack(TXN),{id:TXN,customer_details:{email:'a@b.c'},generationId:'g1'});
});
test('unpaid or non-pack Paddle transactions give no credits',async()=>{
  stub({id:TXN,status:'ready',custom_data:{product_key:'hsc_sample_atelier_producer_pack'}});assert.equal(await paidPack(TXN),null);
  stub({id:TXN,status:'completed',custom_data:{product_key:'hsc_sample_atelier_four_cuts'}});assert.equal(await paidPack(TXN),null);
});
