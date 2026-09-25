// Runs the live preview handler with the site's settings and prints the real error. Changes nothing.
const bulk=JSON.parse(process.env.BULK||'{}');
for(const [k,v] of Object.entries(bulk))if(!(k in process.env))process.env[k]=String(v);
Object.assign(process.env,{THE_EDIT_RUNPOD_API_KEY:process.env.RP||process.env.THE_EDIT_RUNPOD_API_KEY,VERCEL_ENV:'production',THE_EDIT_ORIGIN:'https://hautesoundcouture.com/',THE_EDIT_REMOTE_RENDER:'1',THE_EDIT_REMOTE_FULFIL:'1'});
console.log('have: runpod endpoint',!!process.env.THE_EDIT_RUNPOD_ENDPOINT_ID,'runpod key',!!process.env.THE_EDIT_RUNPOD_API_KEY,'upstash',!!(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL));
const vb=require('../lib/edit/voicebox');const orig=vb.run;
vb.run=async(a,i)=>{try{const o=await orig(a,i);console.log('run ok',JSON.stringify(o).slice(0,600));return o;}catch(e){console.log('run threw',e.name,e.message);throw e;}};
const h=require('../api/the-edit.js');
const res={statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.statusCode=c;return this},json(b){console.log('response',this.statusCode,JSON.stringify(b));},send(b){console.log('response',this.statusCode,'bytes',b.length,this.headers['Content-Type']);}};
const origErr=console.error;
(async()=>{
  const req={method:'POST',query:{action:'preview'},headers:{origin:'https://hautesoundcouture.com',host:'hautesoundcouture.com','x-forwarded-for':'diag-'+Date.now()},body:{phrase:'Make the room move.',voiceId:'monsieur_lousive',bpm:128,cut:{style:'flat_tag'}}};
  const store=require('../lib/edit/store');const oa=store.audio;store.audio=async(r)=>{try{return await oa(r)}catch(e){console.log('store.audio threw',e.message,JSON.stringify(r));throw e}};
  await h(req,res);
})();
