import './style.css';
const djLayoutStyles=document.createElement('link');
djLayoutStyles.rel='stylesheet';
djLayoutStyles.href='/dj-layout.css';
document.head.append(djLayoutStyles);
const recordingStyles=document.createElement('link');
recordingStyles.rel='stylesheet';
recordingStyles.href='/voice-recording.css';
document.head.append(recordingStyles);

const $ = s => document.querySelector(s);
const track=(name,parameters={})=>{
  window.gtag?.('event',name,parameters);
  if(!window.fbq)return;
  if(name==='begin_checkout'||name==='purchase'){
    const items=parameters.items||[];
    const metaParameters={
      value:parameters.value,
      currency:parameters.currency,
      content_type:'product',
      content_ids:items.map(item=>item.item_id),
      contents:items.map(item=>({id:item.item_id,quantity:item.quantity||1,item_price:item.price}))
    };
    window.fbq('track',name==='purchase'?'Purchase':'InitiateCheckout',metaParameters);
  }
};
let audioContext;
let sourceBuffer;
let voices = [];
let activeSource;
let dispatchAudioUrl;
let recordingUrl;
let mediaRecorder;
let recordingStream;
let isOwner = false;
let isPaid = false;
let paidViaPack = false;
let currentGenerationId = null;
let generationMode = 'vocal';
let sourceMode = 'vocal';
let reverseEnabled = false;
let activeQuickStyle = 'custom';
let applyingQuickStyle = false;
let packSessionId = localStorage.getItem('hscProducerPackSession');
let packRemaining = 0;
let producerPackAvailable = false;
let producerPackCheckoutReady = false;
let checkoutReady = true;
let generationAvailable = true;
const presets = [
  {name:'Clean Reference',factor:0,clean:true},
  {name:'Lightly Processed',factor:.5},
  {name:'Your Choice',factor:1},
  {name:'Heavily Processed',factor:1.35}
];
const quickStyles = {
  vocal: [
    {key:'custom',name:'Custom'},
    {key:'dark-echo',name:'Dark Echo',pitch:-5,echo:58,phone:0,bitcrush:0,reverb:30,glitch:0,pulse:0,width:62,reverse:false,delivery:'sinister'},
    {key:'ethereal',name:'Ethereal',pitch:3,echo:34,phone:0,bitcrush:0,reverb:76,glitch:0,pulse:12,width:86,reverse:false,delivery:'seductive'},
    {key:'phone-call',name:'Phone Call',pitch:-1,echo:14,phone:86,bitcrush:5,reverb:8,glitch:0,pulse:0,width:16,reverse:false,delivery:'commanding'},
    {key:'ghost-voice',name:'Ghost Voice',pitch:-3,echo:44,phone:0,bitcrush:8,reverb:78,glitch:8,pulse:22,width:80,reverse:true,delivery:'whispered'},
    {key:'digital-breakdown',name:'Digital Breakdown',pitch:-2,echo:24,phone:0,bitcrush:62,reverb:18,glitch:72,pulse:78,width:68,reverse:false,delivery:'hype'},
    {key:'hype-drop',name:'Hype Drop',pitch:-6,echo:38,phone:0,bitcrush:12,reverb:26,glitch:8,pulse:36,width:76,reverse:false,delivery:'hype'}
  ],
  fx: [
    {key:'custom',name:'Custom'},
    {key:'cinematic-riser',name:'Cinematic Riser',pitch:0,echo:20,phone:0,bitcrush:0,reverb:74,glitch:0,pulse:24,width:88,reverse:false,fxType:'riser',fxCharacter:'cinematic'},
    {key:'dark-impact',name:'Dark Impact',pitch:-6,echo:18,phone:0,bitcrush:28,reverb:36,glitch:5,pulse:0,width:66,reverse:false,fxType:'impact',fxCharacter:'dark'},
    {key:'metallic-swoosh',name:'Metallic Swoosh',pitch:3,echo:24,phone:0,bitcrush:10,reverb:46,glitch:12,pulse:0,width:80,reverse:false,fxType:'swoosh',fxCharacter:'metallic'},
    {key:'glitch-transition',name:'Glitch Transition',pitch:-1,echo:20,phone:0,bitcrush:46,reverb:20,glitch:76,pulse:82,width:72,reverse:false,fxType:'downlifter',fxCharacter:'glitchy'},
    {key:'reverse-dream',name:'Reverse Dream',pitch:2,echo:34,phone:0,bitcrush:0,reverb:82,glitch:6,pulse:16,width:92,reverse:true,fxType:'reverse',fxCharacter:'cinematic'},
    {key:'lo-fi-drop',name:'Lo-Fi Drop',pitch:-4,echo:20,phone:0,bitcrush:66,reverb:20,glitch:22,pulse:46,width:24,reverse:false,fxType:'downlifter',fxCharacter:'dark'}
  ],
  dj: [
    {key:'custom',name:'Custom'},
    {key:'warehouse-siren',name:'Warehouse Siren',pitch:-3,echo:38,phone:0,bitcrush:12,reverb:42,glitch:8,pulse:24,width:74,reverse:false,djTool:'siren',djCharacter:'underground warehouse'},
    {key:'mainstage-airhorn',name:'Mainstage Airhorn',pitch:0,echo:24,phone:0,bitcrush:4,reverb:32,glitch:0,pulse:18,width:92,reverse:false,djTool:'airhorn',djCharacter:'festival mainstage'},
    {key:'neon-laser',name:'Neon Laser',pitch:4,echo:54,phone:0,bitcrush:26,reverb:48,glitch:22,pulse:42,width:86,reverse:false,djTool:'laser',djCharacter:'neon rave'},
    {key:'concrete-stab',name:'Concrete Stab',pitch:-5,echo:16,phone:0,bitcrush:38,reverb:22,glitch:14,pulse:68,width:58,reverse:false,djTool:'rave stab',djCharacter:'concrete basement'},
    {key:'rooftop-tag',name:'Rooftop Tag',pitch:-1,echo:30,phone:0,bitcrush:8,reverb:66,glitch:0,pulse:10,width:88,reverse:false,djTool:'dj tag',djCharacter:'luxury rooftop'}
  ]
};

