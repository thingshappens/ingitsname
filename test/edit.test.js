const {test}=require('node:test');const assert=require('node:assert/strict');const catalogue=require('../edit/cut-catalog.json');
const {randomUUID}=require('node:crypto');const model=require('../lib/edit/model');const {createService}=require('../lib/edit/service');
const voice={id:'monsieur_lousive_v1',name:'Monsieur Lousive',range:'mid',licensed:true,provider:'voicebox',profileId:'11111111-1111-4111-8111-111111111111',engine:'chatterbox_turbo',language:'en',voiceProfile:'masculine',profileVersion:'v1'};process.env.THE_EDIT_VOICES_JSON=JSON.stringify([voice]);process.env.STRIPE_PRICE_THE_EDIT_2='price_two';process.env.STRIPE_PRICE_THE_EDIT_4='price_four';
const input=()=>({phrase:'Make the room move.',voiceId:voice.id,bpm:128});
test('server fixes every order to the HSC four-cut sequence and rejects invalid phrase, voice or BPM',()=>{
  assert.equal(model.validate({...input(),price:1,cutCount:2}).cutCount,4);
  assert.equal(model.validate(input()).delivery,'four_cuts');
  assert.deepEqual(model.validate(input()).cuts.map(c=>c.style),['flat_tag','clean','dark_echo','sexy_robot']);
  for(const change of [{bpm:59},{bpm:128.5},{phrase:' '},{phrase:'a'.repeat(121)},{voiceId:'unknown'}])assert.throws(()=>model.validate({...input(),...change}),model.InputError);
  assert.throws(()=>model.validate(input(),[]));
});
test('The Edit offers one shared, fixed four-cut Monsieur catalogue',()=>{
  assert.equal(model.CUT_SET_ID,'hsc-four-cuts-v1');
  assert.equal(catalogue.id,model.CUT_SET_ID);
  assert.deepEqual(catalogue.cuts,model.CUT_CATALOG);
  assert.deepEqual(model.CUT_CATALOG.map(c=>c.style),['flat_tag','clean','dark_echo','sexy_robot']);
  assert.deepEqual(model.CUT_CATALOG.map(c=>c.name),['Flat Tag Cut','Clean Cut','Dark Echo Cut','Sexy Synthetic Cut']);
  assert.deepEqual(Object.keys(model.STYLES),model.CUT_CATALOG.map(c=>c.style));
  assert.equal(model.validate({...input(),cuts:[{style:'chopped_up'}]}).cuts.length,4);
});
function fixture(){
  const orders=new Map(),locks=new Set(),assets=new Map();let renders=0,generations=0,sessions=0,fail=false;
  const store={create:async o=>{if(!orders.has(o.id))orders.set(o.id,structuredClone(o));},get:async id=>structuredClone(orders.get(id)),lock:async id=>{if(locks.has(id))return null;locks.add(id);return 'lease';},unlock:async id=>locks.delete(id),save:async o=>orders.set(o.id,structuredClone(o)),redis:()=>({sadd:async()=>{},srem:async()=>{}}),putAudio:async(id,n,b)=>{assets.set(n,b);return {prefix:n,expiresAt:Date.now()+86400000};},audio:async ref=>assets.get(ref.prefix)};
  let savedSession;
  const stripe={prices:{retrieve:async id=>({id,active:true,livemode:false,currency:'usd',unit_amount:id==='price_two'?900:1500,type:'one_time'})},checkout:{sessions:{create:async p=>{sessions++;assert.deepEqual(Object.keys(p.metadata),['order_id']);assert.equal(p.allow_promotion_codes,false);savedSession={id:'cs_test_valid',url:'https://checkout.stripe.com/test',...p};return savedSession;},retrieve:async()=>savedSession,listLineItems:async()=>({has_more:false,data:[{price:{id:savedSession.line_items[0].price},quantity:1}]})}}};
  const renderer={generate:async()=>{generations++;return Buffer.alloc(4);},render:async()=>{renders++;if(fail&&renders===2)throw new Error('provider failure');return {buffer:Buffer.from('wav'),metrics:{truePeak:-1.2}};}};
  const service=createService({store,renderer});
  return {service,store,stripe,counts:()=>({renders,generations,sessions}),fail:()=>{fail=true;},session:id=>({id:'cs_test_valid',metadata:{order_id:id},mode:'payment',livemode:false,currency:'usd',amount_total:1500,payment_status:'paid'})};
}
test('checkout refresh creates one session; wrong access never reads an order',async()=>{const f=fixture(),id=randomUUID(),token='a'.repeat(64),ctx={stripe:f.stripe,origin:'https://preview.example',production:false};await f.service.checkout(input(),id,token,ctx);await f.service.checkout(input(),id,token,ctx);assert.equal(f.counts().sessions,1);assert.equal(await f.service.authorized(id,'b'.repeat(64)),null);await assert.rejects(f.service.checkout({...input(),phrase:'changed'},id,token,ctx));});
test('payment mismatches and unpaid returns never render; replay renders the four-cut package once',async()=>{const f=fixture(),id=randomUUID();await f.service.checkout(input(),id,'a'.repeat(64),{stripe:f.stripe,origin:'https://preview.example',production:false});await f.service.paid({...f.session(id),payment_status:'unpaid'},f.stripe);assert.equal(f.counts().renders,0);await assert.rejects(f.service.paid({...f.session(id),amount_total:1},f.stripe));await f.service.paid(f.session(id),f.stripe);await f.service.paid(f.session(id),f.stripe);assert.deepEqual(f.counts(),{renders:4,generations:1,sessions:1});assert.equal((await f.store.get(id)).status,'ready');});
test('failed rendering resumes from persisted source and completed cut',async()=>{const f=fixture(),id=randomUUID();f.fail();await f.service.checkout(input(),id,'a'.repeat(64),{stripe:f.stripe,origin:'https://preview.example',production:false});await assert.rejects(f.service.paid(f.session(id),f.stripe));assert.equal((await f.store.get(id)).status,'failed');await f.service.paid(f.session(id),f.stripe);assert.deepEqual(f.counts(),{renders:5,generations:1,sessions:1});assert.equal((await f.store.get(id)).status,'ready');});
test('concurrent render has a single lease holder',async()=>{const f=fixture(),id=randomUUID();await f.service.checkout(input(),id,'a'.repeat(64),{stripe:f.stripe,origin:'https://preview.example',production:false});const results=await Promise.allSettled([f.service.paid(f.session(id),f.stripe),f.service.paid(f.session(id),f.stripe)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.counts().renders,4);});
test('four-cut purchase uses the configured 1500-cent price and fulfils every cut',async()=>{const f=fixture(),id=randomUUID();await f.service.checkout(input(),id,'a'.repeat(64),{stripe:f.stripe,origin:'https://preview.example',production:false});assert.equal((await f.store.get(id)).expectedAmount,1500);await f.service.paid(f.session(id),f.stripe);assert.deepEqual(f.counts(),{renders:4,generations:1,sessions:1});});
