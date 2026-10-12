/**
 * JointTorqueEngine — Edge Biomechanical Inverse Dynamics & Joint Shear Estimator
 *
 * Computes real-time net joint moments (N·m), joint shear forces (N), and mechanical work (J)
 * directly in the browser with ZERO server infrastructure.
 *
 * Uses de Leva (1996) anthropometric segment parameter standards and 3D landmark kinematics.
 * References:
 * - de Leva P. (1996). Adjustments to Zatsiorsky-Seluyanov's segment inertia parameters. J Biomech, 29(9):1223-1230.
 * - Chaffin DB, Andersson GB, Martin BJ. (2006). Occupational Biomechanics (4th ed.). Wiley.
 * - McGill SM. (2007). Low Back Disorders: Evidence-Based Prevention and Rehabilitation. Human Kinetics.
 */

// de Leva (1996) segment mass percentages (% of total body mass) and CoM locations (% segment length from proximal joint)
export const ANTHRO_CONSTANTS = Object.freeze({
  HEAD_NECK_MASS_PCT: 0.0681,
  TRUNK_MASS_PCT: 0.4346,
  THIGH_MASS_PCT: 0.1416,
  SHANK_MASS_PCT: 0.0433,
  FOOT_MASS_PCT: 0.0137,
  UPPER_ARM_MASS_PCT: 0.0271,
  FOREARM_MASS_PCT: 0.0162,
  HAND_MASS_PCT: 0.0061,

  TRUNK_COM_PROXIMAL: 0.4486,   // CoM from suprasternale toward midpoint of hips
  THIGH_COM_PROXIMAL: 0.4095,   // CoM from hip toward knee
  SHANK_COM_PROXIMAL: 0.4395,   // CoM from knee toward ankle
  UPPER_ARM_COM_PROXIMAL: 0.5772, // CoM from shoulder toward elbow
  FOREARM_COM_PROXIMAL: 0.4574,   // CoM from elbow toward wrist

  STANDARD_BODY_MASS_KG: 75.0,  // Baseline default mass if user mass is unspecified
  GRAVITY_M_S2: 9.80665,
});

/**
 * 3D Euclidean distance between two landmark points
 */
function dist3D(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = (p1.x || 0) - (p2.x || 0);
  const dy = (p1.y || 0) - (p2.y || 0);
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Midpoint between two landmarks in 3D
 */
function midpoint(p1, p2) {
  if (!p1 && !p2) return { x: 0, y: 0, z: 0 };
  if (!p1) return { x: p2.x || 0, y: p2.y || 0, z: p2.z || 0 };
  if (!p2) return { x: p1.x || 0, y: p1.y || 0, z: p1.z || 0 };
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    z: ((p1.z || 0) + (p2.z || 0)) / 2,
  };
}

/**
 * Compute the horizontal moment arm (distance in X-Z plane perpendicular to gravity Y)
 */
