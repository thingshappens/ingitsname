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
  const cardBtn=f.getByRole('button',{name:/^card$|card/i}).first();if(await cardBtn.count()&&await cardBtn.isVisible().catch(()=>false))await cardBtn.click().catch(()=>{});
  await page.waitForTimeout(2000);
  await f.getByLabel(/card number/i).first().fill('4242424242424242');
  await f.getByLabel(/name/i).first().fill('HSC QA');
  await f.getByLabel(/expir/i).first().fill('12/30');
  await f.getByLabel(/security|cvv|cvc/i).first().fill('100');
  await shot(page,'4-card');
  await f.getByRole('button',{name:/pay/i}).last().click();
  await page.waitForTimeout(8000);await shot(page,'5-paid');
  const u=new URL(page.url());console.log('order page:',u.searchParams.has('order')&&u.hash.includes('access')?'yes':'no');
  const started=Date.now();let state='';
  while(Date.now()-started<8*60*1000){
    state=await page.locator('#order-state').textContent().catch(()=>'');const n=await page.locator('#downloads button').count();
    console.log(new Date().toISOString().slice(11,19),'|',state,'| download buttons:',n);
    if(n>=5)break;await page.waitForTimeout(20000);
  }
  await shot(page,'6-ready');
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.locator('#downloads button').last().click()]);
  const path=await dl.path();const {statSync}=await import('node:fs');console.log('downloaded',dl.suggestedFilename(),statSync(path).size,'bytes');
}catch(e){console.log('FAILED:',e.message.split('\n')[0]);await shot(page,'x-failure');process.exitCode=1;}
finally{await browser.close();}
