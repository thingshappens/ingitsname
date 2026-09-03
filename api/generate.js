const Stripe=require('stripe');
const {isCreditStoreConfigured,ensureCreditPack,reserveCredit,releaseCredit}=require('../lib/credits');
const {isOwner}=require('../lib/owner');
const deliveries={commanding:'[commanding]',sinister:'[low and sinister]',whispered:'[whispers]',hype:'[shouts]',seductive:'[softly]',calm:'[calm]'};
const attempts=new Map();
const pcm48ToWav=(pcm)=>{
  const data=Buffer.from(pcm),sampleRate=48000,channels=1,bitsPerSample=16,blockAlign=channels*bitsPerSample/8,byteRate=sampleRate*blockAlign;
  const header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(channels,22);header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(byteRate,28);header.writeUInt16LE(blockAlign,32);header.writeUInt16LE(bitsPerSample,34);header.write('data',36);header.writeUInt32LE(data.length,40);
  return Buffer.concat([header,data]);
};

module.exports=async function(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(process.env.EXTERNAL_GENERATION_ENABLED==='false')return res.status(503).json({error:'Generation temporarily unavailable'});
  if(!process.env.ELEVENLABS_API_KEY)return res.status(503).json({error:'Voice engine is not connected yet'});
  const {code,text,voiceId,delivery,mode,fxType,fxCharacter,fxDuration,promptInfluence,djTool,djCharacter,creditSessionId,generationRequestId}=req.body||{};
  const owner=isOwner(req,code);
  if(!text||text.length>120)return res.status(400).json({error:'Describe what you want to create'});
  let creditReservation=null;
  if(!owner&&creditSessionId){
    if(process.env.PRODUCER_PACK_ENABLED==='false'||!isCreditStoreConfigured()||!process.env.STRIPE_SECRET_KEY)return res.status(503).json({error:'Producer Pack is not available yet'});
    try{
      const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
      const session=await stripe.checkout.sessions.retrieve(String(creditSessionId));
      const valid=session.payment_status==='paid'&&session.metadata?.product_key==='hsc_sample_atelier_producer_pack';
      if(!valid)return res.status(403).json({error:'This Producer Pack is not valid'});
      await ensureCreditPack(session);
      creditReservation=await reserveCredit(session.id,generationRequestId);
      if(!creditReservation.allowed)return res.status(402).json({error:'This Producer Pack has no fittings remaining',remaining:0});
    }catch(error){return res.status(403).json({error:error.message==='Invalid generation request'?error.message:'Could not verify this Producer Pack'});}
  }
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const now=Date.now(),windowMs=60*60*1000,entry=attempts.get(ip);
  const usage=!entry||now-entry.started>windowMs?{started:now,count:0}:entry;
  if(!owner&&!creditReservation&&usage.count>=12)return res.status(429).json({error:'You have reached the preview limit. Please try again later.'});
  if(!owner&&!creditReservation){usage.count+=1;attempts.set(ip,usage);}
  const release=async()=>{if(creditReservation&&!creditReservation.retry)await releaseCredit(String(creditSessionId),String(generationRequestId)).catch(()=>{});};
  const sendAudio=(pcm)=>{
    if(creditReservation){res.setHeader('x-hsc-credit-remaining',String(creditReservation.remaining));res.setHeader('x-hsc-producer-pack','true');}
    res.setHeader('content-type','audio/wav');res.setHeader('cache-control','no-store');return res.status(200).send(pcm48ToWav(pcm));
  };
  try{
    if(mode==='fx'||mode==='dj'){
      const prompt=mode==='dj'
        ?`${djCharacter||'underground warehouse'} ${djTool||'DJ tool'} one-shot for a DJ set and music production. ${String(text).trim()}`
        :`${fxCharacter||'clean'} ${fxType||'swoosh'} transition sound effect for music production. ${String(text).trim()}`;
      const payload={text:prompt,model_id:'eleven_text_to_sound_v2',prompt_influence:Math.max(0,Math.min(1,Number(promptInfluence)||.5))};
      if(fxDuration)payload.duration_seconds=Math.max(.5,Math.min(30,Number(fxDuration)));
      const sound=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_48000',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify(payload)});
      if(!sound.ok){const data=await sound.json().catch(()=>({}));await release();return res.status(502).json({error:data.detail?.message||'Sound effect generation failed'});}
      const bytes=Buffer.from(await sound.arrayBuffer());return sendAudio(bytes);
    }
    if(!voiceId){await release();return res.status(400).json({error:'Select a voice'});}
    const prompt=`${deliveries[delivery]||deliveries.commanding} ${String(text).trim()}`;
    const voice=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_48000`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'content-type':'application/json'},body:JSON.stringify({text:prompt,model_id:'eleven_v3'})});
    if(!voice.ok){const data=await voice.json().catch(()=>({}));await release();return res.status(502).json({error:data.detail?.message||'Voice generation failed'});}
    return sendAudio(Buffer.from(await voice.arrayBuffer()));
  }catch(error){
    await release();return res.status(502).json({error:'The sound engine did not respond. Your fitting was not charged.'});
  }
};
