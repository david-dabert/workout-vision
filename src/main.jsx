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
// On the swipeable lift cards the press waits a moment, so a swipe does not dip the card.
let pendingPress = null;
const clearPress = () => {
  if (pendingPress) { clearTimeout(pendingPress.timer); pendingPress = null; }
  document.querySelectorAll('.is-pressed').forEach(el => el.classList.remove('is-pressed'));
};
// A tap shorter than the delay still lights the card, briefly.
const releasePress = () => {
  const p = pendingPress;
  clearPress();
  if (p && !p.moved) { p.el.classList.add('is-pressed'); setTimeout(() => p.el.classList.remove('is-pressed'), 140); }
};
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.('.wv-experience .press, .wv-experience .tactile');
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--px', `${e.clientX - r.left}px`);
  el.style.setProperty('--py', `${e.clientY - r.top}px`);
  if (el.closest('.rail')) pendingPress = { el, x: e.clientX, y: e.clientY, moved: false, timer: setTimeout(() => { el.classList.add('is-pressed'); pendingPress = null; }, 90) };
  else el.classList.add('is-pressed');
}, { passive: true });
document.addEventListener('pointermove', (e) => {
  if (pendingPress && Math.hypot(e.clientX - pendingPress.x, e.clientY - pendingPress.y) > 8) clearPress();
}, { passive: true });
document.addEventListener('pointerup', releasePress, { passive: true });
for (const type of ['pointercancel', 'pointerleave']) document.addEventListener(type, clearPress, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
