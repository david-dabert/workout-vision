// The playback decoding path (extractFramesRVFC), forced, on a synthetic 6 s video made in the page,
// with an analysis that takes ?ms= milliseconds a frame (150 by default, slower than the video plays).
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
makeVideo().then(async file => {
  let read = 0;
  const meta = await extractFramesRVFC(file, 15, Infinity, 640, async () => { read++; await new Promise(r => setTimeout(r, ms)); }, null, {});
  window.__out = { expected: Math.floor(meta.duration * 15), read, duration: meta.duration };
}).catch(e => { window.__out = { error: String(e) }; });
