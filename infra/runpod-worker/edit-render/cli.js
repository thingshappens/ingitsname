// Reads {pcmBase64, cut, order} as JSON from stdin, runs the exact same
// render() used on Vercel (Node + system ffmpeg), writes
// {audioBase64, metrics} JSON to stdout. One-shot process per call.
process.env.THE_EDIT_FFMPEG_PATH = process.env.THE_EDIT_FFMPEG_PATH || 'ffmpeg';
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
