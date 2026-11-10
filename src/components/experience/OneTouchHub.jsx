import { ONE_TOUCH } from './one-touch-copy';
import './OneTouchHub.css';

/**
 * OneTouchHub: Intuitive "Touch of a Button" mode navigation.
 * Eliminates intimidation by offering 1-touch entry to:
 * 1. Start Workout / Lift
 * 2. Mobility & Physical Therapy Screen
 * 3. My History & Progress
 * Along with 1-touch muscle group chips.
 */
export default function OneTouchHub({ fr = false, onStartLift, onMobility, onPro, onHistory, onSelectCategory }) {
  const copy = ONE_TOUCH[fr ? 'fr' : 'en'];

  const handleTouch = cb => {
    navigator.vibrate?.(10);
    cb?.();
  };

  const categories = [
    { key: 'all', label: copy.categories.all },
    { key: 'recents', label: copy.categories.recents },
    { key: 'glutes', label: copy.categories.glutes },
    { key: 'chest_arms', label: copy.categories.chest_arms },
    { key: 'back_shoulders', label: copy.categories.back_shoulders },
    { key: 'legs', label: copy.categories.legs },
    { key: 'core', label: copy.categories.core },
    { key: 'beta', label: copy.categories.beta },
  ];

  return (
    <nav className="wv-onetouch-hub" aria-label={copy.hubTitle} data-testid="onetouch-hub">
      <div className="wv-onetouch-modes" role="group" aria-label={copy.hubTitle}>
        <button
          type="button"
          className="wv-onetouch-btn is-lift tactile"
          data-testid="onetouch-lift"
          onClick={() => handleTouch(onStartLift)}
        >
          <span className="wv-onetouch-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4v16M18 4v16M2 9v6M22 9v6M6 12h12" />
            </svg>
          </span>
          <span className="wv-onetouch-text">
            <strong className="wv-onetouch-title">{copy.modes.lift.title}</strong>
            <small className="wv-onetouch-sub">{copy.modes.lift.sub}</small>
          </span>
          <svg className="wv-onetouch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          className="wv-onetouch-btn is-mobility tactile"
          data-testid="onetouch-mobility"
          onClick={() => handleTouch(onMobility)}
        >
          <span className="wv-onetouch-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="2.2" />
              <path d="m9 20 3-7 3 7M6 11l6-2 6 2M12 9v4" />
            </svg>
          </span>
          <span className="wv-onetouch-text">
            <strong className="wv-onetouch-title">{copy.modes.mobility.title}</strong>
            <small className="wv-onetouch-sub">{copy.modes.mobility.sub}</small>
          </span>
          <svg className="wv-onetouch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        {onPro && (
          <button
            type="button"
            className="wv-onetouch-btn is-pro tactile"
            data-testid="onetouch-pro"
            onClick={() => handleTouch(onPro)}
          >
            <span className="wv-onetouch-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" />
              </svg>
            </span>
            <span className="wv-onetouch-text">
              <strong className="wv-onetouch-title">{copy.modes.pro.title}</strong>
              <small className="wv-onetouch-sub">{copy.modes.pro.sub}</small>
            </span>
            <svg className="wv-onetouch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <button
          type="button"
          className="wv-onetouch-btn is-history tactile"
          data-testid="onetouch-history"
          onClick={() => handleTouch(onHistory)}
        >
          <span className="wv-onetouch-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m7 15 4-5 4 3 6-7" />
            </svg>
          </span>
          <span className="wv-onetouch-text">
            <strong className="wv-onetouch-title">{copy.modes.history.title}</strong>
            <small className="wv-onetouch-sub">{copy.modes.history.sub}</small>
          </span>
          <svg className="wv-onetouch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        className="wv-onetouch-search-launcher tactile"
        data-testid="onetouch-search-launcher"
        onClick={() => handleTouch(onStartLift)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="wv-onetouch-search-ph">{copy.searchPlaceholder}</span>
        <span className="wv-onetouch-search-badge">183</span>
      </button>

      <div className="wv-onetouch-chips-wrap">
        <span className="wv-onetouch-chips-label" id="onetouch-chips-label">
          {copy.quickCategoriesLabel}
        </span>
        <div
          className="wv-onetouch-chips"
          role="group"
          aria-labelledby="onetouch-chips-label"
          data-testid="onetouch-chips"
        >
          {categories.map(cat => (
            <button
              key={cat.key}
              type="button"
              className="wv-onetouch-chip press"
              data-testid={`onetouch-chip-${cat.key}`}
              onClick={() => handleTouch(() => onSelectCategory?.(cat.key))}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
