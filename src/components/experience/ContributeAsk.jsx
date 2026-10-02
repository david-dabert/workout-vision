// On the saved card, once, when nothing else is asked there: whether to help improve the count
// (contribute.js). A yes keeps this set at once; either answer is final until changed in the history. A yes the
// phone cannot save says so and keeps nothing (audit FINDING-016).
import { useState } from 'react';
import { persistChoice } from '../../lib/contribute';
import { CONTRIBUTE } from './contribute-copy';

export default function ContributeAsk({ fr, onYes }) {
  const t = CONTRIBUTE[fr ? 'fr' : 'en'];
  const [answer, setAnswer] = useState(null);
  if (answer === 'no') return null;
  return <div className="level-ask contribute-ask appear" data-testid="contribute-ask">
    <p className="level-q">{t.ask}</p>
    <p className="level-note">{t.what}</p>
    {answer === 'yes' || answer === 'failed'
      ? <p className="level-note" role="status">{answer === 'yes' ? t.thanks : t.startFailed}</p>
      : <div className="contribute-row">
        <button type="button" className="btn-ghost is-s press" onClick={() => { if (persistChoice('yes')) { setAnswer('yes'); onYes?.(); } else setAnswer('failed'); }}>{t.yes}</button>
        <button type="button" className="text-btn press" onClick={() => { persistChoice('no'); setAnswer('no'); }}>{t.no}</button>
      </div>}
  </div>;
}
