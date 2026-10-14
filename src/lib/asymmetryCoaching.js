/**
 * asymmetryCoaching.js — Biomechanical asymmetry analysis & actionable coaching intelligence.
 *
 * WITHDRAWN from the app on 14 October 2026 (honesty audit, CORE-06, CORE-07): run by no screen, kept for research.
 * The visibility floor cannot exclude the hidden far limb (counting/symmetry.ts), equal-sided synthetic sets scored
 * 35-98, the trunk "tilt" reads forward lean in a side view, and the 5 % / 15 % / 5° thresholds are UNSOURCED. Kiesel
 * 2007 (FMS composite score) and Bishop et al. 2018 (J Sports Sci 36(10):1135-1144, strength and jump asymmetries) do
 * not support these thresholds. Left against right on screen is counting/symmetry.ts with sides-line.js only.
 *
 * Evaluates:
 * 1. Bilateral limb range of motion (ROM) discrepancy (Bishop et al., 2018).
 * 2. Lateral trunk tilt / spinal shift during compound and bilateral movements.
 * 3. Evidence-based coaching cues and exercise recommendations for lifters, coaches, and physiotherapists.
 */

import { analyzeBilateralSymmetry } from './symmetry';

/**
 * Calculates lateral trunk shift / spinal lean from 3D world landmarks.
 *
 * @param {Array} worldLandmarks Array of 33-point landmark frames
 * @param {Array} timestamps Array of timestamps in seconds
 * @returns {object|null} Trunk tilt metrics
 */
export function calculateTrunkShift(worldLandmarks, timestamps) {
  if (!worldLandmarks?.length) return null;

  const tilts = [];
  let validCount = 0;

  for (let i = 0; i < worldLandmarks.length; i++) {
    const frame = worldLandmarks[i];
    if (!frame) continue;

    const ls = frame[11], rs = frame[12]; // shoulders
    const lh = frame[23], rh = frame[24]; // hips

    if (!ls || !rs || !lh || !rh) continue;
    const sVis = ((ls.visibility ?? 0) + (rs.visibility ?? 0)) / 2;
    const hVis = ((lh.visibility ?? 0) + (rh.visibility ?? 0)) / 2;

    if (sVis < 0.35 || hVis < 0.35) continue;

    validCount++;
    // Midpoint of shoulders
    const sx = (ls.x + rs.x) / 2;
    const sy = (ls.y + rs.y) / 2;

    // Midpoint of hips
    const hx = (lh.x + rh.x) / 2;
    const hy = (lh.y + rh.y) / 2;

    // Vector from hips to shoulders (spine vector)
    const vx = sx - hx;
    const vy = sy - hy; // In camera/world coords, y is downward (or vertical)

    // Angle of spine vector against vertical (vx = 0, vy < 0)
    // Positive vx means leaning right, negative vx means leaning left
    const angleRad = Math.atan2(vx, -vy);
    const angleDeg = (angleRad * 180) / Math.PI;
    tilts.push(angleDeg);
  }

  if (validCount < 5 || tilts.length < 5) return null;

  const absTilts = tilts.map(Math.abs);
  absTilts.sort((a, b) => a - b);
  // 90th percentile to avoid single-frame outliers
  const p90Tilt = absTilts[Math.floor(absTilts.length * 0.9)];
  const meanTilt = absTilts.reduce((a, b) => a + b, 0) / absTilts.length;

  const signedMean = tilts.reduce((a, b) => a + b, 0) / tilts.length;
  const direction = Math.abs(signedMean) >= 2.5 ? (signedMean > 0 ? 'right' : 'left') : 'none';

  const maxTrunkTiltDeg = Math.round(p90Tilt * 10) / 10;
  const meanTrunkTiltDeg = Math.round(meanTilt * 10) / 10;

  return {
    maxTrunkTiltDeg,
    meanTrunkTiltDeg,
    direction,
    hasShift: maxTrunkTiltDeg >= 5.0,
  };
}

/**
 * Comprehensive asymmetry analysis combining bilateral limb kinematics and trunk stability.
 *
 * @param {Array} worldLandmarks 3D world landmarks array
 * @param {Array} timestamps Timestamp array
 * @param {string} lift The lift key
 * @param {Array} reps Detected repetitions array
 * @returns {object|null} Enriched symmetry & coaching metrics
 */
