/**
 * Ground-Contact Invariance & Floor-Plane Stabilization Engine
 *
 * Inspired by monocular 3D Human Mesh Recovery systems (e.g. toyxyz_RGBMocap, FlowHMR, GVHMR).
 * In single-camera pose estimation, depth uncertainty frequently introduces "foot sliding",
 * floor sinking, and high-frequency z-depth jitter.
 *
 * This module detects foot contact states ('STANCE' vs 'SWING'), dynamically computes
 * the supporting ground plane, and applies kinematic contact constraints that anchor
 * planted feet, producing rock-solid 3D mocap visualization and reliable bar/joint kinematics.
 */

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type ContactState = 'STANCE' | 'SWING' | 'LIFT_OFF' | 'TOUCH_DOWN';

export interface FootContactInfo {
  state: ContactState;
  speed: number;
  isGrounded: boolean;
  contactY: number;
}

export interface GroundContactResult {
  leftFoot: FootContactInfo;
  rightFoot: FootContactInfo;
  estimatedGroundY: number;
  stabilizedLandmarks: Landmark3D[];
}

export interface GroundStabilizationOptions {
  /** Maximum speed (normalized units per frame) to qualify as stationary stance */
  velocityThreshold?: number;
  /** Smoothing factor for ground plane estimation [0, 1] */
  groundSmoothingAlpha?: number;
  /** Fix heel and toe exactly to ground plane during stance */
  lockStanceToGround?: boolean;
}

// MediaPipe BlazePose Landmark Indices
const FOOT_INDICES = {
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_TOE: 31,
  RIGHT_TOE: 32,
};

const DEFAULT_OPTIONS: Required<GroundStabilizationOptions> = {
  velocityThreshold: 0.045,
  groundSmoothingAlpha: 0.25,
  lockStanceToGround: true,
};

/**
 * Calculates 3D Euclidean distance between two points.
 */
