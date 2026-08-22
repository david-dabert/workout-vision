import { useState, useEffect } from 'react';
import { getAllWorkouts } from '../lib/storage';
import { EXERCISES } from '../lib/exercises';
import { t, tExercise, onLangChange } from '../lib/i18n';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function computePRs(sets) {
  // Walk through sets chronologically to determine which sets were PRs at the time
  const chronological = [...sets].sort((a, b) => new Date(a.date) - new Date(b.date));
  let bestWeight = -1;
  let bestReps = -1;
  let bestForm = -1;
  const prFlags = new Map(); // id -> array of PR types

  for (const s of chronological) {
    const flags = [];
    const w = s.weight || 0;
    const r = s.reps || 0;
    const f = s.formScore || 0;

    if (w > 0 && w > bestWeight) {
      bestWeight = w;
      flags.push('weight');
    }
    if (r > 0 && r > bestReps) {
      bestReps = r;
      flags.push('reps');
    }
    if (f > 0 && f > bestForm) {
      bestForm = f;
      flags.push('form');
    }
    if (flags.length > 0) {
      prFlags.set(s.id, flags);
    }
  }

  return {
    prFlags,
    currentBest: {
      weight: bestWeight > 0 ? bestWeight : null,
      reps: bestReps > 0 ? bestReps : null,
      formScore: bestForm > 0 ? bestForm : null,
    },
  };
}

