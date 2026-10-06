import { useEffect, useRef, useState } from 'react';
import { analyzeCoreVideo } from '../lib/coreAnalysis';
import Watch from './experience/Watch';
import Result, { AnalysisError, AnalysisInterrupted, AnalysisIncomplete } from './experience/Result';
import { watchInterruption, whenVisible, settleRun, holdScreenAwake, isInterruption } from '../lib/interruption';
import Report from './experience/Report';
import Replay from './experience/Replay';
import ScreenFade from './experience/ScreenFade';
import { compactWave, waveAngles } from './experience/wave';
import { track } from '../lib/events';

// The analysis of the video chosen on the Film screen: App mounts it only with a lift and a file (App.jsx,
// page 'analyze'). The old standalone form (lift and file pickers, an 'Arm used' line) and its save of the
// unconfirmed count, which only ran without a file, could never be reached and were removed (third audit, C51);
// the Result screen saves the count the user confirms.
// onNewSet: after a saved set, the next set of the same lift (back to Film); onClose: back to the choice of lift.
export default function CoreUpload({ onClose, onRefilm, onNewSet = onRefilm, initialLift = '', initialFile = null, planned = null }) {
  const lift = initialLift, file = initialFile;
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
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
    setResult(null); setSavedCount(null); setSavedSides(null); setError(null); setInterrupted(false); setIncomplete(null); setProgress(0); setLandmarks(null); setFrameSize(null);
    let release = () => {}, wake = async () => {};
    try {
      // A video chosen while the page is still hidden (back from the camera) waits for it.
      await whenVisible({ signal: controller.signal });
      release = watchInterruption(controller);
      if (mine()) track('analysis_start', { lift });
      wake = holdScreenAwake();
      const output = await analyzeCoreVideo(file, lift, { signal: controller.signal, onProgress: p => { if (mine()) setProgress(p); }, onPhase: p => { if (mine()) setPhase(p); }, onLandmarks: (lm, w, h) => { if (mine()) { setLandmarks(lm); setFrameSize([w, h]); } } });
      // A beat at 100 %, then the result, as in the prototype; a run hidden meanwhile shows no count.
      setProgress(100);
      const settled = await settleRun(controller.signal, output, initialFile && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 380 : 0);
      release();
      // The Result screen saves the count once the user confirms it.
      if (mine()) {
        setResult(settled);
        // Counted, or no rep found and the count asked for (Result.jsx, unsure), or refused.
        track(settled.refused ? 'analysis_refused' : settled.count === 0 ? 'analysis_uncounted' : 'analysis_done', { lift });
      }
    } catch (e) {
      if (isInterruption(controller.signal.reason)) { if (mine()) { setInterrupted(true); track('analysis_interrupted', { lift }); } }
      else if (e.name === 'PartialReadError') { if (mine()) { setIncomplete({ read: e.read, expected: e.expected, decoder: e.decoder, disordered: e.disordered }); track('analysis_partial', { lift }); } }
      else if (e.name !== 'AbortError' && mine()) { console.error('[analysis]', e); setError({ name: e.name || 'Error', message: e.message || 'failed', decoder: e.decoder || '' }); track('analysis_failed', { lift }); }
    } finally { release(); wake(); if (mine()) abort.current = null; }
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
    track('report_open', { lift });
    openOverlay('report');
  }

  // The analysis, then the result (or what went wrong), crossfaded.
  const view = result ? 'result' : interrupted ? 'interrupted' : incomplete ? 'incomplete' : error ? 'error' : 'watch';
  return <>
    <ScreenFade screenKey={view}>
      {view === 'watch' && <Watch lift={lift} progress={progress} phase={phase} landmarks={landmarks} frameSize={frameSize} onSkip={() => { if (abort.current) track('analysis_cancelled', { lift }); abort.current?.abort(); refilm(); }} />}
      {view === 'error' && <AnalysisError lift={lift} phase={phase} failure={error} onClose={onClose} onRestart={() => analyze()} onRefilm={refilm} />}
      {view === 'incomplete' && <AnalysisIncomplete lift={lift} read={incomplete.read} expected={incomplete.expected} disordered={incomplete.disordered} decoder={incomplete.decoder} onClose={onClose} onRestart={() => analyze()} onRefilm={refilm} />}
      {view === 'interrupted' && <AnalysisInterrupted lift={lift} onClose={onClose} onRestart={() => analyze()} onRefilm={refilm} />}
      {view === 'result' && <Result result={result} lift={lift} videoFile={file} covered={overlay && !overlayLeaving ? overlay : null} onClose={onClose} onReport={openReport} onReplay={() => openOverlay('replay')} onNewSet={onNewSet} onChangeLift={onClose} onRefilm={refilm} planned={planned} onSaved={(n, sides) => { setSavedCount(n); setSavedSides(sides ?? null); }} />}
    </ScreenFade>
    {view === 'result' && overlay === 'report' && <Report lift={lift} count={trueNRef.current ?? result.count} counted={result.count} arm={result.arm} reps={result.reps} setId={savedIdRef.current} sides={savedSides} wave={compactWave(waveAngles(result), result.timestamps)} planned={planned} leaving={overlayLeaving} onBack={closeOverlay} />}
    {view === 'result' && overlay === 'replay' && <Replay file={file} result={result} lift={lift} saved={savedCount} leaving={overlayLeaving} onBack={closeOverlay} />}
  </>;
}
