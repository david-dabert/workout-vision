import { useState, useEffect } from 'react';
import { getAllPRs } from '../lib/prSystem';
import { getCorrectionStats } from '../lib/correctionLog';
import { EXERCISES } from '../lib/exercises';
import { useT } from '../lib/LanguageContext';

const TYPE_ICONS = {
  heaviest: '🏋️',
  most_reps: '🔁',
  best_form: '⭐',
  longest_set: '⏱️',
  max_volume: '📊',
  streak: '🔥',
};

export default function PersonalRecords({ onClose }) {
  const { t, tExercise } = useT();
  const [prs, setPrs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [corrStats, setCorrStats] = useState(null);

  useEffect(() => {
    getAllPRs().then(setPrs);
    getCorrectionStats().then(setCorrStats);
  }, []);

  // Group by exercise, keeping latest per type
  const bestByExercise = {};
  for (const pr of prs) {
    const exKey = pr.exercise || '__streak__';
    if (!bestByExercise[exKey]) bestByExercise[exKey] = {};
    const existing = bestByExercise[exKey][pr.type];
    if (!existing || pr.value > existing.value) {
      bestByExercise[exKey][pr.type] = pr;
    }
  }

  const exerciseKeys = Object.keys(bestByExercise).sort((a, b) => {
    if (a === '__streak__') return 1;
    if (b === '__streak__') return -1;
    return a.localeCompare(b);
  });

  const filteredKeys = filter === 'all'
    ? exerciseKeys
    : exerciseKeys.filter(k => bestByExercise[k][filter]);

  const types = ['heaviest', 'most_reps', 'best_form', 'longest_set', 'max_volume', 'streak'];

  return (
    <div className="page" style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
          aria-label="Back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{t('pr_banner_title')}</h2>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', ...types].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            style={{
              padding: '5px 12px',
              borderRadius: 16,
              border: filter === type ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
              background: filter === type ? 'rgba(0, 245, 212, 0.1)' : 'var(--glass-bg)',
              color: filter === type ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: filter === type ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {type === 'all' ? t('all') || 'All' : `${TYPE_ICONS[type] || ''} ${t(`pr_${type}`) || type}`}
          </button>
        ))}
      </div>

      {prs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '0.9rem' }}>{t('no_prs') || 'No personal records yet.'}</p>
          <p style={{ fontSize: '0.8rem' }}>{t('no_prs_desc') || 'Complete workouts to start tracking your PRs.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredKeys.map(exKey => {
            const records = bestByExercise[exKey];
            const ex = EXERCISES[exKey];
            const name = exKey === '__streak__'
              ? (t('pr_streak') || 'Streak')
              : (tExercise?.(exKey) || ex?.name || exKey);

            const displayTypes = filter === 'all'
              ? Object.keys(records)
              : [filter].filter(f => records[f]);

            return (
              <div
                key={exKey}
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius)',
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {displayTypes.map(type => {
                    const pr = records[type];
                    if (!pr) return null;
                    return (
                      <div
                        key={type}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '4px 10px', borderRadius: 12,
                          background: 'rgba(0, 245, 212, 0.06)',
                          border: '1px solid rgba(0, 245, 212, 0.15)',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span>{TYPE_ICONS[type] || ''}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          {pr.value}{pr.unit === 'kg' ? 'kg' : pr.unit === 'reps' ? '' : pr.unit === 'pts' ? '/100' : pr.unit === 's' ? 's' : pr.unit === 'days' ? 'd' : ''}
                        </span>
                        {pr.previousBest != null && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                            ({t('pr_prev_best', { value: pr.previousBest }) || `prev: ${pr.previousBest}`})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 6 }}>
                  {new Date(Object.values(records)[0]?.achievedAt).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Correction stats */}
      {corrStats && corrStats.total > 0 && (
        <div style={{
          marginTop: 24,
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 10, color: 'var(--text-primary)' }}>
            {t('corrections_title') || 'AI Corrections'}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
            <span>{t('rep_corrections') || 'Rep corrections'}: <strong style={{ color: 'var(--text-primary)' }}>{corrStats.repCorrections}</strong></span>
            <span>{t('exercise_corrections') || 'Exercise corrections'}: <strong style={{ color: 'var(--text-primary)' }}>{corrStats.exerciseCorrections}</strong></span>
          </div>
          {corrStats.topMiscounted.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>{t('most_corrected') || 'Most corrected'}:</span>
              {corrStats.topMiscounted.map(({ exercise, count }) => (
                <span key={exercise} style={{
                  display: 'inline-block', margin: '2px 4px', padding: '2px 8px',
                  background: 'rgba(255, 193, 7, 0.08)', borderRadius: 8,
                  fontSize: '0.72rem',
                }}>
                  {tExercise?.(exercise) || EXERCISES[exercise]?.name || exercise} ({count})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
