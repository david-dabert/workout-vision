/**
 * vbtEngine.js — On-Device Velocity-Based Training (VBT) & Sticking Point Localization.
 *
 * Literature:
 *   - González-Badillo JJ, Yáñez-García JM, Mora-Custodio R, Rodríguez-Rosell D.
 *     "Velocity Loss as a Variable for Monitoring Resistance Exercise".
 *     Int J Sports Physiol Perform. 2017;12(4):547-553.
 *   - Kompf J, Arandjelović O.
 *     "Understanding and Overcoming the Sticking Point in Resistance Exercise".
 *     Sports Med. 2017;47(1):135-140.
 *   - Sánchez-Medina L, González-Badillo JJ.
 *     "Velocity loss as an indicator of neuromuscular fatigue during resistance training".
 *     Med Sci Sports Exerc. 2011;43(9):1725-1734.
 */

import { liftDefinition } from './counting/core';

function round(v, d = 1) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

/**
 * Analyzes Velocity-Based Training metrics and localizes the concentric sticking point angle.
 *
 * @param {Array} reps - The set's detected rep objects with timing and ROM.
 * @param {Array<number>} timestamps - Sample timestamps in seconds.
 * @param {Array<number|null>} smoothedAngles - Joint angles per sample timestamp.
 * @param {string} lift - Exercise identifier.
 * @returns {object|null} VBT analysis object or null if insufficient reps.
 */
export function analyzeVbtAndStickingPoint(reps, timestamps, smoothedAngles, lift) {
  if (!Array.isArray(reps) || reps.length < 2) return null;

  const validReps = reps.filter(r => !r.clipped && r.concentricSec > 0 && r.romDegrees > 0);
  if (validReps.length < 2) return null;

  const def = liftDefinition(lift);
  const liftFirst = def?.first || 'concentric';

  // 1. Mean concentric angular velocities (deg/s) per rep
  const velocities = validReps.map(r => ({
    repIndex: r.index,
    velocity: r.romDegrees / r.concentricSec,
    concentricSec: r.concentricSec,
    romDegrees: r.romDegrees,
    startTime: r.startTime,
    endTime: r.endTime,
  }));

  const fastestRep = velocities.reduce((max, r) => (r.velocity > max.velocity ? r : max), velocities[0]);
  const slowestRep = velocities.reduce((min, r) => (r.velocity < min.velocity ? r : min), velocities[0]);
  const lastRep = velocities[velocities.length - 1];

  // Velocity loss (%) from fastest rep to final rep
  const rawLoss = ((fastestRep.velocity - lastRep.velocity) / fastestRep.velocity) * 100;
  const velocityLossPercent = Math.max(0, Math.round(rawLoss));

  // Fatigue classification based on González-Badillo 2017
  let fatigueZone = 'optimal';
  if (velocityLossPercent < 10) fatigueZone = 'low';
  else if (velocityLossPercent > 20) fatigueZone = 'high';

  // 2. Sticking point angle localization on the hardest/slowest repetition
  let stickingAngleDeg = null;
  if (Array.isArray(timestamps) && Array.isArray(smoothedAngles) && timestamps.length > 2) {
    const r = slowestRep;
    const concStart = liftFirst === 'concentric' ? r.startTime : r.startTime + (r.concentricSec > 0 ? (r.endTime - r.startTime - r.concentricSec) : 0);
    const concEnd = r.endTime;

    // Extract sample angles and calculate instantaneous velocity in the middle 80% of ascent
    const samples = [];
    for (let i = 0; i < timestamps.length; i++) {
      const t = timestamps[i];
      if (t >= concStart && t <= concEnd && smoothedAngles[i] !== null && smoothedAngles[i] !== undefined) {
        samples.push({ t, angle: smoothedAngles[i], index: i });
      }
    }

    if (samples.length >= 3) {
      // Exclude first 15% and last 15% of samples (turnaround and lockout)
      const startIdx = Math.max(1, Math.floor(samples.length * 0.15));
      const endIdx = Math.min(samples.length - 2, Math.floor(samples.length * 0.85));

      let minVelocity = Infinity;
      let minAngle = null;

      for (let i = startIdx; i <= endIdx; i++) {
        const dt = samples[i + 1].t - samples[i - 1].t;
        if (dt > 0.01) {
          const dAngle = Math.abs(samples[i + 1].angle - samples[i - 1].angle);
          const instSpeed = dAngle / dt;
          if (instSpeed < minVelocity) {
            minVelocity = instSpeed;
            minAngle = samples[i].angle;
          }
        }
      }

      if (minAngle !== null) {
        stickingAngleDeg = Math.round(minAngle);
      } else {
        const midIdx = Math.floor(samples.length / 2);
        stickingAngleDeg = Math.round(samples[midIdx].angle);
      }
    }
  }

  // 3. Estimated Reps In Reserve (RIR) from velocity decline
  const estimatedRir = velocityLossPercent < 8 ? '3+' : velocityLossPercent <= 18 ? '1-2' : '0-1';

  // 4. Bilingual plain-language coaching feedback
  let cueFr = '';
  let cueEn = '';

  if (fatigueZone === 'low') {
    cueFr = `Perte de vitesse modérée (${velocityLossPercent}\u00A0%). Réserve de vitesse et d’explosivité préservée.`;
    cueEn = `Low velocity loss (${velocityLossPercent}%). Speed and explosive reserve maintained.`;
  } else if (fatigueZone === 'optimal') {
    cueFr = `Perte de vitesse de ${velocityLossPercent}\u00A0%${stickingAngleDeg ? ` (ralentissement à ${stickingAngleDeg}°)` : ''}. Zone idéale de stimulation musculaire.`;
    cueEn = `Optimal velocity loss of ${velocityLossPercent}%${stickingAngleDeg ? ` (deceleration at ${stickingAngleDeg}°)` : ''}. Ideal stimulus zone.`;
  } else {
    cueFr = `Forte perte de vitesse (${velocityLossPercent}\u00A0%). Ralentissement marqué à ${stickingAngleDeg ?? 'mi-course'}° sur la rép ${slowestRep.repIndex}. Fin de série recommandée.`;
    cueEn = `High velocity loss (${velocityLossPercent}%). Pronounced sticking at ${stickingAngleDeg ?? 'mid-range'}° on rep ${slowestRep.repIndex}. Rest recommended.`;
  }

  return {
    velocityLossPercent,
    fatigueZone,
    stickingAngleDeg,
    slowestRepIndex: slowestRep.repIndex,
    fastestRepVelocity: round(fastestRep.velocity, 1),
    lastRepVelocity: round(lastRep.velocity, 1),
    estimatedRir,
    cueFr,
    cueEn,
  };
}