function horizontalMomentArm(pivot, target) {
  if (!pivot || !target) return 0;
  const dx = (target.x || 0) - (pivot.x || 0);
  const dz = (target.z || 0) - (pivot.z || 0);
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Estimates scale factor from normalized MediaPipe units to real-world meters
 * based on canonical adult femur (0.42m) and tibia (0.38m) lengths.
 */
export function estimateWorldScaleMeters(landmarks) {
  if (!landmarks || landmarks.length < 33) return 1.75; // Standard fallback multiplier

  const leftHip = landmarks[23], rightHip = landmarks[24];
  const leftKnee = landmarks[25], rightKnee = landmarks[26];
  const leftAnkle = landmarks[27], rightAnkle = landmarks[28];

  const lFemur = dist3D(leftHip, leftKnee);
  const rFemur = dist3D(rightHip, rightKnee);
  const femurNorm = Math.max(lFemur, rFemur);

  const lTibia = dist3D(leftKnee, leftAnkle);
  const rTibia = dist3D(rightKnee, rightAnkle);
  const tibiaNorm = Math.max(lTibia, rTibia);

  // If normalized leg length is valid, compute scaling factor (adult femur avg: 0.42m, tibia: 0.38m)
  if (femurNorm > 0.05) {
    const scaleFromFemur = 0.42 / femurNorm;
    if (tibiaNorm > 0.05) {
      const scaleFromTibia = 0.38 / tibiaNorm;
      return (scaleFromFemur + scaleFromTibia) / 2;
    }
    return scaleFromFemur;
  }

  return 1.75;
}

/**
 * Computes instantaneous L5/S1 spinal flexion moment and shear force for a single frame.
 * L5/S1 joint is modeled at the sacral base, approximately 3cm above the hip joint center.
 */
export function estimateL5S1SpinalShear(landmarks, scaleMeters = 1.75, bodyMassKg = ANTHRO_CONSTANTS.STANDARD_BODY_MASS_KG) {
  if (!landmarks || landmarks.length < 33) return null;

  const leftHip = landmarks[23], rightHip = landmarks[24];
  const leftShoulder = landmarks[11], rightShoulder = landmarks[12];

  if (!leftHip || !rightHip || !leftShoulder || !rightShoulder) return null;

  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);

  // Trunk center of mass location (44.86% from shoulder center toward hip center)
  const trunkCoM = {
    x: shoulderCenter.x + (hipCenter.x - shoulderCenter.x) * (1 - ANTHRO_CONSTANTS.TRUNK_COM_PROXIMAL),
    y: shoulderCenter.y + (hipCenter.y - shoulderCenter.y) * (1 - ANTHRO_CONSTANTS.TRUNK_COM_PROXIMAL),
    z: shoulderCenter.z + (hipCenter.z - shoulderCenter.z) * (1 - ANTHRO_CONSTANTS.TRUNK_COM_PROXIMAL),
  };

  // Horizontal moment arm in real meters from L5/S1 (hip center) to trunk CoM
  const rTrunkNorm = horizontalMomentArm(hipCenter, trunkCoM);
  const rTrunkMeters = rTrunkNorm * scaleMeters;

  // Mass of upper body (head + arms + trunk)
  const upperBodyMassKg = bodyMassKg * (ANTHRO_CONSTANTS.HEAD_NECK_MASS_PCT + ANTHRO_CONSTANTS.TRUNK_MASS_PCT + 2 * ANTHRO_CONSTANTS.UPPER_ARM_MASS_PCT + 2 * ANTHRO_CONSTANTS.FOREARM_MASS_PCT);
  const upperBodyWeightN = upperBodyMassKg * ANTHRO_CONSTANTS.GRAVITY_M_S2;

  // L5/S1 static flexion moment (N·m)
  const flexionMomentNm = upperBodyWeightN * rTrunkMeters;

  // Trunk forward inclination angle relative to vertical (gravity)
  const dy = Math.abs(shoulderCenter.y - hipCenter.y);
  const dxz = horizontalMomentArm(hipCenter, shoulderCenter);
  const trunkAngleRad = Math.atan2(dxz, dy);

  // Anterior-posterior lumbar shear force: upper body mass component perpendicular to spine
  const anteriorShearN = upperBodyWeightN * Math.sin(trunkAngleRad);
  // Compressive force component parallel to spine
  const compressiveForceN = upperBodyWeightN * Math.cos(trunkAngleRad);

  return {
    flexionMomentNm: Math.round(flexionMomentNm * 10) / 10,
    anteriorShearN: Math.round(anteriorShearN * 10) / 10,
    compressiveForceN: Math.round(compressiveForceN * 10) / 10,
    trunkAngleDeg: Math.round((trunkAngleRad * 180) / Math.PI * 10) / 10,
    momentArmCm: Math.round(rTrunkMeters * 100 * 10) / 10,
  };
}

/**
 * Computes instantaneous Patellofemoral & Tibiofemoral knee joint moments and shear forces.
 */
