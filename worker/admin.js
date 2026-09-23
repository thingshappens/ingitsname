import crypto from 'node:crypto';
import model from '../lib/edit/model.js';
import store from '../lib/edit/store.js';
import { createService } from '../lib/edit/service.js';
// Operator-only tools, gated by HSC_ADMIN_TOKEN (random 64-hex, kept on Mike's Mac
// in ~/.hsc/admin-token). Lets the operator reach RunPod with the Worker's own key
// so that key never has to leave Cloudflare.
const ALLOWED = [/^https:\/\/api\.runpod\.io\/graphql/, /^https:\/\/rest\.runpod\.io\/v1\//, /^https:\/\/api\.runpod\.ai\/v2\//];

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length < 32) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function admin(request, env, url) {
  if (!sameToken(request.headers.get('x-hsc-admin') || '', env.HSC_ADMIN_TOKEN || '')) return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await request.json().catch(() => null);
  if (url.pathname === '/api/admin/runpod') {
    const target = String(body?.url || '');
    if (!ALLOWED.some((re) => re.test(target))) return new Response('Target not allowed', { status: 400 });
    const init = { method: body.method || 'GET', headers: { authorization: `Bearer ${env.THE_EDIT_RUNPOD_API_KEY}`, 'content-type': 'application/json' } };
    if (body.body !== undefined) init.body = typeof body.body === 'string' ? body.body : JSON.stringify(body.body);
    const r = await fetch(target, init);
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'cache-control': 'no-store' } });
  }
  if (url.pathname === '/api/admin/edit-selftest') {
    // A paid-looking test order that skips Paddle, to test voice → cuts → download end to end.
    for (const k in env) if (typeof env[k] === 'string') process.env[k] = env[k];
    const available = model.voices();
    const selection = model.validate({ phrase: body?.phrase || 'Make the room move.', voiceId: body?.voiceId || available[0]?.id, bpm: Number(body?.bpm || 128) }, available);
    const id = crypto.randomUUID(), token = crypto.randomBytes(32).toString('hex');
    const order = { ...selection, id, selftest: true, fingerprint: 'selftest', accessHash: model.hash(token), status: 'paid', paidAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await store.create(order);
    const owner = await store.lock(id);
    try {
      await createService().startFulfil(order);
      await store.save(order, owner);
      await store.redis().sadd('hsc:edit:pending', id);
    } finally { await store.unlock(id, owner); }
    return new Response(JSON.stringify({ orderId: id, accessToken: token, jobId: order.fulfilJobId }), { headers: { 'content-type': 'application/json' } });
  }
  return new Response('Not found', { status: 404 });
}
