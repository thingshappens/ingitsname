// Free Samples survey — replaces the old Tally form (tally.so/r/ZjryyB).
// Emails the answers to the HSC inbox (reply-to = respondent) and sends the
// respondent a confirmation. The pack itself is still sent manually after review.
const esc = (v = '') => String(v)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const QUESTIONS = [
  ['sounds_next', 'What types of sounds would you like us to create next?'],
  ['vocal_use', 'What do you mainly use vocal samples for?'],
  ['more_of', 'What types of sounds would you like to see more of from us?'],
  ['deep_voice', 'Deep, low-pitched male voice with echo — what do you think?'],
  ['collection', 'A whole collection around that sound — what would you want in it?'],
  ['discover', 'How do you usually discover new sample packs?'],
  ['wish', 'What do you wish more sample packs included?'],
  ['dream_pack', 'If you could ask us to make ANY sample pack, what would it be?'],
  ['likely', 'How likely are you to use another HSC pack? (0–10)'],
  ['notify', 'Tell you when we release something based on your feedback?']
];

const clean = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim().slice(0, 300)).filter(Boolean);
  return String(v ?? '').trim().slice(0, 2000);
};
const isEmpty = (v) => (Array.isArray(v) ? v.length === 0 : v === '');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill hidden fields
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Email service is not connected' });

  const email = String(b.email || '').trim().slice(0, 200);
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });

  const answers = {};
  for (const [key] of QUESTIONS) {
    answers[key] = clean(b[key]);
    if (isEmpty(answers[key])) return res.status(400).json({ error: 'Please answer every question', field: key });
  }

  const rows = QUESTIONS.map(([key, label]) => {
    const v = answers[key];
    const value = Array.isArray(v) ? v.join(' · ') : v;
    return `<tr><td style="padding:10px 14px 10px 0;color:#918b80;font-size:12px;vertical-align:top;width:42%">${esc(label)}</td><td style="padding:10px 0;color:#1a1916;font-size:13px;white-space:pre-wrap">${esc(value)}</td></tr>`;
  }).join('');
  const shell = (heading, intro, table) => `<!doctype html><html><body style="margin:0;background:#11100e;padding:32px 14px;font-family:Arial,sans-serif"><div style="max-width:620px;margin:auto;background:#e9e5dc;padding:42px"><p style="margin:0 0 22px;color:#9b773c;font-size:10px;letter-spacing:2px">HAUTE SOUND COUTURE · FREE SAMPLES</p><h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:34px;font-weight:normal;line-height:1.05">${heading}</h1><p style="color:#625e57;font-size:14px;line-height:1.7">${intro}</p>${table ? `<table style="width:100%;border-collapse:collapse;margin-top:28px;border-top:1px solid #c9c3b8">${rows}</table>` : ''}<p style="margin-top:34px;color:#8b857a;font-family:Georgia,serif;font-style:italic">Made for one. Made once.</p></div></body></html>`;

  const from = 'Haute Sound Couture <atelier@mail.hautesoundcouture.com>';
  const payload = [
    {
      from, to: ['hautesoundcouture@gmail.com'], reply_to: email,
      subject: `Free samples survey — ${email}`,
      html: shell('New survey answers.', `${esc(email)} answered the free samples survey${answers.notify === 'Yes' ? ' and wants to hear about releases' : ''}. Reply to this email to send the pack.`, true)
    },
    {
      from, to: [email], reply_to: 'hautesoundcouture@gmail.com',
      subject: 'Your answers are with the atelier',
      html: shell('Thank you.<br>Your pack is on its way.', 'We read every answer ourselves. Once we have, your free pack of royalty-free, authentically produced HSC samples will arrive at this address.', false)
    }
  ];

  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(502).json({ error: result.message || 'Email delivery failed' });
  return res.status(200).json({ ok: true });
};
