import { useState, useEffect } from 'react';
import { getAllWorkouts, deleteWorkout } from '../lib/storage';
import { useT } from '../lib/LanguageContext';

function getWeekLabel(dateStr, t) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return t('this_week');
  if (diffDays < 14) return t('last_week');
  const weeksAgo = Math.floor(diffDays / 7);
  return `${weeksAgo} ${t('weeks_ago')}`;
}

function gradeClass(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  return 'poor';
}

export default function Progress({ onClose }) {
  const { t } = useT();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadWorkouts = async () => {
    const all = await getAllWorkouts();
    setWorkouts(all);
    setLoading(false);
  };

  useEffect(() => { loadWorkouts(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(t('delete_workout_confirm'))) return;
    await deleteWorkout(id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
  };

  // Group by week
  const grouped = {};
  workouts.forEach(w => {
    const label = getWeekLabel(w.date || w.createdAt, t);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(w);
  });

  // Stats
  const totalWorkouts = workouts.length;
  const totalReps = workouts.reduce((s, w) => s + (w.reps || 0), 0);
  const avgScore = totalWorkouts > 0
    ? Math.round(workouts.reduce((s, w) => s + (w.formScore || 0), 0) / totalWorkouts)
    : 0;

  // Trend: last 14 entries form scores
  const trendData = workouts.slice(0, 14).reverse().map(w => w.formScore || 0);

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('progress')}</h2>
      </div>

      {loading && (
        <div className="text-center" style={{ padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && workouts.length === 0 && (
        <div className="card card-welcome">
          <h3>{t('no_workouts')}</h3>
          <p className="text-sm text-muted">
            Complete a live training session or analyze a video to start tracking.
          </p>
        </div>
      )}

      {!loading && workouts.length > 0 && (
        <>
          {/* Summary stats */}
          <div className="card">
            <div className="stats-row" style={{ justifyContent: 'space-around' }}>
              <div className="stat" style={{ alignItems: 'center' }}>
                <span className="stat-value" style={{ fontSize: '1.5rem' }}>{totalWorkouts}</span>
                <span className="stat-label">{t('sessions')}</span>
              </div>
              <div className="stat" style={{ alignItems: 'center' }}>
                <span className="stat-value" style={{ fontSize: '1.5rem' }}>{totalReps}</span>
                <span className="stat-label">{t('total_reps')}</span>
              </div>
              <div className="stat" style={{ alignItems: 'center' }}>
                <span className="stat-value" style={{ fontSize: '1.5rem' }}>{avgScore}</span>
                <span className="stat-label">{t('avg_form')}</span>
              </div>
            </div>
          </div>

          {/* Form trend chart */}
          {trendData.length >= 2 && (
            <div className="card">
              <h4>{t('form_score_trend')}</h4>
              <div className="trend-chart">
                {trendData.map((score, i) => (
                  <div key={i} className="trend-bar-container">
                    <div
                      className="trend-bar"
                      style={{
                        height: `${Math.max(score, 3)}%`,
                        background: score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)',
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grouped workout history */}
          {Object.entries(grouped).map(([weekLabel, items]) => (
            <div key={weekLabel}>
              <div className="week-divider">{weekLabel}</div>
              {items.map(w => (
                <div key={w.id} className="workout-item">
                  <div className="workout-card-header">
                    <div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>
                        {w.exerciseName || w.exercise}
                      </span>
                      <br />
                      <span className="text-xs text-muted">
                        {new Date(w.date || w.createdAt).toLocaleDateString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                        {w.source === 'upload' ? ` ${t('video_tag')}` : w.source === 'live' ? ` ${t('live_tag')}` : ''}
                      </span>
                    </div>
                    {w.formScore != null && (
                      <span className={`score-badge ${gradeClass(w.formScore)}`}>
                        {w.formScore}
                      </span>
                    )}
                  </div>
                  <div className="workout-card-stats">
                    <span>{w.reps || 0} {t('reps').toLowerCase()}</span>
                    {w.duration > 0 && <span>{Math.round(w.duration)}s</span>}
                  </div>
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    style={{ marginTop: 6 }}
                    onClick={() => handleDelete(w.id)}
                  >
                    {t('delete')}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
