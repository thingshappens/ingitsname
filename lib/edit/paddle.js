const crypto=require('node:crypto');

class PaddleError extends Error {}

function apiBase(env=process.env){
  return env.PADDLE_ENVIRONMENT==='sandbox'?'https://sandbox-api.paddle.com':'https://api.paddle.com';
}

function requireConfig(env=process.env){
  const apiKey=env.PADDLE_API_KEY;
  if(typeof apiKey!=='string'||!apiKey.startsWith('pdl_'))throw new PaddleError('Paddle checkout is not connected yet.');
  return {apiKey,baseUrl:apiBase(env)};
}

async function request(path,{env=process.env,fetchImpl=fetch,method='GET',body}={}){
  const {apiKey,baseUrl}=requireConfig(env);
  const response=await fetchImpl(`${baseUrl}${path}`,{
    method,
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json',accept:'application/json'},
    body:body?JSON.stringify(body):undefined
  });
  let payload;try{payload=await response.json();}catch{payload=null;}
  if(!response.ok)throw new PaddleError(payload?.error?.detail||payload?.error?.message||'Paddle checkout is unavailable.');
  return payload?.data;
}

function priceIdFor(order,env=process.env){
  const value=env[`PADDLE_PRICE_THE_EDIT_${order.cutCount}`]||env.PADDLE_PRICE_THE_EDIT_4;
  if(typeof value!=='string'||!/^pri_[A-Za-z0-9]+$/.test(value))throw new PaddleError('The Edit Paddle price is unavailable.');
  return value;
}

async function createCheckout(order,{origin,env=process.env,fetchImpl=fetch}){
  const priceId=priceIdFor(order,env);
  const transaction=await request('/transactions',{env,fetchImpl,method:'POST',body:{
    items:[{price_id:priceId,quantity:1}],
    custom_data:{order_id:order.id,product:'the_edit'},
    checkout:{url:`${origin}/edit/?order=${order.id}#access=${order.accessToken}`}
  }});
  if(typeof transaction?.id!=='string'||typeof transaction?.checkout?.url!=='string')throw new PaddleError('Paddle checkout did not return a checkout URL.');
  return {id:transaction.id,url:transaction.checkout.url,priceId};
}

function parseSignature(header){
  const parts=Object.fromEntries(String(header||'').split(';').map(part=>part.split('=').map(x=>x.trim())).filter(part=>part.length===2));
  if(!/^\d+$/.test(parts.ts||'')||!parts.h1)return null;
  return {timestamp:parts.ts,signature:parts.h1};
}

function verifyWebhook(rawBody,signatureHeader,secret,now=Date.now()){
  if(!Buffer.isBuffer(rawBody)||typeof secret!=='string'||secret.length<16)throw new PaddleError('Paddle webhook is not configured.');
  const parsed=parseSignature(signatureHeader);
  if(!parsed)throw new PaddleError('Invalid Paddle signature.');
  const age=Math.abs(Math.floor(now/1000)-Number(parsed.timestamp));
  if(age>300)throw new PaddleError('Stale Paddle webhook.');
  const signedPayload=Buffer.concat([Buffer.from(`${parsed.timestamp}:`),rawBody]);
  const expected=crypto.createHmac('sha256',secret).update(signedPayload).digest('hex');
  const actual=String(parsed.signature);
  if(expected.length!==actual.length||!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex')))throw new PaddleError('Invalid Paddle signature.');
}

function normalizePaidEvent(event){
  if(!event||!['transaction.completed','transaction.paid'].includes(event.event_type))return null;
  const data=event.data||{};
  return {
    id:data.id,
    metadata:{order_id:data.custom_data?.order_id},
    mode:'payment',
    livemode:event.event_id?true:undefined,
    currency:String(data.currency_code||'usd').toLowerCase(),
    amount_total:Number(data.details?.totals?.total),
    payment_status:['completed','paid'].includes(data.status)?'paid':data.status,
    payment_intent:data.id,
    provider:'paddle',
    priceId:data.items?.[0]?.price?.id,
    quantity:data.items?.[0]?.quantity
  };
}

module.exports={PaddleError,createCheckout,normalizePaidEvent,priceIdFor,request,verifyWebhook};
