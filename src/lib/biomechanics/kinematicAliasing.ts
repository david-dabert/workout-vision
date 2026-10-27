/**
 * Kinematic Machine Aliasing Engine
 * 
 * Maps commercial gym equipment, lever machines, and exercise aliases to their
 * underlying biomechanical archetypes with fixed-plane and pad constraints.
 * 
 * Solves the commercial gym gap where lifters train on pendulum squats, hack squats,
 * belt squats, seal rows, and preacher curls whose guided trajectories differ from
 * free barbell mechanics (e.g. eliminating ankle landmark jumps in deep machine flexion).
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type MachineType = 
  | 'pendulum_arc'       // e.g. Pendulum squat, lever row
  | 'linear_sled_45'     // e.g. 45° Hack squat, 45° Leg press
  | 'linear_vertical'    // e.g. Smith machine
  | 'lever_platform'     // e.g. Belt squat
  | 'chest_supported'    // e.g. Seal row, chest-supported T-bar
  | 'arm_supported'      // e.g. Preacher curl, spider curl
  | 'free_planar';       // e.g. Barbell squat, dumbbell curl

export type MovementArchetype =
  | 'squat'
  | 'hinge'
  | 'horizontal_press'
  | 'vertical_press'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'isolation_biceps'
  | 'isolation_triceps'
  | 'isolation_quads'
  | 'isolation_hamstrings'
  | 'isolation_calves';

export interface KinematicMachineProfile {
  key: string;
  aliases: string[];
  canonicalNameEn: string;
  canonicalNameFr: string;
  archetype: MovementArchetype;
  machineType: MachineType;
  primaryJoint: 'knee' | 'hip' | 'elbow' | 'shoulder' | 'ankle';
  fixedSegment?: 'torso_guided' | 'torso_fixed' | 'sternum_fixed' | 'humerus_fixed' | 'pelvis_loaded';
  restPosition: 'high' | 'low';
  optimalStretchAngle: number; // In degrees: minimum (or maximum) joint threshold for deep stretch
  momentumJerkTolerance: number; // Max deg/s^2 before flag as ballistic rebound
  clampAnkleJump: boolean; // Clamp false ankle detections in deep machine sleds
  nominalPadAngleDeg?: number; // e.g. 45 for hack squat, 50 for preacher
}

/**
 * Verified dictionary of gym machine aliases and kinematics
 */
