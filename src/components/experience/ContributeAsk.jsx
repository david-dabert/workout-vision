// On the saved card, after the first saved set and once more at most (contribute.js shouldAskContribute): whether to
// help improve the count. One sentence says what is kept and why; "Quoi exactement ?" opens the full list the
// history shows (contribute-copy.js `what`), so the yes is an informed one (GDPR Art. 9: movement data is asked for
// openly, never assumed). A yes is stored exactly as the history's "Aider" stores it and keeps this set at once;
// "Pas maintenant" stores nothing (it may be asked once more, from the fifth set). Sending, stopping and erasing stay
// in the history. A yes the phone cannot save says so and keeps nothing (audit FINDING-016); a set the phone cannot
// keep is said too, never thanked.
import { useId, useState } from 'react';
import { persistChoice } from '../../lib/contribute';
import { CONTRIBUTE } from './contribute-copy';

export default function ContributeAsk({ fr, onYes }) {
  const t = CONTRIBUTE[fr ? 'fr' : 'en'];
  const [answer, setAnswer] = useState(null);
  const [open, setOpen] = useState(false);
  const whatId = useId();
  function yes() {
    if (!persistChoice('yes')) { setAnswer('failed'); return; }
    setAnswer('yes');
    Promise.resolve(onYes?.()).then(kept => { if (kept === false) setAnswer('notKept'); });
  }
  const said = { yes: t.thanks, notKept: t.keepFailed, failed: t.startFailed, later: t.laterNote }[answer];
  return <div className="level-ask contribute-ask appear" data-testid="contribute-ask">
    <p className="level-q">{t.ask}</p>
    {answer !== 'later' && <>
      <p className="level-note">{t.lead}</p>
      <button type="button" className="text-btn is-inline press contribute-more" aria-expanded={open} aria-controls={whatId} onClick={() => setOpen(o => !o)}>{t.more}</button>
      <p className="level-note" id={whatId} hidden={!open} data-testid="contribute-what">{t.what}</p>
    </>}
    {said
      ? <p className="level-note" role="status">{said}</p>
      : <div className="contribute-row">
        <button type="button" className="btn-ghost is-s press" onClick={yes}>{t.yes}</button>
        <button type="button" className="text-btn press" onClick={() => setAnswer('later')}>{t.later}</button>
      </div>}
  </div>;
}
