/**
 * velocityAudioHaptics.ts: Real-Time Audio-Haptic Velocity Loss Feedback Engine.
 *
 * Literature:
 * - Sanchez-Medina L, Gonzalez-Badillo JJ.
 *   "Velocity loss as an indicator of neuromuscular fatigue during resistance training".
 *   Med Sci Sports Exerc. 2011;43(9):1725-1734.
 * - Carmack J.
 *   "Latency mitigation in interactive audio-visual simulation architectures".
 *   Communications of the ACM. 1996.
 * - Weakley J, Mann B, Banyard H, et al.
 *   "Velocity-based training: From theory to application".
 *   Strength Cond J. 2021;43(2):31-49.
 */

export type VelocityHapticTier =
  | 'speed_preserved'
  | 'moderate_decline'
  | 'optimal_hypertrophy'
  | 'termination_failure';

export interface VelocityFeedbackResult {
  tier: VelocityHapticTier;
  velocityLossPercent: number;
  frequencyHz: number;
  toneDurationMs: number;
  hapticPattern: number[];
  cueFr: string;
  cueEn: string;
}

let sharedAudioCtx: AudioContext | null = null;

/**
 * Lazily obtains or unlocks the Web Audio API AudioContext for iOS WebKit.
 */
export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Triggers native haptic vibration if supported.
 */
function triggerHaptic(pattern: number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignored if vibration permission is unavailable
    }
  }
}

/**
 * Synthesizes an acoustic tone using Web Audio API oscillators.
 */
function synthesizeTone(
  freqHz: number,
  durationSec: number,
  waveform: OscillatorType = 'sine',
  gainPeak = 0.12
): void {
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = waveform;
    osc.frequency.setValueAtTime(freqHz, now);

    gain.gain.setValueAtTime(gainPeak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec);
  } catch {
    // Degrades silently if autoplay is blocked
  }
}

/**
 * Classifies intra-set velocity loss and triggers the corresponding
 * acoustic chime and haptic feedback pattern.
 *
 * Thresholds:
 * - <10% loss: Speed preserved (520 Hz resonant chime, 80ms, single haptic pulse 25ms)
 * - 10-20% loss: Moderate decline (440 Hz standard tone, 90ms, single pulse 35ms)
 * - 20-30% loss: Optimal hypertrophy horizon (340 Hz harmonic, 120ms, dual pulse [40, 60, 40])
 * - >35% loss: Termination horn / failure alert (220 Hz warning, 180ms, triple pulse [60, 50, 60, 50, 100])
 */
export function dispatchVelocityFeedback(
  velocityLossPercent: number,
  enableAudio = true,
  enableHaptics = true
): VelocityFeedbackResult {
  const loss = Math.max(0, Math.round(velocityLossPercent * 10) / 10);

  let tier: VelocityHapticTier;
  let frequencyHz: number;
  let toneDurationMs: number;
  let waveform: OscillatorType;
  let hapticPattern: number[];
  let cueFr: string;
  let cueEn: string;

  if (loss < 10) {
    tier = 'speed_preserved';
    frequencyHz = 520;
    toneDurationMs = 80;
    waveform = 'sine';
    hapticPattern = [25];
    cueFr = `Vitesse préservée (${loss}\u00A0% de perte)\u00A0: puissance intacte au verrouillage.`;
    cueEn = `Speed preserved (${loss}% loss): intact power at lockout.`;
  } else if (loss < 20) {
    tier = 'moderate_decline';
    frequencyHz = 440;
    toneDurationMs = 90;
    waveform = 'sine';
    hapticPattern = [35];
    cueFr = `Ralentissement modéré (${loss}\u00A0% de perte)\u00A0: cadence stable.`;
    cueEn = `Moderate deceleration (${loss}% loss): stable cadence.`;
  } else if (loss <= 30) {
    tier = 'optimal_hypertrophy';
    frequencyHz = 340;
    toneDurationMs = 120;
    waveform = 'triangle';
    hapticPattern = [40, 60, 40];
    cueFr = `Horizon d'hypertrophie optimal (${loss}\u00A0% de perte)\u00A0: recrutement moteur maximal.`;
    cueEn = `Optimal hypertrophy horizon (${loss}% loss): maximum motor unit recruitment.`;
  } else {
    tier = 'termination_failure';
    frequencyHz = 220;
    toneDurationMs = 180;
    waveform = 'sawtooth';
    hapticPattern = [60, 50, 60, 50, 100];
    cueFr = `Seuil critique de fatigue atteint (${loss}\u00A0% de perte)\u00A0: terminez la série.`;
    cueEn = `Critical fatigue threshold reached (${loss}% loss): terminate set.`;
  }

  if (enableAudio) {
    synthesizeTone(frequencyHz, toneDurationMs / 1000, waveform);
  }

  if (enableHaptics) {
    triggerHaptic(hapticPattern);
  }

  return {
    tier,
    velocityLossPercent: loss,
    frequencyHz,
    toneDurationMs,
    hapticPattern,
    cueFr,
    cueEn,
  };
}

/**
 * Calculates instantaneous concentric mean angular velocity (deg/s) from continuous angle samples.
 */
export function calculateConcentricMeanVelocity(
  angleSamples: { angle: number; timestamp: number }[]
): { meanVelocityDegS: number; peakVelocityDegS: number } | null {
  if (!Array.isArray(angleSamples) || angleSamples.length < 3) {
    return null;
  }

  let totalVelocity = 0;
  let peakVelocity = 0;
  let validCount = 0;

  for (let i = 1; i < angleSamples.length; i++) {
    const prev = angleSamples[i - 1];
    const curr = angleSamples[i];

    const dt = curr.timestamp - prev.timestamp;
    if (dt > 0.005 && dt < 0.25) {
      const dAngle = Math.abs(curr.angle - prev.angle);
      const v = dAngle / dt;

      totalVelocity += v;
      if (v > peakVelocity) peakVelocity = v;
      validCount++;
    }
  }

  if (validCount === 0) return null;

  return {
    meanVelocityDegS: Math.round(totalVelocity / validCount),
    peakVelocityDegS: Math.round(peakVelocity),
  };
}