export function estimateKneeShear(landmarks, scaleMeters = 1.75, bodyMassKg = ANTHRO_CONSTANTS.STANDARD_BODY_MASS_KG) {
  if (!landmarks || landmarks.length < 33) return null;

  const leftHip = landmarks[23], rightHip = landmarks[24];
  const leftKnee = landmarks[25], rightKnee = landmarks[26];
  const leftAnkle = landmarks[27], rightAnkle = landmarks[28];

  const side = (leftKnee && leftKnee.visibility > 0.5) ? 'left' : 'right';
  const hip = side === 'left' ? leftHip : rightHip;
  const knee = side === 'left' ? leftKnee : rightKnee;
  const ankle = side === 'left' ? leftAnkle : rightAnkle;

  if (!hip || !knee || !ankle) return null;

  // Thigh length and Knee moment arm in real meters
  const rKneeMeters = horizontalMomentArm(knee, hip) * scaleMeters;
  const effectiveUpperMassKg = bodyMassKg * 0.68; // ~68% of body mass rests above knee joints
  const downwardForceN = (effectiveUpperMassKg * ANTHRO_CONSTANTS.GRAVITY_M_S2) / 2; // Per leg

  const extensorMomentNm = downwardForceN * rKneeMeters;

  // Knee flexion angle: vector knee->hip vs knee->ankle
  const thighLen = dist3D(knee, hip);
  const shankLen = dist3D(knee, ankle);
  let kneeAngleRad = Math.PI;
  if (thighLen > 0.01 && shankLen > 0.01) {
    const dot = ((hip.x - knee.x) * (ankle.x - knee.x) + (hip.y - knee.y) * (ankle.y - knee.y) + ((hip.z || 0) - (knee.z || 0)) * ((ankle.z || 0) - (knee.z || 0))) / (thighLen * shankLen);
    kneeAngleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
  }

  // Patellar shear force peaks during deep flexion (anterior tibial translation)
  const shearFactor = Math.sin(Math.PI - kneeAngleRad);
  const patellarShearN = downwardForceN * Math.max(0, shearFactor);

  return {
    side,
    extensorMomentNm: Math.round(extensorMomentNm * 10) / 10,
    patellarShearN: Math.round(patellarShearN * 10) / 10,
    kneeAngleDeg: Math.round((kneeAngleRad * 180) / Math.PI * 10) / 10,
    momentArmCm: Math.round(rKneeMeters * 100 * 10) / 10,
  };
}

/**
 * Computes Shoulder Glenohumeral abduction moment (N·m)
 */
export function estimateShoulderTorque(landmarks, scaleMeters = 1.75, bodyMassKg = ANTHRO_CONSTANTS.STANDARD_BODY_MASS_KG) {
  if (!landmarks || landmarks.length < 33) return null;

  const leftShoulder = landmarks[11], rightShoulder = landmarks[12];
  const leftElbow = landmarks[13], rightElbow = landmarks[14];
  const leftWrist = landmarks[15], rightWrist = landmarks[16];

  const side = (leftWrist && leftWrist.visibility > 0.5) ? 'left' : 'right';
  const shoulder = side === 'left' ? leftShoulder : rightShoulder;
  const elbow = side === 'left' ? leftElbow : rightElbow;
  const wrist = side === 'left' ? leftWrist : rightWrist;

  if (!shoulder || !elbow) return null;

  const endPoint = (wrist && wrist.visibility > 0.4) ? wrist : elbow;
  const armLenMeters = dist3D(shoulder, endPoint) * scaleMeters;
  const armMassKg = bodyMassKg * (ANTHRO_CONSTANTS.UPPER_ARM_MASS_PCT + ANTHRO_CONSTANTS.FOREARM_MASS_PCT);

  const rShoulderMeters = horizontalMomentArm(shoulder, endPoint) * scaleMeters;
  const abductionMomentNm = armMassKg * ANTHRO_CONSTANTS.GRAVITY_M_S2 * rShoulderMeters;

  return {
    side,
    abductionMomentNm: Math.round(abductionMomentNm * 10) / 10,
    armLengthCm: Math.round(armLenMeters * 100 * 10) / 10,
    momentArmCm: Math.round(rShoulderMeters * 100 * 10) / 10,
  };
}

/**
 * Analyzes complete set kinetic trajectory across all repetition windows.
 * Extracts peak and mean torques, mechanical work (J), and clinical shear risks.
 */
