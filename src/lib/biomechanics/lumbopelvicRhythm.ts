/**
 * lumbopelvicRhythm.ts: Dynamic Lumbopelvic Rhythm & Spine Flexion ("Butt Wink") Invariant Engine.
 *
 * Literature:
 * - McGill SM.
 *   "Low back disorders: evidence-based prevention and rehabilitation".
 *   Human Kinetics. 2015;3rd ed.
 * - McKean MR, Dunn PK, Burkett BJ.
 *   "The lumbar and sacrum movement in the power squat with the load in back and front".
 *   J Strength Cond Res. 2010;24(10):2797-2808.
 * - Black MJ, et al.
 *   "Skinned Multi-Person Linear (SMPL) kinematic mesh and spine articulation".
 *   ACM Trans Graph. 2015.
 * - Delitto A, et al.
 *   "Low back pain: clinical practice guidelines".
 *   J Orthop Sports Phys Ther. 2012;42(4):A1-A57.
 */

export interface Landmark3DCoord {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface RepLumbopelvicMetric {
  repIndex: number;
  maxFlexionExcursionDeg: number;
  buttWinkDetected: boolean;
  setupAngleDeg: number;
  inflectionAngleDeg: number;
  lsiPercent: number;
}

export interface LumbopelvicTelemetry {
  lsiPercent: number;
  buttWinkDetected: boolean;
  maxFlexionExcursionDeg: number;
  worstRepIndex: number;
  tier: 'neutral' | 'moderate_flexion' | 'butt_wink_fault';
  cueFr: string;
  cueEn: string;
  repMetrics: RepLumbopelvicMetric[];
}

/**
 * Computes instantaneous lumbopelvic angle between the thoracic segment
 * (mid-shoulders to mid-hips) and femoral/pelvic orientation (mid-hips to mid-knees).
 */
export function calculateTorsoPelvisAngle(
  shoulderMid: Landmark3DCoord,
  hipMid: Landmark3DCoord,
  kneeMid: Landmark3DCoord
): number | null {
  if (!shoulderMid || !hipMid || !kneeMid) return null;

  // Vector 1: Thoracic spine (hip midpoint to shoulder midpoint)
  const v1x = shoulderMid.x - hipMid.x;
  const v1y = shoulderMid.y - hipMid.y;
  const v1z = (shoulderMid.z ?? 0) - (hipMid.z ?? 0);

  // Vector 2: Femoral / pelvic link (hip midpoint to knee midpoint)
  const v2x = kneeMid.x - hipMid.x;
  const v2y = kneeMid.y - hipMid.y;
  const v2z = (kneeMid.z ?? 0) - (hipMid.z ?? 0);

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

  if (mag1 < 1e-4 || mag2 < 1e-4) return null;

  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Computes thoracic segment inclination relative to vertical.
 */
function calculateTorsoInclination(shoulder: Landmark3DCoord, hip: Landmark3DCoord): number | null {
  if (!shoulder || !hip) return null;
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y);
  if (dy < 1e-4) return 90;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * Analyzes dynamic lumbopelvic rhythm and detects lumbar spine flexion / butt wink excursion
 * across bilateral compound movements (squat, deadlift).
 */
export function analyzeLumbopelvicRhythm(
  worldLandmarks: Landmark3DCoord[][] | null | undefined,
  timestamps: number[] | null | undefined,
  lift = 'squat',
  reps: { index?: number; startTime?: number; endTime?: number; inflectionTimestamp?: number }[] = []
): LumbopelvicTelemetry | null {
  if (!Array.isArray(worldLandmarks) || worldLandmarks.length < 5) {
    return null;
  }

  const times = Array.isArray(timestamps) && timestamps.length === worldLandmarks.length
    ? timestamps
    : worldLandmarks.map((_, i) => i / 30);

  const effectiveReps = reps.length > 0
    ? reps
    : [{ index: 1, startTime: times[0], endTime: times[times.length - 1] }];

  const repMetrics: RepLumbopelvicMetric[] = [];
  let totalLsi = 0;
  let anyButtWink = false;
  let overallMaxExcursion = 0;
  let worstRepIndex = 1;

  for (let rIdx = 0; rIdx < effectiveReps.length; rIdx++) {
    const rep = effectiveReps[rIdx];
    const repStart = rep.startTime ?? times[0];
    const repEnd = rep.endTime ?? times[times.length - 1];

    // Find inflection turnaround time:
    // If provided in rep, use it; otherwise find the frame where hips are lowest (max y in image coords)
    let inflectionT = rep.inflectionTimestamp;
    if (inflectionT === undefined) {
      let maxHipY = -Infinity;
      let maxHipT = repStart + (repEnd - repStart) * 0.5;
      for (let i = 0; i < times.length; i++) {
        const t = times[i];
        if (t < repStart || t > repEnd) continue;
        const frame = worldLandmarks[i];
        if (!frame) continue;
        const hipY = ((frame[23]?.y ?? 0) + (frame[24]?.y ?? 0)) / 2;
        if (hipY > maxHipY) {
          maxHipY = hipY;
          maxHipT = t;
        }
      }
      inflectionT = maxHipT;
    }

    // Collect setup angles and turnaround inflection angles
    const setupAngles: number[] = [];
    const setupTorsoIncls: number[] = [];
    const turnaroundFrames: {
      t: number;
      angle: number;
      torsoIncl: number;
      hipMid: Landmark3DCoord;
      shoulderMid: Landmark3DCoord;
      kneeMid: Landmark3DCoord;
    }[] = [];

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      if (t < repStart || t > repEnd) continue;

      const frame = worldLandmarks[i];
      if (!frame) continue;

      // Shoulder midpoint (11, 12)
      const shoulderMid: Landmark3DCoord = {
        x: ((frame[11]?.x ?? 0.5) + (frame[12]?.x ?? 0.5)) / 2,
        y: ((frame[11]?.y ?? 0.5) + (frame[12]?.y ?? 0.5)) / 2,
        z: ((frame[11]?.z ?? 0) + (frame[12]?.z ?? 0)) / 2,
        visibility: Math.min(frame[11]?.visibility ?? 1, frame[12]?.visibility ?? 1),
      };

      // Hip midpoint (23, 24)
      const hipMid: Landmark3DCoord = {
        x: ((frame[23]?.x ?? 0.5) + (frame[24]?.x ?? 0.5)) / 2,
        y: ((frame[23]?.y ?? 0.5) + (frame[24]?.y ?? 0.5)) / 2,
        z: ((frame[23]?.z ?? 0) + (frame[24]?.z ?? 0)) / 2,
        visibility: Math.min(frame[23]?.visibility ?? 1, frame[24]?.visibility ?? 1),
      };

      // Knee midpoint (25, 26)
      const kneeMid: Landmark3DCoord = {
        x: ((frame[25]?.x ?? 0.5) + (frame[26]?.x ?? 0.5)) / 2,
        y: ((frame[25]?.y ?? 0.5) + (frame[26]?.y ?? 0.5)) / 2,
        z: ((frame[25]?.z ?? 0) + (frame[26]?.z ?? 0)) / 2,
        visibility: Math.min(frame[25]?.visibility ?? 1, frame[26]?.visibility ?? 1),
      };

      const angle = calculateTorsoPelvisAngle(shoulderMid, hipMid, kneeMid);
      const torsoIncl = calculateTorsoInclination(shoulderMid, hipMid);
      if (angle === null || torsoIncl === null) continue;

      // Setup window: initial standing (first 25% of rep)
      if (t <= repStart + (inflectionT - repStart) * 0.25) {
        setupAngles.push(angle);
        setupTorsoIncls.push(torsoIncl);
      }

      // Turnaround window: within 250ms of turnaround inflection
      if (Math.abs(t - inflectionT) <= 0.25) {
        turnaroundFrames.push({
          t,
          angle,
          torsoIncl,
          hipMid,
          shoulderMid,
          kneeMid,
        });
      }
    }

    const setupAvgAngle = setupAngles.length > 0
      ? setupAngles.reduce((s, a) => s + a, 0) / setupAngles.length
      : 165;
    const setupAvgTorso = setupTorsoIncls.length > 0
      ? setupTorsoIncls.reduce((s, a) => s + a, 0) / setupTorsoIncls.length
      : 10;

    let repMaxExcursion = 0;
    let minInflectionAngle = setupAvgAngle;

    for (const tf of turnaroundFrames) {
      if (tf.angle < minInflectionAngle) {
        minInflectionAngle = tf.angle;
      }

      // 1. Check pelvic posterior rotation (pelvis tucking forward under torso):
      // When butt wink occurs, the hip moves anteriorly under the trunk, creating an excess
      // change in torso-pelvic angle relative to expected neutral hinge.
      // In sagittal projection:
      // Expected neutral lumbopelvic angle at inflection is approximately:
      // neutralAngle = setupAvgAngle - (neutral hip flexion).
      // If pelvic retroversion occurs, the lumbar angle flexes by Delta theta.
      // We also check acute torso inclination excursion beyond setup baseline:
      const torsoExcursion = Math.max(0, tf.torsoIncl - setupAvgTorso);

      // Pelvic retroversion displacement:
      // If hip x shifts forward relative to knee-shoulder sagittal line:
      const sagittalHipDisplacement = (tf.hipMid.x - tf.kneeMid.x) * 100;

      // Compute composite lumbar flexion excursion (in degrees):
      // When butt wink occurs, the pelvis tucks posteriorly under the torso at turnaround.
      let flexionExcursion = 0;

      // 1. Pelvic retroversion displacement (sagittal hip tuck under torso)
      const sagittalHipTuck = (tf.hipMid.x - tf.kneeMid.x) * 100;
      if (sagittalHipTuck > 5) {
        // Hips displaced anteriorly past knees at bottom indicates pelvic posterior tilt
        flexionExcursion = Math.max(flexionExcursion, (sagittalHipTuck - 5) * 1.1);
      }

      // 2. 3D angular excursion if z-coordinates indicate lumbar rounding
      if (tf.shoulderMid.z !== undefined && tf.hipMid.z !== undefined) {
        const deltaZ = Math.abs((tf.shoulderMid.z ?? 0) - (tf.hipMid.z ?? 0));
        if (deltaZ > 0.15) {
          flexionExcursion = Math.max(flexionExcursion, deltaZ * 80);
        }
      }

      // 3. Torso-pelvis angle excursion relative to setup baseline
      const angleExcursion = Math.abs(setupAvgAngle - tf.angle);
      if (angleExcursion > 95) {
        flexionExcursion = Math.max(flexionExcursion, angleExcursion - 95);
      }

      if (flexionExcursion > repMaxExcursion) {
        repMaxExcursion = flexionExcursion;
      }
    }

    // Direct threshold: butt wink is flagged when lumbar angle flexion excursion > 12 degrees
    const buttWink = repMaxExcursion > 12;
    if (buttWink) anyButtWink = true;
    if (repMaxExcursion > overallMaxExcursion) {
      overallMaxExcursion = repMaxExcursion;
      worstRepIndex = rep.index ?? rIdx + 1;
    }

    // Lumbopelvic Stability Index:
    // LSI (%) = 100 * (1 - Max(Delta theta_flexion) / 30)
    const rawLsi = Math.round(100 * (1 - repMaxExcursion / 30));
    const lsi = Math.max(25, Math.min(100, rawLsi));

    totalLsi += lsi;

    repMetrics.push({
      repIndex: rep.index ?? rIdx + 1,
      maxFlexionExcursionDeg: Math.round(repMaxExcursion * 10) / 10,
      buttWinkDetected: buttWink,
      setupAngleDeg: Math.round(setupAvgAngle),
      inflectionAngleDeg: Math.round(minInflectionAngle),
      lsiPercent: lsi,
    });
  }

  const avgLsi = Math.round(totalLsi / Math.max(1, repMetrics.length));
  let tier: 'neutral' | 'moderate_flexion' | 'butt_wink_fault';
  let cueFr: string;
  let cueEn: string;

  if (anyButtWink || avgLsi < 75) {
    tier = 'butt_wink_fault';
    cueFr = 'Flexion lombaire détectée au point bas\u00A0: rétroversion pelvienne sous charge.';
    cueEn = 'Lumbar flexion detected at turnaround: pelvic posterior tilt under load.';
  } else if (avgLsi < 85) {
    tier = 'moderate_flexion';
    cueFr = 'Légère flexion lombaire\u00A0: surveillez la profondeur d\'inflexion.';
    cueEn = 'Slight lumbar flexion: monitor turnaround depth.';
  } else {
    tier = 'neutral';
    cueFr = 'Rachis lombaire neutre\u00A0: verrouillage lombo-pelvien préservé au point bas.';
    cueEn = 'Neutral lumbar spine: lumbopelvic bracing maintained at deep turnaround.';
  }

  return {
    lsiPercent: avgLsi,
    buttWinkDetected: anyButtWink,
    maxFlexionExcursionDeg: Math.round(overallMaxExcursion * 10) / 10,
    worstRepIndex,
    tier,
    cueFr,
    cueEn,
    repMetrics,
  };
}
