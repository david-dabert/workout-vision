/**
 * symmetry.js — Bilateral symmetry and musculoskeletal balance analysis.
 *
 * Measures Left vs Right Range of Motion (ROM) and phase synchronization
 * from 3D world landmarks for injury prevention, post-rehab monitoring,
 * and physiotherapy assessment.
 *
 * Literature:
 *   - Kiesel K et al., 2007, N Am J Sports Phys Ther (Asymmetry >15% increases musculoskeletal injury risk)
 *   - Bishop C et al., 2018, Sports Med (Standardizing asymmetry index calculations)
 */

import { liftDefinition } from './counting/core';

const JOINT_POINTS = {
  elbow: {
    left: [11, 13, 15],
    right: [12, 14, 16],
  },
  shoulder: {
    left: [23, 11, 13],
    right: [24, 12, 14],
  },
  knee: {
    left: [23, 25, 27],
    right: [24, 26, 28],
  },
  hip: {
    left: [11, 23, 25],
    right: [12, 24, 26],
  },
};

function computeAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = (a.z ?? 0) - (b.z ?? 0);
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z ?? 0) - (b.z ?? 0);
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (m1 === 0 || m2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function getVis(pt) {
  return pt?.visibility ?? 0;
}

/**
 * Analyzes bilateral symmetry for a completed set.
 *
 * @param {Array} worldLandmarks 3D world landmarks array per frame
 * @param {Array} timestamps Timestamp array in seconds
 * @param {string} lift The lift key
 * @param {Array} reps The rep details array
 * @returns {object|null} Symmetry metrics or null if video does not support bilateral comparison (e.g. side-view occlusion)
 */
export function analyzeBilateralSymmetry(worldLandmarks, timestamps, lift, reps) {
  if (!worldLandmarks?.length || !timestamps?.length || !reps?.length) return null;

  const def = liftDefinition(lift);
  const joint = def?.joint || 'elbow';
  const jointPts = JOINT_POINTS[joint];
  if (!jointPts) return null;

  const [la, lb, lc] = jointPts.left;
  const [ra, rb, rc] = jointPts.right;

  // Check visibility of both sides across the set
  let lVisSum = 0, rVisSum = 0, validCount = 0;
  for (const frame of worldLandmarks) {
    if (!frame) continue;
    validCount++;
    lVisSum += (getVis(frame[la]) + getVis(frame[lb]) + getVis(frame[lc])) / 3;
    rVisSum += (getVis(frame[ra]) + getVis(frame[rb]) + getVis(frame[rc])) / 3;
  }

  if (validCount === 0) return null;
  const lVisAvg = lVisSum / validCount;
  const rVisAvg = rVisSum / validCount;

  // If one side has poor visibility (< 0.45), the athlete was likely filmed in profile/side view.
  if (lVisAvg < 0.45 || rVisAvg < 0.45) return null;

  // Extract angles for both sides across all frames
  const leftAngles = [];
  const rightAngles = [];
  for (const frame of worldLandmarks) {
    if (!frame) {
      leftAngles.push(null);
      rightAngles.push(null);
      continue;
    }
    leftAngles.push(computeAngle(frame[la], frame[lb], frame[lc]));
    rightAngles.push(computeAngle(frame[ra], frame[rb], frame[rc]));
  }

  // Calculate per-rep Left vs Right ROM
  const repAsymmetries = [];
  const repRomsL = [];
  const repRomsR = [];

  for (const rep of reps) {
    const fromIdx = timestamps.findIndex(t => t >= rep.startTime);
    const toIdx = timestamps.findIndex(t => t >= rep.endTime);
    if (fromIdx < 0) continue;
    const end = toIdx < 0 ? timestamps.length : toIdx + 1;

    let minL = Infinity, maxL = -Infinity;
    let minR = Infinity, maxR = -Infinity;

    for (let i = fromIdx; i < end; i++) {
      const aL = leftAngles[i];
      const aR = rightAngles[i];
      if (aL !== null) {
        minL = Math.min(minL, aL);
        maxL = Math.max(maxL, aL);
      }
      if (aR !== null) {
        minR = Math.min(minR, aR);
        maxR = Math.max(maxR, aR);
      }
    }

    if (minL < maxL && minR < maxR) {
      const romL = maxL - minL;
      const romR = maxR - minR;
      repRomsL.push(romL);
      repRomsR.push(romR);

      const base = Math.max(romL, romR);
      const asym = base > 5 ? (Math.abs(romL - romR) / base) * 100 : 0;
      repAsymmetries.push(asym);
    }
  }

  if (!repAsymmetries.length) return null;

  const meanAsym = repAsymmetries.reduce((a, b) => a + b, 0) / repAsymmetries.length;
  const asymmetryPct = Math.round(meanAsym);
  const symmetryScore = Math.max(0, Math.min(100, 100 - asymmetryPct));

  const meanRomL = repRomsL.reduce((a, b) => a + b, 0) / repRomsL.length;
  const meanRomR = repRomsR.reduce((a, b) => a + b, 0) / repRomsR.length;
  const dominantSide = Math.abs(meanRomL - meanRomR) >= 2 ? (meanRomL > meanRomR ? 'left' : 'right') : 'none';
  const romDiffDeg = Math.round(Math.abs(meanRomL - meanRomR));

  const status = symmetryScore >= 90 ? 'balanced' : symmetryScore >= 80 ? 'mild_asymmetry' : 'notable_asymmetry';

  return {
    symmetryScore,
    asymmetryPct,
    dominantSide,
    romDiffDeg,
    meanRomL: Math.round(meanRomL),
    meanRomR: Math.round(meanRomR),
    status,
    repAsymmetries,
  };
}
