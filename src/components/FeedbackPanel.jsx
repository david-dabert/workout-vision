import { useState, useCallback, memo } from 'react';
import { EXERCISES } from '../lib/exercises';
import { updateWorkout } from '../lib/storage';
import { logCorrection } from '../lib/correctionLog';
import { useT } from '../lib/LanguageContext';

const FEEDBACK_STORAGE_KEY = 'wv_feedback';

// Inert since 3 October 2026 (WP0.4, docs/SPEC-production.md): this used to post the feedback, with free text, to the
// worker's ingest endpoint whenever the build set VITE_FEEDBACK_URL. The endpoint is removed (it answers 404) and nothing
// here sends anywhere: no network call, whatever the build. The choices stay on the phone (saveFeedbackEntry).
// Any future sender needs the notice and recorded consent of Phase 2 first. The calls below are left in place so the
// panel's behaviour on the phone is unchanged; their arguments are ignored.
function beaconFeedback() {}

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
  const { t, tExercise } = useT();
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
      beaconFeedback({
        kind: 'feedback',
        detected: result?.exercise,
        confidence: result?.confidence?.visibility,
        deviceClass: getDeviceInfo().device,
        message: 'exercise_confirmed',
      });
    }
  }, [result?.exercise, result?.workoutId, result?.confidence?.visibility]);

  const handleExerciseCorrection = useCallback((newExercise) => {
    setCorrectedExercise(newExercise);
    saveFeedbackEntry({
      type: 'exercise_correction',
      detected: result?.exercise,
      corrected: newExercise,
      workoutId: result?.workoutId,
    });
    beaconFeedback({
      kind: 'correction',
      detected: result?.exercise,
      corrected: newExercise,
      confidence: result?.confidence?.visibility,
      deviceClass: getDeviceInfo().device,
    });
    // Log to unified correction ledger
    logCorrection({
      type: 'exercise',
      workoutId: result?.workoutId,
      exerciseKey: result?.exercise,
      original: result?.exercise,
      corrected: newExercise,
      confidence: result?.confidence?.visibility,
      detectionConfidence: result?.detectionConfidence,
      insufficientFootage: result?.insufficientFootage,
      qualityGateReasons: result?.qualityGateReasons,
    }).catch(() => {});
    // Update the stored workout record with the corrected exercise
    if (result?.workoutId) {
      const correctedDef = EXERCISES[newExercise];
      updateWorkout(result.workoutId, {
        exercise: newExercise,
        exerciseName: correctedDef?.name || correctedDef?.label || newExercise,
        exerciseCorrected: true,
        originalExercise: result.exercise,
      }).catch(() => {});
    }
  }, [result?.exercise, result?.workoutId, result?.confidence?.visibility]);

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
    beaconFeedback({
      kind: 'rating',
      detected: result?.exercise,
      confidence: result?.confidence?.visibility,
      repCount: result?.reps,
      deviceClass: getDeviceInfo().device,
      message: direction,
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
          {t('detected_exercise')} <strong style={{ color: 'var(--text)' }}>{displayExercise}</strong>
        </span>
        {exerciseConfirmed === null && (
          <span style={{ marginLeft: 10 }}>
            <button
              onClick={() => handleExerciseConfirm(true)}
              style={{
                background: 'rgba(212,167,106,0.1)', border: '1px solid rgba(212,167,106,0.2)',
                color: 'var(--accent)', borderRadius: 6, padding: '3px 10px',
                fontSize: '0.75rem', cursor: 'pointer', marginRight: 4, fontWeight: 600,
              }}
            >{t('correct')}</button>
            <button
              onClick={() => handleExerciseConfirm(false)}
              style={{
                background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                color: 'var(--red)', borderRadius: 6, padding: '3px 10px',
                fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
              }}
            >{t('wrong')}</button>
          </span>
        )}
        {exerciseConfirmed === true && (
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--accent)' }}>{t('confirmed')}</span>
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
            <option value="" disabled>{t('select_exercise_correction')}</option>
            {exerciseOptions.map(({ key, label }) => (
              <option key={key} value={key}>{tExercise(key, label)}</option>
            ))}
          </select>
        )}
        {correctedExercise && (
          <span style={{ marginLeft: 8, fontSize: '0.75rem', color: 'var(--yellow)' }}>
            {t('corrected_to', { exercise: tExercise(correctedExercise, EXERCISES[correctedExercise]?.label || correctedExercise) })}
          </span>
        )}
      </div>

      {/* Thumbs up/down + Report */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginRight: 4 }}>{t('rate_result')}</span>
        <button
          onClick={() => handleThumbs('up')}
          style={{
            background: thumbs === 'up' ? 'rgba(212,167,106,0.15)' : 'transparent',
            border: thumbs === 'up' ? '1px solid rgba(212,167,106,0.3)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '1rem',
            opacity: thumbs && thumbs !== 'up' ? 0.4 : 1,
          }}
          aria-label={t('good_result')}
        ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>
        <button
          onClick={() => handleThumbs('down')}
          style={{
            background: thumbs === 'down' ? 'rgba(255,107,107,0.15)' : 'transparent',
            border: thumbs === 'down' ? '1px solid rgba(255,107,107,0.3)' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '1rem',
            opacity: thumbs && thumbs !== 'down' ? 0.4 : 1,
          }}
          aria-label={t('bad_result')}
        ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg></button>
        <a
          href={buildIssueUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)',
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}
        >{t('report_problem')}</a>
      </div>
    </div>
  );
}

export default memo(FeedbackPanel);
