/**
 * stickingPoint.ts: Concentric Sticking-Point Detection & Intra-Set Velocity Loss Telemetry.
 *
 * Literature:
 * - González-Badillo JJ, Yáñez-García JM, Mora-Custodio R, Rodríguez-Rosell D.
 *   "Velocity Loss as a Variable for Monitoring Resistance Exercise".
 *   Int J Sports Physiol Perform. 2017;12(4):547-553.
 * - Kompf J, Arandjelović O.
 *   "Understanding and Overcoming the Sticking Point in Resistance Exercise".
 *   Sports Med. 2016;46(6):751-762.
 * - Sánchez-Medina L, González-Badillo JJ.
 *   "Velocity loss as an indicator of neuromuscular fatigue during resistance training".
 *   Med Sci Sports Exerc. 2011;43(9):1725-1734.
 */

import { RepDetail, liftDefinition } from '../counting/core';

export interface StickingPointInflection {
  repIndex: number;
  timestamp: number;
  angleDeg: number;
  velocityDegPerSec: number;
  peakConcentricVelocity: number;
  velocityDropPercent: number;
  severity: 'mild' | 'moderate' | 'severe';
}

export type StickingRepInput = {
  index?: number;
  startTime?: number;
  endTime?: number;
  concentricSec?: number;
  eccentricSec?: number;
  romDegrees?: number;
  peakSpeed?: number;
  meanSpeed?: number;
  clipped?: boolean;
};

export interface VelocityLossTelemetry {
  lossPercent: number;
  fastestRepIndex: number;
  fastestVelocity: number;
  lastRepIndex: number;
  lastVelocity: number;
  fatigueZone: 'power' | 'hypertrophy' | 'excessive';
  cueFr: string;
  cueEn: string;
}

/**
 * Detects the concentric sticking point inflection (local velocity minimum during ascent)
 * for a single repetition from continuous angles and timestamps.
 */
export function detectConcentricStickingPoint(
  rep: StickingRepInput,
  angles: (number | null)[],
  timestamps: number[],
  lift = 'squat'
): StickingPointInflection | null {
  if (!rep || !Array.isArray(angles) || angles.length < 4) {
    return null;
  }

  const times = Array.isArray(timestamps) && timestamps.length === angles.length
    ? timestamps
    : angles.map((_, i) => i / 30);

  const tStart = rep.startTime ?? 0;
  const tEnd = rep.endTime ?? (times[times.length - 1] || 1);

  if (tEnd <= tStart) {
    return null;
  }

  const def = liftDefinition(lift);
  const isConcentricFirst = def?.first === 'concentric';

  let concStart: number;
  let concEnd: number;

  if (rep.concentricSec && rep.concentricSec > 0) {
    if (isConcentricFirst) {
      concStart = tStart;
      concEnd = Math.min(tEnd, tStart + rep.concentricSec);
    } else {
      concStart = Math.max(tStart, tEnd - rep.concentricSec);
      concEnd = tEnd;
    }
  } else {
    // Determine turnaround inflection from the angle extrema
    let turnTime = (tStart + tEnd) / 2;
    let minAngle = Infinity;
    let maxAngle = -Infinity;
    let minTime = turnTime;
    let maxTime = turnTime;

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (t >= tStart && t <= tEnd) {
        const a = angles[i];
        if (a !== null && !isNaN(a)) {
          if (a < minAngle) {
            minAngle = a;
            minTime = t;
          }
          if (a > maxAngle) {
            maxAngle = a;
            maxTime = t;
          }
        }
      }
    }

    const restHigh = def?.rest === 'high' || lift === 'squat' || lift === 'bench_press';
    turnTime = restHigh ? minTime : maxTime;

    if (isConcentricFirst) {
      concStart = tStart;
      concEnd = turnTime;
    } else {
      concStart = turnTime;
      concEnd = tEnd;
    }
  }

  const concDuration = concEnd - concStart;
  if (concDuration <= 0.05) {
    return null;
  }

  // Extract samples in the concentric window
  const samples: { t: number; a: number; idx: number }[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (t >= concStart && t <= concEnd) {
      const a = angles[i];
      if (a !== null && !isNaN(a)) {
        samples.push({ t, a, idx: i });
      }
    }
  }

  if (samples.length < 4) {
    return null;
  }

  // Exclude initial 12% and final 12% to avoid turnaround boundary and lockout
  const startIdx = Math.max(1, Math.floor(samples.length * 0.12));
  const endIdx = Math.min(samples.length - 2, Math.floor(samples.length * 0.88));

  if (startIdx >= endIdx) {
    return null;
  }

  let peakVelocity = 0;
  const velocities: { sampleIdx: number; vel: number }[] = [];

  for (let i = startIdx; i <= endIdx; i++) {
    const dt = samples[i + 1].t - samples[i - 1].t;
    if (dt > 0.005) {
      const dAngle = Math.abs(samples[i + 1].a - samples[i - 1].a);
      const vel = dAngle / dt;
      velocities.push({ sampleIdx: i, vel });
      if (vel > peakVelocity) {
        peakVelocity = vel;
      }
    }
  }

  if (velocities.length === 0 || peakVelocity < 5) {
    return null;
  }

  // Find local minimum velocity in the middle ascent
  let minVelocity = Infinity;
  let minSampleIdx = -1;

  for (const v of velocities) {
    if (v.vel < minVelocity) {
      minVelocity = v.vel;
      minSampleIdx = v.sampleIdx;
    }
  }

  if (minSampleIdx < 0) {
    return null;
  }

  const dropRatio = (peakVelocity - minVelocity) / peakVelocity;
  if (dropRatio < 0.20) {
    // Less than 20% drop: smooth continuous drive with no distinct stall
    return null;
  }

  const targetSample = samples[minSampleIdx];
  const dropPercent = Math.round(dropRatio * 100);
  const severity: 'mild' | 'moderate' | 'severe' =
    dropPercent >= 60 ? 'severe' : dropPercent >= 35 ? 'moderate' : 'mild';

  return {
    repIndex: rep.index ?? 1,
    timestamp: Math.round(targetSample.t * 100) / 100,
    angleDeg: Math.round(targetSample.a),
    velocityDegPerSec: Math.round(minVelocity * 10) / 10,
    peakConcentricVelocity: Math.round(peakVelocity * 10) / 10,
    velocityDropPercent: dropPercent,
    severity,
  };
}

