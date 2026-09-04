import { useState, useEffect, useMemo } from 'react';
import { getAllWorkouts, deleteWorkout, getMilestones, saveMilestones } from '../lib/storage';
import { calculateWorkloadRatio } from '../lib/coach';
import { EXERCISES } from '../lib/exercises';
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

  const [milestones, setMilestones] = useState({});

  // Load and compute milestones when workouts change
  useEffect(() => {
    if (workouts.length === 0) return;
    (async () => {
      const saved = await getMilestones();
      const updated = { ...saved };
      const now = new Date().toISOString();

      // First workout
      if (workouts.length >= 1 && !updated.first_workout) {
        updated.first_workout = now;
      }
      // 10 workouts
      if (workouts.length >= 10 && !updated.ten_workouts) {
        updated.ten_workouts = now;
      }
      // 25 workouts
      if (workouts.length >= 25 && !updated.twenty_five_workouts) {
        updated.twenty_five_workouts = now;
      }
      // 50 workouts
      if (workouts.length >= 50 && !updated.fifty_workouts) {
        updated.fifty_workouts = now;
      }
      // First A-grade (80+)
      if (!updated.first_a_grade) {
        const aGrade = workouts.find(w => w.formScore >= 80);
        if (aGrade) updated.first_a_grade = now;
      }
      // 5-day streak
      if (!updated.five_day_streak && stats && stats.streak >= 5) {
        updated.five_day_streak = now;
      }
      // Form improved 10+ points on any exercise
      if (!updated.form_improved) {
        const byExercise = {};
        for (const w of workouts) {
          if (!w.exercise || !w.formScore) continue;
          if (!byExercise[w.exercise]) byExercise[w.exercise] = [];
          byExercise[w.exercise].push(w);
        }
        for (const [exKey, sets] of Object.entries(byExercise)) {
          if (sets.length < 2) continue;
          const sorted = [...sets].sort((a, b) => new Date(a.date) - new Date(b.date));
          const scores = sorted.filter(s => s.formScore > 0).map(s => s.formScore);
          if (scores.length >= 2) {
            const first3 = scores.slice(0, Math.min(3, scores.length));
            const last3 = scores.slice(-Math.min(3, scores.length));
            const earlyAvg = first3.reduce((a, b) => a + b, 0) / first3.length;
            const lateAvg = last3.reduce((a, b) => a + b, 0) / last3.length;
            if (lateAvg - earlyAvg >= 10) {
              updated.form_improved = now;
              updated.form_improved_exercise = exKey;
              break;
            }
          }
        }
      }

      if (JSON.stringify(updated) !== JSON.stringify(saved)) {
        await saveMilestones(updated);
      }
      setMilestones(updated);
    })();
  }, [workouts, stats]);

  const trendData = useMemo(() => {
    return workouts
      .filter(w => w.formScore > 0)
      .slice(0, 20)
      .reverse();
  }, [workouts]);

  // Per-exercise trends: for exercises done 3+ times, compute trend direction
  const exerciseTrends = useMemo(() => {
    const byExercise = {};
    for (const w of workouts) {
      if (!w.exercise || !w.formScore) continue;
      if (!byExercise[w.exercise]) byExercise[w.exercise] = [];
      byExercise[w.exercise].push(w);
    }

    const trends = [];
    for (const [exKey, sets] of Object.entries(byExercise)) {
      if (sets.length < 3) continue;
      const sorted = [...sets].sort((a, b) => new Date(a.date) - new Date(b.date));
      const scores = sorted.filter(s => s.formScore > 0).map(s => s.formScore);
      if (scores.length < 3) continue;

      const half = Math.floor(scores.length / 2);
      const firstHalf = scores.slice(0, half);
      const secondHalf = scores.slice(half);
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = avgSecond - avgFirst;

      let direction = 'stable';
      if (diff >= 3) direction = 'improving';
      else if (diff <= -3) direction = 'declining';

      trends.push({
        key: exKey,
        name: EXERCISES[exKey]?.name || exKey,
        direction,
        count: sets.length,
        latestScore: scores[scores.length - 1],
      });
    }
    return trends.sort((a, b) => b.count - a.count);
  }, [workouts]);

  // Sparkline data: form scores for the most-trained exercise
  const sparklineData = useMemo(() => {
    if (exerciseTrends.length === 0) return [];
    const topExercise = exerciseTrends[0].key;
    return workouts
      .filter(w => w.exercise === topExercise && w.formScore > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-20)
      .map(w => w.formScore);
  }, [workouts, exerciseTrends]);

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

          {/* Journey section */}
          {workouts.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ marginTop: 0, marginBottom: 12 }}>{t('your_journey')}</h4>

              {/* Sparkline: form score trend for top exercise */}
              {sparklineData.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 6 }}>
                    {t('top_exercise_form')} ({exerciseTrends[0]?.name})
                  </div>
                  <svg
                    viewBox={`0 0 ${(sparklineData.length - 1) * 14} 40`}
                    style={{ width: '100%', height: 40, display: 'block' }}
                    preserveAspectRatio="none"
                  >
                    {(() => {
                      const min = Math.min(...sparklineData);
                      const max = Math.max(...sparklineData);
                      const range = max - min || 1;
                      const points = sparklineData.map((v, i) => {
                        const x = i * 14;
                        const y = 38 - ((v - min) / range) * 34;
                        return `${x},${y}`;
                      }).join(' ');
                      return (
                        <>
                          <polyline
                            points={points}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {sparklineData.map((v, i) => {
                            const x = i * 14;
                            const y = 38 - ((v - min) / range) * 34;
                            return (
                              <circle
                                key={i}
                                cx={x}
                                cy={y}
                                r="2.5"
                                fill={v >= 80 ? 'var(--accent)' : v >= 60 ? 'var(--yellow)' : 'var(--red)'}
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span className="text-xs text-muted">{sparklineData[0]}</span>
                    <span className="text-xs text-muted">{sparklineData[sparklineData.length - 1]}</span>
                  </div>
                </div>
              )}

              {/* Per-exercise mini trends */}
              {exerciseTrends.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t('exercise_trends')}
                  </div>
                  {exerciseTrends.map(ex => (
                    <div
                      key={ex.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: '0.95rem',
                          color: ex.direction === 'improving' ? 'var(--accent)' : ex.direction === 'declining' ? 'var(--red)' : 'var(--yellow)',
                        }}>
                          {ex.direction === 'improving' ? '↑' : ex.direction === 'declining' ? '↓' : '→'}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{ex.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="text-xs text-muted">{ex.count}x</span>
                        <span className="text-xs" style={{
                          color: ex.direction === 'improving' ? 'var(--accent)' : ex.direction === 'declining' ? 'var(--red)' : 'var(--yellow)',
                        }}>
                          {t(ex.direction)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Milestones */}
              {(() => {
                const achieved = [];
                if (milestones.first_workout) achieved.push({ key: 'first_workout', label: t('milestone_first_workout'), icon: '🏁' });
                if (milestones.first_a_grade) achieved.push({ key: 'first_a_grade', label: t('milestone_first_a_grade'), icon: '⭐' });
                if (milestones.five_day_streak) achieved.push({ key: 'five_day_streak', label: t('milestone_5_day_streak'), icon: '🔥' });
                if (milestones.ten_workouts) achieved.push({ key: 'ten_workouts', label: t('milestone_10_workouts'), icon: '💪' });
                if (milestones.twenty_five_workouts) achieved.push({ key: 'twenty_five_workouts', label: t('milestone_25_workouts'), icon: '🎯' });
                if (milestones.fifty_workouts) achieved.push({ key: 'fifty_workouts', label: t('milestone_50_workouts'), icon: '🏆' });
                if (milestones.form_improved) {
                  const exName = EXERCISES[milestones.form_improved_exercise]?.name || milestones.form_improved_exercise;
                  achieved.push({ key: 'form_improved', label: `${t('milestone_form_improved')} ${exName}`, icon: '📈' });
                }

                // Also show upcoming milestones (dimmed)
                const upcoming = [];
                if (!milestones.first_workout) upcoming.push({ label: t('milestone_first_workout'), icon: '🏁' });
                if (!milestones.first_a_grade) upcoming.push({ label: t('milestone_first_a_grade'), icon: '⭐' });
                if (!milestones.five_day_streak) upcoming.push({ label: t('milestone_5_day_streak'), icon: '🔥' });
                if (!milestones.ten_workouts) upcoming.push({ label: t('milestone_10_workouts'), icon: '💪' });

                if (achieved.length === 0 && upcoming.length === 0) return null;

                return (
                  <div>
                    <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {t('milestones')}
                    </div>
                    {achieved.map(m => (
                      <div key={m.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '5px 0',
                      }}>
                        <span style={{ fontSize: '1rem' }}>{m.icon}</span>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{m.label}</span>
                      </div>
                    ))}
                    {upcoming.slice(0, 2).map((m, i) => (
                      <div key={`upcoming-${i}`} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '5px 0',
                        opacity: 0.35,
                      }}>
                        <span style={{ fontSize: '1rem' }}>{m.icon}</span>
                        <span className="text-sm">{m.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

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
