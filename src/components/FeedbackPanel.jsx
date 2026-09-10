import { useState, useCallback, memo } from 'react';
import { EXERCISES } from '../lib/exercises';

const FEEDBACK_STORAGE_KEY = 'wv_feedback';

function loadFeedback() {
  try {
    return JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveFeedbackEntry(entry) {
  try {
    const existing = loadFeedback();
    existing.push({ ...entry, timestamp: Date.now() });
    // Keep last 200 entries
    const trimmed = existing.slice(-200);
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* storage full or unavailable */ }
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let device = 'Desktop';
  if (/Android/i.test(ua)) device = 'Android';
  else if (/iPad|iPhone|iPod/.test(ua)) device = 'iOS';

  return { browser, device };
}

function FeedbackPanel({ result }) {
  const [exerciseConfirmed, setExerciseConfirmed] = useState(null); // true, false, or null
  const [correctedExercise, setCorrectedExercise] = useState('');
  const [thumbs, setThumbs] = useState(null); // 'up' or 'down'

  const exerciseOptions = Object.entries(EXERCISES)
    .filter(([key]) => key !== result?.exercise)
    .map(([key, def]) => ({ key, label: def.label || key }));

  const handleExerciseConfirm = useCallback((correct) => {
    setExerciseConfirmed(correct);
    if (correct) {
      saveFeedbackEntry({
        type: 'exercise_confirm',
        detected: result?.exercise,
        correct: true,
        workoutId: result?.workoutId,
      });
    }
  }, [result?.exercise, result?.workoutId]);

  const handleExerciseCorrection = useCallback((newExercise) => {
    setCorrectedExercise(newExercise);
    saveFeedbackEntry({
      type: 'exercise_correction',
      detected: result?.exercise,
      corrected: newExercise,
      workoutId: result?.workoutId,
    });
  }, [result?.exercise, result?.workoutId]);

  const handleThumbs = useCallback((direction) => {
    setThumbs(direction);
    saveFeedbackEntry({
      type: 'thumbs',
      direction,
      exercise: result?.exercise,
      reps: result?.reps,
      formScore: result?.formScore,
      confidence: result?.confidence?.level,
      workoutId: result?.workoutId,
    });
  }, [result]);

  const buildIssueUrl = useCallback(() => {
    const { browser, device } = getDeviceInfo();
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';
    const body = [
      `**Device:** ${device}`,
      `**Browser:** ${browser}`,
      `**App Version:** ${version}`,
      `**Exercise detected:** ${result?.exerciseName || result?.exercise || 'unknown'}`,
      `**Confidence:** ${result?.confidence?.level || 'unknown'}`,
      `**Rep count:** ${result?.reps ?? 'N/A'}`,
      result?.correctedResult ? `**Expected:** ${result.correctedResult.reps}` : '',
      '',
      '**What happened:**',
      '[Please describe the issue]',
    ].filter(Boolean).join('\n');

    return `https://github.com/david-dabert/workout-vision/issues/new?title=${encodeURIComponent('Analysis Issue')}&body=${encodeURIComponent(body)}`;
  }, [result]);

  if (!result) return null;

  const displayExercise = EXERCISES[result.exercise]?.label || result.exerciseName || result.exercise;

  return (
    <div style={{
      marginTop: 10,
      padding: '12px 14px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Exercise confirmation */}
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Detected <strong style={{ color: 'var(--text)' }}>{displayExercise}</strong>
        </span>
        {exerciseConfirmed === null && (
          <span style={{ marginLeft: 10 }}>
            <button
              onClick={() => handleExerciseConfirm(true)}
              style={{
                background: 'rgba(0,245,212,0.1)', border: '1px solid rgba(0,245,212,0.2)',
                color: 'var(--accent)', borderRadius: 6, padding: '3px 10px',
                fontSize: '0.75rem', cursor: 'pointer', marginRight: 4, fontWeight: 600,
              }}
            >Correct</button>
            <button
              onClick={() => handleExerciseConfirm(false)}
              style={{
                background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                color: 'var(--red)', borderRadius: 6, padding: '3px 10px',
                fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
              }}
            >Wrong</button>
          </span>
        )}
        {exerciseConfirmed === true && (
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent)' }}>Confirmed</span>
        )}
        {exerciseConfirmed === false && !correctedExercise && (
          <select
            value=""
            onChange={(e) => handleExerciseCorrection(e.target.value)}
            style={{
              marginLeft: 8, fontSize: '0.75rem', padding: '3px 8px',
              background: 'rgba(255,255,255,0.06)', color: 'var(--text)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
            }}
          >
            <option value="" disabled>Select exercise...</option>
            {exerciseOptions.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        )}
        {correctedExercise && (
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--yellow)' }}>
            Corrected to {EXERCISES[correctedExercise]?.label || correctedExercise}
          </span>
        )}
      </div>

      {/* Thumbs up/down + Report */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginRight: 4 }}>Rate result:</span>
        <button
          onClick={() => handleThumbs('up')}
          style={{
            background: thumbs === 'up' ? 'rgba(0,245,212,0.15)' : 'transparent',
            border: thumbs === 'up' ? '1px solid rgba(0,245,212,0.3)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '1rem',
            opacity: thumbs && thumbs !== 'up' ? 0.4 : 1,
          }}
          aria-label="Good result"
        >&#128077;</button>
        <button
          onClick={() => handleThumbs('down')}
          style={{
            background: thumbs === 'down' ? 'rgba(255,107,107,0.15)' : 'transparent',
            border: thumbs === 'down' ? '1px solid rgba(255,107,107,0.3)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '1rem',
            opacity: thumbs && thumbs !== 'down' ? 0.4 : 1,
          }}
          aria-label="Bad result"
        >&#128078;</button>
        <a
          href={buildIssueUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)',
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >Report a problem</a>
      </div>
    </div>
  );
}

export default memo(FeedbackPanel);