const phrase = $('#phrase');
phrase.addEventListener('input',()=>$('#characters').textContent=phrase.value.length);
document.querySelectorAll('.mode-switch button').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
$('#bpm').addEventListener('input',e=>$('#resultBpm').textContent=`${e.target.value} BPM`);
const formatPitch=value=>{const n=Math.round(Number(value)*10)/10;return n===0?'0 ST':`${n>0?'+':'−'}${Math.abs(n)} ST`};
$('#pitch').addEventListener('input',e=>$('#pitchOut').textContent=formatPitch(e.target.value));
$('#echo').addEventListener('input',e=>$('#echoOut').textContent=`${e.target.value}%`);
$('#phone').addEventListener('input',e=>$('#phoneOut').textContent=Number(e.target.value)===0?'OFF':`${e.target.value}%`);
$('#bitcrush').addEventListener('input',e=>$('#bitcrushOut').textContent=Number(e.target.value)===0?'OFF':`${e.target.value}%`);
$('#reverb').addEventListener('input',e=>$('#reverbOut').textContent=Number(e.target.value)===0?'OFF':`${e.target.value}%`);
$('#glitch').addEventListener('input',e=>$('#glitchOut').textContent=Number(e.target.value)===0?'OFF':`${e.target.value}%`);
$('#pulse').addEventListener('input',e=>{const value=Number(e.target.value);$('#pulseOut').textContent=value===0?'OFF':value<35?'SMOOTH':value<70?'PULSING':'CHOPPED';});
$('#width').addEventListener('input',e=>{const value=Number(e.target.value);$('#widthOut').textContent=value===50?'NATURAL':value<50?`${50-value}% NARROWER`:`${value-50}% WIDER`;});
$('#reverse').addEventListener('click',e=>{reverseEnabled=!reverseEnabled;e.currentTarget.setAttribute('aria-pressed',String(reverseEnabled));e.currentTarget.textContent=reverseEnabled?'ON':'OFF';markQuickStyleCustom();if(sourceBuffer)renderVariations();});
$('#intensity').addEventListener('input',e=>$('#intensityOut').textContent=['CLEAN','TAILORED','DESTROYED'][e.target.value-1]);

function renderQuickStyles(){
  const styles=quickStyles[generationMode];
  $('#quickStyleOptions').innerHTML=styles.map(style=>`<button type="button" data-style="${style.key}" class="${style.key===activeQuickStyle?'active':''}">${style.name}</button>`).join('');
  $('#quickStyleOptions').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>applyQuickStyle(button.dataset.style)));
  const active=styles.find(style=>style.key===activeQuickStyle)||styles[0];
  $('#quickStyleOut').textContent=active.name.toUpperCase();
}

function markQuickStyleCustom(){
  if(applyingQuickStyle||activeQuickStyle==='custom')return;
  activeQuickStyle='custom';renderQuickStyles();
}

function updateControl(id,value){
  const control=$(`#${id}`);
  if(!control||value===undefined)return;
  control.value=String(value);
  control.dispatchEvent(new Event('input',{bubbles:true}));
}

function applyQuickStyle(key){
  const style=quickStyles[generationMode].find(item=>item.key===key);
  if(!style)return;
  activeQuickStyle=key;
  if(key!=='custom'){
    applyingQuickStyle=true;
    ['pitch','echo','phone','bitcrush','reverb','glitch','pulse','width'].forEach(id=>updateControl(id,style[id]));
    if(style.delivery)updateControl('delivery',style.delivery);
    if(style.fxType)updateControl('fxType',style.fxType);
    if(style.fxCharacter)updateControl('fxCharacter',style.fxCharacter);
    if(style.djTool)updateControl('djTool',style.djTool);
    if(style.djCharacter)updateControl('djCharacter',style.djCharacter);
    reverseEnabled=Boolean(style.reverse);
    $('#reverse').setAttribute('aria-pressed',String(reverseEnabled));
    $('#reverse').textContent=reverseEnabled?'ON':'OFF';
    applyingQuickStyle=false;
    track('quick_style_selected',{mode:generationMode,style:key});
    $('#status').textContent=generationAvailable?`${style.name} applied. Adjust anything to make it your own.`:'GENERATION TEMPORARILY UNAVAILABLE. Record Your Own Voice remains available for free processing and playback.';
  }
  renderQuickStyles();
  if(sourceBuffer)renderVariations();
}

['pitch','echo','phone','bitcrush','reverb','glitch','pulse','width','delivery','fxType','fxCharacter','djTool','djCharacter'].forEach(id=>{
  $(`#${id}`)?.addEventListener('input',()=>{markQuickStyleCustom();if(sourceBuffer)renderVariations();});
});
renderQuickStyles();

function updatePurchaseVisibility(){
  const localVoice=sourceMode==='recorded';
  $('.price').hidden=isOwner;
  $('#producerPack').hidden=isOwner||localVoice||!producerPackAvailable;
  if(!isOwner&&!isPaid&&!checkoutReady){
    $('#checkout').disabled=true;
    $('#checkout').textContent='CHECKOUT TEMPORARILY UNAVAILABLE';
  }
}

