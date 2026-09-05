const crypto = require('node:crypto');
const VERSION = 'edit-v1-candidate-4';
const STYLES = {clean:'Clean As Fuck',dark_echo:'Dark & Echo',sexy_robot:'Sexy Robot',chopped_up:'Chopped Up'};
const GROOVES = ['straight','triplet','double'];
const AMOUNTS = ['half','small'];
const DELIVERIES = {
  dark:null,
  hyped:null
};
const PRICES = {2:900,4:1500};
class InputError extends Error {}
function cutKey(c) { return c.style === 'chopped_up' ? `${c.style}:${c.groove}:${c.cutAmount}` : c.style; }
function voices() {
  let list; try { list=JSON.parse(process.env.THE_EDIT_VOICES_JSON || '[]'); } catch { return []; }
  return Array.isArray(list) ? list.filter(v=> /^[A-Za-z0-9_-]{8,100}$/.test(v.id) && typeof v.name==='string' && ['low','mid','bright'].includes(v.range) && v.licensed===true) : [];
}
function validate(input, available=voices()) {
  if (!input || typeof input.phrase!=='string' || !input.phrase.trim() || input.phrase.length>120 || /[\x00-\x08\x0b-\x1f]/.test(input.phrase)) throw new InputError('Write a phrase of 1–120 characters.');
  const voice=available.find(v=>v.id===input.voiceId);
  if (!voice) throw new InputError('Choose an available voice.');
  if (!Number.isInteger(input.bpm) || input.bpm<60 || input.bpm>200) throw new InputError('Choose a whole BPM from 60 to 200.');
  const delivery=input.delivery===undefined?'dark':input.delivery;
  if(!Object.hasOwn(DELIVERIES,delivery))throw new InputError('Choose a voice mood.');
  if (!Array.isArray(input.cuts) || ![2,4].includes(input.cuts.length)) throw new InputError('Choose 2 or 4 cuts.');
  const cuts=input.cuts.map((c,i)=>{
    if (!c || !Object.hasOwn(STYLES,c.style)) throw new InputError('Choose a sound for every cut.');
    if (c.style==='chopped_up') {
      if (!GROOVES.includes(c.groove)||!AMOUNTS.includes(c.cutAmount)) throw new InputError('Choose a groove and cut amount.');
    } else if (c.groove!==undefined || c.cutAmount!==undefined) throw new InputError('This sound has no extra choices.');
    return {id:crypto.randomUUID(),slot:i+1,style:c.style,...(c.style==='chopped_up'?{groove:c.groove,cutAmount:c.cutAmount}:{}),recipeVersion:VERSION,renderStatus:'pending'};
  });
  if(new Set(cuts.map(cutKey)).size!==cuts.length) throw new InputError('Each cut must be different. Try another Chopped Up combination.');
  return {product:'the_edit',phrase:input.phrase.trim(),voiceId:voice.id,voiceRange:voice.range,delivery,bpm:input.bpm,cutCount:cuts.length,cuts};
}
function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}
function tokenMatches(token, expected){return typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)&&typeof expected==='string'&&crypto.timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(expected,'hex'));}
function filename(c,bpm){return `HSC_TheEdit_${STYLES[c.style].replace(/[^A-Za-z]/g,'')}${c.style==='chopped_up'?`_${c.groove}_${c.cutAmount}`:''}_${bpm}BPM.wav`;}
module.exports={VERSION,STYLES,GROOVES,AMOUNTS,DELIVERIES,PRICES,InputError,cutKey,voices,validate,hash,tokenMatches,filename};
