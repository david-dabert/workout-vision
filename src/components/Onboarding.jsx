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
            <h2 style={{ margin: '0 0 4px' }}>{t('demo_analysis_title')}</h2>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              {t('demo_analysis_desc')}
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
            {t('continue_setup')}
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
        {t('try_demo')}
      </button>
    </div>
  );
}

/* ── Step 2: Movement Assessment ── */
const BASELINE_EXERCISES = [
  { key: 'squat',  nameKey: 'onb_squat_name',  descKey: 'onb_squat_desc' },
  { key: 'pushup', nameKey: 'onb_pushup_name', descKey: 'onb_pushup_desc' },
  { key: 'plank',  nameKey: 'onb_plank_name',  descKey: 'onb_plank_desc' },
];

/* Accent colours for each exercise card */
const EXERCISE_ACCENTS = [
  { border: '#00f5d4', glow: 'rgba(0,245,212,0.18)', label: '#00f5d4' },   // squat  — bio-cyan
  { border: '#ff6b9d', glow: 'rgba(255,107,157,0.18)', label: '#ff6b9d' }, // pushup — rose
  { border: '#c4b5fd', glow: 'rgba(196,181,253,0.18)', label: '#c4b5fd' }, // plank  — lavender
];

function StepMovementAssessment({ onStartAssessment, onSkip }) {
  const { t } = useT();
  return (
    <div className="onboarding-step">

      {/* ── Hero: pulsing crosshair / target orb ── */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ position: 'relative', width: 112, height: 112, margin: '0 auto 20px' }}>
          {/* Outer ring — slow pulse */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '1.5px solid rgba(0,245,212,0.25)',
            animation: 'pulseGlow 3s ease-in-out infinite',
          }} />
          {/* Middle ring */}
          <div style={{
            position: 'absolute', inset: 14, borderRadius: '50%',
            border: '1.5px solid rgba(196,181,253,0.30)',
            animation: 'pulseGlow 3s ease-in-out infinite 0.6s',
          }} />
          {/* Inner filled orb */}
          <div style={{
            position: 'absolute', inset: 28, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 38%, rgba(196,181,253,0.55), rgba(0,245,212,0.30) 55%, rgba(255,107,157,0.15) 85%, transparent)',
            boxShadow: '0 0 32px rgba(0,245,212,0.22), 0 0 64px rgba(196,181,253,0.10)',
            animation: 'breathe 3.5s ease-in-out infinite, float 5s ease-in-out infinite',
          }} />
          {/* Centre dot */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 8, height: 8, borderRadius: '50%',
            background: '#00f5d4',
            boxShadow: '0 0 10px rgba(0,245,212,0.8)',
          }} />
          {/* Cross-hair lines */}
          {[
            { top: '50%', left: 0, width: 12, height: 1.5, transform: 'translateY(-50%)' },
            { top: '50%', right: 0, width: 12, height: 1.5, transform: 'translateY(-50%)' },
            { left: '50%', top: 0, height: 12, width: 1.5, transform: 'translateX(-50%)' },
            { left: '50%', bottom: 0, height: 12, width: 1.5, transform: 'translateX(-50%)' },
          ].map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              background: 'rgba(0,245,212,0.6)',
              borderRadius: 2,
              ...s,
            }} />
          ))}
        </div>

        <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display, inherit)', letterSpacing: '-0.02em' }}>
          {t('movement_assessment')}
        </h2>
        <p className="text-muted text-sm" style={{ margin: 0, lineHeight: 1.5, maxWidth: 300, marginInline: 'auto' }}>
          {t('movement_assessment_desc')}
        </p>
      </div>

      {/* ── Exercise cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {BASELINE_EXERCISES.map((ex, idx) => {
          const illustration = getExerciseIllustration(ex.key, 1);
          const accent = EXERCISE_ACCENTS[idx];
          return (
            <div
              key={ex.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.035)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderLeft: `3px solid ${accent.border}`,
                boxShadow: `0 2px 20px ${accent.glow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
                animation: `fadeInUp 0.45s cubic-bezier(0, 0, 0.2, 1) ${0.08 + idx * 0.1}s both`,
              }}
            >
              {/* Image */}
              {illustration ? (
                <img
                  src={illustration}
                  alt={t(ex.nameKey)}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    objectFit: 'cover',
                    background: 'rgba(255,255,255,0.05)',
                    flexShrink: 0,
                    border: `1px solid ${accent.border}33`,
                  }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 12, flexShrink: 0,
                  background: `radial-gradient(circle at 40% 40%, ${accent.border}22, transparent 70%)`,
                  border: `1px solid ${accent.border}33`,
                }} />
              )}

              {/* Text */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                }}>
                  <strong style={{
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-display, inherit)',
                    letterSpacing: '-0.01em',
                    color: '#fff',
                  }}>
                    {t(ex.nameKey)}
                  </strong>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                    color: accent.label,
                    background: `${accent.border}18`,
                    border: `1px solid ${accent.border}30`,
                    borderRadius: 20, padding: '1px 7px',
                    textTransform: 'uppercase',
                  }}>
                    {idx === 0 ? 'Lower' : idx === 1 ? 'Upper' : 'Core'}
                  </span>
                </div>
                <p className="text-muted text-sm" style={{ margin: 0, lineHeight: 1.4, fontSize: '0.78rem' }}>
                  {t(ex.descKey)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            boxShadow: '0 4px 24px rgba(0,245,212,0.30), 0 1px 0 rgba(255,255,255,0.2) inset',
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
          <Target size={17} />
          {t('start_assessment')}
        </button>

        <button
          onClick={onSkip}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.28)',
            padding: '10px 24px',
            borderRadius: 12,
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 500,
            letterSpacing: '0.02em',
            transition: 'color 0.2s',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {t('skip_for_now')}
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
