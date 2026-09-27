// Is this Producer Pack paid? Accepts a Stripe Checkout session (cs_…) or a Paddle transaction (txn_…).
// Returns a session-like object for lib/credits.js, or null when unpaid / not a Producer Pack.
const Stripe=require('stripe');
const paddle=require('./edit/paddle');
const PACK='hsc_sample_atelier_producer_pack';
const STRIPE_ID=/^cs_(?:test_|live_)?[A-Za-z0-9]{20,}$/,PADDLE_ID=/^txn_[A-Za-z0-9]{20,}$/;

function validPackId(id){return STRIPE_ID.test(String(id||''))||PADDLE_ID.test(String(id||''));}
function packProviderReady(id){return PADDLE_ID.test(String(id||''))?Boolean(process.env.PADDLE_API_KEY):Boolean(process.env.STRIPE_SECRET_KEY);}

async function paidPack(id){
  id=String(id||'');
  if(PADDLE_ID.test(id)){
    const t=await paddle.request(`/transactions/${encodeURIComponent(id)}?include=customer`);
    if(!['completed','paid'].includes(t?.status)||t?.custom_data?.product_key!==PACK)return null;
    return {id:t.id,customer_details:{email:t.customer?.email||null},generationId:t.custom_data?.generation_id||null};
  }
  if(STRIPE_ID.test(id)){
    const s=await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(id);
    if(s.payment_status!=='paid'||s.metadata?.product_key!==PACK)return null;
    return {id:s.id,customer_details:{email:s.customer_details?.email||null},generationId:s.metadata?.generation_id||null};
  }
  return null;
}

module.exports={validPackId,packProviderReady,paidPack};
