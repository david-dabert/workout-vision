import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The prototype's screen change: the old screen fades out over 0.5 s while
// the new one fades in over it (its own .screen animation, 0.8 s). The
// leaving screen is frozen as it last rendered and cannot be touched.
// All layers sit in one keyed list, so React keeps the leaving screen's
// instance (and its DOM) instead of mounting a copy.
export default function ScreenFade({ screenKey, children, viaTransition = false }) {
  const [shownKey, setShownKey] = useState(screenKey);
  const [leaving, setLeaving] = useState([]);
  const [instant, setInstant] = useState(null);
  // The screens shown before in this visit: one returned to is already there (no entrance), and the screen
  // being left fades away on top of it, so the stage never dips dark between them (tour, t04-back-to-choice).
  const seen = useRef(new Set([screenKey]));
  const [returned, setReturned] = useState(null);
  const last = useRef({ key: screenKey, node: children });
  if (screenKey !== shownKey) {
    const prev = last.current;
    setShownKey(screenKey);
    // After a browser back or forward (the iOS swipe animates on its own), no second transition.
    // A View Transition animates the change itself (viaTransition, set by App): no fade layer on top of it.
    const fromHistory = viaTransition || performance.now() - (window.__wvHistoryNav || -1e9) < 250;
    setLeaving(list => (fromHistory ? [] : [...list.filter(l => l.key !== prev.key && l.key !== screenKey), prev]));
    setInstant(fromHistory ? screenKey : null);
    setReturned(seen.current.has(screenKey) ? screenKey : null);
    seen.current.add(screenKey);
  }
  useLayoutEffect(() => { last.current = { key: screenKey, node: children }; });
  // After a change, focus goes to the new screen's title unless the screen took it itself (Report, Replay focus
  // their Back): left on the screen that went (inert) or on nothing, VoiceOver and the keyboard were lost
  // (audit of 3 October). Not on the first screen, where nothing was focused before.
  const current = useRef(null), first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const el = current.current, a = document.activeElement;
    if (!el || (a && a !== document.body && el.contains(a))) return;
    const target = el.querySelector('h1, h2, .title') || el.querySelector('button, [href], input');
    if (!target) return;
    if (!target.matches('button, [href], input') && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true, focusVisible: false });
  }, [shownKey]);
  useEffect(() => {
    if (!leaving.length) return undefined;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setLeaving([]), reduced ? 0 : 520);
    return () => clearTimeout(t);
  }, [leaving]);
  const layers = [...leaving.map(l => ({ ...l, out: true })), { key: screenKey, node: children, out: false }];
  return layers.map(l => (l.out
    ? <div key={l.key} className="wv-leaving" aria-hidden="true" inert>{l.node}</div>
    : <div key={l.key} ref={current} className={`wv-current${l.key === instant ? ' wv-instant' : ''}${l.key === returned && l.key !== instant ? ' wv-return' : ''}`}>{l.node}</div>));
}
