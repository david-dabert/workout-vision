import './NavigationShell.css';

/**
 * NavigationShell: Persistent 3-destination app shell (Train, Progress, Explore).
 * Provides unambiguous mobile bottom navigation (and desktop top rail) ensuring
 * users never feel lost and can always return to the primary training workflow.
 *
 * Adheres strictly to:
 * - Rule R10 (French typography, non-breaking space before : ; ? !)
 * - Design tokens (zero raw color literals, uses CSS variables)
 */
export default function NavigationShell({
  current = 'train',
  fr = false,
  onNavigate,
}) {
  const handleTab = (dest) => {
    navigator.vibrate?.(10);
    onNavigate?.(dest);
  };

  const tabs = [
    {
      id: 'train',
      label: fr ? 'Entraînement' : 'Train',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4v16M18 4v16M2 9v6M22 9v6M6 12h12" />
        </svg>
      ),
    },
    {
      id: 'progress',
      label: fr ? 'Progrès' : 'Progress',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 4 4 6-6" />
        </svg>
      ),
    },
    {
      id: 'explore',
      label: fr ? 'Explorer' : 'Explore',
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="wv-nav-shell" aria-label={fr ? 'Navigation principale' : 'Main navigation'} data-testid="nav-shell">
      <div className="wv-nav-bar">
        {tabs.map((t) => {
          const active = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`wv-nav-tab tactile ${active ? 'is-active' : ''}`}
              aria-selected={active}
              role="tab"
              data-testid={`nav-tab-${t.id}`}
              onClick={() => handleTab(t.id)}
            >
              <span className="wv-nav-ico">{t.icon}</span>
              <span className="wv-nav-label">{t.label}</span>
              {active && <span className="wv-nav-pill" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