function updateGenerationAvailability(){
  const recordedReady=sourceMode==='recorded'&&sourceBuffer;
  $('#generate').disabled=!generationAvailable&&!recordedReady;
  if(!generationAvailable&&!recordedReady){
    $('#generate span').textContent='GENERATION TEMPORARILY UNAVAILABLE';
  }else{
    $('#generate span').textContent=generationMode==='vocal'?'Generate four vocal cuts':generationMode==='fx'?'Generate four FX cuts':'Generate four DJ tools';
  }
}

function setMode(mode){
  generationMode=mode;
  // A recorded take can only be regenerated from the Vocal mode. Switching to
  // FX or DJ must always return Generate to the external-generation flow.
  if(mode!=='vocal'&&sourceMode==='recorded')sourceMode=mode;
  activeQuickStyle='custom';
  document.querySelectorAll('.mode-switch button').forEach(button=>button.classList.toggle('active',button.dataset.mode===mode));
  $('#vocalFields').hidden=mode!=='vocal';$('#fxFields').hidden=mode!=='fx';$('#djFields').hidden=mode!=='dj';$('#recordVoice').hidden=mode!=='vocal';$('#phoneBlock').hidden=mode==='fx';
  $('#ideaTitle').textContent=mode==='vocal'?'The phrase':mode==='fx'?'The sound':'The direction';
  $('#designTitle').textContent=mode==='vocal'?'The performance':mode==='fx'?'The design':'The character';
  phrase.placeholder=mode==='vocal'?'Drop the bass':mode==='fx'?'Fast metallic swoosh':'Optional tag or direction';
  updateGenerationAvailability();
  $('#dispatch').hidden=true;
  renderQuickStyles();
  updatePurchaseVisibility();
  updateGenerationAvailability();
  track('atelier_mode_selected',{mode});
}

setMode('vocal');

async function loadVoices(code=''){
  $('#status').textContent='Opening the voice wardrobe…';
  try{
    const r=await fetch('/api/voices',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Connection failed');
    voices=data.voices;
    isOwner=Boolean(data.owner);
    updatePurchaseVisibility();
    $('#voice').innerHTML=voices.slice(0,30).map(v=>`<option value="${v.voice_id}">${v.name}</option>`).join('');
    updateGenerationAvailability();
    $('#status').textContent=!generationAvailable?'GENERATION TEMPORARILY UNAVAILABLE. Record Your Own Voice remains available for free processing and playback.':isOwner?`${voices.length} voices available. Owner access: unlimited WAV downloads unlocked.`:`${voices.length} voices available. The Atelier is ready.`;
    if(sourceBuffer)renderVariations();
  }catch(e){$('#status').textContent=e.message;}
}

$('#connect').addEventListener('click',()=>{
  const code=$('#accessCode').value;
  if(!code){$('#status').textContent='Enter your private owner code.';return;}
  loadVoices(code);
});

loadVoices();

async function loadAtelierConfig(){
  try{
    const r=await fetch('/api/config',{cache:'no-store'}),data=await r.json();
    if(!r.ok)return;
    generationAvailable=data.generationAvailable!==false;
    checkoutReady=data.checkoutReady!==false;
    updateGenerationAvailability();
    updatePurchaseVisibility();
    if(!data.producerPackEnabled)return;
    producerPackAvailable=true;
    producerPackCheckoutReady=Boolean(data.producerPackCheckoutReady);
    updatePurchaseVisibility();
    if(!producerPackCheckoutReady){
      $('#packCheckout').disabled=true;
      $('#packCheckout').textContent='PRODUCER PACK · CHECKOUT RESTORING';
      $('#packStatus').textContent='The 20-WAV Producer Pack is being restored. Checkout will open once its original secure endpoints are back.';
    }
    if(packSessionId)await verifyPack(packSessionId,false);
  }catch{}
}

loadAtelierConfig();

function stopRecording(){
  if(mediaRecorder?.state==='recording'){mediaRecorder.stop();return;}
  recordingStream?.getTracks().forEach(track=>track.stop());
  recordingStream=null;mediaRecorder=null;
  $('#recordVoiceButton').textContent='● RECORD A TAKE';
}

async function resampleTo48k(buffer){
  if(buffer.sampleRate===48000)return buffer;
  const offline=new OfflineAudioContext(Math.max(1,buffer.numberOfChannels),Math.ceil(buffer.duration*48000),48000);
  const source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();
  return offline.startRendering();
}

$('#recordVoiceButton').addEventListener('click',async()=>{
  if(mediaRecorder?.state==='recording'){stopRecording();return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
    $('#status').textContent='Recording is not supported in this browser. Try the latest Chrome, Safari or Edge.';
    return;
  }
  try{
    recordingStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    const chunks=[];
    mediaRecorder=new MediaRecorder(recordingStream);
    mediaRecorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data);});
    mediaRecorder.addEventListener('stop',async()=>{
      try{
        const blob=new Blob(chunks,{type:mediaRecorder?.mimeType||'audio/webm'});
        const bytes=await blob.arrayBuffer();
        audioContext ||= new AudioContext();
        sourceBuffer=await audioContext.decodeAudioData(bytes);
        sourceBuffer=await resampleTo48k(sourceBuffer);
        sourceMode='recorded';currentGenerationId=crypto.randomUUID();isPaid=false;paidViaPack=false;
        updateGenerationAvailability();
        if(recordingUrl)URL.revokeObjectURL(recordingUrl);
        recordingUrl=URL.createObjectURL(blob);
        $('#recordingPreview').src=recordingUrl;$('#recordingPreview').hidden=false;
        updatePurchaseVisibility();renderVariations();
        $('#status').textContent='Your take is ready. Shape it with the processing controls, then download 48 kHz WAVs.';
        track('local_voice_recorded',{mode:'vocal'});
      }catch(error){$('#status').textContent='Could not read that recording. Please try another take.';}
      finally{recordingStream?.getTracks().forEach(track=>track.stop());recordingStream=null;mediaRecorder=null;$('#recordVoiceButton').textContent='● RECORD A TAKE';}
    });
    mediaRecorder.start();
    $('#recordVoiceButton').textContent='■ STOP & USE TAKE';
    $('#status').textContent='Recording locally… say the tag or shout, then stop the take.';
  }catch(error){$('#status').textContent='Microphone access was not granted. Your voice is never uploaded.';stopRecording();}
});

