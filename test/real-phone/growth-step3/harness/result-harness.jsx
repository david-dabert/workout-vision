// Renders the result screen alone with a fixed set of eight curls: rep 3 short (▾), the last two
// concentric phases 25 % slower. Run by test/real-phone/growth-step3/harness/shots.mjs.
import '@fontsource-variable/inter';
import './index.css';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './lib/LanguageContext';
import Stage from './components/experience/Stage';
import Entry from './components/experience/Entry';
import Result from './components/experience/Result';
import './components/experience/Choice.css';
void Entry; // its styles: the stage's colours and type

const rep = (i, s, rom, conc) => ({ index: i, startTime: s, endTime: s + conc + 2, romDegrees: rom, concentricSec: conc, eccentricSec: 2, peakSpeed: 100, meanSpeed: 50 });
// ?clipped: one rep, cut by the recording, so no whole rep (review 01 of step 3).
const clipped = new URLSearchParams(location.search).has('clipped');
const reps = clipped ? [{ ...rep(1, 0, 90, 1), clipped: true }] : Array.from({ length: 8 }, (_, k) => rep(k + 1, k * 4, k === 2 ? 70 : 100, k >= 6 ? 1.25 : 1));
const result = { count: reps.length, arm: 'right', reps, metadata: { duration: clipped ? 3 : 32 }, confidence: 0.9 };
createRoot(document.getElementById('root')).render(<LanguageProvider><Stage />
  <Result result={result} lift="bicep_curl" onClose={() => {}} onReport={() => {}} onNewSet={() => {}} onRefilm={() => {}} /></LanguageProvider>);
