import { useT } from '../lib/LanguageContext';
import ParticleSkeleton from './ParticleSkeleton';
import s from './Landing.module.css';

const IconVideo = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const IconGuide = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

export default function Landing({ onStart }) {
  const { t } = useT();

  const handleStart = () => {
    localStorage.setItem('wv_seen_landing', '1');
    onStart();
  };

  const features = [
    { icon: <IconVideo />, titleKey: 'landing_feature1_title', descKey: 'landing_feature1_desc' },
    { icon: <IconGuide />, titleKey: 'landing_feature2_title', descKey: 'landing_feature2_desc' },
    { icon: <IconDoc />,   titleKey: 'landing_feature3_title', descKey: 'landing_feature3_desc' },
  ];

  return (
    <div className={s.landing}>
      {/* Background skeleton animation */}
      <div className={s.bgCanvas}>
        <ParticleSkeleton />
      </div>

      {/* Hero */}
      <div className={s.hero}>
        <div className={s.wordmark}>
          <span className={s.wordmarkW}>W</span>orkout
          {' '}
          <span className={s.wordmarkAccent}>Vision</span>
        </div>
        <p className={s.tagline}>{t('landing_tagline')}</p>
      </div>

      {/* Feature cards */}
      <div className={s.cards}>
        {features.map((f, i) => (
          <div className={s.card} key={i}>
            <div className={s.cardIcon}>{f.icon}</div>
            <div className={s.cardText}>
              <div className={s.cardTitle}>{t(f.titleKey)}</div>
              <div className={s.cardDesc}>{t(f.descKey)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy badge */}
      <div className={s.privacy}>
        <div className={s.privacyIcon}><IconShield /></div>
        <span className={s.privacyText}>{t('landing_privacy')}</span>
      </div>

      {/* CTA */}
      <button className={s.cta} onClick={handleStart}>
        {t('landing_cta')}
      </button>

      {/* Footer */}
      <div className={s.footer}>{t('landing_footer')}</div>
    </div>
  );
}
