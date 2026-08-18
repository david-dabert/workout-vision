/**
 * Audio and haptic feedback for workout events.
 * Uses Web Audio API (no external files needed).
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (iOS requires user gesture)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a short beep tone.
 * @param {number} freq - frequency in Hz
 * @param {number} duration - duration in seconds
 * @param {number} volume - 0 to 1
 */
function beep(freq, duration = 0.08, volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available, fail silently
  }
}

/**
 * Haptic vibration (mobile only).
 * @param {number|number[]} pattern - milliseconds or pattern array
 */
function vibrate(pattern = 50) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Vibration not available
  }
}

/** Rep completed — short ascending beep + haptic */
export function repCompleteSound() {
  beep(880, 0.06, 0.25);
  setTimeout(() => beep(1100, 0.06, 0.2), 70);
  vibrate(40);
}

/** Form error — low warning tone + longer haptic */
export function formErrorSound() {
  beep(330, 0.12, 0.2);
  vibrate([30, 20, 30]);
}

/** Set complete — triple ascending beep + strong haptic */
export function setCompleteSound() {
  beep(660, 0.08, 0.25);
  setTimeout(() => beep(880, 0.08, 0.25), 100);
  setTimeout(() => beep(1100, 0.1, 0.3), 200);
  vibrate([50, 30, 50, 30, 80]);
}

/** Warm up audio context on first user gesture (call on any button tap) */
export function warmUpAudio() {
  getAudioContext();
}
