import { useMemo } from 'react';
import { useT } from '../lib/LanguageContext';
import css from './TabBar.module.css';

const TABS = [
  {
    id: 'dashboard',
    labelKey: 'home',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: 'analyze',
    labelKey: 'analyze',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    id: 'live',
    labelKey: 'live',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'history',
    labelKey: 'progress',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    id: 'profile',
    labelKey: 'profile',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

/**
 * Floating pill tab bar inspired by Apple's iOS tab bar.
 *
 * @param {object} props
 * @param {string} props.page - current active page id
 * @param {(page: string) => void} props.onNavigate - navigation handler
 */
export default function TabBar({ page, onNavigate }) {
  const { t } = useT();

  // Compute the active tab index for the sliding indicator
  const activeIndex = useMemo(() => {
    const idx = TABS.findIndex(tab => tab.id === page);
    return idx >= 0 ? idx : 0;
  }, [page]);

  // Indicator transform: slide to the active tab position
  const indicatorStyle = useMemo(() => ({
    transform: `translateX(${activeIndex * 100}%)`,
  }), [activeIndex]);

  return (
    <nav className={css.tabBar} aria-label={t('main_navigation') || 'Main navigation'} data-testid="tab-bar">
      {/* Sliding indicator behind active tab */}
      <div className={css.indicatorTrack}>
        <div className={css.indicator} style={indicatorStyle} />
      </div>

      {TABS.map(tab => {
        const isActive = tab.id === page;
        return (
          <button
            key={tab.id}
            className={`${css.tab}${isActive ? ` ${css.tabActive}` : ''}`}
            onClick={() => onNavigate(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={t(tab.labelKey) || tab.labelKey}
          >
            {tab.icon}
            <span>{t(tab.labelKey) || tab.labelKey}</span>
            <span className={css.dot} />
          </button>
        );
      })}
    </nav>
  );
}
