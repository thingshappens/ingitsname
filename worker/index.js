// HSC — single Cloudflare Worker for hautesoundcouture.com.
// Static pages come from ./dist (assets binding). /api/* runs the existing
// Node-style handlers unchanged through a small req/res adapter.
import { Buffer } from 'node:buffer';
import config from '../api/config.js';
import voices from '../api/voices.js';
import generate from '../api/generate.js';
import createCheckout from '../api/create-checkout.js';
import checkoutStatus from '../api/checkout-status.js';
import packStatus from '../api/pack-status.js';
import theEdit from '../api/the-edit.js';
import theEditWebhook from '../api/the-edit-webhook.js';
import tailorSend from '../tailor/api/send.js';
import freeSamples from '../api/free-samples.js';
import { admin } from './admin.js';
import { createService } from '../lib/edit/service.js';
import editStore from '../lib/edit/store.js';

const API = {
  '/api/config': config, '/api/voices': voices, '/api/generate': generate,
  '/api/create-checkout': createCheckout, '/api/checkout-status': checkoutStatus,
  '/api/pack-status': packStatus, '/api/the-edit': theEdit,
  '/api/the-edit-webhook': theEditWebhook, '/api/send': tailorSend, '/api/free-samples': freeSamples
};

// Old subdomains → sections of the one site.
const HOST_REDIRECT = {
  'atelier.hautesoundcouture.com': '/atelier/',
  'theedit.hautesoundcouture.com': '/edit/',
  'www.hautesoundcouture.com': '/'
};
const CANONICAL = 'https://hautesoundcouture.com';

async function runHandler(handler, request, rawBody) {
  const url = new URL(request.url);
  const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  headers['x-forwarded-for'] ||= headers['cf-connecting-ip'] || '';
  let body;
  if (rawBody.length && (headers['content-type'] || '').includes('application/json')) {
    try { body = JSON.parse(Buffer.from(rawBody).toString('utf8')); } catch { body = undefined; }
  }
  const req = {
    method: request.method, url: url.pathname + url.search, headers,
    query: Object.fromEntries(url.searchParams), body, socket: {},
    async *[Symbol.asyncIterator]() { if (rawBody.length) yield Buffer.from(rawBody); }
  };
  return new Promise((resolve) => {
    let status = 200; const out = new Headers(); let done = false;
    const finish = (payload) => { if (done) return; done = true; resolve(new Response(payload ?? null, { status, headers: out })); };
    const res = {
      status(code) { status = code; return res; },
      setHeader(k, v) { if (Array.isArray(v)) v.forEach((x) => out.append(k, x)); else out.set(k, String(v)); return res; },
      getHeader(k) { return out.get(k); },
      json(obj) { if (!out.has('content-type')) out.set('content-type', 'application/json; charset=utf-8'); finish(JSON.stringify(obj)); return res; },
      send(data) { finish(typeof data === 'string' || data instanceof Uint8Array ? data : data == null ? null : JSON.stringify(data)); return res; },
      end(data) { finish(data ?? null); return res; },
      redirect(a, b) { const [code, loc] = typeof a === 'number' ? [a, b] : [302, a]; status = code; out.set('location', loc); finish(null); return res; }
    };
    Promise.resolve(handler(req, res)).then(() => finish(null), (err) => {
      console.error(err); if (!done) { status = 500; out.set('content-type', 'application/json'); finish(JSON.stringify({ error: 'Internal error' })); }
    });
  });
}

export default {
  // Every minute: finish paid Edit orders whose GPU job is done, even if the buyer closed the page.
  async scheduled(event, env, ctx) {
    for (const k in env) if (typeof env[k] === 'string') process.env[k] = env[k];
    if (process.env.THE_EDIT_REMOTE_FULFIL !== '1') return;
    const service = createService();
    const pending = (await editStore.redis().smembers('hsc:edit:pending')) || [];
    for (const id of pending.slice(0, 10)) {
      try { await service.refresh(id); } catch (error) { console.error(JSON.stringify({ event: 'the_edit_refresh_error', error: String(error?.message || error) })); }
    }
  },
  async fetch(request, env) {
    // Cloudflare hands secrets/vars in via env, not process.env — but every
    // handler imported unchanged from Vercel reads process.env.*, so mirror
    // it in on each request (idempotent, cheap).
    for (const k in env) if (typeof env[k] === "string") process.env[k] = env[k];
    const url = new URL(request.url);
    // Config health: says which secrets/vars are present — never their values.
    if (url.pathname === '/api/health') {
      const names = ['ELEVENLABS_API_KEY','RESEND_API_KEY','PADDLE_API_KEY','PADDLE_PRICE_ATELIER_4','PADDLE_PRICE_ATELIER_PACK','PADDLE_PRICE_THE_EDIT_4','PADDLE_WEBHOOK_SECRET','THE_EDIT_WEBHOOK_SECRET','THE_EDIT_PAYMENT_PROVIDER','ATELIER_PAYMENT_PROVIDER','THE_EDIT_ENABLED','THE_EDIT_RUNPOD_API_KEY','THE_EDIT_RUNPOD_ENDPOINT_ID','THE_EDIT_VOICES_JSON','THE_EDIT_ORIGIN','THE_EDIT_REMOTE_RENDER','THE_EDIT_QA_APPROVED_VERSION','THE_EDIT_TERMS_URL','HSC_OWNER_CODE','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','STRIPE_SECRET_KEY','PRODUCER_PACK_ENABLED','EXTERNAL_GENERATION_ENABLED'];
      const state = (v) => v === undefined ? 'missing' : typeof v !== 'string' ? typeof v : v.trim() === '' ? 'empty' : 'set';
      const out = {};
      for (const n of names) out[n] = { env: state(env[n]), processEnv: state(process.env[n]) };
      return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    // Public Paddle.js config (client-side tokens are safe to expose by design).
    if (url.pathname === '/api/paddle-client') {
      return new Response(JSON.stringify({ environment: String(env.PADDLE_ENVIRONMENT || '').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production', token: env.PADDLE_CLIENT_TOKEN || null }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/admin/')) return admin(request, env, url);
    const target = HOST_REDIRECT[url.hostname];
    // Old subdomain links land on the right section; API calls and shared files still answer there.
    if (target && (url.pathname === '/' || url.pathname === '/edit' || url.pathname === '/edit/')) {
      return Response.redirect(CANONICAL + target + url.search, 301);
    }
    const handler = API[url.pathname.replace(/\/$/, '')];
    if (handler) {
      const raw = new Uint8Array(await request.arrayBuffer());
      if (raw.length > 1024 * 1024) return new Response('Payload too large', { status: 413 });
      return runHandler(handler, request, raw);
    }
    return env.ASSETS.fetch(request);
  }
};
