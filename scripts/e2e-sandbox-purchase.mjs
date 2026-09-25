// End-to-end sandbox purchase of The Edit through the real UI. Never prints the owner code or access token.
import {chromium} from '@playwright/test';
const code=process.env.HSC_OWNER_CODE;
const shot=async(p,n)=>{try{await p.screenshot({path:`shots/${n}.png`,fullPage:true});}catch{}};
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:1000}});
page.on('response',r=>{if(r.url().includes('/api/the-edit'))console.log('api',new URL(r.url()).searchParams.get('action'),r.status());});
try{
  await page.goto('https://hautesoundcouture.com/edit/',{waitUntil:'networkidle'});
  await page.fill('#phrase','Make the room move.');
  await page.waitForFunction(()=>document.querySelector('#voice').options.length>1);
  await page.selectOption('#voice',{index:1});
  await page.fill('#bpm','128');
  await page.click('#owner-access summary');await page.fill('#owner-code',code);
  await shot(page,'1-form');
  await page.click('#checkout');
  await page.waitForURL(/_ptxn=/,{timeout:30000});
  console.log('redirected to checkout page with _ptxn');
  const f=page.frameLocator('iframe[name="paddle_frame"], iframe.paddle-frame').first();
  await f.locator('input[type="email"]').first().waitFor({timeout:30000});await shot(page,'2-checkout');
  await f.locator('input[type="email"]').first().fill('qa+sandbox@hautesoundcouture.com');
  const country=f.locator('select').first();if(await country.count())await country.selectOption('SE');
  await f.getByRole('button',{name:/continue/i}).first().click();
  await page.waitForTimeout(4000);await shot(page,'3-after-email');
  const fillAny=async(label,selectors,value)=>{
    for(let t=0;t<20;t++){
      for(const fr of page.frames()){for(const sel of selectors){const l=fr.locator(sel).first();if(await l.count().catch(()=>0)&&await l.isVisible().catch(()=>false)){await l.click();await l.pressSequentially(value,{delay:40});console.log('filled',label);return;}}}
      await page.waitForTimeout(1000);
    }
    throw new Error('field not found: '+label);
  };
  await fillAny('card number',['input[placeholder*="XXXX"]','input[autocomplete="cc-number"]','input[name*="card" i][name*="number" i]'],'4242424242424242');
  await fillAny('name',['input[autocomplete="cc-name"]','input[name*="name" i]','input[aria-label*="name" i]'],'HSC QA');
  await fillAny('expiry',['input[placeholder*="MM"]','input[autocomplete="cc-exp"]'],'1230');
  await fillAny('cvv',['input[placeholder*="CVV" i]','input[autocomplete="cc-csc"]'],'100');
  await shot(page,'4-card');
  await f.getByRole('button',{name:/^pay \$/i}).first().click();
  await page.waitForTimeout(8000);await shot(page,'5-paid');
  const u=new URL(page.url());console.log('order page:',u.searchParams.has('order')&&u.hash.includes('access')?'yes':'no');
  const started=Date.now();let state='';
  while(Date.now()-started<8*60*1000){
    state=await page.locator('#order-state').textContent().catch(()=>'');const n=await page.locator('#downloads button').count();
    console.log(new Date().toISOString().slice(11,19),'|',state,'| download buttons:',n);
    if(n>=5)break;await page.waitForTimeout(20000);
  }
  await shot(page,'6-ready');
  const fs=await import('node:fs');
  const grab=async(btn)=>{const [dl]=await Promise.all([page.waitForEvent('download',{timeout:120000}),btn.click({timeout:15000})]);const b=fs.readFileSync(await dl.path());return {name:dl.suggestedFilename(),b};};
  const wav=await grab(page.locator('#downloads button').first());
  console.log('wav:',wav.name,wav.b.length,'bytes, RIFF/WAVE header:',wav.b.subarray(0,4).toString()==='RIFF'&&wav.b.subarray(8,12).toString()==='WAVE');
  const zip=await grab(page.locator('#downloads button').last());
  const entries=(zip.b.toString('latin1').match(/HSC_TheEdit_[A-Za-z]+_\d+BPM\.wav/g)||[]);
  console.log('zip:',zip.name,zip.b.length,'bytes, wav files:',[...new Set(entries)].length);
  if(wav.b.subarray(0,4).toString()!=='RIFF'||new Set(entries).size!==4)throw new Error('downloads incomplete');
  console.log('E2E OK');
}catch(e){console.log('FAILED:',e.message.split('\n')[0]);await shot(page,'x-failure');process.exitCode=1;}
finally{await browser.close();}
