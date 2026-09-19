const Stripe = require('stripe');
const paddle = require('../lib/edit/paddle');

function validSessionId(sessionId) {
  return /^cs_(?:test_|live_)?[A-Za-z0-9]{20,}$/.test(String(sessionId || '')) || /^txn_[A-Za-z0-9]{20,}$/.test(String(sessionId || ''));
}

module.exports = async function (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = req.query?.session_id;
  if (!validSessionId(sessionId)) return res.status(400).json({ error: 'Invalid checkout session' });

  try {
    if (String(sessionId).startsWith('txn_')) {
      const transaction = await paddle.request(`/transactions/${encodeURIComponent(String(sessionId))}`);
      const productKey = transaction.custom_data?.product_key;
      if (productKey !== 'hsc_sample_atelier_four_cuts') {
        return res.status(403).json({ error: 'This checkout session is not for four WAV cuts' });
      }
      return res.status(200).json({
        paid: ['completed', 'paid'].includes(transaction.status),
        generationId: transaction.custom_data?.generation_id || null,
        email: transaction.customer?.email || null,
      });
    }

    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Stripe checkout is not connected yet' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    const productKey = session.metadata?.product_key;

    if (productKey !== 'hsc_sample_atelier_four_cuts') {
      return res.status(403).json({ error: 'This checkout session is not for four WAV cuts' });
    }

    return res.status(200).json({
      paid: session.payment_status === 'paid',
      generationId: session.metadata?.generation_id || null,
      email: session.customer_details?.email || null,
    });
  } catch (error) {
    return res.status(403).json({ error: 'Could not verify checkout session' });
  }
};
