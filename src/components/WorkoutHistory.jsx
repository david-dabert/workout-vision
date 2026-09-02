import { useState, useEffect, useMemo } from 'react';
import { getAllWorkouts, deleteWorkout } from '../lib/storage';
import { calculateWorkloadRatio } from '../lib/coach';
import { useT } from '../lib/LanguageContext';
import ExerciseHistory from './ExerciseHistory';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getWeekKey(iso) {
  const d = new Date(iso);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return start.toISOString().slice(0, 10);
}

function getWeekLabel(weekKey, t) {
  const d = new Date(weekKey);
  return t('week_of') + d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function scoreClass(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  return 'poor';
}

function workloadZoneColor(zone) {
  if (zone === 'optimal' || zone === 'sweet_spot') return 'var(--accent)';
  if (zone === 'caution' || zone === 'high') return 'var(--yellow)';
  if (zone === 'danger' || zone === 'overtraining') return 'var(--red)';
  return 'var(--muted)';
}

export default function WorkoutHistory({ onClose }) {
  const { t } = useT();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExerciseHistory, setShowExerciseHistory] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, []);

  async function loadWorkouts() {
    setLoading(true);
    try {
      const all = await getAllWorkouts();
      setWorkouts(all.sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      console.error('Failed to load workouts:', err);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this workout? This cannot be undone.')) return;
    try {
      await deleteWorkout(id);
      setWorkouts(prev => prev.filter(w => w.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  const stats = useMemo(() => {
    if (workouts.length === 0) return null;

    const totalReps = workouts.reduce((s, w) => s + (w.reps || 0), 0);
    const scores = workouts.filter(w => w.formScore > 0).map(w => w.formScore);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    // Streak: consecutive days with at least one workout
    const daySet = new Set(workouts.map(w => new Date(w.date).toISOString().slice(0, 10)));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (daySet.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      total: workouts.length,
      totalReps,
      avgScore,
      streak,
    };
  }, [workouts]);

  const workloadRatio = useMemo(() => {
    if (workouts.length < 2) return null;
    try {
      return calculateWorkloadRatio(workouts);
    } catch {
      return null;
    }
  }, [workouts]);

  const grouped = useMemo(() => {
    const groups = {};
    workouts.forEach(w => {
      const key = getWeekKey(w.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(w);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [workouts]);

  const trendData = useMemo(() => {
    return workouts
      .filter(w => w.formScore > 0)
      .slice(0, 20)
      .reverse();
  }, [workouts]);

  if (showExerciseHistory) {
    return <ExerciseHistory onClose={() => setShowExerciseHistory(false)} />;
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>{t('progress')}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
        </div>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" />
          <p className="text-sm text-muted">{t('loading_workouts')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('progress')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
      </div>

      {workouts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-muted">{t('no_workouts')}</p>
          <p className="text-xs text-muted" style={{ marginTop: 6 }}>
            {t('no_workouts_desc')}
          </p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          {stats && (
            <div className="card">
              <div className="result-stats" style={{ justifyContent: 'space-around' }}>
                <div className="stat" style={{ alignItems: 'center' }}>
                  <span className="stat-value">{stats.total}</span>
                  <span className="stat-label">{t('workouts')}</span>
                </div>
                <div className="stat" style={{ alignItems: 'center' }}>
                  <span className="stat-value">{stats.totalReps}</span>
                  <span className="stat-label">{t('total_reps')}</span>
                </div>
                <div className="stat" style={{ alignItems: 'center' }}>
                  <span className="stat-value">{stats.avgScore}</span>
                  <span className="stat-label">{t('avg_form')}</span>
                </div>
                <div className="stat" style={{ alignItems: 'center' }}>
                  <span className="stat-value">{stats.streak}</span>
                  <span className="stat-label">{t('day_streak')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Exercise history link */}
          <button
            className="btn btn-ghost"
            onClick={() => setShowExerciseHistory(true)}
            style={{
              width: '100%',
              textAlign: 'center',
              marginBottom: 8,
              padding: '10px 14px',
              fontSize: '0.85rem',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
          >
            {t('exercise_history') || 'Exercise History'} →
          </button>

          {/* Workload ratio gauge */}
          {workloadRatio && (
            <div className="card">
              <h4>{t('training_load')}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: 10,
                    borderRadius: 5,
                    background: 'var(--border)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min((workloadRatio.ratio / 2) * 100, 100)}%`,
                      height: '100%',
                      borderRadius: 5,
                      background: workloadZoneColor(workloadRatio.zone),
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span className="text-xs text-muted">0</span>
                    <span className="text-xs text-muted">1.0 {t('optimal')}</span>
                    <span className="text-xs text-muted">2.0+</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: workloadZoneColor(workloadRatio.zone) }}>
                    {workloadRatio.ratio?.toFixed(2)}
                  </div>
                  <span className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>
                    {t(`zone_${workloadRatio.zone}`) || t('unknown')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Form score trend */}
          {trendData.length > 1 && (
            <div className="card">
              <h4>{t('form_score_trend')}</h4>
              <div className="trend-chart" style={{ marginTop: 8 }}>
                {trendData.map((w, i) => {
                  const score = w.formScore || 0;
                  return (
                    <div key={i} className="trend-bar-container">
                      <div
                        className="trend-bar"
                        style={{
                          height: `${Math.max(score, 3)}%`,
                          background: score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)',
                        }}
                        title={`${w.exerciseName || w.exercise}: ${score}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span className="text-xs text-muted">{t('oldest')}</span>
                <span className="text-xs text-muted">{t('latest')}</span>
              </div>
            </div>
          )}

          {/* Workout list grouped by week */}
          {grouped.map(([weekKey, weekWorkouts]) => (
            <div key={weekKey}>
              <div className="week-header">{getWeekLabel(weekKey, t)}</div>
              {weekWorkouts.map(w => (
                <div key={w.id} className="card" style={{ padding: 12 }}>
                  <div className="workout-card-header">
                    <div>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                        {w.exerciseName || w.exercise}
                      </strong>
                      <span className="text-xs text-muted" style={{ marginLeft: 8 }}>
                        {formatDate(w.date)}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => handleDelete(w.id)}
                    >
                      {t('delete')}
                    </button>
                  </div>
                  <div className="workout-card-stats">
                    <span>{w.reps} {t('reps').toLowerCase()}</span>
                    {w.duration > 0 && <span>{w.duration}s</span>}
                    {w.formScore > 0 && (
                      <span className={`score-badge ${scoreClass(w.formScore)}`}>
                        {w.formScore}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
