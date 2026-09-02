import { useState, useEffect, useMemo } from 'react';
import { getAllWorkouts, calculateBaselines } from '../lib/storage';
import { EXERCISES } from '../lib/exercises';
import { estimateOneRepMax, getStrengthLevel, calculateWorkloadRatio, suggestNextWorkout } from '../lib/coach';
import { useProfile } from '../lib/ProfileContext';
import MuscleMap from './MuscleMap';
import { useT } from '../lib/LanguageContext';
import { gradeFromScore, translateMuscle } from '../lib/utils';

export default function Dashboard({ profile, modelStatus, onNavigate }) {
  const { t, lang, setLang } = useT();
  const [recentWorkouts, setRecentWorkouts] = useState([]);

  const statusDot = modelStatus === 'ready' ? 'ready'
    : modelStatus === 'error' ? 'err' : 'pulse';
  const statusText = modelStatus === 'ready' ? t('ai_engine_ready')
    : modelStatus === 'error' ? t('engine_failed') : t('loading_ai');

  useEffect(() => {
    getAllWorkouts().then(all => setRecentWorkouts(all.slice(0, 10)));
  }, []);

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

  return (
    <div className="home">
      {/* ── Hero section ── */}
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
              >EN</button>
              <button
                className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
                onClick={() => setLang('fr')}
                aria-label="Français"
              >FR</button>
            </div>
          </div>
          <p className="tagline">{t('tagline')}</p>
          <div className={`engine-status engine-${statusDot}`}>
            <span className={`engine-dot ${statusDot}`} />
            <span>{statusText}</span>
          </div>
        </div>
      </div>

      {/* ── Primary action: Analyze Video ── */}
      <div className="action-cards">
        <button
          className="action-primary"
          onClick={() => onNavigate('analyze')}
          aria-label={t('nav_video_title')}
        >
          <div className="action-primary-glow" />
          <div className="action-primary-content">
            <div className="action-primary-icon">
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
      </div>

      {/* ── Quick access grid ── */}
      <div className="quick-access-grid">
        <button className="quick-access-btn" onClick={() => onNavigate('history')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>{t('nav_prs_title')}</span>
        </button>
        <button className="quick-access-btn" onClick={() => onNavigate('rest')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{t('nav_rest_title')}</span>
        </button>
        <button className="quick-access-btn" onClick={() => onNavigate('profile')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{t('profile')}</span>
        </button>
      </div>

      {/* ── Stats summary ── */}
      {stats && stats.muscles.primary.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">{t('recent')}</h3>
          <div className="stats-hero-card">
            <MuscleMap muscles={stats.muscles} size={90} />
            <div className="stats-numbers">
              <div className="stat-item">
                <span className="stat-value">{stats.totalReps}</span>
                <span className="stat-label">REPS</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.totalSets}</span>
                <span className="stat-label">SETS</span>
              </div>
              <div className="stat-item">
                <span className="stat-value" style={{
                  color: stats.avgScore >= 80 ? 'var(--accent)' : stats.avgScore >= 60 ? 'var(--yellow)' : 'var(--red)'
                }}>{stats.avgScore}</span>
                <span className="stat-label">FORM</span>
              </div>
              {stats.totalVolume > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{Math.round(stats.totalVolume)}<span className="stat-unit">kg</span></span>
                  <span className="stat-label">VOL</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent workouts ── */}
      {recentWorkouts.length > 0 && (
        <div className="recent-section">
          {!stats && <h3 className="section-title">{t('recent')}</h3>}
          <div className="workout-list">
            {recentWorkouts.slice(0, 5).map(w => {
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

      {/* ── Insights section ── */}
      <InsightsSection profile={profile} workouts={recentWorkouts} />

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

function translateRecommendation(data, lang) {
  if (lang !== 'fr') return data.recommendation;
  const exercises = data.suggestedExercises
    .map(key => EXERCISES[key]?.name || key)
    .join(', ');
  if (data.estimatedRecovery === 'rest needed') {
    return `Certains groupes musculaires récupèrent encore. Récupération complète dans environ ${data.daysUntilRecovered} jour(s). Pour aujourd'hui, concentrez-vous sur : ${exercises}.`;
  }
  if (data.estimatedRecovery === 'partial') {
    return `La plupart des muscles sont récupérés. Séance suggérée : ${exercises}.`;
  }
  return `Complètement récupéré et prêt à s'entraîner. Séance suggérée : ${exercises}.`;
}

function InsightsSection({ profile, workouts }) {
  const { t } = useT();

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

  const { lang } = useT();

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
                  <span className="insights-stat-value" style={{ fontSize: '1rem' }}>
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
            {lang === 'fr' ? translateRecommendation(nextWorkoutData, lang) : nextWorkoutData.recommendation}
          </p>
          {/* Weekly muscle volume */}
          {Object.keys(weeklyMuscleVolume).length > 0 && (
            <div className="muscle-volume-section">
              <span className="insights-stat-label" style={{ marginBottom: 6, display: 'block' }}>{t('weekly_sets')}</span>
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
        <p className="insights-empty" style={{ textAlign: 'center', padding: 20 }}>{t('no_workouts_yet')}</p>
      )}
    </div>
  );
}
