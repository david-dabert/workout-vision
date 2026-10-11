import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../lib/LanguageContext';
import { getExerciseFrames, hasExerciseGuide, getAllGuideExercises, getGuideExercise } from '../lib/exerciseGuide';
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

/** Category labels for display */
const CATEGORY_LABELS = {
  legs: 'Legs',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full Body',
  cardio: 'Cardio',
  stretching: 'Stretching',
};

/**
 * Full exercise library page with search, filter, and detail view.
 * Shows ALL 302 exercises from the bryllim/workout-guide library.
 */
export default function ExerciseGuideLibrary({ onClose }) {
  const { t, tExercise } = useT();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [detail, setDetail] = useState(null);

  // Build exercise list from the full guide catalogue
  const exercises = getAllGuideExercises().map(g => {
    const ex = EXERCISES[g.key];
    return {
      key: g.key,
      name: ex?.name || g.name,
      category: g.category,
      muscles: ex?.muscles || null,
      hasFullData: !!ex,
    };
  });

  // Get unique categories for filter chips
  const categories = [...new Set(exercises.map(e => e.category))].sort();

  // Filter
  const filtered = exercises.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      const name = (tExercise ? tExercise(e.key, e.name) : e.name).toLowerCase();
      if (!name.includes(q) && !e.key.includes(q)) return false;
    }
    if (category) {
      if (e.category !== category) return false;
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
        <span style={{ fontSize: '0.75rem', opacity: 0.5, marginLeft: 8 }}>
          {filtered.length}/{exercises.length}
        </span>
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
          className={`${css.filterChip}${!category ? ` ${css.filterChipActive}` : ''}`}
          onClick={() => setCategory(null)}
        >
          {t('all') || 'All'}
        </button>
        {categories.map(c => (
          <button
            key={c}
            className={`${css.filterChip}${category === c ? ` ${css.filterChipActive}` : ''}`}
            onClick={() => setCategory(category === c ? null : c)}
          >
            {CATEGORY_LABELS[c] || c}
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
              {CATEGORY_LABELS[e.category] || e.category}
            </span>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: 'center', color: 'rgba(232,230,225,0.4)', marginTop: 40 }}>
          {t('no_exercises_found') || 'No exercises found'}
        </p>
      )}

      <p style={{ padding: 20 }}>Illustrations: Everkinetic, via <a href="https://github.com/bryllim/workout-guide">bryllim/workout-guide</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. WebP · 320 × 320.</p>
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
          {ex?.muscles?.primary?.join(', ') || CATEGORY_LABELS[exercise.category] || exercise.category}
        </p>

        {ex?.muscles?.secondary?.length > 0 && (
          <p className={css.detailSecondary}>
            {t('secondary') || 'Secondary'}: {ex.muscles.secondary.join(', ')}
          </p>
        )}

        <span className={css.detailEquipment}>
          {CATEGORY_LABELS[exercise.category] || ex?.category || ''}
        </span>

        <p className={css.detailSecondary}>{['bicep_curl', 'lateral_raise', 'lat_pulldown'].includes(exercise.key) ? 'Compté / Counted' : 'Guide uniquement / Guide only'}</p>

        <button className={css.detailClose} onClick={onClose}>
          {t('close') || 'Close'}
        </button>
      </div>
    </div>
  );
}
