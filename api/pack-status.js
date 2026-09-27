const { ensureCreditPack, getCreditPack, isCreditStoreConfigured } = require('../lib/credits');
const { validPackId, packProviderReady, paidPack } = require('../lib/pack-payment');

module.exports = async function (req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sessionId = req.query?.session_id;
  if (!validPackId(sessionId)) return res.status(400).json({ error: 'Invalid Producer Pack session' });
  if (!packProviderReady(sessionId) || !isCreditStoreConfigured()) {
    return res.status(503).json({ error: 'Producer Pack is not available yet' });
  }

  try {
    const session = await paidPack(sessionId);
    if (!session) return res.status(200).json({ paid: false, remaining: 0 });

    await ensureCreditPack(session);
    const pack = await getCreditPack(session.id);

    return res.status(200).json({
      paid: true,
      remaining: pack?.remaining || 0,
      total: pack?.total || 5,
      email: pack?.email || session.customer_details?.email || null,
      generationId: session.generationId,
    });
  } catch (error) {
    return res.status(403).json({ error: 'Could not verify Producer Pack session' });
  }
};
