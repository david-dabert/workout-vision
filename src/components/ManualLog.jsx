import { useState, useRef } from 'react';
import { EXERCISES } from '../lib/exercises';
import { saveWorkout } from '../lib/storage';
import ExerciseSelector from './ExerciseSelector';

import { useT } from '../lib/LanguageContext';

function emptyEntry() {
  return { exerciseKey: '', sets: [{ reps: '', weight: '' }] };
}

export default function ManualLog({ onClose }) {
  const { t, tExercise } = useT();
  const [entries, setEntries] = useState([emptyEntry()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);

  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function updateSet(entryIdx, setIdx, field, value) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e;
      const newSets = e.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s);
      return { ...e, sets: newSets };
    }));
  }

  function addSet(entryIdx) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e;
      return { ...e, sets: [...e.sets, { reps: '', weight: '' }] };
    }));
  }

  function removeSet(entryIdx, setIdx) {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e;
      if (e.sets.length <= 1) return e;
      return { ...e, sets: e.sets.filter((_, si) => si !== setIdx) };
    }));
  }

  function addExercise() {
    setEntries(prev => [...prev, emptyEntry()]);
  }

  function removeExercise(idx) {
    if (entries.length <= 1) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
  }

  const canSave = entries.some(e =>
    e.exerciseKey && e.sets.some(s => s.reps && parseInt(s.reps) > 0)
  );

  async function handleSave() {
    if (!canSave || saving || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      for (const entry of entries) {
        if (!entry.exerciseKey) continue;
        const exData = EXERCISES[entry.exerciseKey];
        for (const set of entry.sets) {
          const reps = parseInt(set.reps);
          if (!reps || reps <= 0) continue;
          const weight = parseFloat(set.weight) || 0;
          await saveWorkout({
            exercise: entry.exerciseKey,
            exerciseName: exData?.name || entry.exerciseKey,
            reps,
            weight,
            formScore: null,
            duration: 0,
            source: 'manual',
            date: now,
          });
        }
      }

      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      console.error('Failed to save workout:', err);
    }
    setSaving(false);
    savingRef.current = false;
  }

  if (saved) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          gap: 16,
          animation: 'enterHeavy 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(93, 184, 122, 0.15), rgba(212, 167, 106, 0.10))',
            border: '2px solid rgba(93, 184, 122, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', color: 'var(--bio-green)',
            boxShadow: '0 0 40px rgba(93, 184, 122, 0.2), 0 0 80px rgba(212, 167, 106, 0.08)',
            animation: 'repBurst 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
          }}>
            &#x2713;
          </div>
          <div style={{
            fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
          }}>
            {t('workout_saved')}
          </div>
          <div style={{
            fontSize: '0.75rem', color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
          }}>
            {t('saved')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('log_workout')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
      </div>

      {entries.map((entry, entryIdx) => (
        <div key={entryIdx} className="card" style={{ marginBottom: 12, padding: 14 }}>
          {/* Exercise selector */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
            <ExerciseSelector
              value={entry.exerciseKey}
              onChange={(key) => updateEntry(entryIdx, 'exerciseKey', key)}
              showAuto={false}
            />
            {entries.length > 1 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--red)', minWidth: 44, minHeight: 44, flexShrink: 0 }}
                onClick={() => removeExercise(entryIdx)}
                aria-label={t('remove_exercise') || 'Remove exercise'}
              >
                X
              </button>
            )}
          </div>

          {/* Sets table */}
          {entry.exerciseKey && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 1fr 44px',
                gap: 6,
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <span className="text-xs text-muted" style={{ textAlign: 'center' }}>{t('set')}</span>
                <span className="text-xs text-muted">{t('reps')}</span>
                <span className="text-xs text-muted">{t('weight_kg_short')}</span>
                <span />
              </div>
              {entry.sets.map((set, setIdx) => (
                <div
                  key={setIdx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 1fr 44px',
                    gap: 6,
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span className="text-sm" style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    {setIdx + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    placeholder="0"
                    aria-label={`${t('reps')} ${setIdx + 1}`}
                    value={set.reps}
                    onChange={e => updateSet(entryIdx, setIdx, 'reps', e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      minHeight: 44,
                      width: '100%',
                    }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.5"
                    step="0.5"
                    placeholder="0"
                    aria-label={`${t('weight_kg_short')} ${setIdx + 1}`}
                    value={set.weight}
                    onChange={e => updateSet(entryIdx, setIdx, 'weight', e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.88rem',
                      minHeight: 44,
                      width: '100%',
                    }}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--muted)', minWidth: 44, minHeight: 44 }}
                    onClick={() => removeSet(entryIdx, setIdx)}
                    disabled={entry.sets.length <= 1}
                    aria-label={`${t('remove_set') || 'Remove set'} ${setIdx + 1}`}
                  >
                    -
                  </button>
                </div>
              ))}
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 6, fontSize: '0.78rem', minHeight: 44 }}
                onClick={() => addSet(entryIdx)}
              >
                {t('add_set')}
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginBottom: 16, minHeight: 44 }}
        onClick={addExercise}
      >
        {t('add_exercise')}
      </button>

      <button
        className="btn btn-primary"
        style={{ width: '100%', minHeight: 48, fontSize: '0.95rem', fontWeight: 700 }}
        onClick={handleSave}
        disabled={!canSave || saving}
      >
        {saving ? t('saving') : t('log_workout')}
      </button>
    </div>
  );
}
