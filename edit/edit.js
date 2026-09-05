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
const sounds={clean:['Clean As Fuck','Clean spoken vocal with just enough reverb to feel finished.','○'],dark_echo:['Dark & Echo','Low-pitched vocal with controlled echo.','◑'],sexy_robot:['Sexy Robot','Synthetic, glitchy, raspy vocal.','⌁'],chopped_up:['Chopped Up','Your phrase, cut into a steady vocal rhythm.','≋']};
const grooves={straight:'Straight Beat',triplet:'Groovy Triplet',double:'Double Chop'},amounts={half:'Half Chopped',small:'Small Cuts'};
let cuts=[{style:'clean'},{style:'dark_echo'}],config={enabled:false},busy=false,previewBusy=false,previewUrl;
const savedKey='hsc-the-edit-draft';
function event(name,props={}){window.gtag?.('event',name,props);}
function key(c){return c.style==='chopped_up'?`${c.style}:${c.groove}:${c.cutAmount}`:c.style;}
function description(c){return sounds[c.style][0]+(c.style==='chopped_up'?` · ${grooves[c.groove]} · ${amounts[c.cutAmount]}`:'');}
function remember(){try{sessionStorage.setItem(savedKey,JSON.stringify({phrase:$('#phrase').value,voiceId:$('#voice').value,delivery:$('#delivery').value,bpm:$('#bpm').value,cuts,request}));}catch{}}
function identity(){return {requestId:crypto.randomUUID(),accessToken:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')};}
let request=identity();
function previewHint(){return config.preview?'Preview mode: 100 short finished-cut previews per hour.':'Hear the finished effect before checkout.';}
function changed(){request=identity();remember();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=undefined;}const player=$('#preview-player');player.pause();player.removeAttribute('src');player.hidden=true;$('#preview-feedback').textContent=previewHint();summary();}
function summary(){
  const count=cuts.length,price=count===2?9:15;
  $('#summary').replaceChildren(...cuts.map(c=>{const li=document.createElement('li');li.textContent=description(c);return li;}));
  $('#summary-title').textContent=count===2?'Two cuts. All yours.':'The full picture. Four cuts.';
  $('#plan-name').textContent=count===2?'The Edit':'The Full Edit';
  $('#price').innerHTML=`$${price}<small> USD</small>`;
  $('#checkout').textContent=`Get ${count} cuts — $${price} ↗`;
  const duplicate=new Set(cuts.map(key)).size!==count;
  $('#checkout').disabled=!config.enabled||busy||duplicate;
  $('#feedback').textContent=duplicate?'Each cut needs its own sound or a different Chop combination.':!config.enabled?'Orders are not open yet. Explore your selection above.':'';
}
function draw(){
  $('#slots').replaceChildren(...cuts.map((c,i)=>{
    const section=document.createElement('section');section.className='slot';
    section.innerHTML=`<div class="slot-top"><span>CUT 0${i+1}</span><span class="slot-symbol" aria-hidden="true">${sounds[c.style][2]}</span></div><label for="sound-${i}">Choose your sound</label><select id="sound-${i}">${Object.entries(sounds).map(([id,[name]])=>`<option value="${id}" ${c.style===id?'selected':''} ${id!=='chopped_up'&&cuts.some((other,j)=>j!==i&&other.style===id)?'disabled':''}>${name}</option>`).join('')}</select><p class="description">${sounds[c.style][1]}</p><button class="preview-cut" type="button" ${!config.enabled||previewBusy?'disabled':''}>Preview this cut ↗</button>`;
    section.querySelector('select').addEventListener('change',e=>{
      cuts[i]={style:e.target.value};
      if(cuts[i].style==='chopped_up'){
        const variants=Object.keys(grooves).flatMap(groove=>Object.keys(amounts).map(cutAmount=>({style:'chopped_up',groove,cutAmount})));
        cuts[i]=variants.find(v=>!cuts.some((other,j)=>j!==i&&key(other)===key(v)))||variants[0];
      }
      event('the_edit_cut_selected',{style:cuts[i].style,slot:i+1});changed();draw();$(`#sound-${i}`).focus();
    });
    if(c.style==='chopped_up'){
      const options=document.createElement('div');options.className='chop-options';
      for(const [field,values,label] of [['groove',grooves,'Groove'],['cutAmount',amounts,'Cut amount']]){
        const wrapper=document.createElement('label');wrapper.textContent=label;
        const select=document.createElement('select');select.setAttribute('aria-label',`${label} for cut ${i+1}`);
        for(const [value,title]of Object.entries(values)){const option=new Option(title,value);option.selected=c[field]===value;option.disabled=cuts.some((other,j)=>j!==i&&key(other)===key({...c,[field]:value}));select.add(option);}
        select.addEventListener('change',e=>{c[field]=e.target.value;changed();draw();const target=$(`#sound-${i}`).parentElement.querySelector(`[aria-label="${label} for cut ${i+1}"]`);target.focus();});wrapper.append(select);options.append(wrapper);
      }
      section.append(options);
    }
    section.querySelector('.preview-cut').onclick=()=>preview(c,section.querySelector('.preview-cut'));
    return section;
  }));
  $('#upgrade').hidden=cuts.length===4;$('#downgrade').hidden=cuts.length===2;summary();
}
$('#upgrade').onclick=()=>{for(const style of ['sexy_robot','chopped_up','clean','dark_echo']){if(cuts.length===4)break;if(!cuts.some(c=>c.style===style))cuts.push(style==='chopped_up'?{style,groove:'straight',cutAmount:'half'}:{style});}while(cuts.length<4){const variant=Object.keys(grooves).flatMap(groove=>Object.keys(amounts).map(cutAmount=>({style:'chopped_up',groove,cutAmount}))).find(c=>!cuts.some(x=>key(x)===key(c)));cuts.push(variant);}event('the_edit_full_upgrade_accepted');changed();draw();$('#sound-2').focus();};
$('#downgrade').onclick=()=>{cuts=cuts.slice(0,2);changed();draw();$('#upgrade').focus();};
for(const id of ['phrase','voice','delivery','bpm'])$(`#${id}`).addEventListener('input',()=>{$('#count').textContent=`${$('#phrase').value.length} / 120`;changed();});
async function api(action,body){const r=await fetch(`/api/the-edit?action=${action}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Please try again.');}return r;}
async function preview(cut,button){
  if(previewBusy||!config.enabled||!$('#phrase').value.trim()||!$('#voice').value){$('#preview-feedback').textContent='Write a phrase and choose a voice first.';return;}
  previewBusy=true;button.disabled=true;
  const feedback=$('#preview-feedback'),player=$('#preview-player');feedback.textContent='Preparing your short preview…';player.hidden=true;
  try{
    const r=await api('preview',{phrase:$('#phrase').value,voiceId:$('#voice').value,delivery:$('#delivery').value,bpm:Number($('#bpm').value),cut});
    if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(await r.blob());player.src=previewUrl;player.hidden=false;await player.play();
    feedback.textContent=`Previewing ${description(cut)}.`;
    event('the_edit_preview_played',{style:cut.style});
  }catch(error){feedback.textContent=error.message;}
  finally{previewBusy=false;button.disabled=false;}
}
$('#editor').onsubmit=async e=>{e.preventDefault();if(busy||!config.enabled)return;busy=true;summary();remember();try{const result=await(await api('checkout',{...request,phrase:$('#phrase').value,voiceId:$('#voice').value,delivery:$('#delivery').value,bpm:Number($('#bpm').value),cuts})).json();if(!result.url){location.assign(`/edit/?order=${encodeURIComponent(result.orderId)}#access=${request.accessToken}`);return;}event('the_edit_checkout_started',{cut_count:cuts.length});location.assign(result.url);}catch(error){busy=false;summary();$('#feedback').textContent=error.message;}};
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
  try{const saved=JSON.parse(sessionStorage.getItem(savedKey)||'null');if(saved&&Array.isArray(saved.cuts)&&[2,4].includes(saved.cuts.length)&&saved.cuts.every(c=>Object.hasOwn(sounds,c.style)&&(c.style!=='chopped_up'||(Object.hasOwn(grooves,c.groove)&&Object.hasOwn(amounts,c.cutAmount))))){cuts=saved.cuts;$('#phrase').value=String(saved.phrase||'').slice(0,120);$('#delivery').value=['seductive','hyped'].includes(saved.delivery)?saved.delivery:'seductive';$('#bpm').value=saved.bpm||128;if(saved.request)request=saved.request;}}
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
  $('#preview-feedback').textContent=previewHint();summary();event('the_edit_viewed');event('the_edit_full_upgrade_shown');
}
init();
