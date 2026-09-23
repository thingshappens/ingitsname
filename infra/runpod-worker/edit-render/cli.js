// Reads {pcmBase64, cut, order} as JSON from stdin, runs the exact same
// render() used on Vercel (Node + system ffmpeg), writes
// {audioBase64, metrics} JSON to stdout. One-shot process per call.
process.env.THE_EDIT_FFMPEG_PATH = process.env.THE_EDIT_FFMPEG_PATH || require('node:path').join(__dirname, 'node_modules/ffmpeg-static/ffmpeg');
// The Sexy Synthetic cut normally asks RunPod for its WORLD pitch transform.
// We ARE the RunPod box, so run that transform locally instead (same code, sexy.py).
process.env.THE_EDIT_RUNPOD_ENDPOINT_ID = process.env.THE_EDIT_RUNPOD_ENDPOINT_ID || 'local';
process.env.THE_EDIT_RUNPOD_API_KEY = process.env.THE_EDIT_RUNPOD_API_KEY || 'local-transform-only';
const { spawnSync } = require('node:child_process');
const voicebox = require('./voicebox.js');
voicebox.sexySynthetic = async (audio) => {
  const r = spawnSync('python', [require('node:path').join(__dirname, 'sexy.py')], { input: audio, maxBuffer: 64 * 1024 * 1024, timeout: 60000 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 44) throw new Error('Voice transformation failed: ' + String(r.stderr || '').slice(0, 200));
  return r.stdout;
};
const { render } = require('./render.js');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', async () => {
  try {
    const { pcmBase64, cut, order } = JSON.parse(raw);
    const pcm = Buffer.from(pcmBase64, 'base64');
    const result = await render(pcm, cut, order);
    process.stdout.write(JSON.stringify({
      audioBase64: result.buffer.toString('base64'),
      metrics: result.metrics
    }));
  } catch (err) {
    process.stderr.write(String(err && err.message || err));
    process.exit(1);
  }
});
