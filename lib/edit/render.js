const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const {VERSION}=require('./model');
const SR=48000;
function binary(){return process.env.THE_EDIT_FFMPEG_PATH||require('ffmpeg-static');}
async function ff(args){return run(binary(),['-hide_banner','-nostdin','-y',...args],{timeout:45000,maxBuffer:1024*1024});}
function pcmFloats(pcm){
  if(!pcm.length||pcm.length%2||pcm.length>SR*2*25)throw new Error('Invalid source length');
  return Float32Array.from({length:pcm.length/2},(_,i)=>pcm.readInt16LE(i*2)/32768);
}
function floatBytes(samples){const b=Buffer.alloc(samples.length*4);samples.forEach((v,i)=>b.writeFloatLE(v,i*4));return b;}
function gate(samples,bpm,groove,amount){
  // One, one-and-a-half and two cuts per beat leave room for the vocal phrase.
  const cycle=SR*60/bpm/({straight:1,triplet:1.5,double:2}[groove]);
  const on=cycle*(amount==='half'?.5:.2),edge=Math.min(SR*.0015,on/8);
  return Float32Array.from(samples,(v,i)=>{const phase=i%cycle;return v*(phase<on?Math.max(0,Math.min(1,phase/edge,(on-phase)/edge)):0);});
}
function robot(samples,bpm){
  // Fixed adaptation of Atelier's Glitch: short, tempo-locked source repeats
  // at deliberate intervals, without the unrelated bitcrusher character.
  const glitchAmount=.68;
  const beat=Math.max(128,Math.round(SR*60/bpm/4));
  const affectedEvery=Math.max(1,Math.round(6-glitchAmount*5));
  const chopDivisions=2+Math.floor(glitchAmount*6);
  const slice=Math.max(64,Math.floor(beat/chopDivisions));
  return Float32Array.from(samples,(v,i)=>{
    const block=Math.floor(i/beat),local=i%beat;
    if(block%affectedEvery!==affectedEvery-1)return v;
    const edge=local%slice,fade=Math.min(96,Math.floor(slice/8));
    const gain=(edge<fade?edge/fade:1)*(local>beat*(1-glitchAmount*.18)?.08:1);
    const idx=Math.min(samples.length-1,block*beat+edge);
    return samples[idx]*gain;
  });
}
function hasSibilance(samples){let high=0,total=0,prev=0;for(const v of samples){high+=(v-prev)**2;total+=v*v;prev=v;}return total>0&&high/total>.38;}
function filters(c,order,samples){
  let style=[];
  if(c.style==='clean')style=['aecho=0.95:1:27|43|71:0.065|0.045|0.025'];
  if(c.style==='dark_echo'){
    const pitch={low:-1,mid:-2.5,bright:-4}[order.voiceRange],rate=2**(pitch/12),delay=60000/order.bpm*.75;
    style=[`asetrate=${SR*rate}`,`aresample=${SR}`,`atempo=${1/rate}`,`asplit=2[lead][repeat];[repeat]lowpass=f=3200,aecho=0.8:0.65:${delay}|${delay*2}|${delay*3}:0.28|0.12|0.05[echo];[lead][echo]amix=inputs=2:normalize=0`];
  }
  if(c.style==='sexy_robot'){
    const pitch={low:-1,mid:-2,bright:-3}[order.voiceRange],rate=2**(pitch/12),delay=60000/order.bpm*.5;
    style=[`asetrate=${SR*rate}`,`aresample=${SR}`,`atempo=${1/rate}`,`aecho=0.8:0.5:${delay}:0.16`,'lowpass=f=10200'];
  }
  const duration=samples.length/SR+(c.style==='clean'?.071:c.style==='dark_echo'?60/order.bpm*2.25:c.style==='sexy_robot'?60/order.bpm*.5:0);
  return ['highpass=f=65',...(hasSibilance(samples)?['deesser=i=0.15:m=0.35:f=0.5']:[]),...style,'acompressor=threshold=0.12:ratio=2:attack=8:release=100:makeup=1.25',`afade=t=out:st=${Math.max(0,duration-.012)}:d=0.012`].join(',');
}
async function measure(file){
  const {stderr}=await ff(['-i',file,'-af','loudnorm=I=-18:TP=-1:LRA=7:print_format=json','-f','null','-']);
  const data=JSON.parse(stderr.slice(stderr.lastIndexOf('{'),stderr.lastIndexOf('}')+1));
  const result={lufs:Number(data.input_i),truePeak:Number(data.input_tp)};
  if(!Number.isFinite(result.truePeak))throw new Error('Silent or invalid render');
  return result;
}
async function render(pcm,cut,order){
  if(cut.recipeVersion!==VERSION)throw new Error('Unavailable recipe version');
  let samples=pcmFloats(pcm);
  if(cut.style==='chopped_up')samples=gate(samples,order.bpm,cut.groove,cut.cutAmount);
  if(cut.style==='sexy_robot')samples=robot(samples,order.bpm);
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hsc-edit-'));
  try{
    const input=path.join(dir,'source.f32'),effect=path.join(dir,'effect.wav'),output=path.join(dir,'cut.wav');
    await fs.writeFile(input,floatBytes(samples));
    await ff(['-f','f32le','-ar',String(SR),'-ac','1','-i',input,'-filter_complex',filters(cut,order,samples),'-ar',String(SR),'-c:a','pcm_f32le',effect]);
    const stats=await measure(effect);
    // Constant gain preserves chopped silence and the phrase envelope. Oversampled
    // loudnorm protects peaks; a second measurement checks the actual 48 kHz WAV.
    const gain=Math.min(12,-18-(Number.isFinite(stats.lufs)?stats.lufs:-18),-1.5-stats.truePeak);
    await ff(['-i',effect,'-af',`volume=${gain}dB,aresample=192000,alimiter=limit=0.84:attack=5:release=50:level=false:latency=true,aresample=48000`,'-ar',String(SR),'-c:a','pcm_s24le',output]);
    let final=await measure(output);
    if(final.truePeak> -1.05){
      const safer=path.join(dir,'safe.wav');
      await ff(['-i',output,'-af',`volume=${-1.2-final.truePeak}dB`,'-c:a','pcm_s24le',safer]);
      await fs.rename(safer,output);final=await measure(output);
    }
    if(final.truePeak> -1)throw new Error('Audio peak check failed');
    return {buffer:await fs.readFile(output),metrics:final};
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
async function generate(order){
  const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(order.voiceId)}?output_format=pcm_48000`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify({text:order.phrase,model_id:'eleven_v3'}),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Voice generation unavailable');
  const pcm=Buffer.from(await response.arrayBuffer());pcmFloats(pcm);return pcm;
}
module.exports={SR,gate,robot,pcmFloats,filters,render,generate,measure};
