import { useState } from 'react';
import { useT } from '../lib/LanguageContext';

const GOALS = ['general', 'strength', 'hypertrophy', 'endurance', 'weight_loss'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
const STEPS = 2;

export default function Onboarding({ profile, onComplete }) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name || '');
  const [experience, setExperience] = useState(profile?.experience || 'intermediate');
  const [goal, setGoal] = useState(profile?.goal || 'general');

  const handleFinish = () => {
    onComplete({ name: name.trim(), experience, goal, profileComplete: true });
  };

  return (
    <div className="onboarding">
      {/* Progress dots */}
      <div className="onboarding-progress">
        {Array.from({ length: STEPS }, (_, i) => (
          <div
            key={i}
            className={`onboarding-dot${i === step ? ' active' : i < step ? ' done' : ''}`}
          />
        ))}
      </div>

      <div className="onboarding-content">
        {step === 0 && (
          <div className="onboarding-step">
            <div className="onboarding-icon-large">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 style={{ textAlign: 'center', marginBottom: 4 }}>{t('onb_step1_title')}</h2>
            <p className="onboarding-tagline">{t('onb_step1_desc')}</p>

            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {t('name')}
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                  style={{
                    display: 'block', width: '100%', marginTop: 6,
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
                    color: 'var(--text-primary)', fontSize: '0.95rem',
                  }}
                />
              </label>
              <div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t('experience')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {EXPERIENCE.map(exp => (
                    <button
                      key={exp}
                      onClick={() => setExperience(exp)}
                      className={`btn ${experience === exp ? 'btn-primary' : ''}`}
                      style={{
                        flex: 1, padding: '8px 4px', fontSize: '0.82rem',
                        ...(experience !== exp ? {
                          background: 'var(--glass-bg)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--text-secondary)',
                        } : {}),
                      }}
                    >
                      {t(`experience_${exp}`) || exp}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-step">
            <div className="onboarding-icon-large">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 style={{ textAlign: 'center', marginBottom: 4 }}>{t('onb_step2_title')}</h2>
            <p className="onboarding-tagline">{t('onb_step2_desc')}</p>

            <div className="onboarding-features">
              {GOALS.map(g => (
                <button
                  key={g}
                  className={`onboarding-feature${goal === g ? ' selected' : ''}`}
                  onClick={() => setGoal(g)}
                  style={goal === g ? {
                    borderLeftColor: 'var(--bio-cyan)',
                    background: 'rgba(0,240,255,0.06)',
                    opacity: 1,
                    animation: 'none',
                  } : { animation: 'none', opacity: 1 }}
                >
                  {t(`goal_${g}`) || g}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="onboarding-actions">
        {step === 0 ? (
          <>
            <button
              className="btn"
              style={{ color: 'var(--text-secondary)', background: 'transparent' }}
              onClick={handleFinish}
            >
              {t('skip')}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(1)}>
              {t('next')}
            </button>
          </>
        ) : (
          <>
            <button
              className="btn"
              style={{ color: 'var(--text-secondary)', background: 'transparent' }}
              onClick={() => setStep(0)}
            >
              {t('back') || 'Back'}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleFinish}>
              {t('finish')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
