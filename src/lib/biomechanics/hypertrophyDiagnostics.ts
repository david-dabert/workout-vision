/**
 * Hypertrophy & Momentum Diagnostics Engine
 * 
 * Provides lifters and coaches with actionable biomechanical telemetry:
 * 1. Stretch-Mediated Hypertrophy Depth Score (0-100%): Measures tension in the lengthened position.
 * 2. Ballistic Momentum / Turnaround Bounce Detection: Identifies elastic rebounds vs controlled muscular reversal.
 * 3. Continuous Tension vs Lockout Resting: Detects bone-stack resting at lockout.
 * 4. Tempo & Cadence Analysis: Quantifies eccentric control (recommended 2-4s) vs concentric drive.
 */

import { KinematicMachineProfile } from './kinematicAliasing';

export interface TrajectorySample {
  timestampMs: number;
  jointAngle: number; // In degrees
  angularVelocity?: number; // deg/s
}

export interface RepHypertrophyDiagnostics {
  repNumber: number;
  minAngle: number;
  maxAngle: number;
  rom: number;
  stretchDepthScore: number; // 0 to 100%
  inStretchZone: boolean;
  turnaroundJerk: number; // Angular acceleration/jerk indicator at bottom turnaround
  isMomentumBounce: boolean;
  eccentricDurationMs: number;
  concentricDurationMs: number;
  pauseDurationMs: number;
  lockoutDurationMs: number;
  continuousTension: boolean;
  tempoRatio: number; // eccentric / concentric ratio (optimal >= 1.5)
  feedback: {
    score: number; // 0 to 100 overall rep execution quality
    level: 'optimal' | 'warning' | 'needs_improvement';
    cueFr: string;
    cueEn: string;
    subCueFr?: string;
    subCueEn?: string;
  };
}

export interface SetHypertrophyReport {
  totalReps: number;
  avgStretchScore: number;
  bounceCount: number;
  continuousTensionPercentage: number;
  avgEccentricDurationMs: number;
  avgConcentricDurationMs: number;
  overallHypertrophyScore: number; // 0-100
  reps: RepHypertrophyDiagnostics[];
  primaryCoachingTakeawayFr: string;
  primaryCoachingTakeawayEn: string;
}

/**
 * Computes hypertrophy diagnostics for a single completed rep trajectory.
 */
