// Renders the result screen alone, with a fixed set, so that its saved card and its refused screen
// can be shot without a real analysis (a saved card needs one; the clips are not in CI).
// Run by test/real-phone/step1/harness/shoot.mjs, which copies this file to src/zz-harness.jsx and
// result-harness.html to the repository root, serves them with Vite, and removes them afterwards.
// The numbers on the screen come from here: 8 reps of 80° to 87°, each 2.0 s, in a 26 s set.
import '@fontsource-variable/inter';
import './index.css';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './lib/LanguageContext';
import Stage from './components/experience/Stage';
import Entry from './components/experience/Entry';
import Result from './components/experience/Result';
import './components/experience/Choice.css'; // the app always loads it; it gives titles their colour
void Entry; // its stylesheet holds the screens' shared styles

const rep = (i, s) => ({ index: i, startTime: s, endTime: s + 2, romDegrees: 80 + i, concentricSec: 0.9, eccentricSec: 1, peakSpeed: 100, meanSpeed: 50 });
const refused = new URLSearchParams(location.search).has('refused');
const result = refused
  ? { refused: true, count: 0, arm: 'right', reps: [], imageLandmarks: [], metadata: { duration: 26 } }
  : { count: 8, arm: 'right', reps: Array.from({ length: 8 }, (_, i) => rep(i, i * 3)), metadata: { duration: 26 }, confidence: 0.9 };
createRoot(document.getElementById('root')).render(<LanguageProvider><Stage />
  <Result result={result} lift="lateral_raise" onClose={() => {}} onReport={() => {}} onNewSet={() => {}} onRefilm={() => {}} /></LanguageProvider>);
