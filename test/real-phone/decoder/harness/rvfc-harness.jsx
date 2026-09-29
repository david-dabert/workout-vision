// The playback decoding path (extractFramesRVFC), forced, on a synthetic 6 s video made in the page,
// with an analysis that takes ?ms= milliseconds a frame (150 by default, slower than the video plays).
// The same video is decoded twice (?twice) to show the two reads take the same sample times.
// Writes window.__out = { expected, read, method }. Run by test/real-phone/decoder/harness/rvfc.mjs.
import { extractFramesRVFC } from './lib/frameExtractor';

const SEC = 6, W = 360, H = 640, ms = Number(new URLSearchParams(location.search).get('ms') ?? 150);
async function makeVideo() {
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/mp4' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  rec.start(250);
  const t0 = performance.now();
  await new Promise(done => { const tick = () => {
    const t = (performance.now() - t0) / 1000;
    g.fillStyle = `hsl(${(t * 60) % 360} 40% 40%)`; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(20 + t * 40, 300, 40, 40);
    if (t < SEC) requestAnimationFrame(tick); else done();
  }; tick(); });
  await new Promise(r => { rec.onstop = r; rec.stop(); });
  return new File(parts, 'synthetic.mp4', { type: 'video/mp4' });
}
const twice = new URLSearchParams(location.search).has('twice');
makeVideo().then(async file => {
  if (twice) {
    const run = async () => { const t = []; await extractFramesRVFC(file, 15, Infinity, 640, async (_c, _i, x) => { t.push(Math.round(x * 1e6)); await new Promise(r => setTimeout(r, ms)); }, null, {}); return t.join(','); };
    const a = await run(), b = await run();
    window.__out = { twice: true, samples: a.split(',').length, identical: a === b };
    return;
  }
  let read = 0; const times = [];
  const meta = await extractFramesRVFC(file, 15, Infinity, 640, async (_c, _i, t) => { read++; times.push(Math.round(t * 1e6)); await new Promise(r => setTimeout(r, ms)); }, null, {});
  window.__out = { expected: Math.floor(meta.duration * 15), read, duration: meta.duration, times: times.join(',') };
}).catch(e => { window.__out = { error: String(e) }; });
