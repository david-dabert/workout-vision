import { useState, useEffect, useCallback, useRef } from 'react';

const VALID_PAGES = new Set([
  'dashboard', 'analyze', 'exercises', 'coach', 'log', 'history', 'rest', 'profile', 'validate', 'weekly',
  'film', 'prs', 'onboarding', 'live', 'about',
]);

function readHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  return VALID_PAGES.has(raw) ? raw : 'dashboard';
}

/**
 * Drop-in replacement for useState('dashboard') that syncs with the URL hash.
 *
 * - On mount, reads window.location.hash to restore the page.
 * - On setPage, writes the hash so the URL stays in sync.
 * - Listens to `hashchange` so the browser back/forward buttons work.
 *
 * Returns [page, setPage, browserMoves, browserPending]: the first two with the same API as useState.
 */
export default function useHashRouter() {
  const [page, setPageState] = useState(readHash);
  const current = useRef(page);
  current.current = page;
  // The last page the app set or the browser announced. The browser changes the address at once
  // and announces it later (hashchange); until then the address differs from this.
  const known = useRef(page);
  // How many times the browser has moved the page itself (back, forward, a typed address).
  const moves = useRef(0);

  // Sync hash -> state when the user presses back/forward. Safari animates
  // its own back swipe, so the app marks the change and skips its crossfade.
  useEffect(() => {
    const onHashChange = () => {
      const next = readHash();
      if (next !== current.current) window.__wvHistoryNav = performance.now();
      if (next !== known.current) moves.current += 1;
      known.current = next;
      setPageState(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Wrapped setter: state + hash in one call
  const setPage = useCallback((next) => {
    const resolved = VALID_PAGES.has(next) ? next : 'dashboard';
    known.current = resolved;
    setPageState(resolved);
    const target = resolved === 'dashboard' ? '' : resolved;
    // Only touch the hash if it actually changed, to avoid duplicate history entries
    if (window.location.hash.replace(/^#\/?/, '') !== target) {
      window.location.hash = target;
    }
  }, []);

  // A count of the browser's own moves, announced or not: a change the app has waiting since an
  // earlier count gives way, even when the browser came back to the same page (back, then forward).
  const browserMoves = useCallback(() => moves.current + (readHash() !== known.current ? 1 : 0), []);
  // True while the browser has moved to a page it has not yet announced.
  const browserPending = useCallback(() => readHash() !== known.current, []);

  return [page, setPage, browserMoves, browserPending];
}
