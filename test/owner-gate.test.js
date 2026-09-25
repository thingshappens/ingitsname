const {test,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const editHandler=require('../api/the-edit');
const atelierHandler=require('../api/create-checkout');

const CODE='test-owner-code-0123456789';
function res(){const r={statusCode:0,body:null,headers:{},setHeader(k,v){r.headers[k]=v;},status(c){r.statusCode=c;return r;},json(b){r.body=b;return r;},end(){return r;}};return r;}
const editReq=body=>({method:'POST',query:{action:'checkout'},headers:{origin:'https://hautesoundcouture.com',host:'hautesoundcouture.com'},body});
const atelierReq=body=>({method:'POST',headers:{host:'hautesoundcouture.com'},body:{generationId:'a'.repeat(32),...body}});

beforeEach(()=>{
  process.env.HSC_OWNER_CODE=CODE;process.env.PADDLE_ENVIRONMENT='sandbox';
  // Keep checkout from getting past the gate into a real order/payment.
  delete process.env.THE_EDIT_ENABLED;process.env.ATELIER_PAYMENT_PROVIDER='paddle';delete process.env.PADDLE_PRICE_ATELIER_4;
});

for(const [name,handler,req] of [['The Edit',editHandler,editReq],['Atelier',atelierHandler,atelierReq]]){
  test(`${name}: sandbox checkout without owner code is 403`,async()=>{const r=res();await handler(req({}),r);assert.equal(r.statusCode,403);assert.doesNotMatch(JSON.stringify(r.body),new RegExp(CODE));});
  test(`${name}: sandbox checkout with wrong owner code is 403`,async()=>{const r=res();await handler(req({ownerCode:'wrong'}),r);assert.equal(r.statusCode,403);});
  test(`${name}: sandbox checkout with the owner code passes the gate`,async()=>{const r=res();await handler(req({ownerCode:CODE}),r);assert.notEqual(r.statusCode,403);});
  test(`${name}: owner code with surrounding whitespace passes the gate`,async()=>{const r=res();await handler(req({ownerCode:` ${CODE}\n`}),r);assert.notEqual(r.statusCode,403);});
  test(`${name}: live Paddle has no owner gate`,async()=>{process.env.PADDLE_ENVIRONMENT='production';const r=res();await handler(req({}),r);assert.notEqual(r.statusCode,403);});
  test(`${name}: no owner code configured keeps sandbox checkout closed`,async()=>{delete process.env.HSC_OWNER_CODE;const r=res();await handler(req({ownerCode:''}),r);assert.equal(r.statusCode,403);});
}

test('The Edit config reports sandbox mode',async()=>{
  const r=res();await editHandler({method:'GET',query:{action:'config'},headers:{host:'hautesoundcouture.com'}},r);assert.equal(r.body.sandbox,true);
  process.env.PADDLE_ENVIRONMENT='production';const l=res();await editHandler({method:'GET',query:{action:'config'},headers:{host:'hautesoundcouture.com'}},l);assert.equal(l.body.sandbox,false);
});
