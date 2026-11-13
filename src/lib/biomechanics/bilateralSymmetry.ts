/**
 * bilateralSymmetry.ts: Bilateral Kinematic Symmetry & Sticking-Point Asymmetrical Divergence Engine.
 *
 * Literature:
 * - Bishop C, Turner A, Read P.
 *   "Effects of inter-limb asymmetries on physical and sports performance: a systematic review".
 *   J Sports Sci. 2018;36(10):1135-1144.
 * - McGill SM, Chaimberg JD, Frost DM, Fenwick CM.
 *   "Evidence of a spine sparing workout: low back joint loads, muscle activation and lumbar motion".
 *   Med Sci Sports Exerc. 2009;41(1):73-82.
 * - Kiesel K, Plisky PJ, Voight ML.
 *   "Can Serious Injury in Professional Football be Predicted by a Preseason Athletic Movement Screen?".
 *   N Am J Sports Phys Ther. 2007;2(3):147-158.
 */

export interface BilateralJointDivergence {
  timestamp: number;
  leftAngleDeg: number;
  rightAngleDeg: number;
  divergenceDeg: number;
}

export interface BilateralSymmetryTelemetry {
  symmetryScore: number;
  meanDivergenceDeg: number;
  peakDivergenceDeg: number;
  peakDivergenceRepIndex: number;
  asymmetricStickingDivergence: boolean;
  tier: 'optimal' | 'moderate' | 'high_asymmetry';
  cueFr: string;
  cueEn: string;
}

export interface Landmark3DCoord {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

function calculateJointAngle3D(
  a: Landmark3DCoord,
  b: Landmark3DCoord,
  c: Landmark3DCoord
): number | null {
  if (
    !a || !b || !c ||
    (a.visibility ?? 1) < 0.35 ||
    (b.visibility ?? 1) < 0.35 ||
    (c.visibility ?? 1) < 0.35
  ) {
    return null;
  }

  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = (a.z ?? 0) - (b.z ?? 0);
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z ?? 0) - (b.z ?? 0);

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

  if (mag1 < 1e-4 || mag2 < 1e-4) return null;

  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Calculates continuous bilateral joint divergence and overall Bilateral Symmetry Index (BAI)
 * across an athletic repetition set from 3D world landmarks or synchronized angle pairs.
 */
export function analyzeBilateralKinematicSymmetry(
  worldLandmarks: Landmark3DCoord[][] | null | undefined,
  timestamps: number[] | null | undefined,
  lift = 'squat',
  reps: { index?: number; startTime?: number; endTime?: number; romDegrees?: number }[] = [],
  stickingInflections: { repIndex: number; timestamp: number }[] = []
): BilateralSymmetryTelemetry | null {
  if (!Array.isArray(worldLandmarks) || worldLandmarks.length < 5) {
    return null;
  }

  const times = Array.isArray(timestamps) && timestamps.length === worldLandmarks.length
    ? timestamps
    : worldLandmarks.map((_, i) => i / 30);

  const isPress = /press|bench|push/i.test(lift);

  // Squat: Left Knee (23-25-27) vs Right Knee (24-26-28)
  // Press: Left Elbow (11-13-15) vs Right Elbow (12-14-16)
  const leftIndices = isPress ? [11, 13, 15] : [23, 25, 27];
  const rightIndices = isPress ? [12, 14, 16] : [24, 26, 28];

  const divergences: BilateralJointDivergence[] = [];
  let totalDivergence = 0;
  let peakDivergence = 0;
  let peakTime = 0;

  for (let i = 0; i < worldLandmarks.length; i++) {
    const frame = worldLandmarks[i];
    if (!frame) continue;

    const leftAngle = calculateJointAngle3D(frame[leftIndices[0]], frame[leftIndices[1]], frame[leftIndices[2]]);
    const rightAngle = calculateJointAngle3D(frame[rightIndices[0]], frame[rightIndices[1]], frame[rightIndices[2]]);

    if (leftAngle !== null && rightAngle !== null) {
      const diff = Math.abs(leftAngle - rightAngle);
      const t = times[i];
      divergences.push({
        timestamp: t,
        leftAngleDeg: Math.round(leftAngle * 10) / 10,
        rightAngleDeg: Math.round(rightAngle * 10) / 10,
        divergenceDeg: Math.round(diff * 10) / 10,
      });

      totalDivergence += diff;
      if (diff > peakDivergence) {
        peakDivergence = diff;
        peakTime = t;
      }
    }
  }

  if (divergences.length < 5) {
    return null;
  }

  const meanDivergence = totalDivergence / divergences.length;

  // Reference excursion ROM from reps or default 80 deg
  let avgRom = 80;
  if (Array.isArray(reps) && reps.length > 0) {
    const romSum = reps.reduce((sum, r) => sum + (r.romDegrees || 0), 0);
    if (romSum > 0) avgRom = romSum / reps.length;
  }

  // BAI Formula: 100 * (1 - (Mean(DeltaTheta) / ROM))
  const rawScore = 100 * (1 - (meanDivergence / Math.max(30, avgRom)));
  const symmetryScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Determine peak divergence rep
  let peakRepIndex = 1;
  if (Array.isArray(reps) && reps.length > 0) {
    for (const r of reps) {
      const s = r.startTime ?? 0, e = r.endTime ?? Infinity;
      if (peakTime >= s && peakTime <= e) {
        peakRepIndex = r.index ?? 1;
        break;
      }
    }
  }

  // Sticking-point asymmetry divergence check:
  // Check if peak divergence occurred within 0.35s of any concentric sticking inflection
  let asymmetricStickingDivergence = false;
  for (const inf of stickingInflections) {
    if (Math.abs(peakTime - inf.timestamp) <= 0.35 && peakDivergence >= 10.0) {
      asymmetricStickingDivergence = true;
      break;
    }
  }

  let tier: 'optimal' | 'moderate' | 'high_asymmetry';
  let cueFr: string;
  let cueEn: string;

  if (symmetryScore >= 90 && !asymmetricStickingDivergence) {
    tier = 'optimal';
    cueFr = `Symétrie bilatérale optimale (${symmetryScore}\u00A0%)\u00A0: répartition équilibrée de la charge.`;
    cueEn = `Optimal bilateral symmetry (${symmetryScore}%): balanced load distribution.`;
  } else if (symmetryScore >= 80 && !asymmetricStickingDivergence) {
    tier = 'moderate';
    cueFr = `Légère divergence bilatérale (${symmetryScore}\u00A0%)\u00A0: écart moyen de ${Math.round(meanDivergence * 10) / 10}°.`;
    cueEn = `Slight bilateral divergence (${symmetryScore}%): mean difference of ${Math.round(meanDivergence * 10) / 10}°.`;
  } else {
    tier = 'high_asymmetry';
    cueFr = `Déséquilibre inter-membres détecté (${symmetryScore}\u00A0%)\u00A0: compensation unilatérale au point critique.`;
    cueEn = `Inter-limb asymmetry detected (${symmetryScore}%): unilateral compensation at the inflection point.`;
  }

  return {
    symmetryScore,
    meanDivergenceDeg: Math.round(meanDivergence * 10) / 10,
    peakDivergenceDeg: Math.round(peakDivergence * 10) / 10,
    peakDivergenceRepIndex: peakRepIndex,
    asymmetricStickingDivergence,
    tier,
    cueFr,
    cueEn,
  };
}
