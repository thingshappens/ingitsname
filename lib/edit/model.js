const crypto = require('node:crypto');
const {ALLOWED_ENGINES,validProfileId}=require('./voicebox');
const rawCatalogue=require('../../edit/cut-catalog.json');
const VERSION = 'edit-v10-monsieur-four-cuts-contract';
// This is a package, not a menu. The server owns the sequence so a browser
// cannot buy a reduced bundle or inject an unapproved treatment.
const CUT_SET_ID = rawCatalogue.id;
const CUT_CATALOG = Object.freeze(rawCatalogue.cuts.map(c=>Object.freeze({...c})));
const CUT_SEQUENCE = Object.freeze(CUT_CATALOG.map(c=>c.style));
// This catalogue is the single source of truth for the customer-facing
// four-cut product. The API sends it to the browser; the renderer receives
// the same sequence through validate(). Do not define a second cut list in UI.
const STYLES = Object.freeze(Object.fromEntries(CUT_CATALOG.map(c=>[c.style,c.name])));
const DELIVERIES = {
  dark:null,
  hyped:null
};
const PRICES = {4:1500};
class InputError extends Error {}
function cutKey(c) { return c.style; }
function voices() {
  let list; try { list=JSON.parse(process.env.THE_EDIT_VOICES_JSON || '[]'); } catch { return []; }
  return Array.isArray(list) ? list.filter(v=> /^[A-Za-z0-9_-]{3,100}$/.test(v.id) && typeof v.name==='string' && ['low','mid','bright'].includes(v.range) && v.licensed===true && v.provider==='voicebox' && validProfileId(v.profileId) && ALLOWED_ENGINES.has(v.engine) && (v.modelSize===undefined||typeof v.modelSize==='string') && (v.language===undefined||/^[a-z]{2,3}$/i.test(v.language)) && (v.instruct===undefined||typeof v.instruct==='string') && (v.profileVersion===undefined||typeof v.profileVersion==='string') && (v.cutSet===undefined||v.cutSet===CUT_SET_ID)).map(v=>({...v,voiceProfile:v.voiceProfile==='masculine'?'masculine':'neutral',language:v.language||'en',cutSet:v.cutSet||CUT_SET_ID})) : [];
}
function validate(input, available=voices()) {
  if (!input || typeof input.phrase!=='string' || !input.phrase.trim() || input.phrase.length>120 || /[\x00-\x08\x0b-\x1f]/.test(input.phrase)) throw new InputError('Write a phrase of 1–120 characters.');
  const voice=available.find(v=>v.id===input.voiceId);
  if (!voice) throw new InputError('Choose an available voice.');
  if (!Number.isInteger(input.bpm) || input.bpm<60 || input.bpm>200) throw new InputError('Choose a whole BPM from 60 to 200.');
  const delivery='four_cuts';
  const cuts=CUT_SEQUENCE.map((style,i)=>({id:crypto.randomUUID(),slot:i+1,style,recipeVersion:VERSION,renderStatus:'pending'}));
  return {product:'the_edit',phrase:input.phrase.trim(),voiceId:voice.id,characterId:voice.id,voiceRange:voice.range,voiceProfile:voice.voiceProfile,voiceboxProfileId:voice.profileId,voiceboxEngine:voice.engine,voiceboxModelSize:voice.modelSize||null,voiceboxLanguage:voice.language,voiceboxInstruct:voice.instruct||null,voiceProfileVersion:voice.profileVersion||'v1',cutSet:voice.cutSet,delivery,bpm:input.bpm,cutCount:cuts.length,cuts};
}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function tokenMatches(token, expected){return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&typeof expected==='string'&&crypto.timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(expected,'hex'));}
function filename(c,bpm){return `HSC_TheEdit_${(STYLES[c.style]||'ChoppedUp').replace(/[^A-Za-z]/g,'')}_${bpm}BPM.wav`;}
module.exports={VERSION,STYLES,CUT_SET_ID,CUT_SEQUENCE,CUT_CATALOG,DELIVERIES,PRICES,InputError,cutKey,voices,validate,hash,tokenMatches,filename};
