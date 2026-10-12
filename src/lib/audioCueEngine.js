/**
 * AudioCueEngine — Tactile Acoustic & Micro-Haptic Kinematic Feedback
 *
 * Provides real-time acoustic feedback at exact kinematic turnaround points,
 * lockouts, and fatigue/velocity thresholds without looking at the screen.
 *
 * 100% Client-Side. Uses native Web Audio API (AudioContext) synthesis.
 * ZERO network downloads. ZERO latency (<5ms acoustic latency).
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Triggers micro-haptic vibration on supported hardware
 */
function triggerHaptic(pattern = [20]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Haptics not allowed or unsupported
    }
  }
}

/**
 * Synthesizes a precision mechanical click (Leica / Hasselblad shutter click aesthetic)
 * indicating clean joint lockout or repetition completion.
 */
export function playLockoutCue(pan = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // 880 Hz (A5) fundamental with rapid exponential decay over 25ms
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.025);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  if (ctx.createStereoPanner && pan !== 0) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
  } else {
    osc.connect(gain);
    gain.connect(ctx.destination);
  }

  osc.start(now);
  osc.stop(now + 0.025);

  triggerHaptic([15]);
}

/**
 * Synthesizes a warm resonant low-frequency tone at peak concentric/eccentric turnaround
 */
export function playTurnaroundCue() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // 330 Hz (E4) warm tone over 40ms
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);

  triggerHaptic([10]);
}

/**
 * Double-pulse alert indicating significant velocity loss or compensatory asymmetry
 */
export function playVelocityLossAlert() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  [0, 0.08].forEach(offset => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now + offset); // C5

    gain.gain.setValueAtTime(0.15, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.05);
  });

  triggerHaptic([20, 40, 20]);
}
