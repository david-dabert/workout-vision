/**
 * L5/S1 Lumbar Spine Biomechanical Inverse Dynamics Engine
 *
 * Implements monocular 2D/3D inverse dynamics to compute:
 * 1. Trunk orientation angle (\theta_{trunk}) relative to gravitational vertical.
 * 2. Net L5/S1 reaction bending moment (M_{L5S1}) in Newton-meters (N·m).
 * 3. Erector spinae muscle force (F_{erector}) required for equilibrium.
 * 4. Spinal compressive force (F_{comp}) and anterior-posterior shear force (F_{shear}) in Newtons (N).
 * 5. Clinical spinal safety classification based on NIOSH (3400 N compression)
 *    and McGill (500 N shear) ergonomic safety standards.
 *
 * References:
 * - Chaffin, D. B., & Andersson, G. (1991). Occupational Biomechanics. John Wiley & Sons.
 * - Winter, D. A. (2009). Biomechanics and Motor Control of Human Movement.
 * - McGill, S. M. (1997). The biomechanics of low back injury: Implications on current practice in industry and clinic.
 * - Waters, T. R., et al. (1993). Revised NIOSH equation for the design and evaluation of manual lifting tasks.
 */

export interface L5S1DynamicsInput {
  landmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>;
  bodyMassKg?: number;
  loadKg?: number;
  lift?: string;
  accelY?: number; // m/s^2 vertical acceleration
}

export type LumbarSafetyTier = 'optimal' | 'moderate' | 'high_shear_risk';

export interface L5S1DynamicsResult {
  trunkAngleDeg: number;
  l5s1Point: { x: number; y: number; z: number };
  momentArmM: number;
  reactionTorqueNm: number;
  erectorSpinaeForceN: number;
  compressiveForceN: number;
  shearForceN: number;
  safetyTier: LumbarSafetyTier;
  advice: {
    fr: string;
    en: string;
  };
}

// Anthropometric Constants (Winter 2009, Dempster 1955)
const DEFAULT_BODY_MASS_KG = 75;
const GRAVITY_M_S2 = 9.81;
// Head, Arms, and Torso (HAT) segment mass ratio above L5/S1
const HAT_MASS_RATIO = 0.58;
// Center of mass location of HAT segment along the trunk vector from L5/S1
const HAT_COM_RATIO = 0.44;
// Effective erector spinae muscle moment arm from L5/S1 disc center (m)
const ERECTOR_MOMENT_ARM_M = 0.050; // 5.0 cm (Chaffin & Andersson 1991)
// Clinical action thresholds
const NIOSH_ACTION_LIMIT_COMP_N = 3400; // NIOSH Action Limit
const MCGILL_SHEAR_SAFETY_LIMIT_N = 500; // McGill Shear Warning Limit

// Typical default external barbell/dumbbell mass for foundational movements (kg)
const DEFAULT_LIFT_LOAD_KG: Record<string, number> = {
  deadlift: 60,
  romanian_deadlift: 50,
  squat: 40,
  hip_thrust: 60,
  overhead_press: 30,
  bench_press: 40,
  lateral_raise: 10,
  bicep_curl: 14,
  lat_pulldown: 45,
};

/**
 * Calculates instantaneous 2D/3D L5/S1 disc kinetics and reaction forces.
 */
