import { useState, useEffect, useRef } from 'react';

/**
 * useCountUp — Animates a number from 0 to a target value.
 *
 * Uses requestAnimationFrame for smooth 60fps animation with ease-out cubic easing.
 * Respects prefers-reduced-motion. Re-triggers when target changes.
 *
 * @param {number} target - The value to animate toward.
 * @param {object} options
 * @param {number} [options.duration=800] - Animation duration in ms.
 * @param {number} [options.delay=0] - Delay before animation starts, in ms.
 * @returns {number} The current animated display value.
 *
 * @example
 * const displayValue = useCountUp(87, { duration: 800, delay: 200 });
 */
export default function useCountUp(target, { duration = 800, delay = 0 } = {}) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (target == null) return;

    // Skip animation if user prefers reduced motion
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setValue(formatOutput(target));
      return;
    }

    // Determine whether to format as integer or single-decimal float
    const isFloat = !Number.isInteger(target);

    function formatOutput(raw) {
      return isFloat ? Math.round(raw * 10) / 10 : Math.round(raw);
    }

    // Ease-out cubic: starts fast, decelerates
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function startAnimation() {
      const startTime = performance.now();

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        setValue(formatOutput(eased * target));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        }
      }

      rafRef.current = requestAnimationFrame(step);
    }

    // Reset to 0 before animating
    setValue(0);

    if (delay > 0) {
      timerRef.current = setTimeout(startAnimation, delay);
    } else {
      startAnimation();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [target, duration, delay]);

  return value;
}
