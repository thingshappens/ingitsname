const {Redis}=require('@upstash/redis');
const {randomUUID}=require('node:crypto');
const TTL=90*86400, AUDIO_TTL=7*86400, CHUNK=192*1024;
let client;
function redis(){
  const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
  if(!url||!token)throw new Error('Order storage unavailable');
  return client ||= new Redis({url,token,automaticDeserialization:true});
}
function key(id){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid order');return `hsc:edit:${process.env.VERCEL_ENV==='production'?'live':'test'}:${id}`;}
async function get(id){return redis().get(key(id));}
async function create(order){return redis().set(key(order.id),JSON.stringify(order),{nx:true,ex:TTL});}
async function lock(id){const owner=randomUUID();return await redis().set(`${key(id)}:lock`,owner,{nx:true,ex:360})?owner:null;}
async function save(order,owner){
  order.updatedAt=new Date().toISOString();
  const result=await redis().eval("if redis.call('GET',KEYS[2]) ~= ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1",[key(order.id),`${key(order.id)}:lock`],[owner,JSON.stringify(order),TTL]);
  if(Number(result)!==1)throw new Error('Order lease lost');
}
async function unlock(id,owner){await redis().eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end; return 0",[`${key(id)}:lock`],[owner]);}
async function putAudio(id,name,buffer){
  if(buffer.length>8*1024*1024)throw new Error('Audio too long');
  const prefix=`${key(id)}:audio:${name}:${randomUUID()}`;
  let count=0;
  for(let i=0;i<buffer.length;i+=CHUNK)await redis().set(`${prefix}:${count++}`,buffer.subarray(i,i+CHUNK).toString('base64'),{ex:AUDIO_TTL});
  return {prefix,count,bytes:buffer.length,expiresAt:Date.now()+AUDIO_TTL*1000};
}
async function audio(ref){
  if(!ref||ref.expiresAt<Date.now())throw new Error('Download expired');
  const parts=[];
  for(let i=0;i<ref.count;i++){const p=await redis().get(`${ref.prefix}:${i}`);if(typeof p!=='string')throw new Error('Audio unavailable');parts.push(Buffer.from(p,'base64'));}
  const result=Buffer.concat(parts);if(result.length!==ref.bytes)throw new Error('Incomplete audio');return result;
}
async function rateLimit(ip){const k=`hsc:edit:checkout:${require('./model').hash(ip)}`;return Number(await redis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n",[k],[]))<=12;}
async function previewRateLimit(ip){const k=`hsc:edit:preview:${require('./model').hash(ip)}`;return Number(await redis().eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],3600) end; return n",[k],[]))<=3;}
module.exports={TTL,AUDIO_TTL,redis,get,create,lock,save,unlock,putAudio,audio,rateLimit,previewRateLimit};
