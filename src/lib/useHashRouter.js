import { useState, useEffect, useCallback } from 'react';

const VALID_PAGES = new Set([
  'dashboard', 'analyze', 'log', 'history', 'rest', 'profile', 'validate', 'landing',
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

  // Sync hash -> state when the user presses back/forward
  useEffect(() => {
    const onHashChange = () => setPageState(readHash());
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
