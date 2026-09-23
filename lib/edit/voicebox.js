const ALLOWED_ENGINES=new Set(['qwen','qwen_custom_voice','luxtts','chatterbox','chatterbox_turbo','tada','kokoro']);

class VoiceboxError extends Error {}

function validProfileId(value){return typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);}

function settings(env=process.env){
  const endpointId=env.THE_EDIT_RUNPOD_ENDPOINT_ID;
  const apiKey=env.THE_EDIT_RUNPOD_API_KEY;
  if(typeof endpointId!=='string'||!/^[a-z0-9]{6,64}$/i.test(endpointId)||typeof apiKey!=='string'||apiKey.length<16)throw new VoiceboxError('Voice rendering is not configured.');
  return {endpointId,apiKey,baseUrl:`https://api.runpod.ai/v2/${endpointId}`};
}

function headers(apiKey){return {'authorization':`Bearer ${apiKey}`,'content-type':'application/json','accept':'application/json'};}

async function run(action,input,{env=process.env,fetchImpl=fetch}={}){
  const {baseUrl,apiKey}=settings(env);
  let queued;
  try{
    const response=await fetchImpl(`${baseUrl}/run`,{method:'POST',headers:headers(apiKey),body:JSON.stringify({input:{action,...input}}),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('run');
    queued=await response.json();
  }catch{throw new VoiceboxError('Voice rendering is temporarily unavailable.');}
  if(typeof queued?.id!=='string'||queued.id.length>128)throw new VoiceboxError('Voice rendering returned an invalid job.');
  const deadline=Date.now()+210000;
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,750));
    let job;
    try{
      const response=await fetchImpl(`${baseUrl}/status/${encodeURIComponent(queued.id)}`,{headers:headers(apiKey),signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('status');
      job=await response.json();
    }catch{throw new VoiceboxError('Voice rendering is temporarily unavailable.');}
    if(job?.status==='COMPLETED'){
      if(!job.output||typeof job.output!=='object'||typeof job.output.error==='string')throw new VoiceboxError('Voice rendering failed.');
      return job.output;
    }
    if(['FAILED','CANCELLED','TIMED_OUT'].includes(job?.status))throw new VoiceboxError('Voice rendering failed.');
  }
  throw new VoiceboxError('Voice rendering timed out.');
}

function audioFrom(output){
  if(typeof output?.audio_base64!=='string'||output.audio_base64.length>24*1024*1024)throw new VoiceboxError('Generated audio is invalid.');
  let audio;try{audio=Buffer.from(output.audio_base64,'base64');}catch{throw new VoiceboxError('Generated audio is invalid.');}
  if(audio.length<44||audio.length>16*1024*1024)throw new VoiceboxError('Generated audio is invalid.');
  return audio;
}

async function generate(input,options={}){
  if(!input||!validProfileId(input.profileId)||typeof input.text!=='string'||!input.text.trim()||input.text.trim().length>220||!ALLOWED_ENGINES.has(input.engine))throw new VoiceboxError('Voice rendering request is invalid.');
  const output=await run('generate',{profile_id:input.profileId,text:input.text.trim()},options);
  const generation=output.generation;
  if(!generation||generation.profile_id!==input.profileId||typeof generation.id!=='string')throw new VoiceboxError('Voice rendering returned an invalid generation.');
  return {id:generation.id,engine:generation.engine||input.engine,modelSize:generation.model_size||input.modelSize||null,sampleRate:generation.sample_rate||null,audio:audioFrom(output)};
}

async function sexySynthetic(audio,options={}){
  if(!Buffer.isBuffer(audio)||audio.length<44||audio.length>16*1024*1024)throw new VoiceboxError('Voice transformation source is invalid.');
  return audioFrom(await run('sexy_synthetic',{audio_base64:audio.toString('base64')},options));
}

// Fire-and-forget job for long work (a whole paid order): returns the RunPod job id at once.
async function submit(action,input,{env=process.env,fetchImpl=fetch}={}){
  const {baseUrl,apiKey}=settings(env);
  const response=await fetchImpl(`${baseUrl}/run`,{method:'POST',headers:headers(apiKey),body:JSON.stringify({input:{action,...input}}),signal:AbortSignal.timeout(15000)});
  const queued=await response.json().catch(()=>null);
  if(!response.ok||typeof queued?.id!=='string'||queued.id.length>128)throw new VoiceboxError('Voice rendering is temporarily unavailable.');
  return queued.id;
}
// {status, output, error} of a submitted job; status is RunPod's (IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED…).
async function job(id,{env=process.env,fetchImpl=fetch}={}){
  const {baseUrl,apiKey}=settings(env);
  const response=await fetchImpl(`${baseUrl}/status/${encodeURIComponent(id)}`,{headers:headers(apiKey),signal:AbortSignal.timeout(15000)});
  if(response.status===404)return {status:'LOST'};
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data)throw new VoiceboxError('Voice rendering is temporarily unavailable.');
  return {status:data.status,output:data.output,error:data.error};
}

module.exports={ALLOWED_ENGINES,VoiceboxError,settings,generate,sexySynthetic,validProfileId,run,submit,job};
