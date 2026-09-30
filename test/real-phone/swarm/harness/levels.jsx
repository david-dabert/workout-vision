// The result screen, the history and the beginner's guide page at each level, for
// test/real-phone/swarm/harness/levels.mjs. The level comes from localStorage (wv_level), as on a phone.
import '@fontsource-variable/inter';
import './index.css';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './lib/LanguageContext';
import Stage from './components/experience/Stage';
import Entry from './components/experience/Entry';
import Result from './components/experience/Result';
import History from './components/experience/History';
import Guide from './components/experience/Guide';
import './components/experience/Choice.css';
void Entry; // its styles: the stage's colours and type

const rep = (i, s, rom, conc) => ({ index: i, startTime: s, endTime: s + conc + 2, romDegrees: rom, concentricSec: conc, eccentricSec: 2, peakSpeed: 180 - i * 6, meanSpeed: 90 - i * 3 });
const q = new URLSearchParams(location.search);
const n = Number(q.get('n') || 8);
// ?short=2,3,5: the short reps (1-based); ?lift=: the lift (review, 30 September: the longest beginner screen).
const short = q.get('short') ? q.get('short').split(',').map(Number) : [3];
const lift = q.get('lift') || 'bicep_curl';
const reps = Array.from({ length: n }, (_, k) => rep(k + 1, k * 4, short.includes(k + 1) ? 70 : 100, k >= n - 2 ? 1.25 : 1));
const result = { count: reps.length, arm: 'right', reps, metadata: { duration: n * 4 }, confidence: 0.9 };
const view = q.get('view');
const screen = view === 'history' ? <History onClose={() => {}} />
  : view === 'guide' ? <Guide lift="bicep_curl" onClose={() => {}} onChoose={l => { document.body.dataset.chosen = l; }} />
    : <Result result={result} lift={lift} onClose={() => {}} onReport={() => {}} onNewSet={() => {}} onRefilm={() => {}} />;
createRoot(document.getElementById('root')).render(<LanguageProvider><Stage />{screen}</LanguageProvider>);
