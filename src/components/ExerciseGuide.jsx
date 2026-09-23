import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../lib/LanguageContext';
import { getExerciseFrames, hasExerciseGuide, getMappedKeys } from '../lib/exerciseGuide';
import { EXERCISES } from '../lib/exercises';
import css from './ExerciseGuide.module.css';

/**
 * Animated exercise illustration — cycles 3 SVG frames.
 * Fetches frames from jsDelivr CDN on demand.
 *
 * @param {Object} props
 * @param {string} props.exerciseKey - Our internal exercise key
 * @param {boolean} [props.compact] - Compact mode for lists
 * @param {boolean} [props.autoPlay=true] - Auto-cycle frames
 */
export function ExerciseAnimation({ exerciseKey, compact, autoPlay = true }) {
  const [activeFrame, setActiveFrame] = useState(0);
  const intervalRef = useRef(null);
  const guide = getExerciseFrames(exerciseKey);

  useEffect(() => {
    if (!guide || !autoPlay) return;
    intervalRef.current = setInterval(() => {
      setActiveFrame(f => (f + 1) % 3);
    }, 800);
    return () => clearInterval(intervalRef.current);
  }, [guide, autoPlay]);

  if (!guide) return null;

  return (
    <div className={`${css.guideContainer}${compact ? ` ${css.compact}` : ''}`}>
      {guide.frames.map((url, i) => (
        <img
          key={i}
          src={url}
          alt=""
          className={`${css.guideFrame}${i === activeFrame ? ` ${css.guideFrameActive}` : ''}`}
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}

/**
 * Full exercise library page with search, filter, and detail view.
 */
export default function ExerciseGuideLibrary({ onClose }) {
  const { t, tExercise } = useT();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState(null);
  const [detail, setDetail] = useState(null);

  // Build exercise list from our definitions that have guide visuals
  const exercises = getMappedKeys()
    .map(key => {
      const ex = EXERCISES[key];
      if (!ex) return null;
      return { key, name: ex.name, muscles: ex.muscles, category: ex.category };
    })
    .filter(Boolean);

  // Get unique muscle groups for filter chips
  const muscleGroups = [...new Set(
    exercises.flatMap(e => e.muscles?.primary || [])
  )].sort();

  // Filter
  const filtered = exercises.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      const name = (tExercise ? tExercise(e.key, e.name) : e.name).toLowerCase();
      if (!name.includes(q) && !e.key.includes(q)) return false;
    }
    if (muscle) {
      if (!e.muscles?.primary?.includes(muscle)) return false;
    }
    return true;
  });

  return (
    <div className={css.libraryPage}>
      <div className={css.libraryHeader}>
        <button className={css.backBtn} onClick={onClose} aria-label={t('back') || 'Back'}>
          &larr;
        </button>
        <h1 className={css.libraryTitle}>{t('exercise_guide') || 'Exercise Guide'}</h1>
      </div>

      <input
        className={css.searchInput}
        type="text"
        placeholder={t('search_exercises') || 'Search exercises...'}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className={css.muscleFilter}>
        <button
          className={`${css.filterChip}${!muscle ? ` ${css.filterChipActive}` : ''}`}
          onClick={() => setMuscle(null)}
        >
          {t('all') || 'All'}
        </button>
        {muscleGroups.map(m => (
          <button
            key={m}
            className={`${css.filterChip}${muscle === m ? ` ${css.filterChipActive}` : ''}`}
            onClick={() => setMuscle(muscle === m ? null : m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className={css.exerciseGrid}>
        {filtered.map(e => (
          <div key={e.key} className={css.exerciseCard} onClick={() => setDetail(e)}>
            <ExerciseAnimation exerciseKey={e.key} compact />
            <span className={css.exerciseCardName}>
              {tExercise ? tExercise(e.key, e.name) : e.name}
            </span>
            <span className={css.exerciseCardMuscle}>
              {e.muscles?.primary?.[0] || ''}
            </span>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'rgba(232,230,225,0.4)', marginTop: 40 }}>
          {t('no_exercises_found') || 'No exercises found'}
        </p>
      )}

      {detail && (
        <ExerciseDetail
          exercise={detail}
          onClose={() => setDetail(null)}
          t={t}
          tExercise={tExercise}
        />
      )}
    </div>
  );
}

function ExerciseDetail({ exercise, onClose, t, tExercise }) {
  const ex = EXERCISES[exercise.key];

  return (
    <div className={css.detailOverlay} onClick={onClose}>
      <div className={css.detailCard} onClick={e => e.stopPropagation()}>
        <ExerciseAnimation exerciseKey={exercise.key} />

        <h2 className={css.detailName}>
          {tExercise ? tExercise(exercise.key, exercise.name) : exercise.name}
        </h2>

        <p className={css.detailMuscle}>
          {exercise.muscles?.primary?.join(', ')}
        </p>

        {exercise.muscles?.secondary?.length > 0 && (
          <p className={css.detailSecondary}>
            {t('secondary') || 'Secondary'}: {exercise.muscles.secondary.join(', ')}
          </p>
        )}

        {ex?.category && (
          <span className={css.detailEquipment}>
            {ex.category}
          </span>
        )}

        {ex?.scienceNotes && (
          <p style={{ fontSize: '0.75rem', color: 'rgba(232,230,225,0.5)', lineHeight: 1.4, marginBottom: 16 }}>
            {ex.scienceNotes}
          </p>
        )}

        <button className={css.detailClose} onClick={onClose}>
          {t('close') || 'Close'}
        </button>
      </div>
    </div>
  );
}
