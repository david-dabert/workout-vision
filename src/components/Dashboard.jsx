import { useState, useEffect, useMemo } from 'react';
import { getAllWorkouts, calculateBaselines } from '../lib/storage';
import { EXERCISES } from '../lib/exercises';
import { estimateOneRepMax, getStrengthLevel, calculateWorkloadRatio, suggestNextWorkout } from '../lib/coach';
import { useProfile } from '../lib/ProfileContext';
import MuscleMap from './MuscleMap';
import { useT } from '../lib/LanguageContext';
import { gradeFromScore, translateMuscle } from '../lib/utils';
import VisionScoreHero from './VisionScoreHero';
import ChallengeBar from './ChallengeBar';
import InjuryRiskCard from './InjuryRiskCard';
import { calculateSmartStreak } from '../lib/prSystem';
import WorkoutOfTheWeek from './WorkoutOfTheWeek';
import { ChallengeResponseView } from './ChallengeBar';
import MilestoneToast from './MilestoneToast';
import { Icon } from '../lib/icons';
import css from './Dashboard.module.css';

const getGreetingKey = () => {
  const h = new Date().getHours();
  if (h < 12) return 'good_morning';
  if (h < 17) return 'good_afternoon';
  return 'good_evening';
};

const getMotivationKey = (count) => {
  if (count === 0) return 'motivation_0';
  if (count < 5) return 'motivation_5';
  if (count < 15) return 'motivation_15';
  if (count < 30) return 'motivation_30';
  return 'motivation_max';
};

// Smart streak: counts consecutive scheduled training days, not calendar days.
// Falls back to Mon/Wed/Fri if no trainingDays set in profile.
const calculateStreak = (workouts, trainingDays) => {
  return calculateSmartStreak(workouts, trainingDays);
};

const getLast7Days = (workouts, lang = 'en') => {
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    const dayWorkouts = workouts.filter(w => new Date(w.date).toDateString() === dateStr);
    days.push({
      label: d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' }).replace('.', '').slice(0, 3),
      count: dayWorkouts.length,
      isToday: i === 0,
    });
  }
  return days;
};

