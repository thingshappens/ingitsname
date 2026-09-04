const Stripe = require('stripe');

const FOUR_CUT_PRICE_CENTS = 900;
const PACK_PRICE_CENTS = 3900;
const VALID_GENERATION = /^[a-f0-9-]{20,64}$/i;

function originFromRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : 'https://hsc-deep-echo.vercel.app';
}

function requireStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Stripe checkout is not connected yet');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { generationId, plan } = req.body || {};
  if (!VALID_GENERATION.test(String(generationId || ''))) {
    return res.status(400).json({ error: 'Create your four cuts before opening checkout' });
  }

  try {
    const stripe = requireStripe();
    const origin = originFromRequest(req);
    const isPack = plan === 'producer_pack';

    if (isPack && process.env.PRODUCER_PACK_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Producer Pack is not available yet' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Atelier uses on-demand product data for each fitting. Keep Stripe's
      // account-level Managed Payments flow from requiring a tax code here.
      managed_payments: { enabled: false },
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: isPack ? PACK_PRICE_CENTS : FOUR_CUT_PRICE_CENTS,
            product_data: {
              name: isPack
                ? 'HSC Sample Atelier Producer Pack'
                : 'HSC Sample Atelier Four Custom WAV Cuts',
              description: isPack
                ? 'Five complete fittings. Twenty production-ready 48 kHz WAV files.'
                : 'One complete fitting. Four production-ready 48 kHz WAV files.',
            },
          },
        },
      ],
      metadata: {
        product_key: isPack ? 'hsc_sample_atelier_producer_pack' : 'hsc_sample_atelier_four_cuts',
        generation_id: String(generationId),
      },
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    return res.status(200).json({ id: session.id, url: session.url });
  } catch (error) {
    return res.status(503).json({ error: error.message || 'Could not start checkout' });
  }
};
