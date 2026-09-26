import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// The prototype's screen change: the old screen fades out over 0.5 s while
// the new one fades in over it (its own .screen animation, 0.8 s). The
// leaving screen is frozen as it last rendered and cannot be touched.
// All layers sit in one keyed list, so React keeps the leaving screen's
// instance (and its DOM) instead of mounting a copy.
export default function ScreenFade({ screenKey, children }) {
  const [shownKey, setShownKey] = useState(screenKey);
  const [leaving, setLeaving] = useState([]);
  const [instant, setInstant] = useState(null);
  const last = useRef({ key: screenKey, node: children });
  if (screenKey !== shownKey) {
    const prev = last.current;
    setShownKey(screenKey);
    // After a browser back or forward (the iOS swipe animates on its own), no second transition.
    const fromHistory = performance.now() - (window.__wvHistoryNav || -1e9) < 250;
    setLeaving(list => (fromHistory ? [] : [...list.filter(l => l.key !== prev.key && l.key !== screenKey), prev]));
    setInstant(fromHistory ? screenKey : null);
  }
  useLayoutEffect(() => { last.current = { key: screenKey, node: children }; });
  useEffect(() => {
    if (!leaving.length) return undefined;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setLeaving([]), reduced ? 0 : 520);
    return () => clearTimeout(t);
  }, [leaving]);
  const layers = [...leaving.map(l => ({ ...l, out: true })), { key: screenKey, node: children, out: false }];
  return layers.map(l => (l.out
    ? <div key={l.key} className="wv-leaving" aria-hidden="true" inert>{l.node}</div>
    : <div key={l.key} className={l.key === instant ? 'wv-current wv-instant' : 'wv-current'}>{l.node}</div>));
}
