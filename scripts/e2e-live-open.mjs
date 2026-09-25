// Live smoke test: public visitor (no owner code) reaches Paddle's LIVE checkout for The Edit. Does not pay.
import {chromium} from 'playwright';
const b=await chromium.launch();const page=await b.newPage();
const shot=(n)=>page.screenshot({path:`shots/${n}.png`,fullPage:true});
try{
  await page.goto('https://hautesoundcouture.com/edit/',{waitUntil:'networkidle'});
  await page.fill('#phrase','Make the room move.');
  await page.waitForFunction(()=>document.querySelector('#voice').options.length>1);
  await page.selectOption('#voice',{index:1});
  await page.fill('#bpm','128');
  await shot('1-form');
  await page.click('#checkout');
  await page.waitForURL(/_ptxn=/,{timeout:30000});
  console.log('LIVE: redirected to checkout with _ptxn');
  const fr=page.frameLocator('iframe[name*="paddle" i], iframe[src*="paddle"]').first();
  await fr.locator('input[type="email"]').first().waitFor({timeout:30000});
  const src=await page.locator('iframe[src*="paddle"]').first().getAttribute('src');
  console.log('LIVE: checkout iframe host', new URL(src).host, 'sandbox_in_url', /sandbox/i.test(src));
  const txt=await page.frames().map(f=>f).reduce(async(a,f)=>(await a)+' '+(await f.locator('body').innerText().catch(()=>'')),Promise.resolve(''));
  console.log('LIVE: shows Test Mode', /test mode/i.test(txt), 'shows 12', /12[.,]00/.test(txt));
  await shot('2-checkout');
  console.log('LIVE: PASS');
}catch(e){console.log('LIVE: FAIL',e.message);await shot('x-fail');process.exitCode=1}
await b.close();