export default function ExerciseHistory({ onClose }) {
  const [, setLangTick] = useState(0);
  useEffect(() => onLangChange(() => setLangTick(n => n + 1)), []);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const all = await getAllWorkouts();
      setWorkouts(all);
    } catch (err) {
      console.error('Failed to load workouts:', err);
    }
    setLoading(false);
  }

  // Group workouts by exercise key
  const grouped = {};
  for (const w of workouts) {
    const key = w.exercise;
    if (!key) continue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(w);
  }

  // Sort exercises by most recent workout
  const exerciseList = Object.entries(grouped)
    .map(([key, sets]) => {
      const mostRecent = sets.reduce((latest, s) => {
        const d = new Date(s.date);
        return d > latest ? d : latest;
      }, new Date(0));
      return { key, sets, mostRecent, name: EXERCISES[key]?.name || key };
    })
    .sort((a, b) => b.mostRecent - a.mostRecent);

  const selectedData = selectedExercise
    ? exerciseList.find(e => e.key === selectedExercise)
    : null;

  const selectedSets = selectedData
    ? [...selectedData.sets].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  const prInfo = selectedData ? computePRs(selectedData.sets) : null;

  // Weight progression data for the simple chart
  const progressionData = selectedData
    ? [...selectedData.sets]
        .filter(s => s.weight > 0)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    : [];

  const maxWeight = progressionData.length > 0
    ? Math.max(...progressionData.map(s => s.weight))
    : 0;
  const minWeight = progressionData.length > 0
    ? Math.min(...progressionData.map(s => s.weight))
    : 0;
  const weightRange = maxWeight - minWeight || 1;

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <h2>{t('exercise_history')}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
        </div>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" />
          <p className="text-sm text-muted">{t('loading_history')}</p>
        </div>
      </div>
    );
  }

  if (selectedExercise && selectedData) {
    return (
      <div className="page">
        <div className="page-header">
          <h2 style={{ fontSize: '1.05rem' }}>{tExercise(selectedData.key, selectedData.name)}</h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedExercise(null)}
          >
            {t('back')}
          </button>
        </div>

        {/* Current PRs */}
        {prInfo && prInfo.currentBest && (
          <div className="card" style={{ marginBottom: 12, padding: 14 }}>
            <h4 style={{ marginTop: 0 }}>{t('personal_records')}</h4>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {prInfo.currentBest.weight != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    color: 'var(--yellow)',
                  }}>
                    {prInfo.currentBest.weight} kg
                  </div>
                  <span className="text-xs text-muted">{t('best_weight')}</span>
                </div>
              )}
              {prInfo.currentBest.reps != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    color: 'var(--accent)',
                  }}>
                    {prInfo.currentBest.reps}
                  </div>
                  <span className="text-xs text-muted">{t('most_reps')}</span>
                </div>
              )}
              {prInfo.currentBest.formScore != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    color: 'var(--blue)',
                  }}>
                    {prInfo.currentBest.formScore}
                  </div>
                  <span className="text-xs text-muted">{t('best_form')}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weight progression chart (CSS-only) */}
        {progressionData.length > 1 && (
          <div className="card" style={{ marginBottom: 12, padding: 14 }}>
            <h4 style={{ marginTop: 0 }}>{t('weight_progression')}</h4>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 2,
              height: 100,
              marginTop: 10,
              padding: '0 2px',
            }}>
              {progressionData.map((s, i) => {
                const pct = ((s.weight - minWeight) / weightRange) * 80 + 20;
                const isPR = prInfo.prFlags.has(s.id) && prInfo.prFlags.get(s.id).includes('weight');
                return (
                  <div
                    key={s.id || i}
                    style={{
                      flex: 1,
                      maxWidth: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        minWidth: 4,
                        height: `${pct}%`,
                        borderRadius: 3,
                        background: isPR ? 'var(--yellow)' : 'var(--accent)',
                        transition: 'height 0.3s',
                      }}
                      title={`${formatDateShort(s.date)}: ${s.weight} kg`}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="text-xs text-muted">
                {formatDateShort(progressionData[0].date)}
              </span>
              <span className="text-xs text-muted">
                {minWeight}-{maxWeight} kg
              </span>
              <span className="text-xs text-muted">
                {formatDateShort(progressionData[progressionData.length - 1].date)}
              </span>
            </div>
          </div>
        )}

        {/* All sets list */}
        <h4>{t('all_sets')} ({selectedSets.length})</h4>
        {selectedSets.map((s, i) => {
          const flags = prInfo.prFlags.get(s.id);
          return (
            <div
              key={s.id || i}
              className="card"
              style={{
                padding: '10px 14px',
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <span className="text-xs text-muted">{formatDate(s.date)}</span>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                  <span className="text-sm" style={{ color: '#fff' }}>
                    {s.reps} reps
                  </span>
                  {s.weight > 0 && (
                    <span className="text-sm" style={{ color: 'var(--text)' }}>
                      {s.weight} kg
                    </span>
                  )}
                  {s.formScore != null && s.formScore > 0 && (
                    <span className="text-sm" style={{
                      color: s.formScore >= 80 ? 'var(--accent)' : s.formScore >= 60 ? 'var(--yellow)' : 'var(--red)',
                    }}>
                      {t('form_colon')} {s.formScore}
                    </span>
                  )}
                  {s.source && (
                    <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                      {s.source}
                    </span>
                  )}
                </div>
              </div>
              {flags && flags.length > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 179, 0, 0.15)',
                  color: 'var(--yellow)',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  minHeight: 24,
                  whiteSpace: 'nowrap',
                }}>
                  {t('pr')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Main exercise list view
  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('exercise_history')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
      </div>

      {exerciseList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="text-muted">{t('no_exercises_recorded')}</p>
          <p className="text-xs text-muted" style={{ marginTop: 6 }}>
            Log a workout to start tracking your history.
          </p>
        </div>
      ) : (
        exerciseList.map(ex => {
          const pr = computePRs(ex.sets);
          return (
            <button
              key={ex.key}
              className="card"
              onClick={() => setSelectedExercise(ex.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                marginBottom: 8,
                cursor: 'pointer',
                border: '1px solid var(--border)',
                minHeight: 44,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ color: '#fff', fontSize: '0.88rem' }}>{tExercise(ex.key, ex.name)}</strong>
                <span className="text-xs text-muted">{ex.sets.length} {t('sets')}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                {pr.currentBest.weight != null && (
                  <span className="text-xs" style={{ color: 'var(--yellow)' }}>
                    {t('best_colon')} {pr.currentBest.weight} kg
                  </span>
                )}
                {pr.currentBest.reps != null && (
                  <span className="text-xs" style={{ color: 'var(--accent)' }}>
                    {t('max_reps_colon')} {pr.currentBest.reps}
                  </span>
                )}
                <span className="text-xs text-muted">
                  {t('last_colon')} {formatDateShort(ex.mostRecent.toISOString())}
                </span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
