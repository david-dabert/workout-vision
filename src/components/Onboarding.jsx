import React, { useState, useEffect } from 'react';
import { Dumbbell, Target, Activity, ChevronRight, ChevronLeft, Check, Play, ClipboardCheck, SkipForward } from 'lucide-react';
import { useT } from '../lib/LanguageContext';
import { INJURY_LABELS } from '../lib/injuries';
import { getExerciseIllustration } from '../lib/exercises';
import ResultCard from './ResultCard';

const TOTAL_STEPS = 5;

const DEMO_RESULT = {
  fileName: 'demo_squat.mp4',
  exerciseName: 'Barbell Back Squat',
  exercise: 'squat',
  reps: 8,
  duration: 32,
  formScore: 78,
  repHistory: [
    { score: 82, issues: [] },
    { score: 85, issues: [] },
    { score: 90, issues: [] },
    { score: 80, issues: ['knee_cave'] },
    { score: 78, issues: ['knee_cave'] },
    { score: 74, issues: ['forward_lean', 'knee_cave'] },
    { score: 70, issues: ['forward_lean'] },
    { score: 65, issues: ['forward_lean', 'depth_short'] },
  ],
  bioAnalysis: {
    movementQuality: 76,
    timeUnderTension: {
      eccentric: 2.1,
      concentric: 1.4,
      total: 28.0,
      perRep: [
        { eccentric: 2.2, concentric: 1.3 },
        { eccentric: 2.3, concentric: 1.3 },
        { eccentric: 2.1, concentric: 1.4 },
        { eccentric: 2.0, concentric: 1.5 },
        { eccentric: 2.0, concentric: 1.5 },
        { eccentric: 1.9, concentric: 1.6 },
        { eccentric: 1.8, concentric: 1.7 },
        { eccentric: 1.7, concentric: 1.8 },
      ],
    },
    velocity: {
      perRep: [0.52, 0.50, 0.48, 0.46, 0.44, 0.41, 0.38, 0.35],
      trend: 'declining',
    },
    fatigue: {
      index: 32,
      velocityDropoff: 33,
      curve: [100, 96, 92, 88, 85, 79, 73, 67],
    },
    rangeOfMotion: {
      avgDegrees: 112,
      consistency: 84,
      perRep: [118, 120, 119, 114, 112, 108, 105, 100],
    },
    asymmetry: {
      score: 8,
    },
  },
  report: {
    summary: 'Good set overall. Form held well through rep 5, then fatigue caused a forward lean and slightly shortened depth on the last 3 reps. Focus on bracing through the bottom position as you tire.',
    highlights: [
      'Strong first 3 reps with full depth and controlled tempo',
      'Consistent eccentric tempo in the 2-second range',
    ],
    improvements: [
      'Brace harder through reps 6-8 to prevent forward lean',
      'Maintain depth on final reps — consider reducing weight by 5%',
      'Try a pause squat at the bottom to build confidence in the hole',
    ],
  },
};

const INJURY_AREAS = ['lower_back', 'shoulder', 'knee', 'wrist', 'hip', 'ankle', 'neck', 'elbow'];

