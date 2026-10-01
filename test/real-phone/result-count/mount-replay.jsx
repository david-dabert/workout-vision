// The real replay screen (src/components/experience/Replay.jsx) mounted alone for check.mjs, on a
// 3-second video drawn here (a moving block, no person, no pose inference) and 7 fixed detections.
// ?saved=N passes the count the user saved. Served by the Vite dev server; not built into the app.
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../../src/lib/LanguageContext';
import Replay from '../../../src/components/experience/Replay';

async function makeVideo(seconds = 3) {
  const canvas = Object.assign(document.createElement('canvas'), { width: 180, height: 320 });
  const ctx = canvas.getContext('2d'), stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  const t0 = performance.now();
  const draw = () => { const t = (performance.now() - t0) / 1000; ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 180, 320); ctx.fillStyle = '#c90'; ctx.fillRect(60, 140 + 60 * Math.sin(t * 6), 60, 40); if (t < seconds) requestAnimationFrame(draw); };
  rec.start(); draw();
  await new Promise(r => setTimeout(r, seconds * 1000));
  await new Promise(r => { rec.onstop = r; rec.stop(); });
  return new File(chunks, 'set.webm', { type: 'video/webm' });
}

const reps = Array.from({ length: 7 }, (_, i) => ({ index: i + 1, startTime: 0.2 + 0.4 * i, endTime: 0.5 + 0.4 * i, romDegrees: 90, concentricSec: 0.1, eccentricSec: 0.15 }));
const result = { count: 7, refused: false, arm: 'right', reps, metadata: { duration: 3, width: 180, height: 320 }, timestamps: [], imageLandmarks: [] };
const saved = new URLSearchParams(location.search).get('saved');
makeVideo().then(file => {
  createRoot(document.getElementById('root')).render(
    <LanguageProvider>
      <Replay file={file} result={result} lift="bicep_curl" saved={saved === null ? null : Number(saved)} leaving={false} onBack={() => {}} />
    </LanguageProvider>,
  );
});