export const KINEMATIC_MACHINE_REGISTRY: Record<string, KinematicMachineProfile> = {
  pendulum_squat: {
    key: 'pendulum_squat',
    aliases: ['pendulum', 'squat_pendule', 'lever_squat', 'pendulum_machine'],
    canonicalNameEn: 'Pendulum Squat',
    canonicalNameFr: 'Squat pendulaire',
    archetype: 'squat',
    machineType: 'pendulum_arc',
    primaryJoint: 'knee',
    fixedSegment: 'torso_guided',
    restPosition: 'high',
    optimalStretchAngle: 80, // Knee flexion < 80° (deep stretch)
    momentumJerkTolerance: 450,
    clampAnkleJump: true,
  },
  hack_squat: {
    key: 'hack_squat',
    aliases: ['hack', 'hack_machine', 'sled_squat', 'squat_guide_incline'],
    canonicalNameEn: 'Hack Squat',
    canonicalNameFr: 'Hack Squat',
    archetype: 'squat',
    machineType: 'linear_sled_45',
    primaryJoint: 'knee',
    fixedSegment: 'torso_fixed',
    restPosition: 'high',
    optimalStretchAngle: 75,
    momentumJerkTolerance: 420,
    clampAnkleJump: true,
    nominalPadAngleDeg: 45,
  },
  leg_press: {
    key: 'leg_press',
    aliases: ['presse_cuisses', '45_leg_press', 'incline_leg_press', 'horizontal_leg_press'],
    canonicalNameEn: 'Leg Press',
    canonicalNameFr: 'Presse à cuisses',
    archetype: 'squat',
    machineType: 'linear_sled_45',
    primaryJoint: 'knee',
    fixedSegment: 'torso_fixed',
    restPosition: 'high',
    optimalStretchAngle: 80,
    momentumJerkTolerance: 400,
    clampAnkleJump: true,
    nominalPadAngleDeg: 45,
  },
  belt_squat: {
    key: 'belt_squat',
    aliases: ['squat_ceinture', 'squat_sans_rachis', 'pit_shark'],
    canonicalNameEn: 'Belt Squat',
    canonicalNameFr: 'Squat à la ceinture',
    archetype: 'squat',
    machineType: 'lever_platform',
    primaryJoint: 'knee',
    fixedSegment: 'pelvis_loaded',
    restPosition: 'high',
    optimalStretchAngle: 85,
    momentumJerkTolerance: 480,
    clampAnkleJump: false,
  },
  smith_squat: {
    key: 'smith_squat',
    aliases: ['smith_machine_squat', 'squat_cadre_guide', 'multipower_squat'],
    canonicalNameEn: 'Smith Machine Squat',
    canonicalNameFr: 'Squat au cadre guidé',
    archetype: 'squat',
    machineType: 'linear_vertical',
    primaryJoint: 'knee',
    restPosition: 'high',
    optimalStretchAngle: 85,
    momentumJerkTolerance: 500,
    clampAnkleJump: false,
  },
  seal_row: {
    key: 'seal_row',
    aliases: ['rowing_banc_horizontal', 'chinese_row', 'prone_bench_row'],
    canonicalNameEn: 'Seal Row',
    canonicalNameFr: 'Rowing Seal',
    archetype: 'horizontal_pull',
    machineType: 'chest_supported',
    primaryJoint: 'elbow',
    fixedSegment: 'sternum_fixed',
    restPosition: 'low',
    optimalStretchAngle: 155, // Full elbow extension + scapular protraction
    momentumJerkTolerance: 350,
    clampAnkleJump: false,
  },
  machine_chest_supported_row: {
    key: 'machine_chest_supported_row',
    aliases: ['t_bar_chest_supported', 'rowing_buste_appuie', 'machine_row'],
    canonicalNameEn: 'Chest-Supported Machine Row',
    canonicalNameFr: 'Tirage machine buste appuyé',
    archetype: 'horizontal_pull',
    machineType: 'chest_supported',
    primaryJoint: 'elbow',
    fixedSegment: 'sternum_fixed',
    restPosition: 'low',
    optimalStretchAngle: 150,
    momentumJerkTolerance: 380,
    clampAnkleJump: false,
  },
  preacher_curl: {
    key: 'preacher_curl',
    aliases: ['larry_scott', 'curl_pupitre', 'biceps_pupitre', 'scott_curl'],
    canonicalNameEn: 'Preacher Curl',
    canonicalNameFr: 'Curl au pupitre',
    archetype: 'isolation_biceps',
    machineType: 'arm_supported',
    primaryJoint: 'elbow',
    fixedSegment: 'humerus_fixed',
    restPosition: 'low',
    optimalStretchAngle: 160, // Maximum lengthening on biceps brachii
    momentumJerkTolerance: 300,
    clampAnkleJump: false,
    nominalPadAngleDeg: 50,
  },
  leg_extension: {
    key: 'leg_extension',
    aliases: ['extension_cuisses', 'quad_extension', 'machine_leg_extension'],
    canonicalNameEn: 'Leg Extension',
    canonicalNameFr: 'Leg Extension',
    archetype: 'isolation_quads',
    machineType: 'pendulum_arc',
    primaryJoint: 'knee',
    fixedSegment: 'torso_fixed',
    restPosition: 'low',
    optimalStretchAngle: 90, // Knee flexion at 90° for rectus femoris pre-stretch
    momentumJerkTolerance: 350,
    clampAnkleJump: false,
  },
  lying_leg_curl: {
    key: 'lying_leg_curl',
    aliases: ['leg_curl_allonge', 'ischios_allonge', 'hamstring_curl'],
    canonicalNameEn: 'Lying Leg Curl',
    canonicalNameFr: 'Leg Curl allongé',
    archetype: 'isolation_hamstrings',
    machineType: 'pendulum_arc',
    primaryJoint: 'knee',
    fixedSegment: 'torso_fixed',
    restPosition: 'low',
    optimalStretchAngle: 165, // Full extension without hyper-extension
    momentumJerkTolerance: 320,
    clampAnkleJump: false,
  },
};

/**
 * Standard fallback for unconstrained free-weight squats
 */
const DEFAULT_FREE_SQUAT: KinematicMachineProfile = {
  key: 'barbell_squat',
  aliases: ['squat', 'back_squat', 'front_squat'],
  canonicalNameEn: 'Barbell Squat',
  canonicalNameFr: 'Squat à la barre',
  archetype: 'squat',
  machineType: 'free_planar',
  primaryJoint: 'knee',
  restPosition: 'high',
  optimalStretchAngle: 85,
  momentumJerkTolerance: 520,
  clampAnkleJump: false,
};

/**
 * Resolves any exercise key or free-text name to its verified kinematic profile.
 */
