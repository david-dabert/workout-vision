import { useEffect, useRef, useState } from 'react';
import { restClock, nextTick, restText, restSpoken } from './rest-clock';

/**
 * The rest after the set, counted up from the moment the set is saved, or from a tap; a tap stops it. It sets no length to reach
 * and says nothing of how long to rest (rest-clock.js). The time is drawn on each whole second and
 * again the moment the page comes back into view, so a phone that slept shows the right time at once.
 */
export default function RestClock({ fr, autoStart = false }) {
  // Started with the saved set, the clock runs from that moment: the rest has begun, no tap needed.
  const [clock] = useState(() => { const c = restClock(); if (autoStart) c.start(); return c; });
  const [running, setRunning] = useState(autoStart);
  const [, redraw] = useState(0);
  // The button that replaces the one tapped takes the focus, so the keyboard and screen readers stay in place.
  const buttonRef = useRef(null), moved = useRef(false);
  useEffect(() => { if (moved.current) buttonRef.current?.focus({ preventScroll: true }); }, [running]);

  useEffect(() => {
    if (!running) return undefined;
    let t = 0;
    const tick = () => { redraw(n => n + 1); t = setTimeout(tick, nextTick(clock)); };
    t = setTimeout(tick, nextTick(clock));
    const back = () => { if (document.visibilityState === 'visible') { clearTimeout(t); tick(); } };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pageshow', back);
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', back); window.removeEventListener('pageshow', back); };
  }, [running, clock]);

  function start() { navigator.vibrate?.(10); clock.start(); moved.current = true; setRunning(true); }
  function stop() { clock.stop(); moved.current = true; setRunning(false); }

  if (!running) {
    return <button ref={buttonRef} type="button" className="btn-line press rest-start" onClick={start}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5" /><path d="M10 2.5h4" /></svg>
      <span>{fr ? 'Lancer le repos' : 'Start rest'}</span>
    </button>;
  }
  const s = clock.seconds();
  return <div className="rest-clock appear" data-testid="rest-clock">
    <p className="eyebrow rest-label" id="rest-label">{fr ? 'Repos' : 'Rest'}</p>
    {/* A timer is not announced each second; its words are read when the reader reaches it. */}
    <p className="rest-time" role="timer" aria-labelledby="rest-label">
      <span aria-hidden="true">{restText(s)}</span><span className="sr">{restSpoken(s, fr)}</span>
    </p>
    <button ref={buttonRef} type="button" className="btn-ghost press rest-stop" onClick={stop}>{fr ? 'Arrêter le repos' : 'Stop rest'}</button>
  </div>;
}
