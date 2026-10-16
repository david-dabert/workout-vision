import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { GroupHead, Verdict } from '../experience/Showcase';
import { LIBRARY, exerciseById, hasMedia, mediaUrl } from '../../lib/kine/library';
import { loadReferencePose } from '../../lib/kine/media';
import { readPose } from '../../lib/reference/readPose';
import { useObjectUrl } from '../../lib/reference/useObjectUrl';
import { TOLERANCE_DEG, TOLERANCE_SHARE } from '../../lib/reference/compare';
import { FAULTS, addTrial, agreement, bestTolerance, clearTrials, exportTrials, readTrials, trialFromResult } from '../../lib/kine/calibration';
import ComparisonView from '../reference/ComparisonView';
import { COPY, pct } from '../reference/reference-copy';

// The physiotherapist's calibration (#kine, tab "Étalonnage"; lib/kine/calibration.js): he films an attempt, gives his
// judgment before the app shows its own, and the trial is kept as figures. Per exercise, the agreement at the
// provisional tolerance and, from enough trials, the tolerance that follows his judgment best. The app's verdict is
// hidden until he has judged, so his judgment is blind (the rule of David's own counts, blind.js). Nothing is applied
// by itself: the trials are exported and the tolerance is set in the code after review (R9).

function Trial({ fr, k, c, onKept }) {
  const choices = LIBRARY.filter(e => e.compare);
  const [exId, setExId] = useState(choices[0]?.id);
  const ex = exerciseById(exId);
  const [side, setSide] = useState(ex?.side ?? '');
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [refPose, setRefPose] = useState(null);
  const [attPose, setAttPose] = useState(null);
  const [label, setLabel] = useState('');
  const [fault, setFault] = useState('');
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null), abortRef = useRef(null);
  const attUrl = useObjectUrl(file);
  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = id => { setExId(id); setSide(exerciseById(id)?.side ?? ''); setRefPose(null); reset(); };
  const reset = () => { abortRef.current?.abort(); setFile(null); setAttPose(null); setLabel(''); setFault(''); setShown(false); setSaved(null); setPhase('idle'); setError(''); };

  // The video is read as soon as it is chosen; the verdict stays hidden until the judgment is given.
  const run = async f => {
    reset();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFile(f);
    try {
      setPhase('ref'); setProgress(0);
      const r = refPose || await loadReferencePose(ex, { signal: ctrl.signal, onProgress: setProgress });
      setRefPose(r);
      setPhase('att'); setProgress(0);
      setAttPose(await readPose(f, { signal: ctrl.signal, onProgress: setProgress }));
      setPhase('done');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setError(err?.message || String(err)); setPhase('error');
    }
  };

  const onResult = useCallback(result => {
    if (saved != null) return;
    const ok = addTrial(trialFromResult(result, { exercise: exId, label, fault, side }));
    setSaved(ok);
    onKept();
  }, [saved, exId, label, fault, side, onKept]);

  const mirror = !!(ex?.side && side && side !== ex.side);
  return <section className="sc-section" data-testid="kn-cal-trial">
    <GroupHead title={k.calNew} />
    <div className="kn-fields">
      <label className="kn-field"><span>{k.calExercise}</span>
        <select value={exId} onChange={e => pick(e.target.value)} disabled={phase === 'ref' || phase === 'att'} data-testid="kn-cal-exercise">
          {choices.map(e => <option key={e.id} value={e.id}>{e[fr ? 'fr' : 'en'].title}</option>)}
        </select>
      </label>
      {ex?.side && <label className="kn-field"><span>{k.side}</span>
        <select value={side} onChange={e => setSide(e.target.value)} disabled={!!file}>
          {['left', 'right'].map(s => <option key={s} value={s}>{k.sides[s]}</option>)}
        </select>
      </label>}
      <button type="button" className="rc-btn is-primary is-wide press" onClick={() => input.current?.click()} disabled={phase === 'ref' || phase === 'att'} data-testid="kn-cal-film">{file ? k.calAnother : k.calFilm}</button>
      <input ref={input} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { hapticLight(); run(f); } }} data-testid="kn-cal-input" />
    </div>

    {file && !shown && <div className="kn-cal-judge" data-testid="kn-cal-judge">
      <p className="kn-cal-ask">{k.calAsk}</p>
      <div className="kn-row">
        <button type="button" className={`rc-btn press ${label === 'match' ? 'is-primary' : ''}`} aria-pressed={label === 'match'} onClick={() => setLabel('match')} data-testid="kn-cal-match">{c.match}</button>
        <button type="button" className={`rc-btn press ${label === 'revise' ? 'is-primary' : ''}`} aria-pressed={label === 'revise'} onClick={() => setLabel('revise')} data-testid="kn-cal-revise">{c.revise}</button>
      </div>
      {label === 'revise' && <label className="kn-field"><span>{k.calFault}</span>
        <select value={fault} onChange={e => setFault(e.target.value)} data-testid="kn-cal-fault">
          <option value="">{k.calFaultNone}</option>
          {FAULTS.map(f => <option key={f} value={f}>{k.calFaults[f]}</option>)}
        </select>
      </label>}
      {(phase === 'ref' || phase === 'att') && <div className="rc-progress" role="status">
        <span>{phase === 'ref' ? k.pReadingRef : k.pReading}</span>
        <div className="rc-bar"><i style={{ width: `${Math.round(progress)}%` }} /></div>
      </div>}
      <button type="button" className="rc-btn is-wide press" disabled={!label || phase !== 'done'} onClick={() => { hapticLight(); setShown(true); }} data-testid="kn-cal-reveal">{phase === 'done' ? k.calReveal : k.calWait}</button>
    </div>}
    {phase === 'error' && <p className="rc-error" role="alert">{c.failed} <small>{error}</small></p>}

    {shown && <>
      <p className="sc-caption" data-testid="kn-cal-yours">{k.calYours(label === 'match' ? c.match : c.revise)}</p>
      <ComparisonView refPose={refPose} attPose={attPose} refUrl={mediaUrl(ex, 'mp4')} attUrl={attUrl} onResult={onResult} measures={ex?.measures} mirror={mirror} />
      {saved === false && <p className="rc-error" role="alert">{k.calNotSaved}</p>}
      {saved && <p className="sc-caption" data-testid="kn-cal-saved">{k.calSaved}</p>}
    </>}
  </section>;
}

