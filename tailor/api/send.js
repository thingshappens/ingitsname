const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email service is not connected' });

  const b = req.body || {};
  const email = String(b.email || '').trim();
  const name = String(b.name || '').trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Name and a valid email are required' });

  const fields = [
    ['Project', b.project], ['Material', b.material], ['Character', b.mood],
    ['Collection', `${b.count} finished sounds`], ['Edition', b.exclusivity],
    ['Payment', b.payment], ['Timing', b.deadline], ['Budget', b.budget], ['Estimated range', b.estimate],
    ['Material notes', b.materialNote || '—'], ['References / context', b.context || '—']
  ];
  const rows = fields.map(([label, value]) => `<tr><td style="padding:9px 14px 9px 0;color:#918b80;font-size:12px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:9px 0;color:#1a1916;font-size:13px">${escapeHtml(Array.isArray(value) ? value.join(' · ') : value)}</td></tr>`).join('');
  const shell = (heading, intro) => `<!doctype html><html><body style="margin:0;background:#11100e;padding:32px 14px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#e9e5dc;padding:42px"><p style="margin:0 0 22px;color:#9b773c;font-size:10px;letter-spacing:2px">HAUTE SOUND COUTURE · THE FITTING ROOM</p><h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:36px;font-weight:normal;line-height:1.05">${heading}</h1><p style="color:#625e57;font-size:14px;line-height:1.7">${intro}</p><table style="width:100%;border-collapse:collapse;margin-top:28px;border-top:1px solid #c9c3b8">${rows}</table><p style="margin-top:34px;color:#8b857a;font-family:Georgia,serif;font-style:italic">Made for one. Made once.</p></div></body></html>`;

  const payload = [
    {
      from: 'Haute Sound Couture <atelier@mail.hautesoundcouture.com>',
      to: ['hautesoundcouture@gmail.com'],
      reply_to: email,
      subject: `New fitting request — ${name}`,
      html: shell(`A new fitting request.`, `${escapeHtml(name)} has submitted a bespoke sound commission.`)
    },
    {
      from: 'Haute Sound Couture <atelier@mail.hautesoundcouture.com>',
      to: [email],
      reply_to: 'hautesoundcouture@gmail.com',
      subject: 'Your HSC fitting request',
      html: shell(`Your measurements<br>are with the atelier.`, `Thank you, ${escapeHtml(name)}. We have received your brief and will review it personally before replying.`)
    }
  ];

  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) return res.status(502).json({ error: result.message || 'Email delivery failed' });
  return res.status(200).json({ ok: true });
};

