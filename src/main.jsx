import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register service worker for offline support and PWA install prompt
if ('serviceWorker' in navigator) {
  // A new version takes over quietly: the page reloads only when it is out of
  // sight or back on the choice of lift, never during an analysis or a report.
  let refreshing = false;
  const wasControlled = !!navigator.serviceWorker.controller;
  const reloadNow = () => { if (!refreshing) { refreshing = true; window.location.reload(); } };
  const onChoice = () => location.hash === '' || location.hash === '#';
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || refreshing) return;
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && onChoice()) reloadNow(); });
    window.addEventListener('hashchange', () => { if (onChoice()) reloadNow(); });
  });

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
        { updateViaCache: 'none' }
      );
      // Check for SW updates every 60s
      // A failed check (offline, or a worker still installing) is not an error.
      setInterval(() => reg?.update().catch(() => {}), 60_000);
      // Also check when user returns to the tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg?.update().catch(() => {});
      });
    } catch (_) { /* SW registration failed — app works fine without it */ }
  });
}

// Touch: a warm light follows the finger on every control, as in the prototype.
// Every screen scrolls, so under a finger the press waits 80 ms without movement, as a native
// list does: a swipe or a scroll that starts on a control never dips or lights it, and a scroll
// cancels a press at once. A tap shorter than the wait still lights the control, briefly, after
// the finger lifts. A mouse presses at once; a pen, which can scroll too, waits like a finger.
// The :active state is never used for this: iOS Safari applies it the moment a finger lands,
// also at the start of a swipe.
const PRESSABLE = '.wv-experience .press, .wv-experience .tactile';
let pendingPress = null;
const pressed = new Set();
const light = (el, x, y) => {
  const r = el.getBoundingClientRect();
  el.style.setProperty('--px', `${x - r.left}px`);
  el.style.setProperty('--py', `${y - r.top}px`);
  el.classList.add('is-pressed');
  pressed.add(el);
};
const unlight = (el) => { el.classList.remove('is-pressed'); pressed.delete(el); };
const clearPress = () => {
  if (pendingPress) { clearTimeout(pendingPress.timer); pendingPress = null; }
  pressed.forEach(unlight);
};
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.(PRESSABLE);
  if (!el) return;
  clearPress();
  if (e.pointerType === 'mouse') { light(el, e.clientX, e.clientY); return; }
  const press = { el, x: e.clientX, y: e.clientY, timer: 0 };
  press.timer = setTimeout(() => { if (pendingPress === press) { pendingPress = null; light(el, press.x, press.y); } }, 80);
  pendingPress = press;
}, { passive: true });
document.addEventListener('pointermove', (e) => {
  if (pendingPress && Math.hypot(e.clientX - pendingPress.x, e.clientY - pendingPress.y) > 8) clearPress();
}, { passive: true });
document.addEventListener('pointerup', () => {
  const tap = pendingPress;
  clearPress();
  if (tap) { light(tap.el, tap.x, tap.y); setTimeout(() => unlight(tap.el), 140); }
}, { passive: true });
document.addEventListener('pointercancel', clearPress, { passive: true });
// After a touch the browser also sends pointerleave to every ancestor, the document included:
// only a mouse that leaves cancels the press, so the brief light of a tap stays for its 140 ms.
document.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') clearPress(); }, { passive: true });
// Scroll events do not bubble; captured here, whatever scrolls drops the presses inside it.
// Nothing pressed, nothing to do: a scroll costs no lookup.
document.addEventListener('scroll', (e) => {
  if (!pendingPress && !pressed.size) return;
  const scroller = e.target === document ? document.documentElement : e.target;
  if (!scroller?.contains) return;
  if (pendingPress && scroller.contains(pendingPress.el)) { clearTimeout(pendingPress.timer); pendingPress = null; }
  pressed.forEach(el => { if (scroller.contains(el)) unlight(el); });
}, { passive: true, capture: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
