import { useState, useEffect } from 'react';
import { Dumbbell, Target, Activity, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useT } from '../lib/LanguageContext';

const TOTAL_STEPS = 4;

const INJURY_AREAS = ['lower_back', 'shoulder', 'knee', 'wrist', 'hip', 'ankle', 'neck', 'elbow'];

export default function Onboarding({ onComplete }) {
  const { t } = useT();
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    name: '',
    age: '',
    sex: 'male',
    weight: '',
    height: '',
    experience: 'intermediate',
    goal: 'general',
    activityLevel: 'moderate',
    injuries: [],
  });

  const update = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const canAdvance = () => {
    if (step === 2) {
      return data.name.trim() && data.age && data.weight && data.height;
    }
    return true;
  };

  const next = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  const finish = async () => {
    onComplete(data);
  };

  const toggleInjury = (area) => {
    const current = data.injuries || [];
    const next = current.includes(area)
      ? current.filter(i => i !== area)
      : [...current, area];
    update('injuries', next);
  };

  return (
    <div className="onboarding">
      {/* Progress dots */}
      <div className="onboarding-progress">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={`onboarding-dot ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'done' : ''}`}
          />
        ))}
      </div>

      <div className="onboarding-content">
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepBasicInfo data={data} update={update} />}
        {step === 3 && <StepFitnessInfo data={data} update={update} toggleInjury={toggleInjury} />}
        {step === 4 && <StepSummary data={data} />}
      </div>

      <div className="onboarding-actions">
        {step > 1 && (
          <button className="btn btn-ghost" onClick={back}>
            <ChevronLeft size={16} />
            {t('back')}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {step < TOTAL_STEPS ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={next}
            disabled={!canAdvance()}
          >
            {step === 1 ? t('get_started') : t('next')}
            <ChevronRight size={16} />
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={finish}>
            {t('finish')}
            <Check size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome() {
  const { t } = useT();
  return (
    <div className="onboarding-step text-center">
      <div className="onboarding-icon-large">
        <Dumbbell size={48} />
      </div>
      <h1>Workout <span style={{ color: 'var(--accent)' }}>Vision</span></h1>
      <p className="onboarding-tagline">
        {t('welcome_subtitle')}
      </p>
      <div className="onboarding-features">
        <div className="onboarding-feature">
          <Activity size={20} color="var(--accent)" />
          <span>{t('onb_feature_live')}</span>
        </div>
        <div className="onboarding-feature">
          <Target size={20} color="var(--accent)" />
          <span>{t('onb_feature_progress')}</span>
        </div>
        <div className="onboarding-feature">
          <Dumbbell size={20} color="var(--accent)" />
          <span>{t('onb_feature_nutrition')}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Basic Info ── */
function StepBasicInfo({ data, update }) {
  const { t } = useT();
  return (
    <div className="onboarding-step">
      <h2>{t('onb_step1_title')}</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        {t('onb_step1_desc')}
      </p>
      <div className="form-grid">
        <label className="full-width">
          <span>{t('name')}</span>
          <input
            type="text"
            value={data.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Your name"
            autoFocus
          />
        </label>
        <label>
          <span>{t('age')}</span>
          <input
            type="number"
            value={data.age}
            onChange={(e) => update('age', e.target.value)}
            placeholder="e.g. 28"
          />
        </label>
        <label>
          <span>{t('sex')}</span>
          <select value={data.sex} onChange={(e) => update('sex', e.target.value)}>
            <option value="male">{t('male')}</option>
            <option value="female">{t('female')}</option>
          </select>
        </label>
        <label>
          <span>{t('weight_kg')}</span>
          <input
            type="number"
            value={data.weight}
            onChange={(e) => update('weight', e.target.value)}
            placeholder="e.g. 75"
          />
        </label>
        <label>
          <span>{t('height_cm')}</span>
          <input
            type="number"
            value={data.height}
            onChange={(e) => update('height', e.target.value)}
            placeholder="e.g. 178"
          />
        </label>
      </div>
    </div>
  );
}

/* ── Step 3: Fitness Info ── */
function StepFitnessInfo({ data, update, toggleInjury }) {
  const { t } = useT();
  return (
    <div className="onboarding-step">
      <h2>{t('onb_step2_title')}</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
        {t('onb_step2_desc')}
      </p>

      <div className="form-grid" style={{ gap: 10 }}>
        <label className="full-width">
          <span>{t('experience')}</span>
          <select value={data.experience} onChange={(e) => update('experience', e.target.value)}>
            <option value="beginner">{t('beginner')}</option>
            <option value="intermediate">{t('intermediate')}</option>
            <option value="advanced">{t('advanced')}</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          <span>{t('goal')}</span>
          <select value={data.goal} onChange={(e) => update('goal', e.target.value)}>
            <option value="general">{t('general_fitness')}</option>
            <option value="strength">{t('strength')}</option>
            <option value="hypertrophy">{t('muscle_growth')}</option>
            <option value="endurance">{t('endurance')}</option>
            <option value="weight_loss">{t('weight_loss')}</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          <span>{t('activity_level')}</span>
          <select value={data.activityLevel} onChange={(e) => update('activityLevel', e.target.value)}>
            <option value="sedentary">{t('sedentary')}</option>
            <option value="light">{t('light_activity')}</option>
            <option value="moderate">{t('moderate_activity')}</option>
            <option value="active">{t('active_activity')}</option>
            <option value="veryActive">{t('very_active_activity')}</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
          {t('injuries')}:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {INJURY_AREAS.map(area => {
            const active = (data.injuries || []).includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleInjury(area)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                  border: active ? '1px solid var(--red)' : '1px solid rgba(255,255,255,0.12)',
                  background: active ? 'rgba(255,59,92,0.15)' : 'rgba(255,255,255,0.04)',
                  color: active ? 'var(--red)' : 'var(--text-secondary, var(--muted))',
                  cursor: 'pointer',
                }}
              >
                {area.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Step 4: Summary ── */
function StepSummary({ data }) {
  const { t } = useT();
  const goalLabels = {
    general: t('general_fitness'),
    strength: t('strength'),
    hypertrophy: t('muscle_growth'),
    endurance: t('endurance'),
    weight_loss: t('weight_loss'),
  };

  return (
    <div className="onboarding-step">
      <h2>{t('done')}, {data.name || 'there'}!</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        {t('welcome_subtitle')}
      </p>

      <div className="card" style={{ marginBottom: 10 }}>
        <h4 style={{ margin: 0 }}>{t('profile')}</h4>
        <div className="onboarding-summary-grid">
          <div className="onboarding-summary-item">
            <span className="stat-label">{t('goal')}</span>
            <span className="stat-value">{goalLabels[data.goal] || data.goal}</span>
          </div>
          <div className="onboarding-summary-item">
            <span className="stat-label">{t('experience')}</span>
            <span className="stat-value" style={{ textTransform: 'capitalize' }}>{data.experience}</span>
          </div>
          <div className="onboarding-summary-item">
            <span className="stat-label">{t('weight_kg')}</span>
            <span className="stat-value">{data.weight} kg</span>
          </div>
          <div className="onboarding-summary-item">
            <span className="stat-label">{t('height_cm')}</span>
            <span className="stat-value">{data.height} cm</span>
          </div>
        </div>
      </div>

      <div className="onboarding-benefits">
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Target size={20} />
          </div>
          <div>
            <strong>{t('nav_plan_title')}</strong>
            <p className="text-muted text-sm">{t('nav_plan_desc')}</p>
          </div>
        </div>
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Activity size={20} />
          </div>
          <div>
            <strong>{t('onb_feature_live')}</strong>
            <p className="text-muted text-sm">{t('nav_live_desc')}</p>
          </div>
        </div>
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Dumbbell size={20} />
          </div>
          <div>
            <strong>{t('onb_feature_nutrition')}</strong>
            <p className="text-muted text-sm">{t('nav_food_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
