const {test}=require('node:test');
const assert=require('node:assert/strict');
const handler=require('../api/generate');

function response(){
  return {
    headers:{},
    setHeader(k,v){this.headers[k]=v;},
    status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},
    send(body){this.body=body;return this;}
  };
}

test('Atelier text-to-speech sends only the requested words to the voice engine',async()=>{
  const previousKey=process.env.ELEVENLABS_API_KEY;
  const previousExternal=process.env.EXTERNAL_GENERATION_ENABLED;
  const previousFetch=global.fetch;
  let payload;
  process.env.ELEVENLABS_API_KEY='test-key';
  delete process.env.EXTERNAL_GENERATION_ENABLED;
  global.fetch=async(url,options)=>{
    assert(String(url).includes('/text-to-speech/voice_fixture'));
    payload=JSON.parse(options.body);
    return {ok:true,arrayBuffer:async()=>new Uint8Array([0,0,0,0]).buffer};
  };
  try{
    const res=response();
    await handler({method:'POST',headers:{},socket:{remoteAddress:'127.0.0.1'},body:{text:'Make the room move.',voiceId:'voice_fixture',delivery:'hype',mode:'vocal'}},res);
    assert.equal(res.code,200);
    assert.equal(payload.model_id,'eleven_v3');
    assert.equal(payload.text,'Make the room move.');
    assert(!payload.text.includes('Perform the words'));
    assert(!payload.text.includes('Do not whisper'));
  }finally{
    if(previousKey===undefined)delete process.env.ELEVENLABS_API_KEY;else process.env.ELEVENLABS_API_KEY=previousKey;
    if(previousExternal===undefined)delete process.env.EXTERNAL_GENERATION_ENABLED;else process.env.EXTERNAL_GENERATION_ENABLED=previousExternal;
    global.fetch=previousFetch;
  }
});
