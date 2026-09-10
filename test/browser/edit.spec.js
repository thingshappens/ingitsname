const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.route('**/api/the-edit?action=config',r=>r.fulfill({json:{enabled:true,preview:true,voices:[{id:'test_voice',name:'Test voice'}]}}));});
test('two curated cuts use different sounds and server-selected checkout',async({page})=>{
  await page.goto('/edit/');await expect(page.locator('#checkout')).toContainText('Get 2 cuts — $9');
  await page.locator('#phrase').fill('Make the room move.');await page.locator('#voice').selectOption('test_voice');
  await expect(page.locator('#sound-0 option[value="chopped_up"]')).toHaveCount(0);
  await page.locator('#sound-0').selectOption('sexy_robot');await expect(page.locator('#sound-1 option[value="sexy_robot"]')).toBeDisabled();
  let body;await page.route('**/api/the-edit?action=checkout',route=>{body=route.request().postDataJSON();return route.fulfill({status:503,json:{error:'Test checkout received'}});});
  await page.locator('#checkout').click();await expect(page.locator('#feedback')).toHaveText('Test checkout received');expect(body.cuts).toHaveLength(2);expect(body).not.toHaveProperty('price');expect(body).not.toHaveProperty('cutCount');
});
test('not-ready and ready orders survive reload; protected individual files form the ZIP',async({page})=>{
  let ready=false;const cuts=[{id:'a',name:'Clean As Fuck',filename:'Clean.wav',renderStatus:'ready'},{id:'b',name:'Dark & Echo',filename:'Dark.wav',renderStatus:'ready'}];
  await page.route('**/api/the-edit?action=status',r=>r.fulfill({json:{id:'order',status:ready?'ready':'rendering',expiresAt:Date.now()+60000,cuts}}));
  await page.route('**/api/the-edit?action=download',r=>r.fulfill({body:Buffer.from('test wav'),contentType:'audio/wav'}));
  await page.goto('/edit/?order=order#access=token');await expect(page.locator('#downloads button')).toHaveCount(0);await expect(page.locator('#order-state')).toContainText('making your cuts');
  ready=true;await page.reload();await expect(page.locator('#downloads button')).toHaveCount(3);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download all cuts'}).click();expect((await downloaded).suggestedFilename()).toBe('HSC_TheEdit.zip');
});
test('mobile fits the viewport and contains no advanced controls',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto('/edit/');await expect(page.locator('h1')).toHaveAttribute('aria-label','The Edit');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(page.locator('input[type=range]')).toHaveCount(0);await page.screenshot({path:'../../outputs/the-edit-mobile.png',fullPage:true});});
test('desktop screenshot with test voices explicitly mocked',async({page})=>{await page.setViewportSize({width:1440,height:1100});await page.goto('/edit/');await page.locator('#phrase').fill('Make the room move.');await page.locator('#voice').selectOption('test_voice');await page.screenshot({path:'../../outputs/the-edit-desktop.png',fullPage:true});});
