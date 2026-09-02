const Stripe = require('stripe');
const { ensureCreditPack, getCreditPack, isCreditStoreConfigured } = require('../lib/credits');

function validSessionId(sessionId) {
  return /^cs_(?:test_|live_)?[A-Za-z0-9]{20,}$/.test(String(sessionId || ''));
}

module.exports = async function (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.STRIPE_SECRET_KEY || !isCreditStoreConfigured()) {
    return res.status(503).json({ error: 'Producer Pack is not available yet' });
  }

  const sessionId = req.query?.session_id;
  if (!validSessionId(sessionId)) return res.status(400).json({ error: 'Invalid Producer Pack session' });

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    const valid = session.payment_status === 'paid' && session.metadata?.product_key === 'hsc_sample_atelier_producer_pack';
    if (!valid) return res.status(200).json({ paid: false, remaining: 0 });

    await ensureCreditPack(session);
    const pack = await getCreditPack(session.id);

    return res.status(200).json({
      paid: true,
      remaining: pack?.remaining || 0,
      total: pack?.total || 5,
      email: pack?.email || session.customer_details?.email || null,
      generationId: session.metadata?.generation_id || null,
    });
  } catch (error) {
    return res.status(403).json({ error: 'Could not verify Producer Pack session' });
  }
};
