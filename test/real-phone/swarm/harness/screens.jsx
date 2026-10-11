// Every CoreUpload state rendered alone (from the design audit of 30 September). ?s=<state>
// Served by test/real-phone/swarm/harness/design-checks.mjs, which copies it into src/ and deletes it.
import '@fontsource-variable/inter';
import './index.css';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { LanguageProvider } from './lib/LanguageContext';
import Stage from './components/experience/Stage';
import Entry from './components/experience/Entry';
import Result, { AnalysisError, AnalysisIncomplete, AnalysisInterrupted } from './components/experience/Result';
import Report from './components/experience/Report';
import Replay from './components/experience/Replay';
import Watch from './components/experience/Watch';
import Guide from './components/experience/Guide';
import History from './components/experience/History';
import './components/experience/Choice.css';
import './components/experience/Film.css';
void Entry;

const s = new URLSearchParams(location.search).get('s') || 'counted';
const rep = (i, st, rom, conc) => ({ index: i, startTime: st, endTime: st + conc + 2, romDegrees: rom, concentricSec: conc, eccentricSec: 2, peakSpeed: 100, meanSpeed: 50 });
const reps = Array.from({ length: 8 }, (_, k) => rep(k + 1, k * 4 + 0.5, k === 2 ? 70 : 100, k >= 6 ? 1.25 : 1));
// Synthetic landmarks: a standing figure, right arm curling.
function pose(t, lostArm = false) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.95 }));
  const set = (i, x, y) => { lm[i] = { x, y, visibility: 0.95 }; };
  set(0, 0.5, 0.14); set(7, 0.47, 0.13); set(8, 0.53, 0.13);
  set(11, 0.42, 0.26); set(12, 0.58, 0.26); set(23, 0.44, 0.55); set(24, 0.56, 0.55);
  set(25, 0.44, 0.73); set(26, 0.56, 0.73); set(27, 0.44, 0.92); set(28, 0.56, 0.92);
  set(13, 0.4, 0.4); set(15, 0.4, 0.54);
  const a = (Math.sin(t * Math.PI / 2) + 1) / 2 * 2.2;
  set(14, 0.6, 0.4); set(16, 0.6 + Math.sin(a) * 0.12, 0.4 + Math.cos(a) * 0.14);
  if (lostArm) { lm[14] = { x: 1.15, y: 0.4, visibility: 0.05 }; lm[16] = { x: 1.2, y: 0.5, visibility: 0.05 }; }
  return lm;
}
const times = Array.from({ length: 330 }, (_, i) => i / 10);
const base = { count: 8, arm: 'right', reps, metadata: { duration: 33, width: 720, height: 1280 }, confidence: 0.9, timestamps: times, imageLandmarks: times.map(t => pose(t)) };
const refusedOut = { ...base, count: 0, reps: [], refused: true, imageLandmarks: times.map(t => pose(t, true)) };
const refusedNobody = { ...base, count: 0, reps: [], refused: true, imageLandmarks: times.map(() => null) };

function makeVideo() {
  return new Promise(res => {
    const c = document.createElement('canvas'); c.width = 360; c.height = 640;
    const ctx = c.getContext('2d'); const st = c.captureStream(30);
    const rec = new MediaRecorder(st, { mimeType: 'video/webm' }); const chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => res(new File(chunks, 'set.webm', { type: 'video/webm' }));
    const t0 = performance.now();
    const draw = () => { const t = (performance.now() - t0) / 1000; const g = ctx.createLinearGradient(0, 0, 0, 640); g.addColorStop(0, '#3a3530'); g.addColorStop(1, '#15120f'); ctx.fillStyle = g; ctx.fillRect(0, 0, 360, 640); ctx.fillStyle = '#6b5f52'; ctx.fillRect(140 + Math.sin(t) * 4, 150, 80, 330); if (t < 3) requestAnimationFrame(draw); else rec.stop(); };
    rec.start(); draw();
  });
}

function App() {
  const [file, setFile] = useState(null);
  const [open, setOpen] = useState(s === 'report' ? { n: 8 } : null);
  useEffect(() => { if (s === 'replay') makeVideo().then(setFile); }, []);
  const noop = () => {};
  if (s === 'watch') return <Watch lift="bicep_curl" progress={42} phase="extracting" landmarks={pose(1)} frameSize={[720, 1280]} onSkip={noop} />;
  if (s === 'watch-loading') return <Watch lift="bicep_curl" progress={0} phase="model" landmarks={null} frameSize={null} onSkip={noop} />;
  if (s === 'guide') return <Guide onClose={noop} onChoose={noop} />;
  if (s === 'history') return <History onClose={noop} />;
  if (s === 'error') return <AnalysisError lift="bicep_curl" phase="decode" onClose={noop} onRefilm={noop} />;
  if (s === 'incomplete') return <AnalysisIncomplete lift="bicep_curl" read={181} expected={439} decoder="rvfc" onClose={noop} onRestart={noop} onRefilm={noop} />;
  if (s === 'interrupted') return <AnalysisInterrupted lift="bicep_curl" onClose={noop} onRestart={noop} onRefilm={noop} />;
  if (s === 'refused') return <Result result={refusedOut} lift="bicep_curl" onClose={noop} onReport={noop} onReplay={noop} onNewSet={noop} onRefilm={noop} />;
  if (s === 'refused-nobody') return <Result result={refusedNobody} lift="squat" onClose={noop} onReport={noop} onNewSet={noop} onRefilm={noop} />;
  if (s === 'replay') return <>{<Result result={base} lift="bicep_curl" covered="replay" onClose={noop} onReport={noop} onReplay={noop} onNewSet={noop} onRefilm={noop} />}{file && <Replay file={file} result={base} lift="bicep_curl" onBack={noop} />}</>;
  return <><Result result={base} lift="bicep_curl" covered={open ? 'report' : null} onClose={noop} onReport={(n, id) => setOpen({ n, id })} onReplay={noop} onNewSet={noop} onRefilm={noop} />
    {open && <Report lift="bicep_curl" count={open.n} counted={8} arm="right" reps={reps} setId={open.id} onBack={() => setOpen(null)} />}</>;
}
createRoot(document.getElementById('root')).render(<LanguageProvider><Stage /><App /></LanguageProvider>);
