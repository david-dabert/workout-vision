/**
 * Telemetry loader for the interactive Olympic / Bodyweight Squat biomechanics demo.
 * Fetches pre-computed MediaPipe skeleton landmarks and kinematics on-demand.
 */

export const FALLBACK_DEMO_TELEMETRY = {
  lift: 'squat',
  count: 7,
  reps: [
    { index: 0, startTime: 0.60, endTime: 3.20, concentricSec: 1.2, eccentricSec: 1.4, romDegrees: 92 },
    { index: 1, startTime: 4.27, endTime: 6.67, concentricSec: 1.1, eccentricSec: 1.3, romDegrees: 95 },
    { index: 2, startTime: 8.14, endTime: 10.21, concentricSec: 1.0, eccentricSec: 1.1, romDegrees: 91 },
    { index: 3, startTime: 11.27, endTime: 13.74, concentricSec: 1.2, eccentricSec: 1.3, romDegrees: 89 },
    { index: 4, startTime: 14.81, endTime: 17.21, concentricSec: 1.1, eccentricSec: 1.3, romDegrees: 88 },
    { index: 5, startTime: 18.68, endTime: 21.08, concentricSec: 1.2, eccentricSec: 1.2, romDegrees: 93 },
    { index: 6, startTime: 22.61, endTime: 25.15, concentricSec: 1.3, eccentricSec: 1.2, romDegrees: 90 },
  ],
  angles: [90, 85, 75, 70, 75, 90, 110, 140, 170],
  smoothedAngles: [90, 85, 75, 70, 75, 90, 110, 140, 170],
  timestamps: [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
  imageLandmarks: [],
  metadata: {
    width: 360,
    height: 640,
    duration: 26.92,
  },
  saved: 7,
  biomechanicsFr: {
    romScore: 94,
    averageRomDeg: 91,
    controlIndex: 88,
    averageEccentricSec: 1.3,
    velocityLossPercent: 12,
    fatigueTier: 'optimal_hypertrophy',
    mechanicalWorkKj: 14.2,
    caloriesKcal: 38,
    averagePowerWatts: 586,
    peakPowerWatts: 1339,
    powerLossPercent: 14,
    timeUnderTensionSec: 18.5,
    tempoCadence: '2-0-1-0',
    pathEfficiencyPercent: 96,
    formDistortionScore: 0.08,
    formBadge: { label: 'Solid Control', labelFr: 'Contrôle Solide', severity: 'good' },
    stickingPoints: [
      { repIndex: 1, timestamp: 1.54, angleDeg: 76, velocityDropPercent: 52, severity: 'moderate' },
      { repIndex: 2, timestamp: 5.40, angleDeg: 91, velocityDropPercent: 56, severity: 'moderate' },
      { repIndex: 3, timestamp: 8.87, angleDeg: 87, velocityDropPercent: 60, severity: 'moderate' },
      { repIndex: 4, timestamp: 12.34, angleDeg: 80, velocityDropPercent: 77, severity: 'severe' },
      { repIndex: 5, timestamp: 15.81, angleDeg: 75, velocityDropPercent: 76, severity: 'severe' },
      { repIndex: 6, timestamp: 20.01, angleDeg: 91, velocityDropPercent: 71, severity: 'severe' },
    ],
    repVelocityProfiles: [
      { repIndex: 1, velocityLossPercent: 0, tier: 'good' },
      { repIndex: 2, velocityLossPercent: 4, tier: 'good' },
      { repIndex: 3, velocityLossPercent: 8, tier: 'good' },
      { repIndex: 4, velocityLossPercent: 11, tier: 'good' },
      { repIndex: 5, velocityLossPercent: 14, tier: 'mid' },
      { repIndex: 6, velocityLossPercent: 18, tier: 'mid' },
      { repIndex: 7, velocityLossPercent: 22, tier: 'warn' },
    ],
  },
  biomechanicsEn: {
    romScore: 94,
    averageRomDeg: 91,
    controlIndex: 88,
    averageEccentricSec: 1.3,
    velocityLossPercent: 12,
    fatigueTier: 'optimal_hypertrophy',
    mechanicalWorkKj: 14.2,
    caloriesKcal: 38,
    averagePowerWatts: 586,
    peakPowerWatts: 1339,
    powerLossPercent: 14,
    timeUnderTensionSec: 18.5,
    tempoCadence: '2-0-1-0',
    pathEfficiencyPercent: 96,
    formDistortionScore: 0.08,
    formBadge: { label: 'Solid Control', labelFr: 'Contrôle Solide', severity: 'good' },
    stickingPoints: [
      { repIndex: 1, timestamp: 1.54, angleDeg: 76, velocityDropPercent: 52, severity: 'moderate' },
      { repIndex: 2, timestamp: 5.40, angleDeg: 91, velocityDropPercent: 56, severity: 'moderate' },
      { repIndex: 3, timestamp: 8.87, angleDeg: 87, velocityDropPercent: 60, severity: 'moderate' },
      { repIndex: 4, timestamp: 12.34, angleDeg: 80, velocityDropPercent: 77, severity: 'severe' },
      { repIndex: 5, timestamp: 15.81, angleDeg: 75, velocityDropPercent: 76, severity: 'severe' },
      { repIndex: 6, timestamp: 20.01, angleDeg: 91, velocityDropPercent: 71, severity: 'severe' },
    ],
    repVelocityProfiles: [
      { repIndex: 1, velocityLossPercent: 0, tier: 'good' },
      { repIndex: 2, velocityLossPercent: 4, tier: 'good' },
      { repIndex: 3, velocityLossPercent: 8, tier: 'good' },
      { repIndex: 4, velocityLossPercent: 11, tier: 'good' },
      { repIndex: 5, velocityLossPercent: 14, tier: 'mid' },
      { repIndex: 6, velocityLossPercent: 18, tier: 'mid' },
      { repIndex: 7, velocityLossPercent: 22, tier: 'warn' },
    ],
  },
};

let cached = null;

export async function loadDemoTelemetry() {
  if (cached) return cached;
  try {
    const base = import.meta.env?.BASE_URL || '/';
    const res = await fetch(`${base}demo/bodyweight-squat-9-telemetry.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cached = await res.json();
    return cached;
  } catch {
    return FALLBACK_DEMO_TELEMETRY;
  }
}
