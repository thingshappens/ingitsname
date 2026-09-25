const crypto=require('crypto');
const COOKIE_NAME='hsc_owner_session';
const SESSION_SECONDS=60*60*24*30;
function ownerCode(){return process.env.HSC_OWNER_CODE||process.env.DEEP_ECHO_ACCESS_CODE||'';}
function signature(expires,secret){return crypto.createHmac('sha256',secret).update(String(expires)).digest('hex');}
function cookieValue(req){const cookies=String(req.headers.cookie||'').split(';');const item=cookies.find(value=>value.trim().startsWith(`${COOKIE_NAME}=`));return item?decodeURIComponent(item.trim().slice(COOKIE_NAME.length+1)):'';}
function hasOwnerSession(req){const secret=ownerCode();if(!secret)return false;const [expiresText,provided]=cookieValue(req).split('.');const expires=Number(expiresText);if(!expires||expires<Date.now()||!/^[a-f0-9]{64}$/.test(provided||''))return false;const expected=signature(expires,secret);return crypto.timingSafeEqual(Buffer.from(provided),Buffer.from(expected));}
function isOwner(req,code){const secret=ownerCode();return Boolean(secret&&(code===secret||hasOwnerSession(req)));}
function setOwnerSession(res){const secret=ownerCode();if(!secret)return;const expires=Date.now()+SESSION_SECONDS*1000;const value=`${expires}.${signature(expires,secret)}`;res.setHeader('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${SESSION_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`);}
function codeMatches(code){const secret=ownerCode();if(!secret||typeof code!=='string'||!code)return false;return crypto.timingSafeEqual(crypto.createHash('sha256').update(code).digest(),crypto.createHash('sha256').update(secret).digest());}
function paddleSandbox(){return String(process.env.PADDLE_ENVIRONMENT||'').trim().toLowerCase()==='sandbox';}
// Paddle sandbox accepts its public test cards, so a sandbox checkout would hand out
// real files (and GPU time) for free. While PADDLE_ENVIRONMENT is 'sandbox', only the
// owner may open a checkout. The gate lifts by itself once PADDLE_ENVIRONMENT is no
// longer 'sandbox' (live Paddle), with no code change needed.
function sandboxCheckoutAllowed(code){return !paddleSandbox()||codeMatches(code);}
const SANDBOX_CHECKOUT_DENIED='Checkout is in private testing and not open to the public yet.';
module.exports={isOwner,setOwnerSession,paddleSandbox,sandboxCheckoutAllowed,SANDBOX_CHECKOUT_DENIED};
