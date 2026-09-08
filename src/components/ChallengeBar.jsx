import { useState } from 'react';
import { useT } from '../lib/LanguageContext';
import { useProfile } from '../lib/ProfileContext';
import { clearChallengeFromURL, compareChallenge, shareChallengeResponse } from '../lib/challenges';

/**
 * Challenge bar shown at top of Dashboard when user arrives via a challenge URL.
 * Shows the challenger's stats and invite to beat them.
 * After completing the same exercise, shows comparison result + "Share my response" button.
 */
export default function ChallengeBar({ challenge, completedResult, onAccept }) {
  const { t, tExercise } = useT();
  const { profile } = useProfile();
  const [dismissed, setDismissed] = useState(false);
  const [shareStatus, setShareStatus] = useState(null);

  if (dismissed || !challenge) return null;

  const exerciseName = tExercise(challenge.exercise, challenge.exercise.replace(/_/g, ' '));

  // After user completed the exercise, show comparison + share response button
  if (completedResult) {
    const cmp = compareChallenge(challenge, completedResult);
    const resultLabel = cmp.tie
      ? t('challenge_tie')
      : cmp.userWins
        ? t('challenge_you_win')
        : t('challenge_they_win');

    const handleShareResponse = async () => {
      setShareStatus('sharing');
      const status = await shareChallengeResponse(challenge, completedResult, profile);
      setShareStatus(status);
      setTimeout(() => setShareStatus(null), 2500);
    };

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
        <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>{t('challenge_you')}</div>
            <div>{cmp.userReps} reps, {cmp.userScore}/100 {t('form').toLowerCase()}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--muted)' }}>{cmp.challengerName}</div>
            <div>{cmp.challengerReps} reps, {cmp.challengerScore}/100 {t('form').toLowerCase()}</div>
          </div>
        </div>
        {/* Share response button - closes the viral loop */}
        <button
          onClick={handleShareResponse}
          disabled={shareStatus === 'sharing'}
          style={{
            width: '100%',
            padding: '10px 0',
            fontSize: '0.85rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #c4b5fd, #a78bfa)',
            border: 'none',
            color: '#000',
            borderRadius: 10,
            cursor: shareStatus === 'sharing' ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {shareStatus === 'copied'
            ? t('link_copied')
            : shareStatus === 'shared'
              ? t('shared')
              : `Send my result to ${cmp.challengerName}`}
        </button>
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

/**
 * Response comparison view shown when User A opens a response URL from User B.
 * Displays both users' results side by side.
 */
export function ChallengeResponseView({ response, onDismiss }) {
  const { t, tExercise } = useT();

  if (!response) return null;

  const exerciseName = tExercise(response.exercise, response.exercise.replace(/_/g, ' '));
  const responderWins = response.responderScore > response.challengerScore
    || (response.responderScore === response.challengerScore && response.responderReps > response.challengerReps);
  const tie = response.responderScore === response.challengerScore && response.responderReps === response.challengerReps;

  const resultLabel = tie
    ? "It's a tie!"
    : responderWins
      ? `${response.responderName} wins!`
      : `${response.challengerName} wins!`;

  const resultColor = tie
    ? 'rgba(255,184,54,0.15)'
    : 'rgba(0,245,212,0.12)';

  return (
    <div style={{
      padding: '16px',
      background: `linear-gradient(135deg, ${resultColor}, rgba(196,181,253,0.08))`,
      borderRadius: 14,
      marginBottom: 12,
      border: '1px solid rgba(196,181,253,0.2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t('challenge_response')}
        </span>
        <button
          onClick={() => { onDismiss(); clearChallengeFromURL(); }}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px',
          }}
          aria-label={t('close')}
        >&times;</button>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)', marginBottom: 4 }}>
          {exerciseName}
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
          {resultLabel}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{
          flex: 1, textAlign: 'center', padding: '12px 8px',
          background: !responderWins && !tie ? 'rgba(0,245,212,0.08)' : 'rgba(255,255,255,0.03)',
          borderRadius: 10, border: !responderWins && !tie ? '1px solid rgba(0,245,212,0.15)' : '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 6, color: !responderWins && !tie ? 'var(--accent)' : 'var(--text-primary)' }}>
            {response.challengerName}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
            {response.challengerScore}<span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--muted)' }}>/100</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
            {response.challengerReps} reps
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)', fontWeight: 700, fontSize: '0.8rem' }}>
          VS
        </div>
        <div style={{
          flex: 1, textAlign: 'center', padding: '12px 8px',
          background: responderWins ? 'rgba(0,245,212,0.08)' : 'rgba(255,255,255,0.03)',
          borderRadius: 10, border: responderWins ? '1px solid rgba(0,245,212,0.15)' : '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 6, color: responderWins ? 'var(--accent)' : 'var(--text-primary)' }}>
            {response.responderName}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
            {response.responderScore}<span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--muted)' }}>/100</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
            {response.responderReps} reps
          </div>
        </div>
      </div>
    </div>
  );
}