$('#generate').addEventListener('click',async()=>{
  const button=$('#generate');
  if(sourceMode==='recorded'&&sourceBuffer){
    renderVariations();
    $('#status').textContent='Your recorded take was reprocessed with the current Atelier settings. No generation credits were used.';
    return;
  }
  const requestText=generationMode==='dj'?(phrase.value.trim()||`${$('#djTool').value} · ${$('#djCharacter').value}`):phrase.value.trim();
  if(!requestText){
    phrase.focus();
    $('#status').textContent=generationMode==='vocal'?'Write the words you want the voice to say first.':'Describe the transition effect you want to create first.';
    return;
  }
  button.disabled=true;button.querySelector('span').textContent=generationMode==='dj'?'Building the tool…':'Cutting the voice…';
  $('#status').textContent=generationMode==='vocal'?'Generating the original performance.':generationMode==='fx'?'Generating the original transition effect.':'Generating the original DJ tool.';
  try{
    const generationRequestId=crypto.randomUUID();
    const usingPack=Boolean(packSessionId&&packRemaining>0&&!isOwner);
    const r=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      code:$('#accessCode').value,text:requestText,mode:generationMode,voiceId:$('#voice').value,delivery:$('#delivery').value,
      fxType:$('#fxType').value,fxCharacter:$('#fxCharacter').value,fxDuration:$('#fxDuration').value,promptInfluence:$('#promptInfluence').value,
      djTool:$('#djTool').value,djCharacter:$('#djCharacter').value,
      ...(usingPack?{creditSessionId:packSessionId,generationRequestId}:{})
    })});
    if(!r.ok){const d=await r.json();throw new Error(d.error||'Generation failed');}
    const bytes=await r.arrayBuffer();
    audioContext ||= new AudioContext();
    sourceBuffer=await audioContext.decodeAudioData(bytes);
    currentGenerationId=crypto.randomUUID();paidViaPack=r.headers.get('x-hsc-producer-pack')==='true';isPaid=paidViaPack;sessionStorage.removeItem('hscPaidSession');
    if(paidViaPack){packRemaining=Number(r.headers.get('x-hsc-credit-remaining')||0);renderPackStatus();}
    sourceMode=generationMode;
    renderVariations();
    track('sample_generated',{mode:generationMode,bpm:Number($('#bpm').value)});
    $('#status').textContent=`Four ${generationMode==='vocal'?'vocal':generationMode==='fx'?'transition FX':'DJ tool'} cuts prepared.`;
  }catch(e){$('#status').textContent=e.message;}
  finally{button.disabled=false;button.querySelector('span').textContent=generationMode==='vocal'?'Generate four vocal cuts':generationMode==='fx'?'Generate four FX cuts':'Generate four DJ tools';}
});

function effectValues(p){
  const scale=p.clean?0:p.factor;
  const widthBase=Number($('#width').value);
  return {
    pitch:p.clean?0:Math.max(-12,Math.min(12,Number($('#pitch').value)*scale)),
    echo:p.clean?0:Math.min(100,Number($('#echo').value)*scale),
    phone:p.clean||sourceMode==='fx'?0:Math.min(100,Number($('#phone').value)*scale),
    bitcrush:p.clean?0:Math.min(100,Number($('#bitcrush').value)*scale),
    reverb:p.clean?0:Math.min(100,Number($('#reverb').value)*scale),
    glitch:p.clean?0:Math.min(100,Number($('#glitch').value)*scale),
    pulse:p.clean?0:Math.min(100,Number($('#pulse').value)*scale),
    width:p.clean?50:Math.max(0,Math.min(100,50+(widthBase-50)*scale)),
    reverse:!p.clean&&reverseEnabled,
  };
}

