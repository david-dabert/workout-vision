import { useEffect, useRef } from 'react';

// On-device instrument, shown only with ?perf=1 (src/lib/perfFlag.js). It reads:
// - frames per second, from requestAnimationFrame;
// - frames dropped during the last swipe: from a touchstart to the end of the scroll it
//   caused, counting frames missed against the display's own measured frame interval
//   (60 Hz, 120 Hz or the 30 Hz of Low Power Mode alike). A tap without a scroll is no swipe;
// - the element that received the last touchstart, and the control that owns it.
// It writes to its own text only; nothing is stored or sent anywhere.
// The app's language rule (LanguageContext): the stored choice, else the phone's language.
const fr = () => {
  try { const saved = localStorage.getItem('wv_lang'); if (saved === 'fr' || saved === 'en') return saved === 'fr'; } catch { /* no storage */ }
  return (navigator.language || '').toLowerCase().startsWith('fr');
};

export default function PerfOverlay() {
  const out = useRef(null);
  useEffect(() => {
    const L = fr()
      ? { fps: 'i/s', swipe: 'images perdues au dernier balayage', noSwipe: 'aucune', none: 'aucun', touched: 'touché', within: 'dans', colon: '\u00A0: ', browser: 'navigateur', standalone: 'écran d’accueil' }
      : { fps: 'fps', swipe: 'frames dropped on the last swipe', noSwipe: 'none', none: 'none', touched: 'touched', within: 'in', colon: ': ', browser: 'browser', standalone: 'home screen' };
    // The screen the page is given, as the layout sees it: the window, the small and dynamic
    // viewport heights, the safe-area insets at the top and bottom, and whether it runs in a browser
    // or from the home screen. Read from a hidden probe, so the numbers are the CSS ones.
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;height:100svh;max-height:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:content-box';
    const dyn = document.createElement('div');
    dyn.setAttribute('aria-hidden', 'true');
    dyn.style.cssText = 'position:fixed;left:0;top:0;width:0;visibility:hidden;pointer-events:none;height:100dvh';
    document.body.append(probe, dyn);
    const screenLine = () => {
      const cs = getComputedStyle(probe), top = Math.round(parseFloat(cs.paddingTop)), bottom = Math.round(parseFloat(cs.paddingBottom));
      const mode = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? L.standalone : L.browser;
      return `${innerWidth}×${innerHeight} · svh ${Math.round(parseFloat(cs.height))} · dvh ${dyn.offsetHeight} · safe ${top}/${bottom} · ${mode}`;
    };
    let raf = 0, last = 0, count = 0, windowStart = performance.now(), fps = 0;
    const gaps = [];
    let touch = null, lastSwipe = L.noSwipe, target = L.none, idle = 0;
    // The display's frame interval: the median of recent frame gaps outside any swipe.
    const interval = () => { if (gaps.length < 10) return 1000 / 60; const s = [...gaps].sort((a, b) => a - b); return s[s.length >> 1]; };
    const show = () => { if (out.current) out.current.textContent = `${fps} ${L.fps} · ${L.swipe}${L.colon}${lastSwipe}\n${L.touched}${L.colon}${target}\n${screenLine()}`; };
    const tick = now => {
      if (last && !document.hidden) {
        const gap = now - last;
        if (touch) { if (touch.scrolled) touch.dropped += Math.max(0, Math.round(gap / interval()) - 1); }
        else { gaps.push(gap); if (gaps.length > 60) gaps.shift(); }
      }
      last = now; count++;
      if (now - windowStart >= 500) { fps = Math.round(count * 1000 / (now - windowStart)); count = 0; windowStart = now; show(); }
      raf = requestAnimationFrame(tick);
    };
    const name = el => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${el.type ? `[${el.type}${el.hasAttribute('switch') ? ' switch' : ''}]` : ''}`;
    };
    // The element touched, and the control that owns it when that is another element.
    const describe = el => {
      if (!(el instanceof Element)) return L.none;
      const owner = el.closest('button, label, input, a, [role="button"], [role="slider"]');
      return owner && owner !== el ? `${name(el)} ${L.within} ${name(owner)}` : name(el);
    };
    const finish = () => { if (touch?.scrolled) lastSwipe = String(touch.dropped); touch = null; show(); };
    const onStart = e => { clearTimeout(idle); target = describe(e.target); touch = { dropped: 0, scrolled: false }; show(); };
    const onScroll = () => { if (touch) { touch.scrolled = true; clearTimeout(idle); idle = setTimeout(finish, 250); } };
    const onEnd = () => { clearTimeout(idle); idle = setTimeout(finish, 250); };
    // Frames are not drawn while the page is hidden (camera, another app): that gap is no drop.
    const onVisibility = () => { last = 0; if (document.hidden) { clearTimeout(idle); touch = null; } };
    const opts = { passive: true, capture: true };
    document.addEventListener('touchstart', onStart, opts);
    document.addEventListener('scroll', onScroll, opts);
    document.addEventListener('touchend', onEnd, opts);
    document.addEventListener('touchcancel', onEnd, opts);
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(idle);
      for (const t of ['touchstart', 'scroll', 'touchend', 'touchcancel']) document.removeEventListener(t, t === 'touchstart' ? onStart : t === 'scroll' ? onScroll : onEnd, { capture: true });
      document.removeEventListener('visibilitychange', onVisibility);
      probe.remove(); dyn.remove();
    };
  }, []);
  return <pre ref={out} className="wv-perf" data-testid="perf-overlay" aria-hidden="true"
    style={{ position: 'fixed', left: 8, top: 'calc(env(safe-area-inset-top, 0px) + 8px)', zIndex: 9999, margin: 0, padding: '6px 8px', maxWidth: 'calc(100vw - 16px)', font: '11px/1.35 ui-monospace, Menlo, monospace', color: '#E8BD7E', background: 'rgba(0,0,0,0.72)', borderRadius: 8, pointerEvents: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>...</pre>;
}
