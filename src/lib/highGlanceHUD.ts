/**
 * High-Glance Athletic HUD Engine.
 *
 * Resolves Vulnerability 3.2 ("Distant Gym Invisibility & Glare"):
 * In real commercial gyms, lifters stand 2.5 to 3.5 meters away under fluorescent lighting.
 * Dense telemetry, fine 14px typography, and subtle charts are completely illegible mid-set.
 *
 * This engine generates an ultra-high-contrast, distance-adaptive HUD:
 * - Dynamically scales primary rep numerals up to 150px+ based on estimated athlete distance.
 * - Formulates peripheral perimeter pulse states for peripheral-vision tempo perception.
 * - Strips all non-essential visual clutter during active sets, maintaining zero raw color literals.
 */

export type RepPhase = 'idle' | 'eccentric' | 'inflection' | 'concentric' | 'lockout' | 'hold';

export interface HighGlanceInput {
  repsCount: number;
  phase: RepPhase;
  velocityMps?: number | null;
  rpe?: number | null;
  estimatedDistanceMeters?: number;
}

export interface HighGlanceState {
  numeralText: string;
  fontScaleRem: number;
  fontScalePx: number;
  perimeterToken: string;
  pulseIntensity: number;
  cueText: string;
  velocityDisplay: string | null;
  isGlanceActive: boolean;
}

/** Average adult biacromial breadth (shoulder-to-shoulder width) in meters */
const AVERAGE_SHOULDER_WIDTH_METERS = 0.39;

/**
 * Estimates distance in meters from camera based on shoulder landmark pixel span
 * relative to frame width, assuming a standard 68° mobile camera field of view.
 */
export function estimateDistanceMeters(shoulderSpanPixels: number, frameWidth: number): number {
  if (!shoulderSpanPixels || !frameWidth || shoulderSpanPixels <= 0 || frameWidth <= 0) {
    return 2.5; // fallback default gym floor distance
  }

  const fractionOfFrame = shoulderSpanPixels / frameWidth;
  // Perspective focal scaling approximation for typical 65-75° mobile lenses
  const distance = (AVERAGE_SHOULDER_WIDTH_METERS / Math.max(0.05, fractionOfFrame)) * 0.75;
  return Math.max(0.8, Math.min(5.0, Math.round(distance * 10) / 10));
}

/**
 * Calculates responsive typographic scale in rem and px to ensure legibility
 * from the lifter's estimated distance.
 */
export function calculateGlanceScale(distanceMeters: number): { fontScaleRem: number; fontScalePx: number } {
  const d = Math.max(1.0, Math.min(4.5, distanceMeters));

  // Linear scaling from 4.5 rem (72px) at 1 meter up to 10.5 rem (168px) at 3.5+ meters
  const rem = 4.5 + (d - 1.0) * 2.4;
  const fontScaleRem = Math.round(rem * 10) / 10;
  const fontScalePx = Math.round(fontScaleRem * 16);

  return { fontScaleRem, fontScalePx };
}

/**
 * Generates the High-Glance HUD state from live rep telemetry.
 * All color indicators map directly to CSS design tokens (never raw hex/rgba literals).
 */
export function generateHighGlanceHUD(input: HighGlanceInput): HighGlanceState {
  const distance = input.estimatedDistanceMeters ?? 2.5;
  const { fontScaleRem, fontScalePx } = calculateGlanceScale(distance);

  const reps = Math.max(0, input.repsCount || 0);
  const numeralText = String(reps);

  let perimeterToken = 'var(--c-rule)';
  let pulseIntensity = 0.2;
  let cueText = 'PRÊT';

  switch (input.phase) {
    case 'concentric':
      // Active drive / propulsion phase: high-luminance accent pulse
      perimeterToken = 'var(--lamp-hi)';
      pulseIntensity = 0.95;
      cueText = 'POUSSER';
      break;

    case 'eccentric':
      // Controlled lowering phase: steady warning/control cadence
      perimeterToken = 'var(--c-fg)';
      pulseIntensity = 0.6;
      cueText = 'CONTRÔLE';
      break;

    case 'inflection':
      // Turnaround point / crux of movement: sharp flash
      perimeterToken = 'var(--lamp-hi)';
      pulseIntensity = 1.0;
      cueText = 'TRANSITION';
      break;

    case 'lockout':
      // Completed rep lockout: steady confirmation
      perimeterToken = 'var(--lamp-line)';
      pulseIntensity = 0.75;
      cueText = 'VERROUILLÉ';
      break;

    case 'hold':
      perimeterToken = 'var(--c-fg-muted)';
      pulseIntensity = 0.4;
      cueText = 'MAINTENIR';
      break;

    case 'idle':
    default:
      perimeterToken = 'var(--c-rule)';
      pulseIntensity = 0.15;
      cueText = reps > 0 ? 'EN PAUSE' : 'PRÊT';
      break;
  }

  let velocityDisplay: string | null = null;
  if (typeof input.velocityMps === 'number' && input.velocityMps > 0) {
    velocityDisplay = `${(Math.round(input.velocityMps * 100) / 100).toFixed(2)} m/s`;
  }

  return {
    numeralText,
    fontScaleRem,
    fontScalePx,
    perimeterToken,
    pulseIntensity,
    cueText,
    velocityDisplay,
    isGlanceActive: input.phase !== 'idle',
  };
}
