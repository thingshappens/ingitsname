import {zipSync} from 'fflate';
const $=s=>document.querySelector(s);
// Keep order tokens and customer phrases out of automatic page context.
if(['atelier.hautesoundcouture.com','theedit.hautesoundcouture.com'].includes(location.hostname)){
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());
  window.gtag('set',{page_location:location.origin+'/edit/',page_referrer:''});
  window.gtag('config','AW-18419497110',{send_page_view:false});
  const tag=document.createElement('script');tag.async=true;tag.src='https://www.googletagmanager.com/gtag/js?id=AW-18419497110';document.head.append(tag);
}
const sounds={clean:['Clean As Fuck','Clean spoken vocal with just enough reverb to feel finished.','○'],dark_echo:['Dark & Echo','Low-pitched vocal with controlled echo.','◑'],sexy_robot:['Sexy Robot','Synthetic, glitchy, raspy vocal.','⌁']};
let cuts=[{style:'clean'},{style:'dark_echo'}],config={enabled:false},busy=false,previewBusy=false,previewUrl;
const savedKey='hsc-the-edit-draft';
function event(name,props={}){window.gtag?.('event',name,props);}
function key(c){return c.style;}
function description(c){return sounds[c.style][0];}
function remember(){try{sessionStorage.setItem(savedKey,JSON.stringify({phrase:$('#phrase').value,voiceId:$('#voice').value,bpm:$('#bpm').value,cuts,request}));}catch{}}
function identity(){return {requestId:crypto.randomUUID(),accessToken:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};}
let request=identity();
function previewHint(){return config.preview?'Preview mode: 100 short finished-cut previews per hour.':'Hear the finished effect before checkout.';}
function changed(){request=identity();remember();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=undefined;}const player=$('#preview-player');player.pause();player.removeAttribute('src');player.hidden=true;$('#preview-feedback').textContent=previewHint();summary();}
function summary(){
  const count=cuts.length,price=9;
  $('#summary').replaceChildren(...cuts.map(c=>{const li=document.createElement('li');li.textContent=description(c);return li;}));
  $('#summary-title').textContent='Two cuts. All yours.';
  $('#plan-name').textContent='The Edit';
  $('#price').innerHTML=`$${price}<small> USD</small>`;
  $('#checkout').textContent=`Get ${count} cuts — $${price} ↗`;
  const duplicate=new Set(cuts.map(key)).size!==count;
  $('#checkout').disabled=!config.enabled||busy||duplicate;
  $('#feedback').textContent=duplicate?'Choose two different sounds.':!config.enabled?'Orders are not open yet. Explore your selection above.':'';
}
function draw(){
  $('#slots').replaceChildren(...cuts.map((c,i)=>{
    const section=document.createElement('section');section.className='slot';
    section.innerHTML=`<div class="slot-top"><span>CUT 0${i+1}</span><span class="slot-symbol" aria-hidden="true">${sounds[c.style][2]}</span></div><label for="sound-${i}">Choose your sound</label><select id="sound-${i}">${Object.entries(sounds).map(([id,[name]])=>`<option value="${id}" ${c.style===id?'selected':''} ${cuts.some((other,j)=>j!==i&&other.style===id)?'disabled':''}>${name}</option>`).join('')}</select><p class="description">${sounds[c.style][1]}</p><button class="preview-cut" type="button" ${!config.enabled||previewBusy?'disabled':''}>Preview this cut ↗</button>`;
    section.querySelector('select').addEventListener('change',e=>{
      cuts[i]={style:e.target.value};
      event('the_edit_cut_selected',{style:cuts[i].style,slot:i+1});changed();draw();$(`#sound-${i}`).focus();
    });
    section.querySelector('.preview-cut').onclick=()=>preview(c,section.querySelector('.preview-cut'));
    return section;
  }));
  summary();
}
for(const id of ['phrase','voice','bpm'])$(`#${id}`).addEventListener('input',()=>{$('#count').textContent=`${$('#phrase').value.length} / 120`;changed();});
async function api(action,body){const r=await fetch(`/api/the-edit?action=${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Please try again.');}return r;}
async function preview(cut,button){
  if(previewBusy||!config.enabled||!$('#phrase').value.trim()||!$('#voice').value){$('#preview-feedback').textContent='Write a phrase and choose a voice first.';return;}
  previewBusy=true;button.disabled=true;
  const feedback=$('#preview-feedback'),player=$('#preview-player');feedback.textContent='Preparing your short preview…';player.hidden=true;
  try{
    const r=await api('preview',{phrase:$('#phrase').value,voiceId:$('#voice').value,bpm:Number($('#bpm').value),cut});
    if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(await r.blob());player.src=previewUrl;player.hidden=false;await player.play();
    feedback.textContent=`Previewing ${description(cut)}.`;
    event('the_edit_preview_played',{style:cut.style});
  }catch(error){feedback.textContent=error.message;}
  finally{previewBusy=false;button.disabled=false;}
}
$('#editor').onsubmit=async e=>{e.preventDefault();if(busy||!config.enabled)return;busy=true;summary();remember();try{const result=await(await api('checkout',{...request,phrase:$('#phrase').value,voiceId:$('#voice').value,bpm:Number($('#bpm').value),cuts})).json();if(!result.url){location.assign(`/edit/?order=${encodeURIComponent(result.orderId)}#access=${request.accessToken}`);return;}event('the_edit_checkout_started',{cut_count:cuts.length});location.assign(result.url);}catch(error){busy=false;summary();$('#feedback').textContent=error.message;}};
let pollTimer,orderData,orderAuth;
async function download(cutId){
  const status=$('#order-state');try{
    let blob,name;
    if(cutId==='all'){
      const files={};for(const cut of orderData.cuts){const r=await api('download',{...orderAuth,cutId:cut.id});files[cut.filename]=new Uint8Array(await r.arrayBuffer());}
      blob=new Blob([zipSync(files,{level:0})],{type:'application/zip'});name='HSC_TheEdit.zip';
    }else{const r=await api('download',{...orderAuth,cutId});blob=await r.blob();name=orderData.cuts.find(c=>c.id===cutId).filename;}
    const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);event('the_edit_downloaded',{cut_count:cutId==='all'?orderData.cuts.length:1});
  }catch(e){status.textContent=e.message;}
}
async function poll(){
  clearTimeout(pollTimer);
  try{
    orderData=await(await api('status',orderAuth)).json();
    const states={draft:'Your checkout is being prepared.',awaiting_payment:'Waiting for payment confirmation.',paid:'Payment received. Your cuts are queued.',rendering:'Payment received. We’re making your cuts.',failed:'Your payment is saved. Rendering has paused and will retry.',ready:'All your cuts are ready. Download them individually or together.'};
    $('#order-state').textContent=states[orderData.status]||'Checking your order…';$('#order-title').textContent=orderData.status==='ready'?'Your Edit has arrived.':'Making your cuts.';$('#order-number').textContent=`Order ${orderData.id}`;
    if(orderData.status==='ready'){
      if(orderData.expiresAt<Date.now()){$('#order-state').textContent='Your download link has expired. Contact HSC with your order number.';return;}
      $('#downloads').replaceChildren(...[...orderData.cuts.map(c=>({id:c.id,name:c.filename})),{id:'all',name:'Download all cuts · ZIP'}].map(c=>{const button=document.createElement('button');button.type='button';button.textContent=c.name;button.onclick=()=>download(c.id);return button;}));
      return;
    }
    pollTimer=setTimeout(poll,5000);
  }catch(e){$('#order-state').textContent=e.message;pollTimer=setTimeout(poll,15000);}
}
$('#refresh-order').onclick=poll;
async function init(){
  try{const saved=JSON.parse(sessionStorage.getItem(savedKey)||'null');if(saved&&Array.isArray(saved.cuts)&&saved.cuts.length>=2&&saved.cuts.every(c=>Object.hasOwn(sounds,c.style))){cuts=saved.cuts.slice(0,2);$('#phrase').value=String(saved.phrase||'').slice(0,120);$('#bpm').value=saved.bpm||128;if(saved.request)request=saved.request;}}
  catch{}
  draw();$('#count').textContent=`${$('#phrase').value.length} / 120`;
  const params=new URLSearchParams(location.search),access=new URLSearchParams(location.hash.slice(1)).get('access');
  if(params.get('order')&&access){orderAuth={orderId:params.get('order'),accessToken:access};$('#editor').hidden=true;$('#order').hidden=false;poll();}
  try{
    config=await(await fetch('/api/the-edit?action=config')).json();
    if(config.termsUrl){const terms=new URL(config.termsUrl);if(terms.protocol==='https:'){$('.licensing a').href=terms.href;$('#license p').textContent='Use words you have the right to use. Your purchase is subject to the linked commercial-use terms. No exclusivity over a voice or phrase is included.';}}
    $('#availability').textContent=config.enabled?(config.preview?'PREVIEW · Stripe test mode. No live orders.':''):config.message;
    $('#voice').replaceChildren(new Option(config.voices.length?'Choose your voice':'Voices are being curated',''),...config.voices.map(v=>new Option(v.name,v.id)));
    const saved=JSON.parse(sessionStorage.getItem(savedKey)||'null');if(saved?.voiceId)$('#voice').value=saved.voiceId;
    draw();
  }catch{$('#availability').textContent='The Edit is being prepared. Orders are not open yet.';$('#voice').replaceChildren(new Option('Voices are being curated',''));}
  $('#preview-feedback').textContent=previewHint();summary();event('the_edit_viewed');
}
init();