/**
 * Detects sticking points across all repetitions in a set.
 */
export function detectSetStickingPoints(
  reps: StickingRepInput[],
  angles: (number | null)[],
  timestamps: number[],
  lift = 'squat'
): StickingPointInflection[] {
  if (!Array.isArray(reps) || reps.length === 0 || !Array.isArray(angles) || angles.length === 0) {
    return [];
  }

  const results: StickingPointInflection[] = [];
  for (const rep of reps) {
    const sp = detectConcentricStickingPoint(rep, angles, timestamps, lift);
    if (sp) {
      results.push(sp);
    }
  }

  return results;
}

/**
 * Computes intra-set velocity loss percentage and fatigue categorization
 * according to González-Badillo & Sánchez-Medina (2011, 2017).
 */
export function calculateIntraSetVelocityLoss(
  reps: StickingRepInput[]
): VelocityLossTelemetry | null {
  if (!Array.isArray(reps) || reps.length < 2) {
    return null;
  }

  const validReps = reps.filter(r => {
    const rom = r.romDegrees ?? 0;
    const conc = r.concentricSec ?? 0;
    const dur = (r.endTime ?? 0) - (r.startTime ?? 0);
    return rom > 0 && (conc > 0 || dur > 0);
  });

  if (validReps.length < 2) {
    return null;
  }

  const velocities = validReps.map((r, i) => {
    const rom = r.romDegrees ?? 0;
    const conc = r.concentricSec && r.concentricSec > 0 ? r.concentricSec : Math.max(0.2, ((r.endTime ?? 1) - (r.startTime ?? 0)) / 2);
    const vel = rom / conc;
    return {
      repIndex: r.index ?? (i + 1),
      velocity: vel,
    };
  });

  let fastest = velocities[0];
  for (const v of velocities) {
    if (v.velocity > fastest.velocity) {
      fastest = v;
    }
  }

  const last = velocities[velocities.length - 1];
  const rawLoss = ((fastest.velocity - last.velocity) / fastest.velocity) * 100;
  const lossPercent = Math.max(0, Math.round(rawLoss));

  let fatigueZone: 'power' | 'hypertrophy' | 'excessive';
  let cueFr: string;
  let cueEn: string;

  if (lossPercent < 20) {
    fatigueZone = 'power';
    cueFr = `Perte de vitesse modérée (${lossPercent}\u00A0%)\u00A0: vitesse et explosivité préservées.`;
    cueEn = `Low velocity decline (${lossPercent}%): speed and explosive reserve preserved.`;
  } else if (lossPercent <= 40) {
    fatigueZone = 'hypertrophy';
    cueFr = `Perte de vitesse optimale (${lossPercent}\u00A0%)\u00A0: zone idéale de stimulation musculaire.`;
    cueEn = `Optimal velocity decline (${lossPercent}%): ideal hypertrophic stimulus zone.`;
  } else {
    fatigueZone = 'excessive';
    cueFr = `Forte perte de vitesse (${lossPercent}\u00A0%)\u00A0: fatigue neuromusculaire élevée, fin de série recommandée.`;
    cueEn = `High velocity decline (${lossPercent}%): high neuromuscular fatigue, set completion recommended.`;
  }

  return {
    lossPercent,
    fastestRepIndex: fastest.repIndex,
    fastestVelocity: Math.round(fastest.velocity * 10) / 10,
    lastRepIndex: last.repIndex,
    lastVelocity: Math.round(last.velocity * 10) / 10,
    fatigueZone,
    cueFr,
    cueEn,
  };
}
