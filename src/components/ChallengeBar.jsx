import { useState } from 'react';
import { useT } from '../lib/LanguageContext';
import { clearChallengeFromURL, compareChallenge } from '../lib/challenges';

/**
 * Challenge bar shown at top of Dashboard when user arrives via a challenge URL.
 * Shows the challenger's stats and invite to beat them.
 * After completing the same exercise, shows comparison result.
 */
export default function ChallengeBar({ challenge, completedResult, onAccept }) {
  const { t, tExercise } = useT();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !challenge) return null;

  const exerciseName = tExercise(challenge.exercise, challenge.exercise.replace(/_/g, ' '));

  // After user completed the exercise, show comparison
  if (completedResult) {
    const cmp = compareChallenge(challenge, completedResult);
    const resultLabel = cmp.tie
      ? t('challenge_tie')
      : cmp.userWins
        ? t('challenge_you_win')
        : t('challenge_they_win');

    return (
      <div style={{
        padding: '12px 16px',
        background: cmp.userWins
          ? 'linear-gradient(135deg, rgba(0,245,212,0.12), rgba(0,230,118,0.08))'
          : cmp.tie
            ? 'linear-gradient(135deg, rgba(255,184,54,0.12), rgba(255,184,54,0.06))'
            : 'linear-gradient(135deg, rgba(255,59,92,0.12), rgba(255,59,92,0.06))',
        borderRadius: 12,
        marginBottom: 12,
        border: `1px solid ${cmp.userWins ? 'rgba(0,245,212,0.2)' : cmp.tie ? 'rgba(255,184,54,0.2)' : 'rgba(255,59,92,0.2)'}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{resultLabel}</span>
          <button
            onClick={() => { setDismissed(true); clearChallengeFromURL(); }}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)',
              fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px',
            }}
            aria-label={t('close')}
          >&times;</button>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>{t('challenge_you')}</div>
            <div>{cmp.userReps} reps, {cmp.userScore}/100 {t('form').toLowerCase()}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--muted)' }}>{cmp.challengerName}</div>
            <div>{cmp.challengerReps} reps, {cmp.challengerScore}/100 {t('form').toLowerCase()}</div>
          </div>
        </div>
      </div>
    );
  }

  // Initial challenge state: show invitation
  return (
    <div style={{
      padding: '12px 16px',
      background: 'linear-gradient(135deg, rgba(255,107,157,0.1), rgba(255,176,136,0.08))',
      borderRadius: 12,
      marginBottom: 12,
      border: '1px solid rgba(255,107,157,0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('challenge_incoming', {
              name: challenge.challengerName,
              reps: challenge.reps,
              exercise: exerciseName,
              score: challenge.score,
            })}
          </p>
        </div>
        <button
          onClick={() => { setDismissed(true); clearChallengeFromURL(); }}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px', marginLeft: 8,
          }}
          aria-label={t('close')}
        >&times;</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          style={{
            flex: 1, padding: '10px 0', fontSize: '0.85rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #ff6b9d, #ffb088)', border: 'none', color: '#000',
          }}
          onClick={onAccept}
        >
          {t('challenge_accept')}
        </button>
        <button
          className="btn btn-ghost"
          style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: 600 }}
          onClick={() => { setDismissed(true); clearChallengeFromURL(); }}
        >
          {t('challenge_dismiss')}
        </button>
      </div>
    </div>
  );
}
