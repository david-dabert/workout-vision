import { lazy, useRef } from 'react';

// A lazily loaded screen that can be warmed in advance. Once its code is
// loaded it renders directly: React.lazy would otherwise suspend on first
// render and hold the screen back behind a blank fallback.
//
// A failed download (a weak signal, a deploy that renamed the chunks) is not kept: the next warm-up or the next mount
// downloads again, so "Réessayer" on the error screen works and the video picked stays (ErrorBoundary inside AppInner).
// Before, the failed promise and the React.lazy that held it were kept for the whole visit, and the only ways out
// reloaded the page (live-app audit, 10 October 2026; lazyScreen.test.js).
export function lazyScreen(load) {
  let Mod = null, pending = null, Lazy = null;
  const warm = () => (pending ||= load().then(m => { Mod = m.default; return m; }, err => { pending = null; throw err; }));
  // React.lazy keeps its first result for good: a failure surfaces once, as an error the boundary shows, and the next
  // mount gets a new one.
  const make = () => lazy(() => warm().catch(err => {
    console.error('[Lazy load failed]', err);
    Lazy = make();
    return { default: () => { throw err; } };
  }));
  Lazy = make();
  function Screen(props) { const C = useRef(Mod || Lazy).current; return <C {...props} />; }
  Screen.warm = () => warm().catch(() => {});
  Screen.loaded = () => Mod !== null;
  return Screen;
}
