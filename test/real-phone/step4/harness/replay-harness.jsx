// Renders the replay alone over a synthetic video made in the page (a figure moving its arm, 3 s,
// recorded as WebM), with landmarks that follow it, so the export of step 4 can run without a real
// clip. Run by test/real-phone/step4/harness/export.mjs.
import '@fontsource-variable/inter';
import './index.css';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './lib/LanguageContext';
import Stage from './components/experience/Stage';
import Entry from './components/experience/Entry';
import Replay from './components/experience/Replay';
void Entry; // its styles

const W = 360, H = 640, SEC = 3, FPS = 15;
const elbow = t => 60 + 50 * Math.sin(t * Math.PI); // the wrist rises and falls, one rep a second or so
const pose = t => Array.from({ length: 33 }, (_, k) => {
  const a = elbow(t) * Math.PI / 180;
  const p = { 11: [0.5, 0.3], 13: [0.5, 0.45], 15: [0.5 + 0.15 * Math.sin(a), 0.45 + 0.15 * Math.cos(a)], 12: [0.6, 0.3], 23: [0.5, 0.6], 24: [0.6, 0.6] }[k];
  return p ? { x: p[0], y: p[1], z: 0, visibility: 0.99 } : { x: 0, y: 0, z: 0, visibility: 0.1 };
});
async function makeVideo() {
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' }), parts = [];
  rec.ondataavailable = e => parts.push(e.data);
  rec.start(250);
  const t0 = performance.now();
  await new Promise(done => { const tick = () => {
    const t = (performance.now() - t0) / 1000;
    g.fillStyle = '#35302a'; g.fillRect(0, 0, W, H);
    const lm = pose(t); g.fillStyle = '#d9d1c4';
    for (const k of [11, 13, 15, 12, 23, 24]) { g.beginPath(); g.arc(lm[k].x * W, lm[k].y * H, 10, 0, 7); g.fill(); }
    if (t < SEC) requestAnimationFrame(tick); else done();
  }; tick(); });
  await new Promise(r => { rec.onstop = r; rec.stop(); });
  return new File(parts, 'synthetic.webm', { type: 'video/webm' });
}
const times = Array.from({ length: SEC * FPS }, (_, i) => i / FPS);
const result = {
  count: 2, arm: 'left', imageLandmarks: times.map(pose), timestamps: times, metadata: { duration: SEC, width: W, height: H },
  reps: [0.2, 1.4].map((s, i) => ({ index: i + 1, startTime: s, endTime: s + 1, romDegrees: 100, concentricSec: 0.5, eccentricSec: 0.5 })),
};
makeVideo().then(file => { window.__made = file.size; createRoot(document.getElementById('root')).render(<LanguageProvider><Stage />
  <Replay file={file} result={result} lift="bicep_curl" onBack={() => {}} /></LanguageProvider>); });