function renderVariations(){
  $('#empty').hidden=true;$('#variations').hidden=false;
  const canDownload=isOwner||isPaid;
  $('#variations').innerHTML=presets.map((p,i)=>{const fx=effectValues(p),shownPitch=Math.round(fx.pitch*10)/10,shownEcho=Math.round(fx.echo),shownPhone=Math.round(fx.phone),shownCrush=Math.round(fx.bitcrush),shownReverb=Math.round(fx.reverb),shownGlitch=Math.round(fx.glitch),shownPulse=Math.round(fx.pulse),shownWidth=Math.round(fx.width);return `<article class="variation"><button class="play" data-i="${i}">▶</button><div><h3>${p.name}</h3><p>${formatPitch(shownPitch)} · ${shownEcho}% ECHO · ${shownPhone}% PHONE · ${shownCrush}% CRUSH · ${shownReverb}% REVERB · ${shownGlitch}% GLITCH · ${shownPulse}% PULSE · ${shownWidth}% WIDTH${fx.reverse?' · REVERSE':''} · ${$('#bpm').value} BPM · 48 kHz WAV</p></div><div class="wave">${Array.from({length:18},(_,n)=>`<i style="height:${7+((n*13+i*9)%21)}px"></i>`).join('')}</div><button class="dispatch-cut" data-i="${i}" ${sourceMode==='vocal'?'':'hidden'}>DISPATCH</button><button class="download" data-i="${i}" ${canDownload?'':'disabled'}>${isOwner?'DOWNLOAD 48 kHz WAV · OWNER ACCESS':paidViaPack?'DOWNLOAD 48 kHz WAV · PRODUCER PACK':isPaid?'DOWNLOAD 48 kHz WAV':'48 kHz WAV · UNLOCK AFTER PAYMENT'}</button></article>`}).join('');
  document.querySelectorAll('.play').forEach(b=>b.addEventListener('click',()=>playVariation(Number(b.dataset.i),b)));
  document.querySelectorAll('.dispatch-cut').forEach(b=>b.addEventListener('click',()=>showDispatch(Number(b.dataset.i),b)));
  document.querySelectorAll('.download:not(:disabled)').forEach(b=>b.addEventListener('click',()=>downloadVariation(Number(b.dataset.i),b)));
  $('#checkout').disabled=canDownload||!checkoutReady;
  $('#checkout').textContent=isOwner?'OWNER DOWNLOADS UNLOCKED':isPaid?'PURCHASE COMPLETE · WAVS UNLOCKED':checkoutReady?'UNLOCK 4 WAV FILES · $9':'CHECKOUT TEMPORARILY UNAVAILABLE';
  if(producerPackAvailable&&!isOwner&&packRemaining<=0)$('#packCheckout').textContent=packPurchaseLabel();
}

async function showDispatch(index,button){
  if(!sourceBuffer||sourceMode!=='vocal')return;
  const original=button.textContent;button.disabled=true;button.textContent='PREPARING…';
  try{
    const p=presets[index],fx=effectValues(p),rate=Math.pow(2,fx.pitch/12),delayTime=60/Number($('#bpm').value),feedback=Math.min(.72,fx.echo/120);
    const echoTail=feedback>0?Math.min(8,delayTime*Math.ceil(Math.log(.001)/Math.log(feedback))):0;
    const reverbTail=fx.reverb>0?.35+Math.pow(fx.reverb/100,.7)*4.65:0;
    const duration=sourceBuffer.duration/rate+Math.max(echoTail,reverbTail)+.08;
    const offline=new OfflineAudioContext(Math.max(2,sourceBuffer.numberOfChannels),Math.ceil(duration*sourceBuffer.sampleRate),sourceBuffer.sampleRate);
    const master=offline.createGain(),src=offline.createBufferSource();master.connect(offline.destination);master.gain.setValueAtTime(1,Math.max(0,duration-.04));master.gain.linearRampToValueAtTime(0,duration);
    src.buffer=prepareSourceBuffer(offline,sourceBuffer,p);connectTreatment(offline,src,p,master);src.start();
    const rendered=await offline.startRendering();
    if(dispatchAudioUrl)URL.revokeObjectURL(dispatchAudioUrl);
    dispatchAudioUrl=URL.createObjectURL(audioBufferToWav(rendered));
    const text=phrase.value.trim()||'Drop the bass',bpm=$('#bpm').value||128,style=p.name;
    $('#dispatchPhrase').textContent=text.toUpperCase();$('#dispatchMeta').textContent=`${bpm} BPM · ${style.toUpperCase()} · 48 kHz WAV`;
    $('#dispatchAudio').src=dispatchAudioUrl;
    $('#dispatchReels').textContent=`“${text}” · ${style}. Four vocal cuts. One idea. #HauteSoundCouture #Producer`;
    $('#dispatchTikTok').textContent=`Built in the Atelier: ${style} vocal cut at ${bpm} BPM.`;
    $('#dispatchShorts').textContent=`One phrase. One ${style.toLowerCase()} treatment. Made for the drop.`;
    $('#dispatch').hidden=false;$('#dispatch').scrollIntoView({behavior:'smooth',block:'nearest'});
    track('dispatch_cut_selected',{cut:p.name,bpm:Number(bpm)});$('#status').textContent=`${p.name} prepared for Atelier Dispatch.`;
  }catch(e){$('#status').textContent=`Dispatch preview failed: ${e.message}`;}
  finally{button.disabled=false;button.textContent=original;}
}

async function verifyCheckout(sessionId){
  try{
    const r=await fetch(`/api/checkout-status?session_id=${encodeURIComponent(sessionId)}`,{cache:'no-store'}),data=await r.json();
    if(r.ok&&data.paid&&currentGenerationId&&data.generationId===currentGenerationId){
      isPaid=true;sessionStorage.setItem('hscPaidSession',sessionId);renderVariations();
      track('purchase',{transaction_id:sessionId,value:9,currency:'USD',items:[{item_id:'hsc_sample_atelier_four_cuts',item_name:'Four Custom WAV Cuts',price:9,quantity:1}]});
      $('#status').textContent=`Payment confirmed${data.email?` for ${data.email}`:''}. All four WAV downloads are unlocked.`;
      return true;
    }
  }catch{}
  return false;
}

function renderPackStatus(){
  if(!$('#producerPack')||$('#producerPack').hidden)return;
  $('#packStatus').textContent=packRemaining>0?`${packRemaining} of 5 fittings remaining. Your next generation will use one fitting.`:'Producer Pack used. All five fittings have been created.';
  $('#packCheckout').textContent=packRemaining>0?'PRODUCER PACK ACTIVE · 20 WAV FILES':packPurchaseLabel();
  $('#packCheckout').disabled=packRemaining>0;
}

