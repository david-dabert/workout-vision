import { useState } from 'react';
import { useT } from '../lib/LanguageContext';

const GOALS = ['general', 'strength', 'hypertrophy', 'endurance', 'weight_loss'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];

const GOAL_ICONS = {
  general: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
    </svg>
  ),
  strength: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" /><path d="M12 6.5v11" />
      <rect x="3" y="8" width="3" height="8" rx="1" /><rect x="18" y="8" width="3" height="8" rx="1" />
      <rect x="1" y="10" width="2" height="4" rx="0.5" /><rect x="21" y="10" width="2" height="4" rx="0.5" />
    </svg>
  ),
  hypertrophy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 20l4-16m2 16l4-16" /><path d="M3 8h18" /><path d="M3 16h18" />
    </svg>
  ),
  endurance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  weight_loss: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
};

const EXP_ICONS = {
  beginner: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  intermediate: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="9" />
    </svg>
  ),
  advanced: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

export default function Onboarding({ profile, onComplete }) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.name || '');
  const [experience, setExperience] = useState(profile?.experience || 'intermediate');
  const [goal, setGoal] = useState(profile?.goal || 'general');
  const [age, setAge] = useState(profile?.age || '');
  const [sex, setSex] = useState(profile?.sex || '');
  const [weight, setWeight] = useState(profile?.weight || '');
  const [height, setHeight] = useState(profile?.height || '');

  const isBeginner = experience === 'beginner';
  const totalSteps = isBeginner ? 4 : 3;

  const collectData = () => ({
    name: name.trim(),
    experience,
    goal,
    age: age ? Number(age) : undefined,
    sex: sex || undefined,
    weight: weight ? Number(weight) : undefined,
    height: height ? Number(height) : undefined,
    profileComplete: true,
  });

  const handleFinish = (navigateTo) => {
    onComplete(collectData(), navigateTo);
  };

  const progressPercent = ((step + 1) / totalSteps) * 100;

  return (
    <div className="onboarding">
      {/* Ambient glow background */}
      <div className="onb-glow" />

      {/* Progress bar */}
      <div className="onb-progress-bar">
        <div className="onb-progress-track">
          <div className="onb-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="onb-progress-label">{step + 1}/{totalSteps}</span>
      </div>

      <div className="onboarding-content">
        {/* Step 1: Name + Experience */}
        {step === 0 && (
          <div className="onboarding-step">
            <div className="onb-hero">
              <div className="onb-wordmark">
                <span className="onb-w">W</span>orkout
                <span className="onb-accent">Vision</span>
              </div>
              <p className="onb-subtitle">{t('onb_step1_desc')}</p>
            </div>

            <div className="onb-form">
              <div className="onb-field">
                <label className="onb-label" htmlFor="onb-name">{t('name')}</label>
                <input
                  id="onb-name"
                  type="text"
                  className="onb-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('name')}
                  autoFocus
                />
              </div>

              <div className="onb-field">
                <label className="onb-label">{t('experience')}</label>
                <div className="onb-chips" role="radiogroup" aria-label={t('experience')}>
                  {EXPERIENCE.map(exp => (
                    <button
                      key={exp}
                      onClick={() => setExperience(exp)}
                      className={`onb-chip${experience === exp ? ' selected' : ''}`}
                      role="radio"
                      aria-checked={experience === exp}
                    >
                      <span className="onb-chip-num">{EXP_ICONS[exp]}</span>
                      {t(`experience_${exp}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Body measurements */}
        {step === 1 && (
          <div className="onboarding-step">
            <div className="onb-hero">
              <h2 className="onb-title">{t('onb_step2_body_title')}</h2>
              <p className="onb-subtitle">{t('onb_step2_body_desc')}</p>
            </div>

            <div className="onb-form">
              <div className="onb-body-grid">
                <div className="onb-field">
                  <label className="onb-label" htmlFor="onb-age">{t('age')}</label>
                  <input
                    id="onb-age"
                    type="number"
                    className="onb-input"
                    value={age}
                    onChange={e => setAge(e.target.value)}
                    placeholder="28"
                    inputMode="numeric"
                    min="10"
                    max="120"
                  />
                </div>

                <div className="onb-field">
                  <label className="onb-label">{t('sex')}</label>
                  <div className="onb-chips" role="radiogroup" aria-label={t('sex')}>
                    <button
                      onClick={() => setSex('male')}
                      className={`onb-chip${sex === 'male' ? ' selected' : ''}`}
                      role="radio"
                      aria-checked={sex === 'male'}
                    >
                      {t('male')}
                    </button>
                    <button
                      onClick={() => setSex('female')}
                      className={`onb-chip${sex === 'female' ? ' selected' : ''}`}
                      role="radio"
                      aria-checked={sex === 'female'}
                    >
                      {t('female')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="onb-body-grid">
                <div className="onb-field">
                  <label className="onb-label" htmlFor="onb-weight">{t('weight')}</label>
                  <div className="onb-input-with-unit">
                    <input
                      id="onb-weight"
                      type="number"
                      className="onb-input"
                      value={weight}
                      onChange={e => setWeight(e.target.value)}
                      placeholder="70"
                      inputMode="decimal"
                      min="20"
                      max="300"
                    />
                    <span className="onb-unit">{t('kg')}</span>
                  </div>
                </div>

                <div className="onb-field">
                  <label className="onb-label" htmlFor="onb-height">{t('height')}</label>
                  <div className="onb-input-with-unit">
                    <input
                      id="onb-height"
                      type="number"
                      className="onb-input"
                      value={height}
                      onChange={e => setHeight(e.target.value)}
                      placeholder="175"
                      inputMode="numeric"
                      min="50"
                      max="250"
                    />
                    <span className="onb-unit">{t('cm')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Goal selection */}
        {step === 2 && (
          <div className="onboarding-step">
            <div className="onb-hero">
              <h2 className="onb-title">{t('onb_step2_title')}</h2>
              <p className="onb-subtitle">{t('onb_step2_desc')}</p>
            </div>

            <div className="onb-goals" role="radiogroup" aria-label={t('onb_step2_title')}>
              {GOALS.map((g, i) => (
                <button
                  key={g}
                  className={`onb-goal${goal === g ? ' selected' : ''}`}
                  onClick={() => setGoal(g)}
                  style={{ animationDelay: `${i * 0.06}s` }}
                  role="radio"
                  aria-checked={goal === g}
                >
                  <span className="onb-goal-icon" aria-hidden="true">{GOAL_ICONS[g]}</span>
                  <span className="onb-goal-label">{t(`goal_${g}`)}</span>
                  {goal === g && (
                    <svg className="onb-goal-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Exercise Guide teaser (beginners only) */}
        {step === 3 && isBeginner && (
          <div className="onboarding-step">
            <div className="onb-hero">
              <div className="onb-exercises-icon" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  <path d="M8 7h8" /><path d="M8 11h6" />
                </svg>
              </div>
              <h2 className="onb-title">{t('onb_exercises_title')}</h2>
              <p className="onb-subtitle">{t('onb_exercises_desc')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="onb-actions">
        {step === 0 ? (
          <>
            <button className="onb-skip" onClick={() => handleFinish()}>{t('skip')}</button>
            <button className="onb-next" onClick={() => setStep(1)}>{t('next')}</button>
          </>
        ) : step === 1 ? (
          <>
            <button className="onb-back" onClick={() => setStep(0)} aria-label={t('back')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <button className="onb-next" onClick={() => setStep(2)}>{t('next')}</button>
          </>
        ) : step === 2 && !isBeginner ? (
          <>
            <button className="onb-back" onClick={() => setStep(1)} aria-label={t('back')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <button className="onb-next" onClick={() => handleFinish()}>{t('finish')}</button>
          </>
        ) : step === 2 && isBeginner ? (
          <>
            <button className="onb-back" onClick={() => setStep(1)} aria-label={t('back')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <button className="onb-next" onClick={() => setStep(3)}>{t('next')}</button>
          </>
        ) : (
          /* step === 3 (beginner exercise teaser) */
          <>
            <button className="onb-skip" onClick={() => handleFinish()}>{t('skip')}</button>
            <button className="onb-next" onClick={() => handleFinish('exercises')}>{t('onb_browse_exercises')}</button>
          </>
        )}
      </div>
    </div>
  );
}
