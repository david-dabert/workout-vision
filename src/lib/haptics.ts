/**
 * Haptic feedback utility using navigator.vibrate() API.
 * Falls back to no-op on unsupported platforms (iOS Safari, desktop).
 */

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function vibrate(pattern: number | number[]): void {
  if (canVibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (_) {
      // silently ignore
    }
  }
}

/** Short single pulse - use on rep count increments */
export function hapticTap(): void {
  vibrate(50);
}

/** Double pulse - use on personal records */
export function hapticPR(): void {
  vibrate([50, 50, 50]);
}

/** Light pulse - use on button taps */
export function hapticLight(): void {
  vibrate(30);
}
