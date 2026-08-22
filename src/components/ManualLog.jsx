import { useState } from 'react';
import { EXERCISES, EXERCISE_GROUPS } from '../lib/exercises';
import { saveWorkout } from '../lib/storage';
import { useT } from '../lib/LanguageContext';

function getCategoryLabel(key) {
  const map = { compound: 'compound', isolation: 'isolation', bodyweight: 'bodyweight' };
  return map[key] ? t(map[key]) : key;
}

const categoryOrder = ['compound', 'bodyweight', 'isolation'];
const sortedCategories = categoryOrder.filter(c => EXERCISE_GROUPS[c]);
// Add any categories not in the predefined order
for (const c of Object.keys(EXERCISE_GROUPS)) {
  if (!sortedCategories.includes(c)) sortedCategories.push(c);
}

function emptyEntry() {
  return { exerciseKey: '', sets: [{ reps: '', weight: '' }] };
}

export default function ManualLog({ onClose }) {
  const { t, tExercise } = useT();
  const [entries, setEntries] = useState([emptyEntry()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(null); // index of entry with picker open
  const [searchTerm, setSearchTerm] = useState('');

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

  function selectExercise(entryIdx, key) {
    updateEntry(entryIdx, 'exerciseKey', key);
    setPickerOpen(null);
    setSearchTerm('');
  }

  function filteredCategories() {
    if (!searchTerm.trim()) return sortedCategories.map(c => [c, EXERCISE_GROUPS[c]]);
    const term = searchTerm.toLowerCase();
    return sortedCategories
      .map(c => [c, EXERCISE_GROUPS[c].filter(ex => ex.name.toLowerCase().includes(term))])
      .filter(([, exs]) => exs.length > 0);
  }

  const canSave = entries.some(e =>
    e.exerciseKey && e.sets.some(s => s.reps && parseInt(s.reps) > 0)
  );

  async function handleSave() {
    if (!canSave || saving) return;
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
  }

  if (saved) {
    return (
      <div className="page">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          gap: 12,
        }}>
          <div style={{ fontSize: '2rem', color: 'var(--accent)' }}>{t('saved')}</div>
          <p className="text-sm text-muted">{t('workout_saved')}</p>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button
              className="btn btn-ghost"
              style={{
                flex: 1,
                textAlign: 'left',
                minHeight: 44,
                color: entry.exerciseKey ? '#fff' : 'var(--muted)',
                fontWeight: entry.exerciseKey ? 700 : 400,
                fontSize: '0.88rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
              }}
              onClick={() => {
                setPickerOpen(pickerOpen === entryIdx ? null : entryIdx);
                setSearchTerm('');
              }}
            >
              {entry.exerciseKey ? tExercise(entry.exerciseKey, EXERCISES[entry.exerciseKey]?.name) : t('select_exercise')}
            </button>
            {entries.length > 1 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--red)', marginLeft: 8, minWidth: 44, minHeight: 44 }}
                onClick={() => removeExercise(entryIdx)}
              >
                X
              </button>
            )}
          </div>

          {/* Exercise picker dropdown */}
          {pickerOpen === entryIdx && (
            <div style={{
              background: 'var(--card-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              maxHeight: 280,
              overflowY: 'auto',
              marginBottom: 10,
            }}>
              <div style={{ padding: '8px 10px', position: 'sticky', top: 0, background: 'var(--card-elevated)', zIndex: 1 }}>
                <input
                  type="text"
                  placeholder={t('search_exercises')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>
              {filteredCategories().map(([cat, exercises]) => (
                <div key={cat}>
                  <div style={{
                    padding: '6px 12px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--muted)',
                    background: 'var(--card)',
                  }}>
                    {getCategoryLabel(cat)}
                  </div>
                  {exercises.map(ex => (
                    <button
                      key={ex.key}
                      onClick={() => selectExercise(entryIdx, ex.key)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        background: entry.exerciseKey === ex.key ? 'var(--accent-glow)' : 'transparent',
                        color: entry.exerciseKey === ex.key ? 'var(--accent)' : 'var(--text)',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        minHeight: 44,
                      }}
                    >
                      {tExercise(ex.key, ex.name)}
                    </button>
                  ))}
                </div>
              ))}
              {filteredCategories().length === 0 && (
                <p className="text-sm text-muted" style={{ padding: 16, textAlign: 'center' }}>
                  {t('no_exercises_found')}
                </p>
              )}
            </div>
          )}

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
                    min="0"
                    placeholder="0"
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
                    min="0"
                    step="0.5"
                    placeholder="0"
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
