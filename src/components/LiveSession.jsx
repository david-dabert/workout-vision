import { useEffect, useRef, useState } from 'react';
import Live from './experience/Live';
import Result from './experience/Result';
import Report from './experience/Report';
import Replay from './experience/Replay';
import ScreenFade from './experience/ScreenFade';
import { compactWave, waveAngles } from './experience/wave';
import { track } from '../lib/events';
import { writeFilmMode } from '../lib/liveCamera';

// A set counted live (Film screen, "En direct"): the Live screen, then the same Result, report and replay as a
// recorded set (CoreUpload.jsx), with the same result in the same shape (liveCounter.js, finish). There is no video:
// the replay shows the skeleton alone (Replay.jsx, without a file). The usage counts are the recorded path's own,
// so the counts the server accepts do not change (feedback-worker/usage-schema.js).
export default function LiveSession({ lift, onClose, onRecord, planned = null }) {
  const [result, setResult] = useState(null);
  const [liveShown, setLiveShown] = useState(null);
  const [overlay, setOverlay] = useState(null);
  const [overlayLeaving, setOverlayLeaving] = useState(false);
  const [savedCount, setSavedCount] = useState(null);
  const [savedSides, setSavedSides] = useState(null);
  const trueNRef = useRef(null), savedIdRef = useRef(null), closeTimer = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  function done(output, shown) {
    // Local diagnostic event, as the recorded path sends it (coreAnalysis.js).
    window.dispatchEvent(new CustomEvent('wv:core-result', { detail: output }));
    setLiveShown(shown);
    setResult(output);
    track(output.refused ? 'analysis_refused' : output.count === 0 ? 'analysis_uncounted' : 'analysis_done', { lift });
  }
  function closeOverlay() {
    if (overlayLeaving) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setOverlay(null); return; }
    setOverlayLeaving(true);
    closeTimer.current = setTimeout(() => { setOverlay(null); setOverlayLeaving(false); }, 450);
  }
  function openOverlay(name) { clearTimeout(closeTimer.current); setOverlayLeaving(false); setOverlay(name); }
  function openReport(savedN, savedId) {
    trueNRef.current = savedN;
    savedIdRef.current = savedId ?? null;
    track('report_open', { lift });
    openOverlay('report');
  }
  // Another live set: the Live screen again, from its start.
  const [round, setRound] = useState(0);
  function again() { setResult(null); setLiveShown(null); setSavedCount(null); setSavedSides(null); setOverlay(null); setRound(r => r + 1); }

  const view = result ? 'result' : `live:${round}`;
  return <>
    <ScreenFade screenKey={view}>
      {/* "Filmer ma série" after a camera that did not open, or a phone too slow: back to the Film screen, on video. */}
      {!result && <Live lift={lift} onBack={running => { if (running) track('analysis_cancelled', { lift }); onRecord(); }} onRecord={() => { writeFilmMode('video'); onRecord(); }}
        onStart={() => track('analysis_start', { lift })} onDone={done} />}
      {result && <Result result={result} lift={lift} liveShown={liveShown} covered={overlay && !overlayLeaving ? overlay : null} onClose={onClose} onReport={openReport}
        onReplay={() => openOverlay('replay')} onNewSet={onRecord} onChangeLift={onClose} onRefilm={again} planned={planned} onSaved={(n, sides) => { setSavedCount(n); setSavedSides(sides ?? null); }} />}
    </ScreenFade>
    {result && overlay === 'report' && <Report lift={lift} count={trueNRef.current ?? result.count} counted={result.count} arm={result.arm} reps={result.reps} setId={savedIdRef.current} sides={savedSides} wave={compactWave(waveAngles(result), result.timestamps)} planned={planned} leaving={overlayLeaving} onBack={closeOverlay} />}
    {result && overlay === 'replay' && <Replay file={null} result={result} lift={lift} saved={savedCount} leaving={overlayLeaving} onBack={closeOverlay} />}
  </>;
}
