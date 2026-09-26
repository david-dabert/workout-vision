import { useState, useEffect, useCallback, useRef } from 'react';

const VALID_PAGES = new Set([
  'dashboard', 'analyze', 'exercises', 'coach', 'log', 'history', 'rest', 'profile', 'validate', 'weekly',
  'film', 'prs', 'onboarding', 'live',
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
 * Returns [page, setPage] with the same API as useState.
 */
export default function useHashRouter() {
  const [page, setPageState] = useState(readHash);
  const current = useRef(page);
  current.current = page;

  // Sync hash -> state when the user presses back/forward. Safari animates
  // its own back swipe, so the app marks the change and skips its crossfade.
  useEffect(() => {
    const onHashChange = () => {
      const next = readHash();
      if (next !== current.current) window.__wvHistoryNav = performance.now();
      setPageState(next);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Wrapped setter: state + hash in one call
  const setPage = useCallback((next) => {
    const resolved = VALID_PAGES.has(next) ? next : 'dashboard';
    setPageState(resolved);
    const target = resolved === 'dashboard' ? '' : resolved;
    // Only touch the hash if it actually changed, to avoid duplicate history entries
    if (window.location.hash.replace(/^#\/?/, '') !== target) {
      window.location.hash = target;
    }
  }, []);

  return [page, setPage];
}