function packPurchaseLabel(){
  return sourceBuffer?'UNLOCK THESE + 16 MORE WAV FILES · $39':'CREATE 20 WAV FILES · $39';
}

async function verifyPack(sessionId,announce=true){
  try{
    const r=await fetch(`/api/pack-status?session_id=${encodeURIComponent(sessionId)}`,{cache:'no-store'}),data=await r.json();
    if(!r.ok||!data.paid)return false;
    packSessionId=sessionId;packRemaining=Number(data.remaining||0);localStorage.setItem('hscProducerPackSession',sessionId);renderPackStatus();
    if(data.generationId&&data.generationId===currentGenerationId&&sourceBuffer){isPaid=true;paidViaPack=true;renderVariations();}
    if(announce){track('purchase',{transaction_id:sessionId,value:39,currency:'USD',items:[{item_id:'hsc_sample_atelier_producer_pack',item_name:'Producer Pack — 20 WAV Files',price:39,quantity:1}]});$('#status').textContent=`Producer Pack confirmed${data.email?` for ${data.email}`:''}. Your current four WAV files are unlocked and ${packRemaining} fittings remain.`;}
    return true;
  }catch{return false;}
}

window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.data?.type!=='hsc-checkout-success')return;
  const sessionId=String(event.data.sessionId||'');verifyPack(sessionId).then(ok=>{if(!ok)verifyCheckout(sessionId);});
});