export function computeL5S1InverseDynamics(input: L5S1DynamicsInput): L5S1DynamicsResult | null {
  const { landmarks, bodyMassKg = DEFAULT_BODY_MASS_KG, accelY = 0, lift = 'squat' } = input;
  if (!landmarks || landmarks.length < 25) return null;

  // MediaPipe Landmark Indices:
  // 11: left shoulder, 12: right shoulder
  // 23: left hip, 24: right hip
  const ls = landmarks[11], rs = landmarks[12];
  const lh = landmarks[23], rh = landmarks[24];
  if (!ls || !rs || !lh || !rh) return null;

  // Mid-shoulder and mid-hip positions
  const midShoulder = {
    x: (ls.x + rs.x) / 2,
    y: (ls.y + rs.y) / 2,
    z: ((ls.z ?? 0) + (rs.z ?? 0)) / 2,
  };
  const midHip = {
    x: (lh.x + rh.x) / 2,
    y: (lh.y + rh.y) / 2,
    z: ((lh.z ?? 0) + (rh.z ?? 0)) / 2,
  };

  // Trunk vector (from midHip to midShoulder)
  const dx = midShoulder.x - midHip.x;
  const dy = midShoulder.y - midHip.y; // note: screen coordinates y increases downwards
  const dz = midShoulder.z - midHip.z;

  const trunkLenNorm = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (trunkLenNorm < 0.05) return null;

  // L5/S1 joint center is approximately 18% along the trunk axis from midHip towards shoulders
  const l5s1Point = {
    x: midHip.x + 0.18 * dx,
    y: midHip.y + 0.18 * dy,
    z: midHip.z + 0.18 * dz,
  };

  // Trunk angle relative to vertical (gravity axis is vertical)
  // In normalized image coords, dy < 0 when shoulders are above hips
  // trunkAngle = 0° when perfectly vertical, 90° when horizontal
  const horizontalDisp = Math.sqrt(dx * dx + dz * dz);
  const verticalDisp = Math.abs(dy);
  const trunkAngleRad = Math.atan2(horizontalDisp, verticalDisp);
  const trunkAngleDeg = Math.round(trunkAngleRad * (180 / Math.PI) * 10) / 10;

  // Real-world human torso length scaling:
  // Average human torso length from L5/S1 to C7/T1 is ~0.48 m for a 1.75m individual
  const torsoRealM = 0.48;

  // Segment mass of HAT (Head, Arms, Torso)
  const hatMassKg = bodyMassKg * HAT_MASS_RATIO;
  const hatWeightN = hatMassKg * (GRAVITY_M_S2 + accelY);

  // Load mass (from parameter or default for lift archetype)
  const liftKey = (lift || '').toLowerCase();
  let defaultLoad = 0;
  for (const [k, v] of Object.entries(DEFAULT_LIFT_LOAD_KG)) {
    if (liftKey.includes(k)) {
      defaultLoad = v;
      break;
    }
  }
  const loadKg = input.loadKg !== undefined ? input.loadKg : defaultLoad;
  const loadWeightN = loadKg * (GRAVITY_M_S2 + accelY);

  // Moment arms from L5/S1 to HAT CoM and Load
  // HAT CoM is at HAT_COM_RATIO along the trunk from L5/S1
  const hatMomentArmM = torsoRealM * HAT_COM_RATIO * Math.sin(trunkAngleRad);

  // External load moment arm:
  // For squat/overhead: load is near shoulders/cervical spine (~0.85 * torsoRealM * sin(theta))
  // For deadlift/curl: load is in hands, which hang vertically or slightly anterior
  const isBackLoaded = liftKey.includes('squat') || liftKey.includes('overhead');
  const isDeadliftHinge = liftKey.includes('deadlift') || liftKey.includes('rdl') || liftKey.includes('row');
  const loadMomentArmRatio = isBackLoaded ? 0.85 : isDeadliftHinge ? 0.70 : 0.50;
  const loadMomentArmM = torsoRealM * loadMomentArmRatio * Math.sin(trunkAngleRad);

  // Net reaction torque M_{L5S1} (N·m)
  const reactionTorqueNm = Math.round((hatWeightN * hatMomentArmM) + (loadWeightN * loadMomentArmM));

  // Required erector spinae muscle force F_{erector}
  // M_{L5S1} = F_{erector} * d_{muscle}  =>  F_{erector} = M_{L5S1} / d_{muscle}
  const erectorSpinaeForceN = Math.round(reactionTorqueNm / ERECTOR_MOMENT_ARM_M);

  // Compressive force F_{comp} (parallel to lumbar spine):
  // F_{comp} = F_{erector} + (W_{HAT} + W_{load}) * cos(trunkAngle)
  const compressiveForceN = Math.round(
    erectorSpinaeForceN + (hatWeightN + loadWeightN) * Math.cos(trunkAngleRad)
  );

  // Anterior-posterior shear force F_{shear} (perpendicular to lumbar spine):
  // F_{shear} = (W_{HAT} + W_{load}) * sin(trunkAngle)
  const shearForceN = Math.round((hatWeightN + loadWeightN) * Math.sin(trunkAngleRad));

  // Clinical Safety Classification
  let safetyTier: LumbarSafetyTier = 'optimal';
  let frAdvice = 'Alignement vertébral optimal\u00A0: cisaillement minime sur L5/S1.';
  let enAdvice = 'Optimal spinal alignment: minimal shear on L5/S1 disc.';

  if (shearForceN >= MCGILL_SHEAR_SAFETY_LIMIT_N || compressiveForceN >= NIOSH_ACTION_LIMIT_COMP_N) {
    safetyTier = 'high_shear_risk';
    frAdvice = 'Alerte cisaillement lombaire (>500 N)\u00A0: redressez le buste, fixez la cage thoracique et engagez les fessiers.';
    enAdvice = 'Lumbar shear warning (>500 N): maintain upright torso, brace core, and engage glutes.';
  } else if (shearForceN >= 350 || compressiveForceN >= 2500) {
    safetyTier = 'moderate';
    frAdvice = 'Charge lombaire modérée\u00A0: veillez au maintien de la courbure lordotique neutre.';
    enAdvice = 'Moderate lumbar load: maintain neutral lordotic spine curvature.';
  }

  return {
    trunkAngleDeg,
    l5s1Point,
    momentArmM: Math.round(hatMomentArmM * 100) / 100,
    reactionTorqueNm,
    erectorSpinaeForceN,
    compressiveForceN,
    shearForceN,
    safetyTier,
    advice: {
      fr: frAdvice,
      en: enAdvice,
    },
  };
}