export function calculateRepHypertrophyDiagnostics(
  samples: TrajectorySample[],
  repNumber: number,
  profile: KinematicMachineProfile
): RepHypertrophyDiagnostics {
  if (!samples || samples.length < 5) {
    return createDefaultRepDiagnostics(repNumber);
  }

  // Raw extrema capture the lifter's true physical depth
  const rawAngles = samples.map(s => s.jointAngle);
  const minAngle = Math.min(...rawAngles);
  const maxAngle = Math.max(...rawAngles);
  const rom = maxAngle - minAngle;

  // Smoothed samples for derivative and velocity estimation
  const smoothed = smoothAngles(samples);

  // Identify inflection points
  const isHighRest = profile.restPosition === 'high'; // e.g. squat, leg press start high
  const turnaroundIdx = findTurnaroundIndex(smoothed, isHighRest);
  const turnaroundSample = smoothed[turnaroundIdx] || smoothed[Math.floor(smoothed.length / 2)];

  // 1. Stretch-Mediated Hypertrophy Depth Score
  // For squat/hack squat/leg press: deeper is lower angle (e.g. < 80° knee).
  // For bicep curl/preacher curl: deeper is higher angle (full extension > 150° elbow).
  let stretchDepthScore = 0;
  let inStretchZone = false;

  if (isHighRest) {
    // Bottom of the movement is minimum angle
    const targetStretch = profile.optimalStretchAngle; // e.g. 80°
    if (minAngle <= targetStretch) {
      stretchDepthScore = 100;
      inStretchZone = true;
    } else {
      // Partial depth scaling: full mark at target, 0 mark if ROM cut by 30°
      const shortfall = minAngle - targetStretch;
      stretchDepthScore = Math.max(0, Math.min(100, Math.round(100 - (shortfall / 30) * 100)));
      inStretchZone = shortfall <= 5;
    }
  } else {
    // Bottom of the movement is maximum angle (e.g. curls at extension)
    const targetStretch = profile.optimalStretchAngle; // e.g. 160°
    if (maxAngle >= targetStretch) {
      stretchDepthScore = 100;
      inStretchZone = true;
    } else {
      const shortfall = targetStretch - maxAngle;
      stretchDepthScore = Math.max(0, Math.min(100, Math.round(100 - (shortfall / 30) * 100)));
      inStretchZone = shortfall <= 5;
    }
  }

  // 2. Turnaround Bounce & Jerk Detection
  // Check the rate of velocity reversal within a localized window around turnaround
  const windowRadius = Math.max(1, Math.min(3, Math.floor(smoothed.length / 5)));
  const startW = Math.max(0, turnaroundIdx - windowRadius);
  const endW = Math.min(smoothed.length - 1, turnaroundIdx + windowRadius);

  const tStart = smoothed[startW].timestampMs;
  const tEnd = smoothed[endW].timestampMs;
  const dt = Math.max(0.04, (tEnd - tStart) / 1000); // seconds

  const dtIn = Math.max(0.02, (smoothed[turnaroundIdx].timestampMs - tStart) / 1000);
  const dtOut = Math.max(0.02, (tEnd - smoothed[turnaroundIdx].timestampMs) / 1000);

  const vIn = (smoothed[turnaroundIdx].jointAngle - smoothed[startW].jointAngle) / dtIn;
  const vOut = (smoothed[endW].jointAngle - smoothed[turnaroundIdx].jointAngle) / dtOut;

  // Turnaround acceleration (deg/s^2)
  const turnaroundAcceleration = Math.abs((vOut - vIn) / dt);
  const isMomentumBounce = turnaroundAcceleration > profile.momentumJerkTolerance;

  // 3. Temporal Phase Durations
  const startTime = smoothed[0].timestampMs;
  const turnaroundTime = turnaroundSample.timestampMs;
  const endTime = smoothed[smoothed.length - 1].timestampMs;

  const eccentricDurationMs = Math.max(100, turnaroundTime - startTime);
  const concentricDurationMs = Math.max(100, endTime - turnaroundTime);
  const tempoRatio = Math.round((eccentricDurationMs / concentricDurationMs) * 10) / 10;

  // Pause duration at bottom (window where angle stays within 4° of turning point)
  const turningAngle = turnaroundSample.jointAngle;
  let pauseCount = 0;
  for (let i = startW; i <= endW; i++) {
    if (Math.abs(smoothed[i].jointAngle - turningAngle) <= 4) {
      pauseCount++;
    }
  }
  const pauseDurationMs = Math.round((pauseCount / (endW - startW + 1)) * (dt * 1000));

  // Lockout duration: check end of rep dwell time
  const lockoutAngle = isHighRest ? maxAngle : minAngle;
  let lockoutCount = 0;
  for (let i = smoothed.length - 1; i >= Math.max(0, smoothed.length - 5); i--) {
    if (Math.abs(smoothed[i].jointAngle - lockoutAngle) <= 5) {
      lockoutCount++;
    }
  }
  const lockoutDurationMs = Math.round((lockoutCount / 5) * 500);
  const continuousTension = lockoutDurationMs < 800; // Resting > 800ms at top drops muscle tension

  // 4. Feedback & Quality Scoring
  let score = 100;
  if (!inStretchZone) score -= (100 - stretchDepthScore) * 0.4;
  if (isMomentumBounce) score -= 25;
  if (eccentricDurationMs < 1200) score -= 15; // Rushed descent
  if (!continuousTension) score -= 10;
  score = Math.max(10, Math.min(100, Math.round(score)));

  let level: 'optimal' | 'warning' | 'needs_improvement' = 'optimal';
  if (score < 65) level = 'needs_improvement';
  else if (score < 85) level = 'warning';

  const feedback = generateCoachingCues(
    level,
    inStretchZone,
    isMomentumBounce,
    eccentricDurationMs,
    continuousTension,
    stretchDepthScore,
    score
  );

  return {
    repNumber,
    minAngle: Math.round(minAngle),
    maxAngle: Math.round(maxAngle),
    rom: Math.round(rom),
    stretchDepthScore,
    inStretchZone,
    turnaroundJerk: Math.round(turnaroundAcceleration),
    isMomentumBounce,
    eccentricDurationMs,
    concentricDurationMs,
    pauseDurationMs,
    lockoutDurationMs,
    continuousTension,
    tempoRatio,
    feedback,
  };
}

