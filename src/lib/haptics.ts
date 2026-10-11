/**
 * Haptic feedback utility using navigator.vibrate() API.
 * Includes a synthesized audio tick fallback for iOS Safari and desktop.
 */

let audioCtx: AudioContext | null = null;

function audioTick(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.025);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.025);
  } catch {
    // silently ignore if audio is blocked or unsupported
  }
}

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function vibrate(pattern: number | number[]): void {
  if (canVibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // silently ignore
    }
  } else {
    audioTick();
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
