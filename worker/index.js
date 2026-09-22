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

const API = {
  '/api/config': config, '/api/voices': voices, '/api/generate': generate,
  '/api/create-checkout': createCheckout, '/api/checkout-status': checkoutStatus,
  '/api/pack-status': packStatus, '/api/the-edit': theEdit,
  '/api/the-edit-webhook': theEditWebhook, '/api/send': tailorSend
};

// Old subdomains → sections of the one site.
const HOST_REDIRECT = {
  'atelier.hautesoundcouture.com': '/atelier/',
  'theedit.hautesoundcouture.com': '/edit/',
  'tailor.hautesoundcouture.com': '/tailor/',
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
  async fetch(request, env) {
    // Cloudflare hands secrets/vars in via env, not process.env — but every
    // handler imported unchanged from Vercel reads process.env.*, so mirror
    // it in on each request (idempotent, cheap).
    for (const k in env) if (typeof env[k] === "string") process.env[k] = env[k];
    const url = new URL(request.url);
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
