import { useEffect, useRef, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { GroupHead } from '../experience/Showcase';
import { askGlimpse, exerciseText } from '../../lib/kine/glimpse';

// The AI commentary under a patient's comparison (lib/kine/glimpse.js): offered with the notice that the video leaves
// the phone, sent only on the tap, shown labelled as an AI's opinion, apart from the app's own measures (R8).

/** The commentary as shown (and printed, lib/kine/pdf.js): its lines under their headings. */
export function CommentaryView({ c, k }) {
  const lists = [[k.pAiCompensations, c.compensations], [k.pAiSetup, c.setup], [k.pAiCamera, c.camera], [k.pAiAdvice, c.advice]].filter(([, l]) => l.length);
  return <div className="kn-ai-card" data-testid="kn-ai-card">
    {!c.visible && <p className="sc-caption">{k.pAiUnseen}</p>}
    {c.visible && c.sameExercise === 'no' && <p className="sc-caption">{k.pAiOther}</p>}
    <p className="kn-ai-summary">{c.summary}</p>
    <p className="kn-ai-fact">{c.reps != null ? k.pAiReps(c.reps) : k.pAiRepsUnknown}</p>
    {c.holds.length > 0 && <div className="kn-ai-list">
      <h4>{k.pAiHolds}</h4>
      <ul>{c.holds.map((h, i) => <li key={i}>{k.pAiHold(h.rep, h.seconds)}</li>)}</ul>
    </div>}
    {lists.map(([title, items]) => <div key={title} className="kn-ai-list">
      <h4>{title}</h4>
      <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>)}
    <p className="kn-ai-foot">{k.pAiFoot}</p>
  </div>;
}

/**
 * file: the attempt's video (a new video is a new attempt: the parent keys this on it). ex: the library's exercise.
 * dosage: the programme's. initial: the commentary already given on this video (kept across a deeper reading).
 * onCommentary: called with it.
 */
export default function AiCommentary({ file, ex, fr, k, dosage, initial = null, onCommentary }) {
  const [state, setState] = useState(() => (initial ? { phase: 'done', c: initial } : { phase: 'idle' }));
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);

  const go = async () => {
    hapticLight();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setState({ phase: 'upload', p: 0 });
    try {
      const c = await askGlimpse(file, { id: ex.id, text: exerciseText(ex, fr ? 'fr' : 'en', dosage) }, {
        signal: ctrl.signal,
        onProgress: (phase, p) => setState(phase === 'upload' ? { phase, p } : { phase }),
      });
      setState({ phase: 'done', c });
      onCommentary?.(c);
    } catch (e) {
      setState(e?.name === 'AbortError' ? { phase: 'idle' } : { phase: 'failed', why: e?.why || 'failed' });
    }
  };

  return <section className="kn-ai" data-testid={`kn-ai-${ex.id}`}>
    <GroupHead title={k.pAiTitle} />
    {(state.phase === 'idle' || state.phase === 'failed') && <>
      <p className="sc-caption">{k.pAiHint}</p>
      <button type="button" className="rc-btn is-wide press" onClick={go} data-testid={`kn-ai-${ex.id}-go`}>{state.phase === 'failed' ? k.pAiRetry : k.pAiGo}</button>
    </>}
    {state.phase === 'failed' && <p className="rc-error" role="alert">{k.pAiFailed[state.why] || k.pAiFailed.failed}</p>}
    {(state.phase === 'upload' || state.phase === 'reading') && <div className="rc-progress" role="status">
      <span>{state.phase === 'upload' ? k.pAiUpload(Math.round(state.p * 100)) : k.pAiReading}</span>
      {state.phase === 'upload' && <div className="rc-bar"><i style={{ width: `${Math.round(state.p * 100)}%` }} /></div>}
      <button type="button" className="rc-link press" onClick={() => abort.current?.abort()}>{fr ? 'Annuler' : 'Cancel'}</button>
    </div>}
    {state.phase === 'done' && <CommentaryView c={state.c} k={k} />}
  </section>;
}
