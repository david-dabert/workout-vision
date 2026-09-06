import { useState, useEffect } from 'react';
import { getWorkoutOfTheWeek } from '../lib/workoutOfTheWeek';
import { getWorkoutsByDateRange } from '../lib/storage';
import { useT } from '../lib/LanguageContext';

/**
 * Weekly challenge card on the Dashboard.
 * Shows the current Workout of the Week and user's best attempt if any.
 */
export default function WorkoutOfTheWeek({ onNavigate }) {
  const { t, lang } = useT();
  const [wotw] = useState(() => getWorkoutOfTheWeek());
  const [bestAttempt, setBestAttempt] = useState(null);

  useEffect(() => {
    // Check if user has done this exercise this week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    getWorkoutsByDateRange(monday, now).then(workouts => {
      const matching = workouts
        .filter(w => w.exercise === wotw.exercise && w.formScore > 0)
        .sort((a, b) => (b.formScore || 0) - (a.formScore || 0));
      if (matching.length > 0) setBestAttempt(matching[0]);
    });
  }, [wotw.exercise]);

  return (
    <div style={{
      margin: '0 16px 12px',
      padding: '14px 16px',
      background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(196,181,253,0.06))',
      borderRadius: 14,
      border: '1px solid rgba(168,85,247,0.18)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>&#127942;</span>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--lavender, #c4b5fd)',
          }}>
            {lang === 'fr' ? 'Exercice de la semaine' : 'Workout of the Week'}
          </span>
        </div>
        <span style={{
          fontSize: '0.68rem', color: 'var(--text-tertiary)',
          fontWeight: 500,
        }}>
          {wotw.daysLeft > 0
            ? (lang === 'fr' ? `${wotw.daysLeft}j restants` : `${wotw.daysLeft}d left`)
            : (lang === 'fr' ? 'Dernier jour' : 'Last day')}
        </span>
      </div>

      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        {wotw.exerciseName}
      </div>

      {bestAttempt ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <div style={{
            padding: '4px 10px', borderRadius: 8,
            background: 'rgba(0,245,212,0.12)',
            fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)',
          }}>
            {bestAttempt.formScore}/100
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {bestAttempt.reps} reps &middot;{' '}
            {lang === 'fr' ? 'Votre meilleur score' : 'Your best score'}
          </span>
          <button
            onClick={() => onNavigate('analyze')}
            style={{
              marginLeft: 'auto', padding: '6px 12px', borderRadius: 8,
              background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.25)',
              color: 'var(--lavender, #c4b5fd)', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {lang === 'fr' ? 'Battre' : 'Beat it'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => onNavigate('analyze')}
          style={{
            marginTop: 8, width: '100%', padding: '10px 0',
            borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #a855f7, #c4b5fd)',
            color: '#000', fontSize: '0.85rem', fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {lang === 'fr' ? 'Relever le challenge' : 'Take the challenge'}
        </button>
      )}
    </div>
  );
}