$('#packCheckout').addEventListener('click',async()=>{
  if(packRemaining>0)return;
  if(!sourceBuffer){
    phrase.scrollIntoView({behavior:'smooth',block:'center'});
    phrase.focus();
    $('#status').textContent='Create and preview your first four cuts before choosing the 20 WAV Producer Pack.';
    return;
  }
  const popup=window.open('about:blank','hscPackCheckout');
  $('#packCheckout').disabled=true;$('#packCheckout').textContent='OPENING SECURE CHECKOUT…';
  try{
    const r=await fetch('/api/create-checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan:'producer_pack',generationId:currentGenerationId})}),data=await r.json();
    if(!r.ok)throw new Error(data.error||'Could not start Producer Pack checkout');
    track('begin_checkout',{currency:'USD',value:39,items:[{item_id:'hsc_sample_atelier_producer_pack',item_name:'Producer Pack — 20 WAV Files',price:39,quantity:1}]});
    if(popup)popup.location=data.url;else window.location.href=data.url;
    $('#packCheckout').textContent='WAITING FOR PAYMENT…';
    const started=Date.now(),timer=setInterval(async()=>{
      if(popup?.closed||await verifyPack(data.id)||Date.now()-started>10*60*1000){
        clearInterval(timer);
        if(!packRemaining){$('#packCheckout').disabled=false;$('#packCheckout').textContent=packPurchaseLabel();}
      }
    },2500);
  }catch(e){if(popup)popup.close();$('#status').textContent=e.message;$('#packCheckout').disabled=false;$('#packCheckout').textContent=packPurchaseLabel();}
});

$('#checkout').addEventListener('click',async()=>{
  if(isOwner||isPaid)return;
  if(!checkoutReady){
    $('#status').textContent='Checkout is temporarily unavailable while the secure payment connection is restored.';
    return;
  }
  if(!sourceBuffer){
    phrase.scrollIntoView({behavior:'smooth',block:'center'});
    phrase.focus();
    $('#status').textContent='Create your four cuts first — then unlock every WAV for $9.';
    return;
  }
  const popup=window.open('about:blank','hscCheckout');
  $('#checkout').disabled=true;$('#checkout').textContent='OPENING SECURE CHECKOUT…';
  try{
    const r=await fetch('/api/create-checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({generationId:currentGenerationId})}),data=await r.json();
    if(!r.ok)throw new Error(data.error||'Could not start checkout');
    track('begin_checkout',{currency:'USD',value:9,items:[{item_id:'hsc_sample_atelier_four_cuts',item_name:'Four Custom WAV Cuts',price:9,quantity:1}]});
    if(popup)popup.location=data.url;else window.location.href=data.url;
    $('#checkout').textContent='WAITING FOR PAYMENT…';
    const started=Date.now();
    const timer=setInterval(async()=>{
      if(popup?.closed||await verifyCheckout(data.id)||Date.now()-started>10*60*1000){clearInterval(timer);if(!isPaid){$('#checkout').disabled=false;$('#checkout').textContent='UNLOCK 4 WAV FILES · $9';}}
    },2500);
  }catch(e){if(popup)popup.close();$('#status').textContent=e.message;$('#checkout').disabled=false;$('#checkout').textContent='UNLOCK 4 WAV FILES · $9';}
});

const returnedSession=sessionStorage.getItem('hscPaidSession');
if(returnedSession&&currentGenerationId)verifyCheckout(returnedSession);

const checkoutParams=new URLSearchParams(window.location.search);
const checkoutSession=checkoutParams.get('session_id');
if(checkoutParams.get('checkout')==='success'&&checkoutSession?.startsWith('cs_')&&window.opener&&!window.opener.closed){
  window.opener.postMessage({type:'hsc-checkout-success',sessionId:checkoutSession},window.location.origin);
  $('#status').textContent='Payment received. Unlocking the WAV files in your original Atelier tab…';
}

function prepareSourceBuffer(context,buffer,p){
  const fx=effectValues(p);
  if(!fx.reverse&&fx.glitch===0)return buffer;
  const output=context.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);
  const glitchAmount=fx.glitch===0?0:Math.pow(fx.glitch/100,.62);
  const beatSamples=Math.max(128,Math.round(buffer.sampleRate*(60/Number($('#bpm').value))/4));
  const affectedEvery=Math.max(1,Math.round(6-glitchAmount*5));
  const chopDivisions=2+Math.floor(glitchAmount*6);
  const chopSamples=Math.max(64,Math.floor(beatSamples/chopDivisions));
  for(let channel=0;channel<buffer.numberOfChannels;channel++){
    const input=buffer.getChannelData(channel),out=output.getChannelData(channel);
    for(let i=0;i<buffer.length;i++){
      let timelineIndex=i,gain=1;
      if(glitchAmount>0){
        const block=Math.floor(i/beatSamples),local=i%beatSamples;
        if(block%affectedEvery===affectedEvery-1){
          timelineIndex=block*beatSamples+(local%chopSamples);
          const edge=local%chopSamples;
          const fadeSamples=Math.min(96,Math.floor(chopSamples/8));
          if(edge<fadeSamples)gain=edge/fadeSamples;
          if(glitchAmount>.55&&local>beatSamples*(1-glitchAmount*.18))gain*=.08;
        }
      }
      const sourceIndex=fx.reverse?buffer.length-1-Math.min(buffer.length-1,timelineIndex):Math.min(buffer.length-1,timelineIndex);
      out[i]=input[sourceIndex]*gain;
    }
  }
  return output;
}

function createReverbImpulse(context,amount){
  const seconds=.35+Math.pow(amount,.7)*4.65;
  const length=Math.max(1,Math.round(context.sampleRate*seconds));
  const impulse=context.createBuffer(2,length,context.sampleRate);
  for(let channel=0;channel<2;channel++){
    const data=impulse.getChannelData(channel);let seed=1234567+channel*891;
    for(let i=0;i<length;i++){
      seed=(seed*16807)%2147483647;
      const noise=seed/1073741823.5-1;
      data[i]=noise*Math.pow(1-i/length,1.25+amount*2.2);
    }
  }
  return impulse;
}

function connectWidth(context,input,destination,widthValue){
  const output=context.createGain();output.gain.value=.88;output.connect(destination);
  const direct=context.createGain(),distance=(widthValue-50)/50;
  input.connect(direct);direct.connect(output);
  if(distance<=0){
    direct.gain.value=Math.max(0,widthValue/50);
    const mono=context.createGain();mono.channelCount=1;mono.channelCountMode='explicit';mono.gain.value=1-direct.gain.value;
    input.connect(mono);mono.connect(output);
    return;
  }
  direct.gain.value=1-distance*.16;
  const leftDelay=context.createDelay(.05),rightDelay=context.createDelay(.05),leftPan=context.createStereoPanner(),rightPan=context.createStereoPanner(),leftGain=context.createGain(),rightGain=context.createGain();
  leftDelay.delayTime.value=.004+distance*.008;rightDelay.delayTime.value=.009+distance*.012;
  leftPan.pan.value=-1;rightPan.pan.value=1;leftGain.gain.value=distance*.28;rightGain.gain.value=distance*.28;
  input.connect(leftDelay);leftDelay.connect(leftGain);leftGain.connect(leftPan);leftPan.connect(output);
  input.connect(rightDelay);rightDelay.connect(rightGain);rightGain.connect(rightPan);rightPan.connect(output);
}

function connectPulseGate(context,input,output,amount,duration){
  if(amount<=0){input.connect(output);return;}
  const control=amount/100,depth=Math.pow(control,.72),sharpness=Math.pow(control,1.35);
  const gate=context.createGain(),modulation=context.createGain(),oscillator=context.createOscillator();
  const real=new Float32Array(18),imaginary=new Float32Array(18);
  imaginary[1]=1;
  for(let harmonic=3;harmonic<imaginary.length;harmonic+=2)imaginary[harmonic]=sharpness/harmonic;
  oscillator.setPeriodicWave(context.createPeriodicWave(real,imaginary,{disableNormalization:false}));
  oscillator.frequency.value=Math.max(1,Number($('#bpm').value)||128)/30;
  gate.gain.value=1-depth/2;modulation.gain.value=depth/2;
  oscillator.connect(modulation);modulation.connect(gate.gain);
  input.connect(gate);gate.connect(output);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime+duration+.1);
}