export default function Onboarding({ onComplete }) {
  const { t } = useT();
  const [step, setStep] = useState(1);
  const [showDemo, setShowDemo] = useState(false);
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
    if (step === 3) {
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

  if (showDemo) {
    return (
      <div className="onboarding">
        <div className="onboarding-content" style={{ paddingBottom: 80 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 4px' }}>Demo Analysis</h2>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              This is what your analysis will look like
            </p>
          </div>
          <ResultCard result={DEMO_RESULT} />
        </div>
        <div className="onboarding-actions">
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowDemo(false)}
            style={{
              background: 'linear-gradient(135deg, #00f5d4, #00e676)',
              color: '#000',
              fontWeight: 800,
              fontSize: '1rem',
              padding: '16px 32px',
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(0,245,212,0.25)',
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              width: '100%',
              fontFamily: 'var(--font-display, inherit)',
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            Continue Setup
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding">
      {/* Premium progress indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 40px', marginBottom: 32 }}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <React.Fragment key={i}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i + 1 <= step ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)',
              boxShadow: i + 1 <= step ? '0 0 8px rgba(0,245,212,0.3)' : 'none',
              transition: 'all 0.4s var(--ease-spring)',
              transform: i + 1 === step ? 'scale(1.3)' : 'scale(1)',
            }} />
            {i < TOTAL_STEPS - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: i + 1 < step ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.06)',
                transition: 'background 0.4s',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="onboarding-content">
        <div key={step} style={{
          animation: 'fadeInUp 0.4s cubic-bezier(0, 0, 0.2, 1) both',
        }}>
          {step === 1 && <StepWelcome onTryDemo={() => setShowDemo(true)} />}
          {step === 2 && (
            <StepMovementAssessment
              onStartAssessment={() => { update('baselineAssessmentPending', true); next(); }}
              onSkip={() => next()}
            />
          )}
          {step === 3 && <StepBasicInfo data={data} update={update} />}
          {step === 4 && <StepFitnessInfo data={data} update={update} toggleInjury={toggleInjury} />}
          {step === 5 && <StepSummary data={data} />}
        </div>
      </div>

      {step !== 2 && (
        <div className="onboarding-actions">
          {step > 1 && (
            <button
              onClick={back}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)',
                padding: '12px 24px',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ChevronLeft size={16} />
              {t('back')}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              disabled={!canAdvance()}
              style={{
                background: 'linear-gradient(135deg, #00f5d4, #00e676)',
                color: '#000',
                fontWeight: 800,
                fontSize: '1rem',
                padding: '16px 32px',
                borderRadius: 16,
                border: 'none',
                cursor: canAdvance() ? 'pointer' : 'not-allowed',
                boxShadow: '0 4px 20px rgba(0,245,212,0.25)',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                width: '100%',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: canAdvance() ? 1 : 0.3,
              }}
            >
              {step === 1 ? t('get_started') : t('next')}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={finish}
              style={{
                background: 'linear-gradient(135deg, #00f5d4, #00e676)',
                color: '#000',
                fontWeight: 800,
                fontSize: '1rem',
                padding: '16px 32px',
                borderRadius: 16,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,245,212,0.25)',
                transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                width: '100%',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {t('finish')}
              <Check size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome({ onTryDemo }) {
  const { t } = useT();
  return (
    <div className="onboarding-step text-center">
      {/* Breathing orb */}
      <div style={{
        width: 120, height: 120, borderRadius: '50%', margin: '0 auto 24px',
        background: 'radial-gradient(circle at 40% 40%, rgba(196,181,253,0.4), rgba(0,245,212,0.2) 50%, rgba(255,107,157,0.1) 80%, transparent)',
        boxShadow: '0 0 60px rgba(0,245,212,0.15), 0 0 120px rgba(196,181,253,0.08)',
        animation: 'breathe 4s ease-in-out infinite, float 6s ease-in-out infinite',
      }} />
      <h1>Workout <span style={{ color: 'var(--accent)' }}>Vision</span></h1>
      <p className="onboarding-tagline">
        {t('welcome_subtitle')}
      </p>
      <div className="onboarding-features">
        <div className="onboarding-feature">
          <Activity size={20} color="var(--accent)" />
          <span>{t('nav_video_title')}</span>
        </div>
        <div className="onboarding-feature">
          <Target size={20} color="var(--accent)" />
          <span>{t('nav_log_title')}</span>
        </div>
        <div className="onboarding-feature">
          <Dumbbell size={20} color="var(--accent)" />
          <span>{t('onb_feature_progress')}</span>
        </div>
      </div>
      <button
        onClick={onTryDemo}
        style={{
          marginTop: 16,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.4)',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 24px',
          borderRadius: 12,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <Play size={14} />
        Try Demo
      </button>
    </div>
  );
}

/* ── Step 2: Movement Assessment ── */
const BASELINE_EXERCISES = [
  {
    key: 'squat',
    name: 'Squat',
    description: 'Assesses lower body mobility, hip hinge depth, and knee tracking under bodyweight.',
  },
  {
    key: 'pushup',
    name: 'Push-up',
    description: 'Assesses upper body pressing strength, core stability, and scapular control.',
  },
  {
    key: 'plank',
    name: 'Plank',
    description: 'Assesses core endurance, spinal alignment, and shoulder girdle stability.',
  },
];

function StepMovementAssessment({ onStartAssessment, onSkip }) {
  return (
    <div className="onboarding-step">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="onboarding-icon-large" style={{ marginBottom: 8 }}>
          <ClipboardCheck size={40} />
        </div>
        <h2 style={{ margin: '0 0 4px' }}>Movement Assessment</h2>
        <p className="text-muted text-sm" style={{ margin: 0 }}>
          Record three baseline exercises so the app can track your progress from day one.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {BASELINE_EXERCISES.map((ex) => {
          const illustration = getExerciseIllustration(ex.key, 1);
          return (
            <div key={ex.key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}>
              {illustration && (
                <img
                  src={illustration}
                  alt={ex.name}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 8,
                    objectFit: 'cover',
                    background: 'rgba(255,255,255,0.04)',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: '0.9rem' }}>{ex.name}</strong>
                <p className="text-muted text-sm" style={{ margin: '2px 0 0', lineHeight: 1.35 }}>
                  {ex.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onStartAssessment}
          style={{
            background: 'linear-gradient(135deg, #00f5d4, #00e676)',
            color: '#000',
            fontWeight: 800,
            fontSize: '1rem',
            padding: '16px 32px',
            borderRadius: 16,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,245,212,0.25)',
            transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            width: '100%',
            fontFamily: 'var(--font-display, inherit)',
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <ClipboardCheck size={16} />
          Start Assessment
        </button>
        <button
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)',
            padding: '12px 24px',
            borderRadius: 12,
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            transition: 'all 0.2s',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <SkipForward size={14} />
          Skip for now
        </button>
      </div>
    </div>
  );
}

/* ── Step 3: Basic Info ── */
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

/* ── Step 4: Fitness Info ── */
function StepFitnessInfo({ data, update, toggleInjury }) {
  const { t, lang } = useT();
  return (
    <div className="onboarding-step">
      <h2>{t('onb_step2_title')}</h2>
      <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
        {t('onb_step2_desc')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>{t('experience')}</span>
          <select value={data.experience} onChange={(e) => update('experience', e.target.value)}>
            <option value="beginner">{t('beginner')}</option>
            <option value="intermediate">{t('intermediate')}</option>
            <option value="advanced">{t('advanced')}</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>{t('goal')}</span>
          <select value={data.goal} onChange={(e) => update('goal', e.target.value)}>
            <option value="general">{t('general_fitness')}</option>
            <option value="strength">{t('strength')}</option>
            <option value="hypertrophy">{t('muscle_growth')}</option>
            <option value="endurance">{t('endurance')}</option>
            <option value="weight_loss">{t('weight_loss')}</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 700 }}>{t('activity_level')}</span>
          <select value={data.activityLevel} onChange={(e) => update('activityLevel', e.target.value)}>
            <option value="sedentary">{t('sedentary')}</option>
            <option value="light">{t('light_activity')}</option>
            <option value="moderate">{t('moderate_activity')}</option>
            <option value="active">{t('active_activity')}</option>
            <option value="veryActive">{t('very_active_activity')}</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 20 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: 10 }}>
          {t('injuries')}:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                {INJURY_LABELS[area]?.[lang] || area.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Step 5: Summary ── */
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
            <Activity size={20} />
          </div>
          <div>
            <strong>{t('nav_video_title')}</strong>
            <p className="text-muted text-sm">{t('nav_video_desc')}</p>
          </div>
        </div>
        <div className="onboarding-benefit">
          <div className="onboarding-benefit-icon">
            <Target size={20} />
          </div>
          <div>
            <strong>{t('nav_log_title')}</strong>
            <p className="text-muted text-sm">{t('nav_log_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
