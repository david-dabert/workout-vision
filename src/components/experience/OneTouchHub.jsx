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
export default function OneTouchHub({ fr = false, onStartLift, onMobility, onHistory, onSelectCategory }) {
  const copy = ONE_TOUCH[fr ? 'fr' : 'en'];

  const handleTouch = cb => {
    navigator.vibrate?.(10);
    cb?.();
  };

  const categories = [
    { key: 'all', label: copy.categories.all },
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
          <span className="wv-onetouch-ico" aria-hidden="true">{copy.modes.lift.badge}</span>
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
          <span className="wv-onetouch-ico" aria-hidden="true">{copy.modes.mobility.badge}</span>
          <span className="wv-onetouch-text">
            <strong className="wv-onetouch-title">{copy.modes.mobility.title}</strong>
            <small className="wv-onetouch-sub">{copy.modes.mobility.sub}</small>
          </span>
          <svg className="wv-onetouch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>

        <button
          type="button"
          className="wv-onetouch-btn is-history tactile"
          data-testid="onetouch-history"
          onClick={() => handleTouch(onHistory)}
        >
          <span className="wv-onetouch-ico" aria-hidden="true">{copy.modes.history.badge}</span>
          <span className="wv-onetouch-text">
            <strong className="wv-onetouch-title">{copy.modes.history.title}</strong>
            <small className="wv-onetouch-sub">{copy.modes.history.sub}</small>
          </span>
          <svg className="wv-onetouch-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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