export default function Dashboard({ profile, modelStatus, onRetryModel, onNavigate, challenge, challengeResponse, onDismissResponse }) {
  const { t, lang, setLang } = useT();
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [allWorkouts, setAllWorkouts] = useState([]);
  const [showMore, setShowMore] = useState(false);

  const isCoach = profile?.isCoach === true;

  const statusDot = modelStatus === 'ready' ? 'ready'
    : modelStatus === 'error' ? 'err' : 'pulse';
  const statusText = modelStatus === 'ready' ? t('ai_engine_ready')
    : modelStatus === 'error' ? t('engine_failed') : t('loading_ai');

  useEffect(() => {
    getAllWorkouts().then(all => {
      setAllWorkouts(all);
      setRecentWorkouts(all.slice(0, 10));
    });
  }, []);

  const daysSinceLastWorkout = useMemo(() => {
    if (allWorkouts.length === 0) return -1;
    const last = new Date(allWorkouts[0]?.date || allWorkouts[0]?.createdAt);
    return Math.floor((Date.now() - last.getTime()) / 86400000);
  }, [allWorkouts]);

  const stats = useMemo(() => {
    if (recentWorkouts.length === 0) return null;
    const totalReps = recentWorkouts.reduce((s, w) => s + (w.reps || 0), 0);
    const totalSets = recentWorkouts.length;
    const avgScore = Math.round(recentWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / recentWorkouts.length);
    const totalVolume = recentWorkouts.reduce((s, w) => s + (w.volume || 0), 0);
    const primarySet = new Set();
    const secondarySet = new Set();
    for (const w of recentWorkouts) {
      const ex = EXERCISES[w.exercise];
      if (ex?.muscles) {
        (ex.muscles.primary || []).forEach(m => primarySet.add(m));
        (ex.muscles.secondary || []).forEach(m => secondarySet.add(m));
      }
    }
    return { totalReps, totalSets, avgScore, totalVolume,
      muscles: { primary: [...primarySet], secondary: [...secondarySet] } };
  }, [recentWorkouts]);

  // Last session info for the summary line
  const lastSession = useMemo(() => {
    if (allWorkouts.length === 0) return null;
    const w = allWorkouts[0];
    const score = w.formScore || 0;
    return {
      exercise: w.exerciseName || w.exercise,
      grade: gradeFromScore(score),
      date: new Date(w.date || w.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }),
      score,
    };
  }, [allWorkouts, lang]);

  // Client count for coach mode
  const clientCount = useMemo(() => {
    if (!isCoach || allWorkouts.length === 0) return 0;
    const clients = new Set();
    for (const w of allWorkouts) {
      if (w.clientName) clients.add(w.clientName);
    }
    return clients.size;
  }, [isCoach, allWorkouts]);

  return (
    <div className="home">
      <MilestoneToast />

      {/* ===== SECTION 1: Hero with greeting + last session summary ===== */}
      <div className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-content">
          <div className="home-header">
            <h1 className="logo">
              <span className="logo-w">W</span>orkout
              <span className="logo-accent">Vision</span>
            </h1>
            <div className="lang-toggle">
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
                aria-label="English"
                aria-pressed={lang === 'en'}
              >EN</button>
              <button
                className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
                onClick={() => setLang('fr')}
                aria-label="Français"
                aria-pressed={lang === 'fr'}
              >FR</button>
            </div>
          </div>
          <p className="greeting-text">
            {profile?.name ? `${t(getGreetingKey())}, ${profile.name.split(' ')[0]}` : t(getGreetingKey())}
          </p>
          {lastSession ? (
            <p className="tagline" style={{ fontSize: '0.82rem', opacity: 0.8 }}>
              {t('dash_last_session')}: {lastSession.exercise} — {lastSession.grade} — {lastSession.date}
            </p>
          ) : (
            <p className="tagline">{t(getMotivationKey(allWorkouts.length))}</p>
          )}
          <div className="hero-status-row">
            <div
              className={`engine-status engine-${statusDot}`}
              onClick={modelStatus === 'error' && onRetryModel ? onRetryModel : undefined}
              onKeyDown={modelStatus === 'error' && onRetryModel ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRetryModel(); } } : undefined}
              style={modelStatus === 'error' ? { cursor: 'pointer' } : undefined}
              role={modelStatus === 'error' ? 'button' : 'status'}
              tabIndex={modelStatus === 'error' ? 0 : undefined}
              aria-label={modelStatus === 'error' ? t('retry_engine') : statusText}
            >
              <span className={`engine-dot ${statusDot}`} />
              <span>{modelStatus === 'error' ? t('engine_failed_retry') : statusText}</span>
            </div>
            {!isCoach && calculateStreak(allWorkouts, profile?.trainingDays) > 0 ? (
              <span className="streak-badge">
                <Icon name="fire" size={14} /> {calculateStreak(allWorkouts, profile?.trainingDays)} {profile?.trainingDays ? t('scheduled_streak') : t('days_streak')}
              </span>
            ) : !isCoach && daysSinceLastWorkout >= 2 ? (
              <span className="streak-badge comeback">
                {t('days_since_last', { days: daysSinceLastWorkout })}
              </span>
            ) : isCoach && clientCount > 0 ? (
              <span className="streak-badge">
                {clientCount} {t('dash_clients_analyzed')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Challenge response view (when arriving via response URL) ── */}
      {challengeResponse && (
        <div className={css.challengeWrapper}>
          <ChallengeResponseView response={challengeResponse} onDismiss={onDismissResponse} />
        </div>
      )}

      {/* ── Challenge bar (when arriving via challenge URL) ── */}
      {challenge && (
        <div className={css.challengeWrapper}>
          <ChallengeBar
            challenge={challenge}
            onAccept={() => onNavigate('analyze')}
          />
        </div>
      )}

      {/* ===== SECTION 2: Primary CTA ===== */}
      <div className="action-cards">
        {isCoach ? (
          /* Coach mode: two equal-weight primary buttons */
          <div className={css.coachDualCta}>
            <button
              className="action-primary"
              onClick={() => onNavigate('analyze')}
              aria-label={t('dash_analyze_client')}
              style={{ flex: 1 }}
            >
              <div className="action-primary-glow" />
              <div className="action-primary-content">
                <div className={`action-primary-icon ${css.actionPrimaryIcon}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <div className="action-primary-text">
                  <span className="action-label">{t('dash_analyze_client')}</span>
                </div>
              </div>
            </button>
            <button
              className="action-primary"
              onClick={() => onNavigate('coach')}
              aria-label={t('dash_generate_report')}
              style={{ flex: 1 }}
            >
              <div className="action-primary-glow" />
              <div className="action-primary-content">
                <div className={`action-primary-icon ${css.actionPrimaryIcon}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className="action-primary-text">
                  <span className="action-label">{t('dash_generate_report')}</span>
                </div>
              </div>
            </button>
          </div>
        ) : (
          /* Individual mode: single prominent Analyze Video button */
          <button
            className="action-primary"
            onClick={() => onNavigate('analyze')}
            aria-label={t('nav_video_title')}
            style={{ minHeight: '80px' }}
          >
            <div className="action-primary-glow" />
            <div className="action-primary-content">
              <div className={`action-primary-icon ${css.actionPrimaryIcon}`}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <div className="action-primary-text">
                <span className="action-label">{t('nav_video_title')}</span>
                <span className="action-desc">{t('nav_video_desc')}</span>
              </div>
              <svg className="action-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* ===== SECTION 3: Last result preview card ===== */}
      {recentWorkouts.length > 0 && (() => {
        const w = recentWorkouts[0];
        const score = w.formScore || 0;
        const gradeColor = score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)';
        return (
          <div className="recent-section" style={{ paddingTop: '4px' }}>
            <div className="workout-list">
              <div className="workout-row">
                <div className="workout-grade" style={{ '--grade-color': gradeColor }}>
                  {gradeFromScore(score)}
                </div>
                <div className="workout-info">
                  <span className="workout-name">{w.exerciseName || w.exercise}</span>
                  <span className="workout-meta">
                    {new Date(w.date || w.createdAt).toLocaleDateString()} &middot; {w.reps} {t('reps').toLowerCase()}
                    {w.weight > 0 && ` \u00B7 ${w.weight}kg`}
                  </span>
                </div>
                <div className="workout-reps">
                  <span className="workout-reps-num">{w.reps}</span>
                  <span className="workout-reps-label">reps</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Welcome card for first-time users ── */}
      {allWorkouts.length === 0 && (
        <div className="welcome-card">
          <h3 className="welcome-card-title">{t('welcome_first_run')}</h3>
          <p className="welcome-card-text">{t('welcome_first_run_text')}</p>
          <div className="welcome-card-steps">
            <div className="welcome-step"><span className="welcome-step-num">1</span><span>{t('welcome_step_1')}</span></div>
            <div className="welcome-step"><span className="welcome-step-num">2</span><span>{t('welcome_step_2')}</span></div>
            <div className="welcome-step"><span className="welcome-step-num">3</span><span>{t('welcome_step_3')}</span></div>
          </div>
          <button className="btn btn-primary" onClick={() => onNavigate('analyze')}>{t('nav_video_title')}</button>
        </div>
      )}

      {/* ===== Secondary actions (below the fold) ===== */}
      <div className="action-cards" style={{ marginTop: '8px' }}>
        <button
          className="action-secondary"
          onClick={() => onNavigate('log')}
          aria-label={t('nav_log_title')}
        >
          <div className="action-secondary-content">
            <div className="action-secondary-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="action-label">{t('nav_log_title')}</span>
            <svg className="action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>

        <button
          className="action-secondary"
          onClick={() => onNavigate('exercises')}
          aria-label={t('exercise_guide') || 'Exercise Guide'}
        >
          <div className="action-secondary-content">
            <div className="action-secondary-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </div>
            <span className="action-label">{t('exercise_guide') || 'Exercise Guide'}</span>
            <svg className="action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>

        {!isCoach && (
          <button
            className="action-secondary"
            onClick={() => onNavigate('coach')}
            aria-label={t('coach_report') || 'Coach Report'}
          >
            <div className="action-secondary-content">
              <div className="action-secondary-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <span className="action-label">{t('coach_report') || 'Coach Report'}</span>
              <svg className="action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        )}
      </div>

      {/* ── VisionScore + weekly dots: always visible ── */}
      <VisionScoreHero workouts={allWorkouts} />

      {allWorkouts.length > 0 && (
        <div className="weekly-dots">
          {getLast7Days(allWorkouts, lang).map((day, i) => (
            <div key={i} className="weekly-dot-col">
              <div className={`weekly-dot${day.count > 0 ? ' active' : ''}${day.isToday ? ' today' : ''}`} />
              <span className={`weekly-dot-label${day.isToday ? ' today' : ''}`}>{day.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== View More / View Less divider ===== */}
      {allWorkouts.length > 0 && (
        <button
          className={css.viewMoreBtn}
          onClick={() => setShowMore(prev => !prev)}
        >
          <span>{showMore ? t('dash_view_less') : t('dash_view_more')}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* ===== Expandable section: everything else ===== */}
      {showMore && (
        <>
          {/* ── Workout of the Week ── */}
          <WorkoutOfTheWeek onNavigate={onNavigate} />

          {/* ── Stats summary ── */}
          {stats && stats.muscles.primary.length > 0 && (
            <div className="stats-section">
              <h3 className="section-title">{t('recent')}</h3>
              <div className="stats-hero-card">
                <MuscleMap muscles={stats.muscles} size={90} />
                <div className="stats-numbers">
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalReps}</span>
                    <span className="stat-label">{t('reps').toUpperCase()}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.totalSets}</span>
                    <span className="stat-label">{t('sets').toUpperCase()}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value" style={{
                      color: stats.avgScore >= 80 ? 'var(--accent)' : stats.avgScore >= 60 ? 'var(--yellow)' : 'var(--red)'
                    }}>{stats.avgScore}</span>
                    <span className="stat-label">{t('form').toUpperCase()}</span>
                  </div>
                  {stats.totalVolume > 0 && (
                    <div className="stat-item">
                      <span className="stat-value">{Math.round(stats.totalVolume)}<span className="stat-unit">kg</span></span>
                      <span className="stat-label">{t('volume').toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Recent workouts (rest of them) ── */}
          {recentWorkouts.length > 1 && (
            <div className="recent-section">
              {!stats && <h3 className="section-title">{t('recent')}</h3>}
              <div className="workout-list">
                {recentWorkouts.slice(1, 5).map(w => {
                  const score = w.formScore || 0;
                  const gradeColor = score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)';
                  return (
                    <div key={w.id} className="workout-row">
                      <div className="workout-grade" style={{ '--grade-color': gradeColor }}>
                        {gradeFromScore(score)}
                      </div>
                      <div className="workout-info">
                        <span className="workout-name">{w.exerciseName || w.exercise}</span>
                        <span className="workout-meta">
                          {new Date(w.date || w.createdAt).toLocaleDateString()} &middot; {w.reps} {t('reps').toLowerCase()}
                          {w.weight > 0 && ` \u00B7 ${w.weight}kg`}
                        </span>
                      </div>
                      <div className="workout-reps">
                        <span className="workout-reps-num">{w.reps}</span>
                        <span className="workout-reps-label">reps</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Training Load Monitor ── */}
          {allWorkouts.length >= 5 && <InjuryRiskCard />}

          {/* ── Insights section ── */}
          <InsightsSection profile={profile} workouts={recentWorkouts} />
        </>
      )}

      {/* ── Footer ── */}
      <div className="home-footer">
        <span className="home-footer-text">{t('footer_on_device')}</span>
        <span className="home-footer-dot">&middot;</span>
        <span className="home-footer-text">{t('footer_privacy')}</span>
      </div>
    </div>
  );
}

// ── Insights Section ──

function translateRecommendation(data, lang, t) {
  if (data.recommendationKey) {
    return t(data.recommendationKey);
  }
  const exercises = data.suggestedExercises
    .map(key => EXERCISES[key]?.name || key)
    .join(', ');
  if (data.estimatedRecovery === 'rest needed') {
    return t('rec_rest_needed').replace('{days}', data.daysUntilRecovered).replace('{exercises}', exercises);
  }
  if (data.estimatedRecovery === 'partial') {
    return t('rec_partial').replace('{exercises}', exercises);
  }
  return t('rec_recovered').replace('{exercises}', exercises);
}

function InsightsSection({ profile, workouts }) {
  const { t, lang } = useT();

  const baselines = useMemo(() => {
    const b = calculateBaselines(profile);
    // Sanity check: if BMI is outside reasonable range, profile data is corrupt
    if (b && (b.bmi < 10 || b.bmi > 80)) return null;
    return b;
  }, [profile]);

  // Strength levels from logged workouts with weight
  const strengthData = useMemo(() => {
    if (!workouts || workouts.length === 0) return [];
    const bestByExercise = {};
    for (const w of workouts) {
      if (!w.weight || w.weight <= 0 || !w.reps || w.reps <= 0) continue;
      const key = w.exercise;
      const oneRM = estimateOneRepMax(w.weight, w.reps);
      if (!bestByExercise[key] || oneRM > bestByExercise[key].oneRM) {
        bestByExercise[key] = { oneRM, weight: w.weight, reps: w.reps, name: w.exerciseName || w.exercise };
      }
    }
    const bw = parseFloat(profile?.weight) || 75;
    const sex = profile?.sex || 'male';
    return Object.entries(bestByExercise).map(([key, data]) => ({
      key,
      name: EXERCISES[key]?.name || data.name,
      oneRM: data.oneRM,
      level: getStrengthLevel(key, data.oneRM, bw, sex),
      weight: data.weight,
      reps: data.reps,
    })).sort((a, b) => b.oneRM - a.oneRM);
  }, [workouts, profile]);

  // Workload ratio
  const workloadData = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;
    const history = workouts.map(w => ({
      date: w.date || new Date(w.createdAt).toISOString(),
      load: (w.reps || 0) * (w.weight || 1),
    }));
    return calculateWorkloadRatio(history);
  }, [workouts]);

  // Recovery and next workout
  const nextWorkoutData = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;
    // Group workouts by session (same day)
    const sessions = {};
    for (const w of workouts) {
      const day = new Date(w.date || w.createdAt).toDateString();
      if (!sessions[day]) sessions[day] = { date: w.date || new Date(w.createdAt).toISOString(), exercises: [] };
      sessions[day].exercises.push({ exerciseKey: w.exercise, sets: 1, reps: w.reps || 0 });
    }
    return suggestNextWorkout(profile, Object.values(sessions));
  }, [workouts, profile]);

  // Weekly sets per muscle
  const weeklyMuscleVolume = useMemo(() => {
    if (!workouts || workouts.length === 0) return {};
    const now = Date.now();
    const weekMs = 7 * 24 * 3600 * 1000;
    const volume = {};
    for (const w of workouts) {
      const age = now - (w.createdAt || new Date(w.date).getTime());
      if (age > weekMs) continue;
      const ex = EXERCISES[w.exercise];
      if (!ex?.muscles) continue;
      for (const m of ex.muscles.primary) {
        volume[m] = (volume[m] || 0) + 1;
      }
    }
    return volume;
  }, [workouts]);

  // Goal-specific tips
  const goalTips = useMemo(() => {
    const goal = profile?.goal || 'general';
    const exp = profile?.experience || 'intermediate';
    const tips = [];
    if (goal === 'strength') {
      tips.push({ en: 'Focus on 3-5 reps per set at 85%+ of your 1RM.', fr: 'Visez 3-5 reps par série à 85%+ de votre 1RM.' });
      tips.push({ en: 'Rest 3-5 minutes between heavy sets.', fr: 'Repos de 3-5 min entre les séries lourdes.' });
      tips.push({ en: 'Prioritize compound lifts: squat, deadlift, bench, OHP.', fr: 'Priorisez les mouvements composés : squat, soulevé, développé.' });
    } else if (goal === 'hypertrophy') {
      tips.push({ en: 'Aim for 8-12 reps per set with 60-80% 1RM.', fr: 'Visez 8-12 reps par série à 60-80% du 1RM.' });
      tips.push({ en: 'Target 10-20 sets per muscle group per week.', fr: 'Visez 10-20 séries par groupe musculaire par semaine.' });
      tips.push({ en: 'Control the eccentric (lowering) phase: 2-3 seconds.', fr: 'Contrôlez la phase excentrique : 2-3 secondes.' });
    } else if (goal === 'endurance') {
      tips.push({ en: 'Use 15-20+ reps with lighter loads (50-65% 1RM).', fr: 'Utilisez 15-20+ reps avec charges légères (50-65% 1RM).' });
      tips.push({ en: 'Keep rest periods short: 30-60 seconds.', fr: 'Repos courts : 30-60 secondes.' });
      tips.push({ en: 'Include circuit training and supersets.', fr: 'Incluez du circuit training et des supersets.' });
    } else if (goal === 'weight_loss') {
      tips.push({ en: 'Combine resistance training with higher rep ranges (10-15).', fr: 'Combinez musculation avec séries de 10-15 reps.' });
      tips.push({ en: 'Maintain protein intake at 1.6-2.2g per kg bodyweight.', fr: 'Maintenez un apport de 1.6-2.2g de protéines par kg.' });
      tips.push({ en: 'Stay in a moderate caloric deficit, not extreme.', fr: 'Déficit calorique modéré, pas extrême.' });
    } else {
      tips.push({ en: 'Mix compound and isolation exercises across the week.', fr: 'Alternez exercices composés et isolation dans la semaine.' });
      tips.push({ en: 'Aim for 3-4 sessions per week with balanced muscle coverage.', fr: 'Visez 3-4 séances par semaine avec couverture musculaire équilibrée.' });
      tips.push({ en: 'Increase weight when you can complete all reps with good form.', fr: 'Augmentez le poids quand vous complétez toutes les reps avec bonne forme.' });
    }
    if (exp === 'beginner') {
      tips.push({ en: 'Focus on learning proper form before adding weight.', fr: 'Apprenez la bonne forme avant d\'ajouter du poids.' });
    }
    return tips;
  }, [profile]);

  const { saveProfile } = useProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saved, setSaved] = useState(false);

  const openEdit = () => {
    setEditData({
      weight: profile?.weight || '',
      height: profile?.height || '',
      age: profile?.age || '',
      sex: profile?.sex || 'male',
      goal: profile?.goal || 'general',
      experience: profile?.experience || 'intermediate',
      bodyFat: profile?.bodyFat || '',
      muscleMass: profile?.muscleMass || '',
    });
    setEditOpen(true);
    setSaved(false);
  };

  const handleSaveProfile = async () => {
    const updated = { ...profile, ...editData };
    await saveProfile(updated);
    setSaved(true);
    setTimeout(() => { setEditOpen(false); setSaved(false); }, 800);
  };

  if (!profile) return null;

  const levelColors = {
    beginner: 'var(--red)',
    novice: 'var(--yellow)',
    intermediate: 'var(--accent)',
    advanced: '#6e8efb',
    elite: '#a855f7',
  };

  const goalLabels = {
    general: t('general_fitness'),
    strength: t('strength'),
    hypertrophy: t('muscle_growth'),
    endurance: t('endurance'),
    weight_loss: t('weight_loss'),
  };

  return (
    <div className="insights-section">
      <div className="insights-header">
        <h3 className="section-title">{t('insights_title')}</h3>
        <button className="edit-profile-btn" onClick={openEdit}>
          {t('edit_profile')}
        </button>
      </div>

      {/* Profile editor */}
      {editOpen && editData && (
        <div className="card insights-card profile-edit-card">
          <div className="profile-edit-grid">
            <label>
              <span>{t('weight_kg')}</span>
              <input type="number" value={editData.weight} onChange={e => setEditData(d => ({ ...d, weight: e.target.value }))} placeholder="116" />
            </label>
            <label>
              <span>{t('height_cm')}</span>
              <input type="number" value={editData.height} onChange={e => setEditData(d => ({ ...d, height: e.target.value }))} placeholder="189" />
            </label>
            <label>
              <span>{t('age')}</span>
              <input type="number" value={editData.age} onChange={e => setEditData(d => ({ ...d, age: e.target.value }))} placeholder="37" />
            </label>
            <label>
              <span>{t('sex')}</span>
              <select value={editData.sex} onChange={e => setEditData(d => ({ ...d, sex: e.target.value }))}>
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </label>
            <label>
              <span>{t('goal')}</span>
              <select value={editData.goal} onChange={e => setEditData(d => ({ ...d, goal: e.target.value }))}>
                <option value="general">{t('general_fitness')}</option>
                <option value="strength">{t('strength')}</option>
                <option value="hypertrophy">{t('muscle_growth')}</option>
                <option value="endurance">{t('endurance')}</option>
                <option value="weight_loss">{t('weight_loss')}</option>
              </select>
            </label>
            <label>
              <span>{t('experience')}</span>
              <select value={editData.experience} onChange={e => setEditData(d => ({ ...d, experience: e.target.value }))}>
                <option value="beginner">{t('beginner')}</option>
                <option value="intermediate">{t('intermediate')}</option>
                <option value="advanced">{t('advanced')}</option>
              </select>
            </label>
            <label>
              <span>{t('body_fat_pct')}</span>
              <input type="number" step="0.1" value={editData.bodyFat} onChange={e => setEditData(d => ({ ...d, bodyFat: e.target.value }))} placeholder="28" />
            </label>
            <label>
              <span>{t('muscle_pct')}</span>
              <input type="number" step="0.1" value={editData.muscleMass} onChange={e => setEditData(d => ({ ...d, muscleMass: e.target.value }))} placeholder="68" />
            </label>
          </div>
          <div className="profile-edit-actions">
            <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSaveProfile}>
              {saved ? t('saved') : t('save')}
            </button>
          </div>
        </div>
      )}

      {/* Body profile card */}
      {baselines && (
        <div className="card insights-card">
          <h4 className="insights-card-title">{t('body_profile')}</h4>
          <div className="insights-grid-2">
            <div className="insights-stat">
              <span className="insights-stat-value">{baselines.bmi}</span>
              <span className="insights-stat-label">{t('bmi')}</span>
            </div>
            <div className="insights-stat">
              <span className="insights-stat-value">
                {profile.bodyFat ? `${profile.bodyFat}%` : `${baselines.estimatedBF}%`}
              </span>
              <span className="insights-stat-label">
                {profile.bodyFat ? `${t('body_fat_pct')} (${t('measured')})` : t('body_fat_est')}
              </span>
            </div>
            {profile.muscleMass && (
              <div className="insights-stat">
                <span className="insights-stat-value">{profile.muscleMass}%</span>
                <span className="insights-stat-label">{t('muscle')} ({t('measured')})</span>
              </div>
            )}
            <div className="insights-stat">
              <span className="insights-stat-value">{baselines.maxHR}</span>
              <span className="insights-stat-label">{t('max_hr')} ({t('bpm')})</span>
            </div>
          </div>
        </div>
      )}

      {/* Strength levels */}
      <div className="card insights-card">
        <h4 className="insights-card-title">{t('strength_levels')}</h4>
        {strengthData.length === 0 ? (
          <p className="insights-empty">{t('no_weighted')}</p>
        ) : (
          <div className="strength-list">
            {strengthData.slice(0, 5).map(s => (
              <div key={s.key} className="strength-row">
                <div className="strength-info">
                  <span className="strength-name">{s.name}</span>
                  <span className="strength-detail">{s.weight}kg x {s.reps} = {t('estimated_1rm')} {s.oneRM}kg</span>
                </div>
                <span className="strength-level" style={{ color: levelColors[s.level] || 'var(--muted)' }}>
                  {t(s.level) || s.level}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Training load & recovery */}
      {workloadData && (
        <div className="card insights-card">
          <h4 className="insights-card-title">{t('training_load')}</h4>
          <div className="insights-grid-2">
            <div className="insights-stat">
              <span className="insights-stat-value">{workloadData.ratio}</span>
              <span className="insights-stat-label">{t('workload_ratio')}</span>
              <span className="insights-zone" style={{
                color: workloadData.zone === 'optimal' ? 'var(--accent)'
                  : workloadData.zone === 'undertraining' ? 'var(--yellow)'
                  : 'var(--red)'
              }}>
                {t('zone_' + workloadData.zone)}
              </span>
            </div>
            <div className="insights-stat">
              {nextWorkoutData && (
                <>
                  <span className={`insights-stat-value ${css.recoverySymbol}`}>
                    {nextWorkoutData.estimatedRecovery === 'recovered' ? '✓' : nextWorkoutData.estimatedRecovery === 'partial' ? '~' : '✗'}
                  </span>
                  <span className="insights-stat-label">{t('recovery')}</span>
                  <span className="insights-zone" style={{
                    color: nextWorkoutData.estimatedRecovery === 'recovered' ? 'var(--accent)'
                      : nextWorkoutData.estimatedRecovery === 'partial' ? 'var(--yellow)'
                      : 'var(--red)'
                  }}>
                    {nextWorkoutData.estimatedRecovery === 'recovered' ? t('recovery_ready')
                      : nextWorkoutData.estimatedRecovery === 'partial' ? t('recovery_partial')
                      : t('recovery_rest')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Next workout suggestion */}
      {nextWorkoutData && nextWorkoutData.suggestedExercises.length > 0 && (
        <div className="card insights-card">
          <h4 className="insights-card-title">{t('next_workout')}</h4>
          <p className="insights-recommendation">
            {translateRecommendation(nextWorkoutData, lang, t)}
          </p>
          {/* Weekly muscle volume */}
          {Object.keys(weeklyMuscleVolume).length > 0 && (
            <div className="muscle-volume-section">
              <span className={`insights-stat-label ${css.weeklySetsLabel}`}>{t('weekly_sets')}</span>
              <div className="muscle-volume-bars">
                {Object.entries(weeklyMuscleVolume)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([muscle, sets]) => (
                    <div key={muscle} className="muscle-volume-row">
                      <span className="muscle-volume-name">{translateMuscle(muscle, lang)}</span>
                      <div className="muscle-volume-bar-bg">
                        <div
                          className="muscle-volume-bar-fill"
                          style={{
                            width: `${Math.min(100, (sets / 10) * 100)}%`,
                            background: sets >= 10 ? 'var(--accent)' : sets >= 5 ? 'var(--yellow)' : 'var(--red)',
                          }}
                        />
                      </div>
                      <span className="muscle-volume-count">{sets}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Goal-specific tips */}
      <div className="card insights-card">
        <h4 className="insights-card-title">{t('goal_tips')}: {goalLabels[profile?.goal] || t('general_fitness')}</h4>
        <ul className="goal-tips-list">
          {goalTips.map((tip, i) => (
            <li key={i} className="goal-tip">{tip[lang] || tip.en}</li>
          ))}
        </ul>
      </div>

      {workouts.length === 0 && (
        <p className={`insights-empty ${css.emptyStateMessage}`}>{t('no_workouts_yet')}</p>
      )}
    </div>
  );
}
