const crypto=require('crypto');
const COOKIE_NAME='hsc_owner_session';
const SESSION_SECONDS=60*60*24*30;
function ownerCode(){return process.env.HSC_OWNER_CODE||process.env.DEEP_ECHO_ACCESS_CODE||'';}
function signature(expires,secret){return crypto.createHmac('sha256',secret).update(String(expires)).digest('hex');}
function cookieValue(req){const cookies=String(req.headers.cookie||'').split(';');const item=cookies.find(value=>value.trim().startsWith(`${COOKIE_NAME}=`));return item?decodeURIComponent(item.trim().slice(COOKIE_NAME.length+1)):'';}
function hasOwnerSession(req){const secret=ownerCode();if(!secret)return false;const [expiresText,provided]=cookieValue(req).split('.');const expires=Number(expiresText);if(!expires||expires<Date.now()||!/^[a-f0-9]{64}$/.test(provided||''))return false;const expected=signature(expires,secret);return crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected));}
function isOwner(req,code){const secret=ownerCode();return Boolean(secret&&(code===secret||hasOwnerSession(req)));}
function setOwnerSession(res){const secret=ownerCode();if(!secret)return;const expires=Date.now()+SESSION_SECONDS*1000;const value=`${expires}.${signature(expires,secret)}`;res.setHeader('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`);}
module.exports={isOwner,setOwnerSession};
