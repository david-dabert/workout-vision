import { lazy, useRef } from 'react';

// A lazily loaded screen that can be warmed in advance. Once its code is
// loaded it renders directly: React.lazy would otherwise suspend on first
// render and hold the screen back behind a blank fallback.
//
// A failed download (a weak signal, a deploy that renamed the chunks) stays failed until an explicit new attempt: the
// warm-up, the tap that opens the screen (App.jsx go() warms it), or "Réessayer" on the error screen
// (retryFailedScreens, ErrorBoundary.jsx). That attempt downloads again and gives the screen a new React.lazy, so the
// video picked stays (the boundary sits inside AppInner). Before, the failure was kept for the whole visit and the only
// ways out reloaded the page (live-app audit, 10 October 2026). It is never retried from a render: React renders again
// after an error, and a download started there would loop instead of reaching the error screen (CI, e2e/history.spec.js).
const screens = new Set();

export function lazyScreen(load) {
  let Mod = null, pending = null, failed = false, Lazy = null;
  const attempt = () => (pending ||= load().then(m => { Mod = m.default; return m; }, err => { failed = true; throw err; }));
  const make = () => lazy(() => attempt().catch(err => {
    console.error('[Lazy load failed]', err);
    return { default: () => { throw err; } };
  }));
  Lazy = make();
  const warm = () => {
    if (failed) { failed = false; pending = null; Lazy = make(); }
    return attempt();
  };
  function Screen(props) { const C = useRef(Mod || Lazy).current; return <C {...props} />; }
  Screen.warm = () => warm().catch(() => {});
  Screen.loaded = () => Mod !== null;
  Screen.failed = () => failed;
  screens.add(Screen);
  return Screen;
}

/** Downloads again every screen whose download failed: "Réessayer" on the error screen. */
export function retryFailedScreens() {
  for (const s of screens) if (s.failed()) s.warm();
}