export function analyzeAsymmetryAndTrunk(worldLandmarks, timestamps, lift, reps) {
  const baseSymmetry = analyzeBilateralSymmetry(worldLandmarks, timestamps, lift, reps);
  const trunkShift = calculateTrunkShift(worldLandmarks, timestamps);

  if (!baseSymmetry && !trunkShift) return null;

  const symmetryScore = baseSymmetry?.symmetryScore ?? (trunkShift?.hasShift ? Math.max(70, Math.round(100 - trunkShift.maxTrunkTiltDeg * 3)) : 95);
  const asymmetryPct = baseSymmetry?.asymmetryPct ?? (trunkShift?.hasShift ? Math.round(trunkShift.maxTrunkTiltDeg * 2.5) : 5);
  const dominantSide = baseSymmetry?.dominantSide ?? trunkShift?.direction ?? 'none';
  const romDiffDeg = baseSymmetry?.romDiffDeg ?? 0;
  const status = baseSymmetry?.status ?? (asymmetryPct <= 8 ? 'balanced' : asymmetryPct <= 15 ? 'mild_asymmetry' : 'notable_asymmetry');

  // Generate actionable coaching cues
  let adviceFr = '';
  let adviceEn = '';
  let level = 'optimal'; // 'optimal' | 'mild' | 'notable'

  if (asymmetryPct > 15) {
    level = 'notable';
    const sideLabelFr = dominantSide === 'left' ? 'gauche' : dominantSide === 'right' ? 'droit' : 'dominant';
    const sideLabelEn = dominantSide === 'left' ? 'left' : dominantSide === 'right' ? 'right' : 'dominant';
    adviceFr = `Asymétrie notable (+${romDiffDeg}° côté ${sideLabelFr}). Pour éviter les surcharges articulaires, intégrez du travail unilatéral avec haltères et fixez la charge sur la force du membre le plus faible.`;
    adviceEn = `Notable asymmetry detected (+${romDiffDeg}° on ${sideLabelEn} side). To prevent compensatory joint stress, introduce unilateral dumbbell exercises and calibrate loading to your non-dominant side.`;
  } else if (asymmetryPct >= 8) {
    level = 'mild';
    const sideLabelFr = dominantSide === 'left' ? 'gauche' : dominantSide === 'right' ? 'droite' : 'dominante';
    const sideLabelEn = dominantSide === 'left' ? 'left' : dominantSide === 'right' ? 'right' : 'dominant';
    adviceFr = `Légère asymétrie fonctionnelle (+${romDiffDeg}°, ${sideLabelFr} dominante). Veillez à synchroniser l'inversion du mouvement et vérifiez la symétrie de votre prise.`;
    adviceEn = `Mild functional asymmetry (+${romDiffDeg}°, ${sideLabelEn} dominant). Focus on synchronizing the directional turnaround and verify bilateral grip symmetry.`;
  } else {
    level = 'optimal';
    adviceFr = 'Équilibre bilatéral optimal\u00A0: le transfert de force est uniforme entre les deux côtés.';
    adviceEn = 'Optimal bilateral balance: force transfer is uniformly distributed across kinetic chains.';
  }

  // Trunk shift coaching addendum
  if (trunkShift?.hasShift) {
    const dirFr = trunkShift.direction === 'left' ? 'la gauche' : trunkShift.direction === 'right' ? 'la droite' : 'un côté';
    const dirEn = trunkShift.direction === 'left' ? 'the left' : trunkShift.direction === 'right' ? 'the right' : 'one side';
    const trunkCueFr = ` Décalage latéral du tronc de ${trunkShift.maxTrunkTiltDeg}°\u00A0: le buste penche vers ${dirFr}. Ancrez les deux pieds de manière égale pour stabiliser le bassin.`;
    const trunkCueEn = ` Lateral trunk tilt of ${trunkShift.maxTrunkTiltDeg}°\u00A0: torso leans toward ${dirEn}. Anchor evenly through both feet to stabilize the pelvis.`;
    adviceFr += trunkCueFr;
    adviceEn += trunkCueEn;
    if (level === 'optimal') level = 'mild';
  }

  return {
    ...(baseSymmetry || {}),
    symmetryScore,
    asymmetryPct,
    dominantSide,
    romDiffDeg,
    status,
    trunkShift: trunkShift ? {
      ...trunkShift,
      significantShift: trunkShift.hasShift,
      maxLateralTiltDeg: trunkShift.maxTrunkTiltDeg,
      meanLateralTiltDeg: trunkShift.meanTrunkTiltDeg,
    } : null,
    coaching: {
      level,
      hasNotableAsymmetry: level !== 'optimal',
      adviceFr,
      adviceEn,
    },
  };
}