function connectTreatment(context,src,p,destination){
  const fx=effectValues(p),envelope=context.createGain(),crushDry=context.createGain(),crushWet=context.createGain(),crusher=context.createWaveShaper(),crushBus=context.createGain(),dry=context.createGain(),phoneWet=context.createGain(),highpass=context.createBiquadFilter(),lowpass=context.createBiquadFilter(),bus=context.createGain(),pulseBus=context.createGain(),spatialBus=context.createGain(),delay=context.createDelay(3),feedback=context.createGain(),echoWet=context.createGain();
  const phoneControl=fx.phone/100,crushControl=fx.bitcrush/100;
  // The old low exponent made tiny values disproportionately strong: 5–8% of
  // Bitcrush could become a 30% wet signal. Keep the deliberately destroyed
  // settings characterful, but make the subtle end of the controls genuinely subtle.
  const phoneAmount=phoneControl===0?0:Math.pow(phoneControl,1.15),crushAmount=crushControl===0?0:Math.pow(crushControl,1.25);
  src.playbackRate.value=Math.pow(2,fx.pitch/12);
  delay.delayTime.value=60/Number($('#bpm').value);
  feedback.gain.value=Math.min(.72,fx.echo/120);echoWet.gain.value=Math.min(.8,fx.echo/100);
  dry.gain.value=1-phoneAmount;phoneWet.gain.value=phoneAmount;
  crushDry.gain.value=1-crushAmount;crushWet.gain.value=crushAmount;
  const bits=16-crushAmount*13,levels=Math.pow(2,bits-1),curve=new Float32Array(65536);
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.round(x*levels)/levels;}
  crusher.curve=curve;crusher.oversample='4x';
  highpass.type='highpass';highpass.frequency.value=100+phoneAmount*900;
  lowpass.type='lowpass';lowpass.frequency.value=12000-phoneAmount*9500;
  const now=context.currentTime,sourceDuration=src.buffer.duration/src.playbackRate.value,fadeIn=Math.min(.006,sourceDuration/4),fadeOut=Math.min(.025,sourceDuration/4);
  envelope.gain.setValueAtTime(0,now);envelope.gain.linearRampToValueAtTime(1,now+fadeIn);envelope.gain.setValueAtTime(1,Math.max(now+fadeIn,now+sourceDuration-fadeOut));envelope.gain.linearRampToValueAtTime(0,now+sourceDuration);
  src.connect(envelope);envelope.connect(crushDry);crushDry.connect(crushBus);envelope.connect(crusher);crusher.connect(crushWet);crushWet.connect(crushBus);
  crushBus.connect(dry);dry.connect(bus);crushBus.connect(highpass);highpass.connect(lowpass);lowpass.connect(phoneWet);phoneWet.connect(bus);
  connectPulseGate(context,bus,pulseBus,fx.pulse,sourceDuration);
  pulseBus.connect(spatialBus);pulseBus.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(echoWet);echoWet.connect(spatialBus);
  if(fx.reverb>0){
    const reverbAmount=Math.pow(fx.reverb/100,.65),convolver=context.createConvolver(),reverbWet=context.createGain();
    convolver.buffer=createReverbImpulse(context,reverbAmount);reverbWet.gain.value=Math.min(.78,reverbAmount*.72);
    pulseBus.connect(convolver);convolver.connect(reverbWet);reverbWet.connect(spatialBus);
  }
  // Echo and convolution reverb can sum above 0 dBFS. A transparent final
  // safety stage prevents the small digital crackles that clipping creates.
  const outputGain=context.createGain(),limiter=context.createDynamicsCompressor();
  outputGain.gain.value=.9;
  limiter.threshold.value=-2.5;limiter.knee.value=5;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.12;
  outputGain.connect(limiter);limiter.connect(destination);
  connectWidth(context,spatialBus,outputGain,fx.width);
  return {rate:src.playbackRate.value,fx};
}

function playVariation(index,button){
  if(!sourceBuffer)return;
  audioContext ||= new AudioContext();
  if(activeSource){try{activeSource.stop()}catch{}}
  document.querySelectorAll('.play').forEach(b=>b.textContent='▶');
  const p=presets[index],src=audioContext.createBufferSource();
  src.buffer=prepareSourceBuffer(audioContext,sourceBuffer,p);connectTreatment(audioContext,src,p,audioContext.destination);
  src.start();activeSource=src;button.textContent='■';src.onended=()=>button.textContent='▶';
}

async function downloadVariation(index,button){
  if(!sourceBuffer||(!isOwner&&!isPaid))return;
  const original=button.textContent;button.disabled=true;button.textContent='RENDERING WAV…';
  try{
    const p=presets[index],fx=effectValues(p),rate=Math.pow(2,fx.pitch/12);
    const delayTime=60/Number($('#bpm').value),feedback=Math.min(.72,fx.echo/120);
    const echoTail=feedback>0?Math.min(8,delayTime*Math.ceil(Math.log(.001)/Math.log(feedback))):0;
    const reverbTail=fx.reverb>0?.35+Math.pow(fx.reverb/100,.7)*4.65:0;
    const duration=sourceBuffer.duration/rate+Math.max(echoTail,reverbTail)+.08;
    const offline=new OfflineAudioContext(Math.max(2,sourceBuffer.numberOfChannels),Math.ceil(duration*sourceBuffer.sampleRate),sourceBuffer.sampleRate);
    const master=offline.createGain(),src=offline.createBufferSource();master.connect(offline.destination);master.gain.setValueAtTime(1,Math.max(0,duration-.04));master.gain.linearRampToValueAtTime(0,duration);
    src.buffer=prepareSourceBuffer(offline,sourceBuffer,p);connectTreatment(offline,src,p,master);src.start();
    const rendered=await offline.startRendering(),blob=audioBufferToWav(rendered),url=URL.createObjectURL(blob),a=document.createElement('a');
    const phraseName=phrase.value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'hsc-vocal';
    a.href=url;a.download=`${phraseName}-${p.name.toLowerCase().replace(/\s+/g,'-')}.wav`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('#status').textContent=`${p.name} downloaded as a 48 kHz WAV.`;
  }catch(e){$('#status').textContent=`WAV export failed: ${e.message}`;}
  finally{button.disabled=false;button.textContent=original;}
}

function audioBufferToWav(buffer){
  const channels=buffer.numberOfChannels,samples=buffer.length,bytesPerSample=2,dataSize=samples*channels*bytesPerSample,array=new ArrayBuffer(44+dataSize),view=new DataView(array);
  const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+dataSize,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*bytesPerSample,true);view.setUint16(32,channels*bytesPerSample,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,dataSize,true);
  const channelData=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let offset=44;
  for(let i=0;i<samples;i++)for(let c=0;c<channels;c++){const sample=Math.max(-1,Math.min(1,channelData[c][i]));view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);offset+=2;}
  return new Blob([array],{type:'audio/wav'});
}