function dist3D(p1: Landmark3D, p2: Landmark3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Detects foot contact status and applies ground-plane stabilization to a single frame
 * given an optional preceding frame for velocity estimation.
 */
export function stabilizeFrameGroundContact(
  current: Landmark3D[],
  previous: Landmark3D[] | null = null,
  knownGroundY: number | null = null,
  opts: GroundStabilizationOptions = {}
): GroundContactResult {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  if (!current || current.length < 33) {
    return {
      leftFoot: { state: 'SWING', speed: 1, isGrounded: false, contactY: 1.0 },
      rightFoot: { state: 'SWING', speed: 1, isGrounded: false, contactY: 1.0 },
      estimatedGroundY: knownGroundY ?? 1.0,
      stabilizedLandmarks: current ? [...current] : [],
    };
  }

  // Extract raw contact points
  const lHeel = current[FOOT_INDICES.LEFT_HEEL];
  const lToe = current[FOOT_INDICES.LEFT_TOE];
  const rHeel = current[FOOT_INDICES.RIGHT_HEEL];
  const rToe = current[FOOT_INDICES.RIGHT_TOE];

  // Measure instantaneous speeds if previous frame exists
  let lSpeed = 0;
  let rSpeed = 0;

  if (previous && previous.length >= 33) {
    const prevLHeel = previous[FOOT_INDICES.LEFT_HEEL];
    const prevLToe = previous[FOOT_INDICES.LEFT_TOE];
    const prevRHeel = previous[FOOT_INDICES.RIGHT_HEEL];
    const prevRToe = previous[FOOT_INDICES.RIGHT_TOE];

    lSpeed = (dist3D(lHeel, prevLHeel) + dist3D(lToe, prevLToe)) / 2;
    rSpeed = (dist3D(rHeel, prevRHeel) + dist3D(rToe, prevRToe)) / 2;
  }

  const lGrounded = lSpeed <= options.velocityThreshold;
  const rGrounded = rSpeed <= options.velocityThreshold;

  // Compute lowest candidate y (in image coordinates, positive y is downward toward floor)
  const lLowest = Math.max(lHeel.y, lToe.y);
  const rLowest = Math.max(rHeel.y, rToe.y);

  let frameGroundCandidates: number[] = [];
  if (lGrounded) frameGroundCandidates.push(lLowest);
  if (rGrounded) frameGroundCandidates.push(rLowest);

  // Fallback to whichever foot is lowest if neither is strictly under threshold
  if (frameGroundCandidates.length === 0) {
    frameGroundCandidates.push(Math.max(lLowest, rLowest));
  }

  const rawGround = Math.max(...frameGroundCandidates);
  const estimatedGroundY = knownGroundY !== null
    ? knownGroundY + options.groundSmoothingAlpha * (rawGround - knownGroundY)
    : rawGround;

  const leftState: ContactState = lGrounded ? 'STANCE' : 'SWING';
  const rightState: ContactState = rGrounded ? 'STANCE' : 'SWING';

  // Produce stabilized cloned landmarks
  const stabilizedLandmarks: Landmark3D[] = current.map((lm) => ({ ...lm }));

  if (options.lockStanceToGround) {
    if (lGrounded) {
      const offset = estimatedGroundY - lLowest;
      stabilizedLandmarks[FOOT_INDICES.LEFT_HEEL].y += offset;
      stabilizedLandmarks[FOOT_INDICES.LEFT_TOE].y += offset;
      stabilizedLandmarks[FOOT_INDICES.LEFT_ANKLE].y += offset * 0.75;
      // Dampen z-depth jitter during stance
      if (previous && previous[FOOT_INDICES.LEFT_HEEL]) {
        const prevZ = previous[FOOT_INDICES.LEFT_HEEL].z ?? 0;
        stabilizedLandmarks[FOOT_INDICES.LEFT_HEEL].z = prevZ * 0.8 + (stabilizedLandmarks[FOOT_INDICES.LEFT_HEEL].z ?? 0) * 0.2;
      }
    }

    if (rGrounded) {
      const offset = estimatedGroundY - rLowest;
      stabilizedLandmarks[FOOT_INDICES.RIGHT_HEEL].y += offset;
      stabilizedLandmarks[FOOT_INDICES.RIGHT_TOE].y += offset;
      stabilizedLandmarks[FOOT_INDICES.RIGHT_ANKLE].y += offset * 0.75;
      // Dampen z-depth jitter during stance
      if (previous && previous[FOOT_INDICES.RIGHT_HEEL]) {
        const prevZ = previous[FOOT_INDICES.RIGHT_HEEL].z ?? 0;
        stabilizedLandmarks[FOOT_INDICES.RIGHT_HEEL].z = prevZ * 0.8 + (stabilizedLandmarks[FOOT_INDICES.RIGHT_HEEL].z ?? 0) * 0.2;
      }
    }
  }

  return {
    leftFoot: {
      state: leftState,
      speed: Number(lSpeed.toFixed(4)),
      isGrounded: lGrounded,
      contactY: Number(lLowest.toFixed(4)),
    },
    rightFoot: {
      state: rightState,
      speed: Number(rSpeed.toFixed(4)),
      isGrounded: rGrounded,
      contactY: Number(rLowest.toFixed(4)),
    },
    estimatedGroundY: Number(estimatedGroundY.toFixed(4)),
    stabilizedLandmarks,
  };
}

/**
 * Stabilizes an entire sequential video/mocap trajectory by chaining ground contact constraints.
 */
export function stabilizeMotionSequence(
  frames: Landmark3D[][],
  opts: GroundStabilizationOptions = {}
): Landmark3D[][] {
  if (!Array.isArray(frames) || frames.length === 0) return [];

  const stabilizedSequence: Landmark3D[][] = [];
  let currentGround: number | null = null;
  let previousRaw: Landmark3D[] | null = null;

  for (let i = 0; i < frames.length; i++) {
    const rawFrame = frames[i];
    const res = stabilizeFrameGroundContact(rawFrame, previousRaw, currentGround, opts);
    stabilizedSequence.push(res.stabilizedLandmarks);
    currentGround = res.estimatedGroundY;
    previousRaw = rawFrame;
  }

  return stabilizedSequence;
}