export function resolveKinematicAlias(queryOrKey: string): KinematicMachineProfile {
  if (!queryOrKey) return DEFAULT_FREE_SQUAT;
  
  const normalized = queryOrKey.toLowerCase().replace(/[-\s]/g, '_').trim();
  
  // Direct key lookup
  if (KINEMATIC_MACHINE_REGISTRY[normalized]) {
    return KINEMATIC_MACHINE_REGISTRY[normalized];
  }
  
  // Alias search
  for (const profile of Object.values(KINEMATIC_MACHINE_REGISTRY)) {
    if (profile.aliases.some(alias => normalized.includes(alias) || alias.includes(normalized))) {
      return profile;
    }
  }

  // Substring heuristic matching
  if (normalized.includes('pendulum')) return KINEMATIC_MACHINE_REGISTRY.pendulum_squat;
  if (normalized.includes('hack')) return KINEMATIC_MACHINE_REGISTRY.hack_squat;
  if (normalized.includes('press') && (normalized.includes('leg') || normalized.includes('cuisse'))) return KINEMATIC_MACHINE_REGISTRY.leg_press;
  if (normalized.includes('belt') && normalized.includes('squat')) return KINEMATIC_MACHINE_REGISTRY.belt_squat;
  if (normalized.includes('seal') && normalized.includes('row')) return KINEMATIC_MACHINE_REGISTRY.seal_row;
  if (normalized.includes('preacher') || normalized.includes('scott')) return KINEMATIC_MACHINE_REGISTRY.preacher_curl;
  if (normalized.includes('smith')) return KINEMATIC_MACHINE_REGISTRY.smith_squat;

  return DEFAULT_FREE_SQUAT;
}

/**
 * Corrects raw vision landmarks by enforcing machine constraints.
 * 
 * Specifically addresses the known failure mode on pendulum squats and hack squats where
 * deep knee flexion causes the vision model to confuse the footplate or ankle landmark
 * and project it near the lifter's hip or head (resulting in spurious double peaks).
 */
export function correctMachineLandmarks(
  landmarks: LandmarkPoint[],
  profile: KinematicMachineProfile,
  baselineFootplateY?: number
): { corrected: LandmarkPoint[]; wasClamped: boolean } {
  if (!landmarks || landmarks.length < 33) {
    return { corrected: landmarks, wasClamped: false };
  }

  const result = landmarks.map(lm => ({ ...lm }));
  let wasClamped = false;

  // MediaPipe pose landmark indices:
  // 23: Left Hip, 24: Right Hip
  // 25: Left Knee, 26: Right Knee
  // 27: Left Ankle, 28: Right Ankle
  // 29: Left Heel, 30: Right Heel
  // 31: Left Foot Index, 32: Right Foot Index

  if (profile.clampAnkleJump && baselineFootplateY != null) {
    const leftAnkle = result[27];
    const rightAnkle = result[28];
    const midHipY = (result[23].y + result[24].y) / 2;

    // In a deep squat or leg press, hips descend (y increases in screen space).
    // If an ankle landmark y jumps upward (y decreases) above mid-hip or moves > 0.15 screen
    // height away from the solid footplate baseline, clamp it to the footplate plane.
    const maxAnkleJumpThreshold = 0.12;

    if (leftAnkle && (leftAnkle.y < baselineFootplateY - maxAnkleJumpThreshold || leftAnkle.y < midHipY)) {
      leftAnkle.y = baselineFootplateY;
      if (result[29]) result[29].y = baselineFootplateY;
      if (result[31]) result[31].y = baselineFootplateY;
      wasClamped = true;
    }

    if (rightAnkle && (rightAnkle.y < baselineFootplateY - maxAnkleJumpThreshold || rightAnkle.y < midHipY)) {
      rightAnkle.y = baselineFootplateY;
      if (result[30]) result[30].y = baselineFootplateY;
      if (result[32]) result[32].y = baselineFootplateY;
      wasClamped = true;
    }
  }

  // Preacher curl constraint: Upper arm (humerus) should not rotate through shoulder cheating
  if (profile.machineType === 'arm_supported' && profile.fixedSegment === 'humerus_fixed') {
    // 11: Left Shoulder, 13: Left Elbow
    // 12: Right Shoulder, 14: Right Elbow
    const leftShoulder = result[11];
    const leftElbow = result[13];
    if (leftShoulder && leftElbow && profile.nominalPadAngleDeg) {
      // Ensure elbow stays below and forward of shoulder without unnatural vertical translation
      if (leftElbow.y < leftShoulder.y + 0.05) {
        leftElbow.y = leftShoulder.y + 0.15;
        wasClamped = true;
      }
    }
  }

  return { corrected: result, wasClamped };
}

/**
 * Calculates joint 3D or 2D angle between three points (A -> B -> C, with B as vertex).
 * Returns angle in degrees [0, 180].
 */
export function calculateJointAngle(a: LandmarkPoint, b: LandmarkPoint, c: LandmarkPoint): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 * mag2 === 0) return 180;

  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosTheta) * (180 / Math.PI);
}
