const ALLOWED_ENGINES=new Set(['qwen','qwen_custom_voice','luxtts','chatterbox','chatterbox_turbo','tada','kokoro']);

class VoiceboxError extends Error {}

function settings(env=process.env){
  const raw=env.THE_EDIT_VOICEBOX_URL;
  const token=env.THE_EDIT_VOICEBOX_TOKEN;
  if(!raw||!token)throw new VoiceboxError('Voice rendering is not configured.');
  let url;
  try{url=new URL(raw);}catch{throw new VoiceboxError('Voice rendering URL is invalid.');}
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new VoiceboxError('Voice rendering URL is invalid.');
  if(env.VERCEL_ENV==='production'&&url.protocol!=='https:')throw new VoiceboxError('Voice rendering must use HTTPS in production.');
  return {baseUrl:url.href.replace(/\/$/,''),token};
}

function headers(token){return {'authorization':`Bearer ${token}`,'content-type':'application/json','accept':'application/json'};}

function validProfileId(value){return typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);}

async function generate(input,{env=process.env,fetchImpl=fetch}={}){
  const {baseUrl,token}=settings(env);
  if(!input||!validProfileId(input.profileId)||typeof input.text!=='string'||!input.text.trim()||!ALLOWED_ENGINES.has(input.engine))throw new VoiceboxError('Voice rendering request is invalid.');
  const payload={profile_id:input.profileId,text:input.text.trim(),language:input.language||'en',engine:input.engine};
  if(input.modelSize)payload.model_size=input.modelSize;
  if(input.instruct)payload.instruct=input.instruct;
  let response;
  try{response=await fetchImpl(`${baseUrl}/generate`,{method:'POST',headers:headers(token),body:JSON.stringify(payload),signal:AbortSignal.timeout(90000)});}catch{throw new VoiceboxError('Voice rendering is temporarily unavailable.');}
  if(!response.ok)throw new VoiceboxError('Voice rendering is temporarily unavailable.');
  let generation;
  try{generation=await response.json();}catch{throw new VoiceboxError('Voice rendering returned an invalid response.');}
  if(!validProfileId(generation?.id)||generation.profile_id!==input.profileId)throw new VoiceboxError('Voice rendering returned an invalid generation.');
  let audio;
  try{audio=await fetchImpl(`${baseUrl}/audio/${encodeURIComponent(generation.id)}`,{headers:{'authorization':`Bearer ${token}`},signal:AbortSignal.timeout(210000)});}catch{throw new VoiceboxError('Generated audio is temporarily unavailable.');}
  if(!audio.ok)throw new VoiceboxError('Generated audio is temporarily unavailable.');
  const buffer=Buffer.from(await audio.arrayBuffer());
  if(!buffer.length||buffer.length>16*1024*1024)throw new VoiceboxError('Generated audio is invalid.');
  return {id:generation.id,engine:generation.engine||input.engine,modelSize:generation.model_size||input.modelSize||null,sampleRate:generation.sample_rate||null,audio:buffer};
}

module.exports={ALLOWED_ENGINES,VoiceboxError,settings,generate,validProfileId};
