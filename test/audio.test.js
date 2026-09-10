const {test}=require('node:test');const assert=require('node:assert/strict');const {render,SR}=require('../lib/edit/render');const {VERSION}=require('../lib/edit/model');
const {generate}=require('../lib/edit/render');
test('recipes export real 48 kHz, 24-bit WAVs below -1 dBTP',{timeout:90000},async()=>{const pcm=Buffer.alloc(SR*2*2);for(let i=0;i<pcm.length/2;i++)pcm.writeInt16LE(Math.round((Math.sin(i/SR*2*Math.PI*190)*.3+Math.sin(i/SR*2*Math.PI*720)*.15)*Math.min(1,i/240,(pcm.length/2-i)/480)*32767),i*2);for(const style of ['clean','dark_echo','sexy_robot']){const {buffer,metrics}=await render(pcm,{style,recipeVersion:VERSION},{bpm:128,voiceRange:'low'});assert.equal(buffer.toString('ascii',0,4),'RIFF');const fmt=buffer.indexOf(Buffer.from('fmt '));assert.equal(buffer.readUInt32LE(fmt+12),48000);assert.equal(buffer.readUInt16LE(fmt+22),24);assert(metrics.truePeak<=-1);}});
test('The Edit renderer never falls back to ElevenLabs while HSC recordings are pending',async()=>{
  await assert.rejects(generate({phrase:'Test',voiceId:'felix-lousive'}),/HSC character recordings are being prepared/);
});