export function analyzeSetKinetics(worldLandmarksSequence, timestamps, lift, reps = [], bodyMassKg = ANTHRO_CONSTANTS.STANDARD_BODY_MASS_KG) {
  if (!worldLandmarksSequence || !worldLandmarksSequence.length || !reps.length) return null;

  const validFrame = worldLandmarksSequence.find(f => f && f.length >= 33);
  const scale = estimateWorldScaleMeters(validFrame);

  const isSquatOrLunge = /squat|lunge|leg_press|step_up/i.test(lift);
  const isSpinalFlexion = /deadlift|romanian_deadlift|good_morning|row|back_extension/i.test(lift);
  const isShoulderLift = /raise|press|y_raise|t_raise|overhead/i.test(lift);

  const perRepKinetics = reps.map((rep, idx) => {
    const sIdx = Math.max(0, timestamps.findIndex(t => t >= rep.startTime));
    const eIdx = timestamps.findIndex(t => t >= rep.endTime);
    const end = eIdx === -1 ? timestamps.length - 1 : eIdx;

    let peakL5S1ShearN = 0;
    let peakL5S1MomentNm = 0;
    let peakKneeShearN = 0;
    let peakKneeMomentNm = 0;
    let peakShoulderMomentNm = 0;

    for (let i = sIdx; i <= end; i++) {
      const frame = worldLandmarksSequence[i];
      if (!frame || frame.length < 33) continue;

      if (isSpinalFlexion || isSquatOrLunge) {
        const l5s1 = estimateL5S1SpinalShear(frame, scale, bodyMassKg);
        if (l5s1) {
          if (l5s1.anteriorShearN > peakL5S1ShearN) peakL5S1ShearN = l5s1.anteriorShearN;
          if (l5s1.flexionMomentNm > peakL5S1MomentNm) peakL5S1MomentNm = l5s1.flexionMomentNm;
        }
      }

      if (isSquatOrLunge) {
        const knee = estimateKneeShear(frame, scale, bodyMassKg);
        if (knee) {
          if (knee.patellarShearN > peakKneeShearN) peakKneeShearN = knee.patellarShearN;
          if (knee.extensorMomentNm > peakKneeMomentNm) peakKneeMomentNm = knee.extensorMomentNm;
        }
      }

      if (isShoulderLift) {
        const sh = estimateShoulderTorque(frame, scale, bodyMassKg);
        if (sh && sh.abductionMomentNm > peakShoulderMomentNm) {
          peakShoulderMomentNm = sh.abductionMomentNm;
        }
      }
    }

    // Work done = Force × displacement or Moment × angular displacement (radians)
    const romRad = (rep.romDegrees || 60) * (Math.PI / 180);
    const governingTorque = Math.max(peakL5S1MomentNm, peakKneeMomentNm, peakShoulderMomentNm, 20);
    const estimatedWorkJoules = Math.round(governingTorque * romRad);

    return {
      repNumber: idx + 1,
      peakL5S1ShearN,
      peakL5S1MomentNm,
      peakKneeShearN,
      peakKneeMomentNm,
      peakShoulderMomentNm,
      workJoules: estimatedWorkJoules,
    };
  });

  const totalWorkJoules = perRepKinetics.reduce((acc, r) => acc + r.workJoules, 0);
  const maxL5S1ShearN = Math.max(...perRepKinetics.map(r => r.peakL5S1ShearN), 0);
  const maxKneeShearN = Math.max(...perRepKinetics.map(r => r.peakKneeShearN), 0);
  const maxShoulderMomentNm = Math.max(...perRepKinetics.map(r => r.peakShoulderMomentNm), 0);

  // Clinical risk assessment
  let riskNote = null;
  if (isSpinalFlexion && maxL5S1ShearN > 650) {
    riskNote = {
      level: 'warning',
      joint: 'l5_s1',
      textEn: 'High lumbar anterior shear detected. Maintain neutral spine and brace core intra-abdominally.',
      textFr: 'Cisaillement lombaire L5/S1 élevé. Maintenez le rachis neutre et renforcez le gainage abdominal.',
    };
  } else if (isSquatOrLunge && maxKneeShearN > 700) {
    riskNote = {
      level: 'moderate',
      joint: 'patellofemoral',
      textEn: 'Elevated patellofemoral shear force. Drive through midfoot and align knees with toes.',
      textFr: 'Contrainte patellaire élevée. Poussez sur le milieu du pied et alignez les genoux avec les pointes.',
    };
  }

  return {
    scaleMeters: Math.round(scale * 100) / 100,
    bodyMassKg,
    totalWorkJoules,
    maxL5S1ShearN,
    maxKneeShearN,
    maxShoulderMomentNm,
    perRepKinetics,
    riskNote,
  };
}
