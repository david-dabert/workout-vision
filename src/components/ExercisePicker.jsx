/**
 * ExercisePicker — chip-based exercise selection UI.
 *
 * Default live path: shows candidate chips from the HierarchicalDetector.
 * User taps a chip to lock the exercise. Auto-locks when confidence
 * is high enough (0.85 with 0.15 margin for 1 second).
 *
 * Also captures training samples on every lock/correction via sampleCapture.
 */

import { useState, useEffect, useCallback } from 'react';
import { EXERCISES } from '../lib/exercises';
import { saveSample } from '../lib/sampleCapture';
import { useT } from '../lib/LanguageContext';

/**
 * @param {object} props
 * @param {{ context, movementClass, exercise, candidates, confidence, locked }} props.detectorState
 * @param {function} props.onSelect - called with exercise key when user picks
 * @param {object} props.temporalFeatures - current features for sample capture
 * @param {boolean} [props.compact=false] - compact mode for inline use
 */
export default function ExercisePicker({ detectorState, onSelect, temporalFeatures, compact = false }) {
  const { t } = useT();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when detector resets (new set)
  useEffect(() => {
    if (!detectorState?.locked) setDismissed(false);
  }, [detectorState?.locked]);

  const handleSelect = useCallback((exerciseId) => {
    // Was this a correction?
    const wasCorrection = detectorState?.exercise != null && detectorState.exercise !== exerciseId;

    onSelect(exerciseId);

    // Capture training sample
    if (temporalFeatures) {
      saveSample(
        exerciseId,
        detectorState?.context,
        detectorState?.movementClass,
        temporalFeatures,
        wasCorrection,
      ).catch(() => {}); // best-effort
    }
  }, [detectorState, onSelect, temporalFeatures]);

  if (!detectorState) return null;
  if (detectorState.locked || dismissed) return null;

  const { candidates, confidence, exercise, context } = detectorState;
  if (!candidates || candidates.length === 0) return null;

  // Show context badge
  const contextLabel = context ? context.charAt(0).toUpperCase() + context.slice(1) : '';

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? 4 : 6,
        padding: compact ? '4px 0' : '8px 0',
        alignItems: 'center',
      }}
    >
      {contextLabel && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted, #888)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginRight: 4,
          }}
        >
          {contextLabel}
        </span>
      )}
      {candidates.slice(0, 5).map((c, i) => {
        const ex = EXERCISES[c.id];
        const name = ex?.name || c.id;
        const isTop = i === 0;
        const pct = Math.round(c.score * 100);

        return (
          <button
            key={c.id}
            className="exercise-chip"
            onClick={() => handleSelect(c.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: compact ? '3px 8px' : '5px 12px',
              borderRadius: 16,
              border: isTop ? '2px solid var(--accent, #D4A76A)' : '1px solid var(--border, #333)',
              background: isTop ? 'rgba(212, 167, 106, 0.12)' : 'rgba(255,255,255,0.05)',
              color: isTop ? 'var(--accent, #D4A76A)' : 'var(--text, #eee)',
              fontSize: compact ? 11 : 13,
              fontWeight: isTop ? 600 : 400,
              cursor: 'pointer',
              transition: 'transform 0.1s, filter 0.1s',
              whiteSpace: 'nowrap',
            }}
            title={`${name} (${pct}%)`}
          >
            {name}
            <span style={{ fontSize: compact ? 9 : 10, opacity: 0.6 }}>{pct}%</span>
          </button>
        );
      })}
      {confidence > 0 && confidence < 0.4 && (
        <span style={{ fontSize: 10, color: 'var(--warning, #ffaa00)', marginLeft: 4 }}>
          {t('low_confidence') || 'Low confidence'}
        </span>
      )}
    </div>
  );
}

/**
 * Inline auto-lock indicator.
 * Shows when the detector has auto-locked an exercise.
 */
export function AutoLockBadge({ exercise, confidence, onUnlock }) {
  const { t, tExercise } = useT();
  const ex = EXERCISES[exercise];
  if (!ex) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 14,
        background: 'rgba(212, 167, 106, 0.1)',
        border: '1px solid var(--accent, #D4A76A)',
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--accent, #D4A76A)', fontWeight: 600 }}>{tExercise(exercise, ex.name)}</span>
      <span style={{ fontSize: 10, opacity: 0.6 }}>{Math.round(confidence * 100)}%</span>
      {onUnlock && (
        <button
          onClick={onUnlock}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted, #888)',
            cursor: 'pointer',
            fontSize: 11,
            padding: '0 2px',
          }}
          title={t('change_exercise')}
        >
          ✕
        </button>
      )}
    </div>
  );
}