function Summary({ fr, k, trials, onChange }) {
  const byExercise = useMemo(() => {
    const m = new Map();
    for (const t of trials) { if (!m.has(t.exercise)) m.set(t.exercise, []); m.get(t.exercise).push(t); }
    return [...m.entries()];
  }, [trials]);
  const download = () => {
    hapticLight();
    const blob = new Blob([exportTrials()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `etalonnage-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const clear = () => { if (window.confirm(k.calClearConfirm)) { clearTrials(); onChange(); } };
  return <section className="sc-section" data-testid="kn-cal-summary">
    <GroupHead title={k.calSummary} />
    {!trials.length && <p className="sc-caption">{k.calEmpty}</p>}
    <ul className="kn-sessions">
      {byExercise.map(([id, ts]) => {
        const ex = exerciseById(id);
        const now = agreement(ts);
        const best = bestTolerance(ts);
        return <li key={id} className="kn-session" data-testid={`kn-cal-ex-${id}`}>
          <span className="kn-session-head"><b>{ex ? ex[fr ? 'fr' : 'en'].title : id}</b><small>{k.calCount(ts.length)}</small></span>
          {now.n > 0 && <span className="kn-session-row">{k.calNow(TOLERANCE_DEG, pct(TOLERANCE_SHARE, fr))}<small>{k.calAgree(now.agree, now.n)}</small></span>}
          {now.n > 0 && <span className="kn-session-row"><small>{k.calDetail(now.caught, now.revise, now.falseFlags, now.match)}</small></span>}
          {best ? <span className="kn-session-row" data-testid={`kn-cal-best-${id}`}>{k.calBest(best.tol, pct(best.share, fr))}<Verdict ok>{k.calAgree(best.agree, best.n)}</Verdict></span>
            : <span className="kn-session-row"><small>{k.calNeed}</small></span>}
        </li>;
      })}
    </ul>
    {trials.length > 0 && <>
      <p className="sc-caption">{k.calExportHint}</p>
      <button type="button" className="rc-btn is-primary is-wide press" onClick={download} data-testid="kn-cal-export">{k.calExport}</button>
      <button type="button" className="rc-link press kn-forget" onClick={clear}>{k.calClear}</button>
    </>}
  </section>;
}

export default function Calibration({ fr, k }) {
  const c = COPY[fr ? 'fr' : 'en'];
  const [trials, setTrials] = useState(readTrials);
  const refresh = useCallback(() => setTrials(readTrials()), []);
  return <>
    <section className="sc-section">
      <p className="sc-caption">{k.calHint}</p>
      {!hasMedia() && <p className="sc-frame-note">{k.noMedia}</p>}
    </section>
    {hasMedia() && <Trial fr={fr} k={k} c={c} onKept={refresh} />}
    <Summary fr={fr} k={k} trials={trials} onChange={refresh} />
  </>;
}
