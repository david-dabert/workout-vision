import { setAverages, setTempo } from './tempo';
import './Level.css';

// Card 011, lab lane: today's set beside the person's best set of the same exercise, so there is a reason to film
// again tomorrow. Read from what a saved set keeps: its reps' range and phase times (saved-set.js repDetails, version
// 2). A saved set keeps no landmarks, so the comparison engine's overlay (src/lib/reference/compare.js) cannot run on
// two saved sets yet; that waits on storing them (card 011). Off in production (measures.js BEST_SET_SHOWN) until card
// 001 has passed, since both rest on the same engine and on measures not yet validated (R8). The best set is the one
// with the most reps: the count is the measure the app is surest of. Status: experimental.
const NB = ' ';
const usable = w => w && w.repDetailsVersion === 2 && Array.isArray(w.repDetails) && w.repDetails.length > 0;

/** The earlier set with the most reps, among those that kept their reps; null when there is none. */
export function bestOf(before) {
  return (before || []).filter(usable).reduce((best, w) => (!best || w.reps > best.reps ? w : best), null);
}

function line(fr, label, count, reps, first) {
  const { rom } = setAverages(reps);
  const tempo = setTempo(reps, first);
  return <div className="bs-row">
    <span className="bs-label">{label}</span>
    <span className="bs-vals">
      <b>{count}{NB}{fr ? 'rép.' : 'reps'}</b>
      {rom != null && <span>{Math.round(rom)}{NB}°</span>}
      {tempo && <span>tempo {tempo}</span>}
    </span>
  </div>;
}

/** before: the earlier saved sets of this exercise; reps and count: today's set. */
export default function BestSet({ before, reps, count, fr, first = 'concentric' }) {
  const best = bestOf(before);
  if (!best || !(reps || []).length) return null;
  return <div className="level-ask bs appear" data-testid="best-set">
    {line(fr, fr ? 'Aujourd’hui' : 'Today', count, reps, first)}
    {line(fr, fr ? 'Votre meilleure série' : 'Your best set', best.reps, best.repDetails, first)}
    <p className="level-note">{fr ? 'Amplitude moyenne et tempo, mesures expérimentales.' : 'Mean range and tempo, experimental measures.'}</p>
  </div>;
}