/**
 * Aggregates set-wide metrics and produces a comprehensive coaching summary.
 */
export function analyzeSetHypertrophy(
  reps: { samples: TrajectorySample[] }[],
  profile: KinematicMachineProfile
): SetHypertrophyReport {
  if (!reps || reps.length === 0) {
    return {
      totalReps: 0,
      avgStretchScore: 0,
      bounceCount: 0,
      continuousTensionPercentage: 0,
      avgEccentricDurationMs: 0,
      avgConcentricDurationMs: 0,
      overallHypertrophyScore: 0,
      reps: [],
      primaryCoachingTakeawayFr: 'Aucune répétition enregistrée pour analyser la tension musculaire.',
      primaryCoachingTakeawayEn: 'No repetitions recorded to analyze muscle tension.',
    };
  }

  const diagnostics: RepHypertrophyDiagnostics[] = reps.map((rep, idx) =>
    calculateRepHypertrophyDiagnostics(rep.samples, idx + 1, profile)
  );

  const totalReps = diagnostics.length;
  const avgStretchScore = Math.round(
    diagnostics.reduce((acc, r) => acc + r.stretchDepthScore, 0) / totalReps
  );
  const bounceCount = diagnostics.filter(r => r.isMomentumBounce).length;
  const continuousTensionCount = diagnostics.filter(r => r.continuousTension).length;
  const continuousTensionPercentage = Math.round((continuousTensionCount / totalReps) * 100);
  const avgEccentricDurationMs = Math.round(
    diagnostics.reduce((acc, r) => acc + r.eccentricDurationMs, 0) / totalReps
  );
  const avgConcentricDurationMs = Math.round(
    diagnostics.reduce((acc, r) => acc + r.concentricDurationMs, 0) / totalReps
  );

  const overallHypertrophyScore = Math.round(
    diagnostics.reduce((acc, r) => acc + r.feedback.score, 0) / totalReps
  );

  // Derive top coaching takeaway
  let takeawayFr = 'Excellente exécution\u00A0: contrôle excentrique exemplaire et tension maximale dans la zone d’étirement.';
  let takeawayEn = 'Exceptional execution: controlled eccentrics and sustained tension in the deep stretch zone.';

  if (bounceCount >= totalReps / 2) {
    takeawayFr = 'Attention au rebond en bas\u00A0: contrôlez l’inversion de phase pour recruter les fibres musculaires plutôt que les tendons.';
    takeawayEn = 'Watch the bounce at the bottom: decelerate into the turnaround to recruit muscle fibers over elastic tendon recoil.';
  } else if (avgStretchScore < 75) {
    takeawayFr = 'Amplitude incomplète\u00A0: recherchez 5 à 10° supplémentaires en fin de descente pour exploiter l’hypertrophie médiée par l’étirement.';
    takeawayEn = 'Incomplete range: seek an extra 5-10° of depth to engage the stretch-mediated hypertrophy response.';
  } else if (avgEccentricDurationMs < 1400) {
    takeawayFr = 'Descente trop rapide\u00A0: ralentissez la phase négative (2 à 3 secondes) pour maximiser les micro-lésions hypertrophiques.';
    takeawayEn = 'Rushed descent: slow the negative phase to 2-3 seconds to maximize mechanical tension.';
  }

  return {
    totalReps,
    avgStretchScore,
    bounceCount,
    continuousTensionPercentage,
    avgEccentricDurationMs,
    avgConcentricDurationMs,
    overallHypertrophyScore,
    reps: diagnostics,
    primaryCoachingTakeawayFr: takeawayFr,
    primaryCoachingTakeawayEn: takeawayEn,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function smoothAngles(samples: TrajectorySample[]): TrajectorySample[] {
  if (samples.length < 12) return samples;
  return samples.map((s, i) => {
    if (i === 0 || i === samples.length - 1) return s;
    const avgAngle = (samples[i - 1].jointAngle + s.jointAngle + samples[i + 1].jointAngle) / 3;
    return { ...s, jointAngle: avgAngle };
  });
}

function findTurnaroundIndex(samples: TrajectorySample[], isHighRest: boolean): number {
  let targetIdx = 0;
  let extremum = isHighRest ? Infinity : -Infinity;

  for (let i = 0; i < samples.length; i++) {
    const angle = samples[i].jointAngle;
    if (isHighRest && angle < extremum) {
      extremum = angle;
      targetIdx = i;
    } else if (!isHighRest && angle > extremum) {
      extremum = angle;
      targetIdx = i;
    }
  }
  return targetIdx;
}

function generateCoachingCues(
  level: 'optimal' | 'warning' | 'needs_improvement',
  inStretch: boolean,
  isBounce: boolean,
  eccDuration: number,
  continuousTension: boolean,
  stretchScore: number,
  score: number
) {
  if (isBounce) {
    return {
      score,
      level,
      cueFr: 'Rebond détecté à l’inversion',
      cueEn: 'Momentum bounce detected at bottom',
      subCueFr: 'Ralentissez l’entrée dans le trou, inversez avec les muscles.',
      subCueEn: 'Decelerate into the hole, reverse with muscular control.',
    };
  }

  if (!inStretch) {
    return {
      score,
      level,
      cueFr: `Zone d’étirement incomplète (${stretchScore}%)`,
      cueEn: `Incomplete stretch zone (${stretchScore}%)`,
      subCueFr: 'Descendez plus bas pour chercher l’étirement maximal sous charge.',
      subCueEn: 'Increase depth to maximize loaded muscle elongation.',
    };
  }

  if (eccDuration < 1200) {
    return {
      score,
      level,
      cueFr: 'Phase excentrique trop vive',
      cueEn: 'Eccentric phase too fast',
      subCueFr: 'Freinez la descente (2 à 3 secondes) pour créer plus de tension.',
      subCueEn: 'Slow the descent (2 to 3 seconds) to accumulate mechanical tension.',
    };
  }

  if (!continuousTension) {
    return {
      score,
      level,
      cueFr: 'Verrouillage prolongé en haut',
      cueEn: 'Prolonged lockout resting',
      subCueFr: 'Enchaînez sans décharger les articulations pour maintenir la tension.',
      subCueEn: 'Reverse smoothly without resting on stacked joints.',
    };
  }

  return {
    score,
    level,
    cueFr: 'Exécution optimale',
    cueEn: 'Optimal mechanical tension',
    subCueFr: 'Contrôle parfait de la descente et étirement complet validé.',
    subCueEn: 'Flawless eccentric tempo and deep stretch-mediated excursion.',
  };
}

function createDefaultRepDiagnostics(repNumber: number): RepHypertrophyDiagnostics {
  return {
    repNumber,
    minAngle: 90,
    maxAngle: 90,
    rom: 0,
    stretchDepthScore: 50,
    inStretchZone: false,
    turnaroundJerk: 0,
    isMomentumBounce: false,
    eccentricDurationMs: 1500,
    concentricDurationMs: 1000,
    pauseDurationMs: 200,
    lockoutDurationMs: 200,
    continuousTension: true,
    tempoRatio: 1.5,
    feedback: {
      score: 75,
      level: 'optimal',
      cueFr: 'Données insuffisantes pour le calcul précis',
      cueEn: 'Insufficient trajectory samples for precision telemetry',
    },
  };
}
