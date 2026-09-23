import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../../lib/LanguageContext';
import s from './GradeReveal.module.css';

/**
 * Full-screen grade reveal overlay shown when analysis completes.
 *
 * Props:
 *   grade        — letter grade (A+, A, B, C, D, F)
 *   score        — numeric score 0-100
 *   exerciseName — display name of the exercise
 *   onComplete   — called when the reveal dismisses (auto or tap)
 */
export default function GradeReveal({ grade, score, exerciseName, onComplete }) {
  const { t } = useT();
  const [dismissing, setDismissing] = useState(false);
  const [countedScore, setCountedScore] = useState(0);
  const dismissed = useRef(false);
  const rafRef = useRef(null);

  // Resolve reduced-motion preference once
  const prefersReduced = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const dismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (prefersReduced.current) {
      onComplete();
      return;
    }

    setDismissing(true);
    setTimeout(() => onComplete(), 400);
  }, [onComplete]);

  // Score count-up animation via requestAnimationFrame
  useEffect(() => {
    if (prefersReduced.current) {
      setCountedScore(score ?? 0);
      return;
    }

    const target = score ?? 0;
    const startTime = performance.now();
    // Count-up begins at 800ms, runs for 500ms
    const countStart = 800;
    const countDuration = 500;

    function tick(now) {
      const elapsed = now - startTime;
      if (elapsed < countStart) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min((elapsed - countStart) / countDuration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setCountedScore(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [score]);

  // Auto-dismiss timer
  useEffect(() => {
    const delay = prefersReduced.current ? 500 : 2500;
    const timer = setTimeout(dismiss, delay);
    return () => clearTimeout(timer);
  }, [dismiss]);

  // Map grade to color class
  const gradeColorClass =
    grade === 'A+' || grade === 'A' ? s.gradeA :
    grade === 'B' ? s.gradeB :
    grade === 'C' ? s.gradeC :
    grade === 'D' ? s.gradeD :
    s.gradeF;

  return (
    <div
      className={`${s.overlay} ${dismissing ? s.overlayOut : ''}`}
      onClick={dismiss}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') dismiss(); }}
      role="button"
      tabIndex={0}
      aria-label={t('grade_reveal_dismiss')}
    >
      <span className={`${s.gradeLetter} ${gradeColorClass}`}>
        {grade}
      </span>
      <span className={s.scoreNumber}>
        {countedScore}<span className={s.scoreUnit}>/100</span>
      </span>
      <span className={s.exerciseName}>
        {exerciseName}
      </span>
      <span className={s.tapHint}>
        {t('grade_reveal_tap')}
      </span>
    </div>
  );
}
