// Renders the result screen alone for a chosen exercise, counted or refused, with a fixed set, so what
// it says of an exercise without a card can be read without a real analysis. Run by
// test/real-phone/step2/harness/results.mjs, which copies it to src/zz-harness.jsx and serves it with
// Vite. Query: ?lift=<key>&arm=<left|right|both>&refused&hide=<left|right|both>.
import '@fontsource-variable/inter';
import './index.css';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './lib/LanguageContext';
import Stage from './components/experience/Stage';
import Entry from './components/experience/Entry';
import Result from './components/experience/Result';
import './components/experience/Choice.css';
void Entry;

const q = new URLSearchParams(location.search), lift = q.get('lift'), arm = q.get('arm') || 'left', hide = q.get('hide');
const rep = (i, s) => ({ index: i, startTime: s, endTime: s + 2, romDegrees: 80 + i, concentricSec: 0.9, eccentricSec: 1, peakSpeed: 100, meanSpeed: 50 });
// Knee landmarks: left 23, 25, 27; right 24, 26, 28. A hidden side's knee and ankle are at 0.1 visibility.
const frame = () => Array.from({ length: 33 }, (_, k) => ({ x: 0.5, y: 0.5, z: 0, visibility:
  (hide === 'left' || hide === 'both') && [25, 27].includes(k) ? 0.1 : (hide === 'right' || hide === 'both') && [26, 28].includes(k) ? 0.1 : 0.9 }));
const result = q.has('refused')
  ? { refused: true, count: 0, arm, reps: [], imageLandmarks: Array.from({ length: 30 }, frame), metadata: { duration: 26 } }
  : { count: 8, arm, reps: Array.from({ length: 8 }, (_, i) => rep(i, i * 3)), metadata: { duration: 26 }, confidence: 0.9 };
createRoot(document.getElementById('root')).render(<LanguageProvider><Stage />
  <Result result={result} lift={lift} onClose={() => {}} onReport={() => {}} onNewSet={() => {}} onRefilm={() => {}} /></LanguageProvider>);
