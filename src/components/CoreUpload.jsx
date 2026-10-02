import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/LanguageContext';
import { analyzeCoreVideo, APPROVED_LIFTS } from '../lib/coreAnalysis';
import { saveWorkout } from '../lib/storage';
import Watch from './experience/Watch';
import Result, { AnalysisError, AnalysisInterrupted, AnalysisIncomplete } from './experience/Result';
import { watchInterruption, whenVisible, settleRun, holdScreenAwake, isInterruption } from '../lib/interruption';
import Report from './experience/Report';
import Replay from './experience/Replay';
import ScreenFade from './experience/ScreenFade';
import { compactWave } from './experience/wave';

export default function CoreUpload({ onClose, onRefilm, initialLift = '', initialFile = null }) {
  const { lang, tExercise } = useT();
  const fr = lang === 'fr';
  const [lift, setLift] = useState(initialLift);
  const [file, setFile] = useState(initialFile);
  // Arriving from Film, the analysis starts at once: never paint the old form first.
  const [busy, setBusy] = useState(Boolean(initialFile && initialLift));
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // The page was hidden during the run (screen locked, app left): no count is shown.
  const [interrupted, setInterrupted] = useState(false);
  const [incomplete, setIncomplete] = useState(null); // { read, expected } when the phone read part of the video
  // The screen open over the result: 'report' or 'replay'; it fades out before it goes.
  const [overlay, setOverlay] = useState(null);
  const [overlayLeaving, setOverlayLeaving] = useState(false);
  const [landmarks, setLandmarks] = useState(null);
  const [frameSize, setFrameSize] = useState(null);
  const trueNRef = useRef(null);
  // The count the user saved on the result, once saved: the replay states it beside the detected marks.
  const [savedCount, setSavedCount] = useState(null);
  // The left/right comparison the result screen saved with the set (sides-line.js), for the report.
  const [savedSides, setSavedSides] = useState(null);
  const savedIdRef = useRef(null);
  const abort = useRef(null);
  const closeTimer = useRef(null);
  useEffect(() => () => { abort.current?.abort(); clearTimeout(closeTimer.current); }, []);

  // Arriving from the Film screen with a file, the analysis starts at once. Start and
  // abort live in one effect, so a remount (StrictMode) restarts it instead of losing it.
  useEffect(() => {
    if (!(initialFile && initialLift)) return undefined;
    const controller = analyze();
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function analyze() {
    const controller = new AbortController();
    abort.current = controller;
    run(controller);
    return controller;
  }

  async function run(controller) {
    const mine = () => abort.current === controller;
    setBusy(true); setResult(null); setSavedCount(null); setSavedSides(null); setError(''); setInterrupted(false); setIncomplete(null); setProgress(0); setLandmarks(null); setFrameSize(null);
    let release = () => {}, wake = async () => {};
    try {
      // A video chosen while the page is still hidden (back from the camera) waits for it.
      await whenVisible({ signal: controller.signal });
      release = watchInterruption(controller);
      wake = holdScreenAwake();
      const output = await analyzeCoreVideo(file, lift, { signal: controller.signal, onProgress: p => { if (mine()) setProgress(p); }, onPhase: p => { if (mine()) setPhase(p); }, onLandmarks: (lm, w, h) => { if (mine()) { setLandmarks(lm); setFrameSize([w, h]); } } });
      // A beat at 100 %, then the result, as in the prototype; a run hidden meanwhile shows no count.
      setProgress(100);
      const settled = await settleRun(controller.signal, output, initialFile && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 380 : 0);
      release();
      if (mine()) setResult(settled);
      // In experience mode (initialFile), Result component handles saving
      if (!initialFile && !output.refused) {
        try {
          await saveWorkout({ exercise: lift, reps: output.count, repDetails: output.reps, arm: output.arm, confidence: output.confidence, date: new Date().toISOString(), source: 'counter-core', duration: output.metadata.duration });
        } catch {
          setError(fr ? 'Résultat affiché, mais non enregistré sur ce téléphone.' : 'Result shown, but could not save it on this phone.');
        }
      }
    } catch (e) {
      if (isInterruption(controller.signal.reason)) { if (mine()) setInterrupted(true); }
      else if (e.name === 'PartialReadError') { if (mine()) setIncomplete({ read: e.read, expected: e.expected, decoder: e.decoder }); }
      else if (e.name !== 'AbortError' && mine()) { console.error('[analysis]', e); setError(e.message || 'failed'); }
    } finally { release(); wake(); if (mine()) { setBusy(false); abort.current = null; } }
  }

  const refilm = onRefilm || onClose;
  function closeOverlay() {
    if (overlayLeaving) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setOverlay(null); return; }
    setOverlayLeaving(true);
    closeTimer.current = setTimeout(() => { setOverlay(null); setOverlayLeaving(false); }, 450);
  }
  function openOverlay(name) {
    clearTimeout(closeTimer.current);
    setOverlayLeaving(false);
    setOverlay(name);
  }
  function openReport(savedN, savedId) {
    trueNRef.current = savedN;
    savedIdRef.current = savedId ?? null;
    openOverlay('report');
  }

  // Experience mode: analysis, then the result (or what went wrong), crossfaded.
  if (initialFile) {
    const view = result ? 'result' : interrupted ? 'interrupted' : incomplete ? 'incomplete' : error ? 'error' : 'watch';
    return <>
      <ScreenFade screenKey={view}>
        {view === 'watch' && <Watch lift={lift} progress={progress} phase={phase} landmarks={landmarks} frameSize={frameSize} onSkip={() => { abort.current?.abort(); refilm(); }} />}
        {view === 'error' && <AnalysisError lift={lift} phase={phase} onClose={onClose} onRefilm={refilm} />}
        {view === 'incomplete' && <AnalysisIncomplete lift={lift} read={incomplete.read} expected={incomplete.expected} decoder={incomplete.decoder} onClose={onClose} onRestart={() => analyze()} onRefilm={refilm} />}
        {view === 'interrupted' && <AnalysisInterrupted lift={lift} onClose={onClose} onRestart={() => analyze()} onRefilm={refilm} />}
        {view === 'result' && <Result result={result} lift={lift} covered={overlay && !overlayLeaving ? overlay : null} onClose={onClose} onReport={openReport} onReplay={() => openOverlay('replay')} onNewSet={onClose} onRefilm={refilm} onSaved={(n, sides) => { setSavedCount(n); setSavedSides(sides ?? null); }} />}
      </ScreenFade>
      {view === 'result' && overlay === 'report' && <Report lift={lift} count={trueNRef.current ?? result.count} counted={result.count} arm={result.arm} reps={result.reps} setId={savedIdRef.current} sides={savedSides} wave={compactWave(result.smoothedAngles, result.timestamps)} leaving={overlayLeaving} onBack={closeOverlay} />}
      {view === 'result' && overlay === 'replay' && <Replay file={file} result={result} lift={lift} saved={savedCount} leaving={overlayLeaving} onBack={closeOverlay} />}
    </>;
  }

  return <main className="page" style={{ maxWidth: 520, margin: '0 auto', padding: 20 }}>
    <button className="btn btn-ghost" onClick={() => { abort.current?.abort(); onClose(); }}>{fr ? 'Retour' : 'Back'}</button>
    <h1>{fr ? 'Analyser une vidéo' : 'Analyze a video'}</h1>
    <p>{fr ? 'Version de test - vérifiez le nombre de répétitions.' : 'Test version - check the repetition count.'}</p>
    <label htmlFor="core-lift">{fr ? 'Exercice' : 'Exercise'}</label>
    <select id="core-lift" value={lift} disabled={busy} onChange={e => { setLift(e.target.value); setResult(null); }} style={{ display: 'block', width: '100%', minHeight: 44, marginBottom: 16 }}>
      <option value="">{fr ? 'Choisir un exercice' : 'Choose an exercise'}</option>
      {APPROVED_LIFTS.map(id => <option key={id} value={id}>{tExercise(id)}</option>)}
    </select>
    <label htmlFor="core-file">{fr ? 'Vidéo' : 'Video'}</label>
    <input id="core-file" type="file" accept="video/*,.mov" disabled={busy} onChange={e => { setFile(e.target.files[0] || null); setResult(null); }} style={{ display: 'block', marginBottom: 20, maxWidth: '100%' }} />
    <button className="btn btn-primary" disabled={!file || !lift || busy} onClick={() => analyze()}>{fr ? 'Analyser' : 'Analyze'}</button>
    {busy && <div role="status">
      <p>{phase === 'model' ? (fr ? 'Chargement du modèle…' : 'Loading model…') : `${fr ? 'Analyse' : 'Analysis'} ${Math.round(progress)}%`}</p>
      <progress max="100" value={progress} />
      <button className="btn btn-ghost" onClick={() => abort.current?.abort()}>{fr ? 'Annuler' : 'Cancel'}</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    {incomplete && <p role="alert">{fr ? 'La vidéo n’a pas été lue en entier. Aucun compte n’est affiché. Recommencez l’analyse.' : 'The video was not read in full. No count is shown. Start the analysis again.'}</p>}
    {result && <section data-testid="core-result" aria-live="polite">
      <h2>{tExercise(result.exercise)}</h2>
      {result.refused ? <p>{fr ? 'Impossible de compter : les articulations nécessaires sont cachées pendant la majeure partie de la série. Filmez avec le bras entier visible.' : 'Cannot count: the required joints are hidden for most of the set. Film with the whole arm visible.'}</p> : <>
        {/* Ask for verification for every result, including all low-confidence results. */}
        <h2>{fr ? `Nous avons compté ${result.count}. Est-ce correct ?` : `We counted ${result.count}. Is that right?`}</h2>
        <p>{fr ? 'Bras utilisé' : 'Arm used'}: {result.arm}</p>
        <ol aria-label={fr ? 'Répétitions comptées' : 'Counted repetitions'} style={{ display: 'flex', gap: 4, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>{result.reps.map(rep => <li key={rep.index} aria-label={`${fr ? 'Répétition' : 'Rep'} ${rep.index}`} style={{ width: 12, height: 28, background: 'currentColor', borderRadius: 2 }} />)}</ol>
      </>}
    </section>}
  </main>;
}
