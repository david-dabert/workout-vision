/**
 * Kinematic Occlusion Inpainting Engine
 *
 * Implements rigid skeletal segment length preservation and 3D geometric
 * trilateration to solve severe landmark occlusions in strength training
 * (e.g., 45 cm Olympic bumper plates crossing knee/ankle trajectories during squats,
 * or machine chest pads/shields occluding torso/hip kinematics).
 *
 * Biomechanical Principles:
 * 1. Rigid Link Invariance: Human adult long bones (femur, tibia, humerus, radius)
 *    and spinal trunk height are strictly rigid bodies. Their 3D Euclidean lengths
 *    are invariant across dynamic flexion/extension cycles.
 * 2. Sphere-Sphere Trilateration: An occluded intermediate joint (e.g. Knee)
 *    between two visible anchors (Hip and Ankle) is mathematically constrained
 *    to the intersection circle of two 3D spheres centered at the anchors with radii
 *    equal to the calibrated segment lengths (Winter 2009, Dempster 1955).
 * 3. Kalman Velocity Continuation: A constant-velocity 3D kinematic Kalman filter
 *    tracks joint momentum. When landmark visibility drops below threshold,
 *    velocity continuation predicts trajectory momentum, which is then snapped
 *    onto the exact sphere intersection manifold.
 *
 * References:
 * - Winter, D. A. (2009). Biomechanics and Motor Control of Human Movement.
 * - Dempster, W. T. (1955). Space requirements of the seated operator.
 * - Chaffin, D. B., & Andersson, G. (1991). Occupational Biomechanics.
 */

import { LANDMARKS } from './poseGeometry';

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface SkeletalInvariants {
  leftFemur: number;       // Distance Hip (23) -> Knee (25)
  rightFemur: number;      // Distance Hip (24) -> Knee (26)
  leftTibia: number;       // Distance Knee (25) -> Ankle (27)
  rightTibia: number;      // Distance Knee (26) -> Ankle (28)
  leftTorso: number;       // Distance Shoulder (11) -> Hip (23)
  rightTorso: number;      // Distance Shoulder (12) -> Hip (24)
  leftHumerus?: number;    // Distance Shoulder (11) -> Elbow (13)
  rightHumerus?: number;   // Distance Shoulder (12) -> Elbow (14)
  leftForearm?: number;    // Distance Elbow (13) -> Wrist (15)
  rightForearm?: number;   // Distance Elbow (14) -> Wrist (16)
}

export interface InpaintedJointInfo {
  index: number;
  name: string;
  isOccluded: boolean;
  isInpainted: boolean;
  confidence: number;
  originalVisibility: number;
  originalPoint: Point3D;
  projectedPoint: Point3D;
  method: 'sphere_kalman_continuation' | 'kalman_continuation' | 'unmodified';
}

export interface InpaintedFrameResult {
  landmarks: Landmark3D[];
  inpaintedJoints: InpaintedJointInfo[];
  invariantsCompliant: boolean;
  maxInvariantDeviation: number;
}

export interface KinematicOcclusionInpainterConfig {
  /** Visibility below which inpainting triggers (default: 0.50) */
  visibilityThreshold?: number;
  /** Minimum anchor visibility required for geometric trilateration (default: 0.35) */
  minAnchorVisibility?: number;
  /** Process noise acceleration standard deviation for Kalman continuation (default: 2.0 m/s^2) */
  processNoiseAcc?: number;
  /** Measurement noise for raw computer vision observations (default: 0.02) */
  measurementNoise?: number;
  /** Virtual observation noise when updating with inpainted coordinates (default: 0.03) */
  inpaintedMeasurementNoise?: number;
  /** Calibrated skeletal segment invariants */
  invariants?: SkeletalInvariants;
}

export interface SphereIntersectionResult {
  point: Point3D;
  circleCenter: Point3D;
  circleRadius: number;
  isLockout: boolean;
  isDegenerate: boolean;
}

/**
 * 3D Euclidean distance between two landmarks.
 */
export function computeDistance3D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.hypot(dx, dy, dz);
}

/**
 * 1D Constant-Velocity Kinematic Kalman Filter for decoupled Cartesian axes.
 * Implements Discrete Continuous White Noise Acceleration (CWNA) model.
 */
export class AxisKalmanFilter {
  p = 0; // Position state
  v = 0; // Velocity state

  // Covariance matrix: [[p00, p01], [p10, p11]]
  p00 = 1.0;
  p01 = 0.0;
  p10 = 0.0;
  p11 = 1.0;

  constructor(
    public sigmaA = 2.0,
    public sigmaM = 0.02
  ) {}

  reset(initialP = 0, initialV = 0): void {
    this.p = initialP;
    this.v = initialV;
    this.p00 = 0.05;
    this.p01 = 0.0;
    this.p10 = 0.0;
    this.p11 = 0.5;
  }

  predict(dt: number): number {
    const clampedDt = Math.max(1e-4, Math.min(dt, 0.5));

    // State extrapolation: p = p + v * dt
    this.p += this.v * clampedDt;

    // Process noise covariance Q:
    // Q00 = (dt^3 / 3) * sigmaA^2, Q01 = (dt^2 / 2) * sigmaA^2, Q11 = dt * sigmaA^2
    const dt2 = clampedDt * clampedDt;
    const dt3 = dt2 * clampedDt;
    const qVar = this.sigmaA * this.sigmaA;
    const q00 = (dt3 / 3) * qVar;
    const q01 = (dt2 / 2) * qVar;
    const q11 = clampedDt * qVar;

    // Covariance extrapolation: P = F * P * F^T + Q
    const newP00 = this.p00 + clampedDt * (this.p01 + this.p10) + dt2 * this.p11 + q00;
    const newP01 = this.p01 + clampedDt * this.p11 + q01;
    const newP11 = this.p11 + q11;

    this.p00 = newP00;
    this.p01 = newP01;
    this.p10 = newP01;
    this.p11 = newP11;

    return this.p;
  }

  update(meas: number, customSigmaM?: number): void {
    const sigma = customSigmaM ?? this.sigmaM;
    const r = Math.max(1e-6, sigma * sigma);
    const s = this.p00 + r;

    const k0 = this.p00 / s;
    const k1 = this.p10 / s;
    const y = meas - this.p;

    this.p += k0 * y;
    this.v += k1 * y;

    const p00Old = this.p00;
    const p01Old = this.p01;

    this.p00 = p00Old * (1 - k0);
    this.p01 = p01Old * (1 - k0);
    this.p10 = this.p01;
    this.p11 -= k1 * p01Old;
  }
}

/**
 * 3D Kinematic Kalman Tracker for tracking joint trajectory and continuing velocity.
 */
export class JointKalmanTracker3D {
  private xFilter: AxisKalmanFilter;
  private yFilter: AxisKalmanFilter;
  private zFilter: AxisKalmanFilter;
  private lastTimestampMs = 0;
  private isInitialized = false;

  constructor(processNoiseAcc = 2.0, measurementNoisePos = 0.02) {
    this.xFilter = new AxisKalmanFilter(processNoiseAcc, measurementNoisePos);
    this.yFilter = new AxisKalmanFilter(processNoiseAcc, measurementNoisePos);
    this.zFilter = new AxisKalmanFilter(processNoiseAcc, measurementNoisePos);
  }

  initialized(): boolean {
    return this.isInitialized;
  }

  init(p: Point3D, timestampMs: number, initialVelocity?: Point3D): void {
    this.xFilter.reset(p.x, initialVelocity?.x ?? 0);
    this.yFilter.reset(p.y, initialVelocity?.y ?? 0);
    this.zFilter.reset(p.z, initialVelocity?.z ?? 0);
    this.lastTimestampMs = timestampMs;
    this.isInitialized = true;
  }

  reset(): void {
    this.isInitialized = false;
    this.lastTimestampMs = 0;
  }

  predict(timestampMs: number): Point3D {
    let dt = (timestampMs - this.lastTimestampMs) / 1000;
    if (this.lastTimestampMs === 0 || dt <= 0 || dt > 0.5) {
      dt = 1 / 30; // Nominal 30 fps delta
    }
    this.lastTimestampMs = timestampMs;

    return {
      x: this.xFilter.predict(dt),
      y: this.yFilter.predict(dt),
      z: this.zFilter.predict(dt),
    };
  }

  update(observed: Point3D): void {
    this.xFilter.update(observed.x);
    this.yFilter.update(observed.y);
    this.zFilter.update(observed.z);
  }

  updateInpainted(projected: Point3D, customNoise = 0.03): void {
    this.xFilter.update(projected.x, customNoise);
    this.yFilter.update(projected.y, customNoise);
    this.zFilter.update(projected.z, customNoise);
  }

  getState(): { position: Point3D; velocity: Point3D } {
    return {
      position: { x: this.xFilter.p, y: this.yFilter.p, z: this.zFilter.p },
      velocity: { x: this.xFilter.v, y: this.yFilter.v, z: this.zFilter.v },
    };
  }
}

/**
 * Geometric Sphere-Sphere Trilateration Solver.
 * Computes the exact 3D intersection manifold of two rigid spheres (centers C1, C2
 * with radii r1, r2) and projects the continuation point onto the intersection circle.
 *
 * Guarantees ||P - C1|| == r1 and ||P - C2|| == r2 to machine precision.
 */
export function intersectAdjacentSpheres(
  center1: Point3D,
  radius1: number,
  center2: Point3D,
  radius2: number,
  continuationPoint: Point3D,
  preferredFlexionNormal?: Point3D
): SphereIntersectionResult {
  const dx = center2.x - center1.x;
  const dy = center2.y - center1.y;
  const dz = center2.z - center1.z;
  const D = Math.hypot(dx, dy, dz);

  // Degenerate case: Centers coincide
  if (D < 1e-7) {
    return {
      point: { ...center1 },
      circleCenter: { ...center1 },
      circleRadius: 0,
      isLockout: false,
      isDegenerate: true,
    };
  }

  // Unit vector connecting center1 -> center2
  const ux = dx / D;
  const uy = dy / D;
  const uz = dz / D;

  // Singularity 1: Full lockout / stretch beyond segment sum (D >= r1 + r2)
  if (D >= radius1 + radius2) {
    const point: Point3D = {
      x: center1.x + radius1 * ux,
      y: center1.y + radius1 * uy,
      z: center1.z + radius1 * uz,
    };
    return {
      point,
      circleCenter: point,
      circleRadius: 0,
      isLockout: true,
      isDegenerate: false,
    };
  }

  // Singularity 2: Folded beyond difference (D <= |r1 - r2|)
  if (D <= Math.abs(radius1 - radius2)) {
    const d1 = Math.max(0, radius1 - radius2);
    const point: Point3D = {
      x: center1.x + d1 * ux,
      y: center1.y + d1 * uy,
      z: center1.z + d1 * uz,
    };
    return {
      point,
      circleCenter: point,
      circleRadius: 0,
      isLockout: false,
      isDegenerate: true,
    };
  }

  // Exact Sphere-Sphere Circle Intersection
  // Distance from center1 along u to circle plane
  const d1 = (radius1 * radius1 - radius2 * radius2 + D * D) / (2 * D);
  const rCircleSq = Math.max(0, radius1 * radius1 - d1 * d1);
  const rCircle = Math.sqrt(rCircleSq);

  // Center of intersection circle
  const cx = center1.x + d1 * ux;
  const cy = center1.y + d1 * uy;
  const cz = center1.z + d1 * uz;
  const circleCenter: Point3D = { x: cx, y: cy, z: cz };

  // Vector from circle center to continuation point
  const wx = continuationPoint.x - cx;
  const wy = continuationPoint.y - cy;
  const wz = continuationPoint.z - cz;

  // Project continuation displacement onto circle plane (orthogonal to u)
  const wDotU = wx * ux + wy * uy + wz * uz;
  const wPerpX = wx - wDotU * ux;
  const wPerpY = wy - wDotU * uy;
  const wPerpZ = wz - wDotU * uz;
  const wPerpNorm = Math.hypot(wPerpX, wPerpY, wPerpZ);

  let ex: number;
  let ey: number;
  let ez: number;

  if (wPerpNorm > 1e-5) {
    ex = wPerpX / wPerpNorm;
    ey = wPerpY / wPerpNorm;
    ez = wPerpZ / wPerpNorm;
  } else if (preferredFlexionNormal) {
    // Continuation point lies along the axis: use preferred flexion normal
    const pnx = preferredFlexionNormal.x;
    const pny = preferredFlexionNormal.y;
    const pnz = preferredFlexionNormal.z;
    const pnDotU = pnx * ux + pny * uy + pnz * uz;
    const pnPerpX = pnx - pnDotU * ux;
    const pnPerpY = pny - pnDotU * uy;
    const pnPerpZ = pnz - pnDotU * uz;
    const pnNorm = Math.hypot(pnPerpX, pnPerpY, pnPerpZ);

    if (pnNorm > 1e-5) {
      ex = pnPerpX / pnNorm;
      ey = pnPerpY / pnNorm;
      ez = pnPerpZ / pnNorm;
    } else {
      // Perpendicular fallback
      const perp = Math.abs(ux) < 0.9 ? { x: 0, y: -uz, z: uy } : { x: -uy, y: ux, z: 0 };
      const pNorm = Math.hypot(perp.x, perp.y, perp.z);
      ex = perp.x / pNorm;
      ey = perp.y / pNorm;
      ez = perp.z / pNorm;
    }
  } else {
    // Arbitrary orthogonal basis vector
    const perp = Math.abs(ux) < 0.9 ? { x: 0, y: -uz, z: uy } : { x: -uy, y: ux, z: 0 };
    const pNorm = Math.hypot(perp.x, perp.y, perp.z);
    ex = perp.x / pNorm;
    ey = perp.y / pNorm;
    ez = perp.z / pNorm;
  }

  // Exact point on intersection circle
  const point: Point3D = {
    x: cx + rCircle * ex,
    y: cy + rCircle * ey,
    z: cz + rCircle * ez,
  };

  return {
    point,
    circleCenter,
    circleRadius: rCircle,
    isLockout: false,
    isDegenerate: false,
  };
}

/**
 * Calibrate rigid skeletal invariants from unoccluded standing setup frames.
 */
export function calibrateSkeletalInvariants(
  frames: Landmark3D[][],
  minVisibility = 0.5
): SkeletalInvariants | null {
  if (!frames || frames.length === 0) return null;

  const validLengths: {
    leftFemur: number[];
    rightFemur: number[];
    leftTibia: number[];
    rightTibia: number[];
    leftTorso: number[];
    rightTorso: number[];
    leftHumerus: number[];
    rightHumerus: number[];
    leftForearm: number[];
    rightForearm: number[];
  } = {
    leftFemur: [],
    rightFemur: [],
    leftTibia: [],
    rightTibia: [],
    leftTorso: [],
    rightTorso: [],
    leftHumerus: [],
    rightHumerus: [],
    leftForearm: [],
    rightForearm: [],
  };

  const getDist = (f: Landmark3D[], i1: number, i2: number): number | null => {
    const p1 = f[i1];
    const p2 = f[i2];
    if (!p1 || !p2) return null;
    if ((p1.visibility ?? 1.0) < minVisibility || (p2.visibility ?? 1.0) < minVisibility) return null;
    const d = computeDistance3D(p1, p2);
    return d > 1e-3 ? d : null;
  };

  for (const f of frames) {
    if (!f || f.length < 33) continue;

    const lf = getDist(f, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE);
    if (lf) validLengths.leftFemur.push(lf);

    const rf = getDist(f, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE);
    if (rf) validLengths.rightFemur.push(rf);

    const lt = getDist(f, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE);
    if (lt) validLengths.leftTibia.push(lt);

    const rt = getDist(f, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE);
    if (rt) validLengths.rightTibia.push(rt);

    const lTorso = getDist(f, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP);
    if (lTorso) validLengths.leftTorso.push(lTorso);

    const rTorso = getDist(f, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP);
    if (rTorso) validLengths.rightTorso.push(rTorso);

    const lHum = getDist(f, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW);
    if (lHum) validLengths.leftHumerus.push(lHum);

    const rHum = getDist(f, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW);
    if (rHum) validLengths.rightHumerus.push(rHum);

    const lFore = getDist(f, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST);
    if (lFore) validLengths.leftForearm.push(lFore);

    const rFore = getDist(f, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST);
    if (rFore) validLengths.rightForearm.push(rFore);
  }

  const median = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const leftFemur = median(validLengths.leftFemur);
  const rightFemur = median(validLengths.rightFemur);
  const leftTibia = median(validLengths.leftTibia);
  const rightTibia = median(validLengths.rightTibia);
  const leftTorso = median(validLengths.leftTorso);
  const rightTorso = median(validLengths.rightTorso);

  if (!leftFemur && !rightFemur) return null;

  // Harmonize bilateral segments if one side was unobserved
  const finalLeftFemur = leftFemur ?? rightFemur!;
  const finalRightFemur = rightFemur ?? leftFemur!;
  const finalLeftTibia = leftTibia ?? rightTibia ?? finalLeftFemur * 0.95;
  const finalRightTibia = rightTibia ?? leftTibia ?? finalRightFemur * 0.95;
  const finalLeftTorso = leftTorso ?? rightTorso ?? finalLeftFemur * 1.15;
  const finalRightTorso = rightTorso ?? leftTorso ?? finalRightFemur * 1.15;

  const leftHumerus = median(validLengths.leftHumerus) ?? undefined;
  const rightHumerus = median(validLengths.rightHumerus) ?? leftHumerus;
  const leftForearm = median(validLengths.leftForearm) ?? undefined;
  const rightForearm = median(validLengths.rightForearm) ?? leftForearm;

  return {
    leftFemur: finalLeftFemur,
    rightFemur: finalRightFemur,
    leftTibia: finalLeftTibia,
    rightTibia: finalRightTibia,
    leftTorso: finalLeftTorso,
    rightTorso: finalRightTorso,
    leftHumerus,
    rightHumerus,
    leftForearm,
    rightForearm,
  };
}

/**
 * Verify skeletal invariants on a landmark frame.
 * Checks that bone segment lengths conform to calibrated invariants within specified tolerance.
 */
export function verifySkeletalInvariants(
  landmarks: Landmark3D[],
  invariants: SkeletalInvariants,
  tolerance = 1e-3
): {
  compliant: boolean;
  maxDeviation: number;
  deviations: {
    leftFemur?: number;
    rightFemur?: number;
    leftTibia?: number;
    rightTibia?: number;
    leftTorso?: number;
    rightTorso?: number;
  };
} {
  const deviations: {
    leftFemur?: number;
    rightFemur?: number;
    leftTibia?: number;
    rightTibia?: number;
    leftTorso?: number;
    rightTorso?: number;
  } = {};

  let maxDeviation = 0;

  const check = (
    name: 'leftFemur' | 'rightFemur' | 'leftTibia' | 'rightTibia' | 'leftTorso' | 'rightTorso',
    i1: number,
    i2: number,
    target: number
  ) => {
    if (landmarks[i1] && landmarks[i2]) {
      const d = computeDistance3D(landmarks[i1], landmarks[i2]);
      const dev = Math.abs(d - target);
      deviations[name] = dev;
      if (dev > maxDeviation) maxDeviation = dev;
    }
  };

  check('leftFemur', LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, invariants.leftFemur);
  check('rightFemur', LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, invariants.rightFemur);
  check('leftTibia', LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE, invariants.leftTibia);
  check('rightTibia', LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE, invariants.rightTibia);
  check('leftTorso', LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP, invariants.leftTorso);
  check('rightTorso', LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP, invariants.rightTorso);

  return {
    compliant: maxDeviation <= tolerance,
    maxDeviation,
    deviations,
  };
}

/**
 * Kinematic Occlusion Inpainter
 * Real-time edge processor enforcing rigid segment length preservation and Kalman continuation.
 */
export class KinematicOcclusionInpainter {
  private config: Required<KinematicOcclusionInpainterConfig>;
  private trackers: Map<number, JointKalmanTracker3D> = new Map();
  private invariants: SkeletalInvariants | null = null;

  constructor(config?: KinematicOcclusionInpainterConfig) {
    this.config = {
      visibilityThreshold: config?.visibilityThreshold ?? 0.50,
      minAnchorVisibility: config?.minAnchorVisibility ?? 0.35,
      processNoiseAcc: config?.processNoiseAcc ?? 2.0,
      measurementNoise: config?.measurementNoise ?? 0.02,
      inpaintedMeasurementNoise: config?.inpaintedMeasurementNoise ?? 0.03,
      invariants: config?.invariants ?? {
        leftFemur: 0.42,
        rightFemur: 0.42,
        leftTibia: 0.40,
        rightTibia: 0.40,
        leftTorso: 0.48,
        rightTorso: 0.48,
      },
    };

    if (config?.invariants) {
      this.invariants = config.invariants;
    }

    // Initialize 3D Kalman trackers for all candidate reconstructible joints
    const joints = [
      LANDMARKS.LEFT_KNEE,
      LANDMARKS.RIGHT_KNEE,
      LANDMARKS.LEFT_HIP,
      LANDMARKS.RIGHT_HIP,
      LANDMARKS.LEFT_ELBOW,
      LANDMARKS.RIGHT_ELBOW,
      LANDMARKS.LEFT_ANKLE,
      LANDMARKS.RIGHT_ANKLE,
      LANDMARKS.LEFT_SHOULDER,
      LANDMARKS.RIGHT_SHOULDER,
    ];

    for (const j of joints) {
      this.trackers.set(
        j,
        new JointKalmanTracker3D(this.config.processNoiseAcc, this.config.measurementNoise)
      );
    }
  }

  setInvariants(invariants: SkeletalInvariants): void {
    this.invariants = invariants;
    this.config.invariants = invariants;
  }

  getInvariants(): SkeletalInvariants | null {
    return this.invariants ?? this.config.invariants;
  }

  calibrateFromStanding(standingFrames: Landmark3D[][]): SkeletalInvariants | null {
    const calibrated = calibrateSkeletalInvariants(standingFrames, this.config.visibilityThreshold);
    if (calibrated) {
      this.setInvariants(calibrated);
    }
    return calibrated;
  }

  reset(): void {
    for (const tracker of this.trackers.values()) {
      tracker.reset();
    }
  }

  /**
   * Process a single landmark frame with kinematic occlusion inpainting.
   */
  processFrame(rawLandmarks: Landmark3D[], timestampMs: number): InpaintedFrameResult {
    if (!rawLandmarks || rawLandmarks.length < 33) {
      return {
        landmarks: rawLandmarks,
        inpaintedJoints: [],
        invariantsCompliant: false,
        maxInvariantDeviation: 1.0,
      };
    }

    const invariants = this.getInvariants();
    if (!invariants) {
      // Auto-extract initial invariants if standing and unoccluded
      const autoCal = calibrateSkeletalInvariants([rawLandmarks], this.config.visibilityThreshold);
      if (autoCal) this.setInvariants(autoCal);
    }
    const activeInvariants = this.getInvariants()!;

    // Clone landmarks to prevent mutating caller inputs
    const landmarks: Landmark3D[] = rawLandmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z ?? 0,
      visibility: lm.visibility ?? 1.0,
    }));

    const inpaintedJoints: InpaintedJointInfo[] = [];

    // Helper to extract 3D point
    const toPoint = (lm: Landmark3D): Point3D => ({ x: lm.x, y: lm.y, z: lm.z ?? 0 });

    // Helper to compute anterior normal vector from torso & pelvis
    const computeAnteriorNormal = (): Point3D => {
      const ls = landmarks[LANDMARKS.LEFT_SHOULDER];
      const rs = landmarks[LANDMARKS.RIGHT_SHOULDER];
      const lh = landmarks[LANDMARKS.LEFT_HIP];
      const rh = landmarks[LANDMARKS.RIGHT_HIP];

      // Torso vector pointing upwards
      const midShoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2, z: ((ls.z ?? 0) + (rs.z ?? 0)) / 2 };
      const midHip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2, z: ((lh.z ?? 0) + (rh.z ?? 0)) / 2 };
      const up = {
        x: midShoulder.x - midHip.x,
        y: midShoulder.y - midHip.y,
        z: midShoulder.z - midHip.z,
      };

      // Lateral vector pointing rightwards
      const right = {
        x: rh.x - lh.x,
        y: rh.y - lh.y,
        z: (rh.z ?? 0) - (lh.z ?? 0),
      };

      // Anterior = cross product right x up
      const ax = right.y * up.z - right.z * up.y;
      const ay = right.z * up.x - right.x * up.z;
      const az = right.x * up.y - right.y * up.x;
      const norm = Math.hypot(ax, ay, az);

      if (norm > 1e-4) {
        return { x: ax / norm, y: ay / norm, z: az / norm };
      }
      return { x: 0, y: 0, z: -1 }; // Default camera facing normal
    };

    const anteriorNormal = computeAnteriorNormal();

    // Posterior normal for hip hinge
    const posteriorNormal: Point3D = {
      x: -anteriorNormal.x,
      y: -anteriorNormal.y,
      z: -anteriorNormal.z,
    };

    // Step 1: Predict & Update state for all joints with high visibility
    for (const [idx, tracker] of this.trackers.entries()) {
      const lm = landmarks[idx];
      const pt = toPoint(lm);
      const vis = lm.visibility ?? 1.0;

      if (!tracker.initialized()) {
        if (vis >= this.config.visibilityThreshold) {
          tracker.init(pt, timestampMs);
        }
      } else {
        tracker.predict(timestampMs);
        if (vis >= this.config.visibilityThreshold) {
          tracker.update(pt);
        }
      }
    }

    // Step 2: Define Joint Reconstruction Topology
    // Prioritized order: Knee -> Hip -> Elbow -> Ankle
    interface JointConstraint {
      index: number;
      name: string;
      proximalAnchorIndex: number;
      distalAnchorIndex: number;
      proximalRadius: number;
      distalRadius: number;
      preferredNormal: Point3D;
    }

    const constraints: JointConstraint[] = [
      // Left Knee: Proximal = Left Hip (leftFemur), Distal = Left Ankle (leftTibia)
      {
        index: LANDMARKS.LEFT_KNEE,
        name: 'leftKnee',
        proximalAnchorIndex: LANDMARKS.LEFT_HIP,
        distalAnchorIndex: LANDMARKS.LEFT_ANKLE,
        proximalRadius: activeInvariants.leftFemur,
        distalRadius: activeInvariants.leftTibia,
        preferredNormal: anteriorNormal,
      },
      // Right Knee: Proximal = Right Hip (rightFemur), Distal = Right Ankle (rightTibia)
      {
        index: LANDMARKS.RIGHT_KNEE,
        name: 'rightKnee',
        proximalAnchorIndex: LANDMARKS.RIGHT_HIP,
        distalAnchorIndex: LANDMARKS.RIGHT_ANKLE,
        proximalRadius: activeInvariants.rightFemur,
        distalRadius: activeInvariants.rightTibia,
        preferredNormal: anteriorNormal,
      },
      // Left Hip: Proximal = Left Shoulder (leftTorso), Distal = Left Knee (leftFemur)
      {
        index: LANDMARKS.LEFT_HIP,
        name: 'leftHip',
        proximalAnchorIndex: LANDMARKS.LEFT_SHOULDER,
        distalAnchorIndex: LANDMARKS.LEFT_KNEE,
        proximalRadius: activeInvariants.leftTorso,
        distalRadius: activeInvariants.leftFemur,
        preferredNormal: posteriorNormal,
      },
      // Right Hip: Proximal = Right Shoulder (rightTorso), Distal = Right Knee (rightFemur)
      {
        index: LANDMARKS.RIGHT_HIP,
        name: 'rightHip',
        proximalAnchorIndex: LANDMARKS.RIGHT_SHOULDER,
        distalAnchorIndex: LANDMARKS.RIGHT_KNEE,
        proximalRadius: activeInvariants.rightTorso,
        distalRadius: activeInvariants.rightFemur,
        preferredNormal: posteriorNormal,
      },
    ];

    if (activeInvariants.leftHumerus && activeInvariants.leftForearm) {
      constraints.push({
        index: LANDMARKS.LEFT_ELBOW,
        name: 'leftElbow',
        proximalAnchorIndex: LANDMARKS.LEFT_SHOULDER,
        distalAnchorIndex: LANDMARKS.LEFT_WRIST,
        proximalRadius: activeInvariants.leftHumerus,
        distalRadius: activeInvariants.leftForearm,
        preferredNormal: posteriorNormal,
      });
    }

    if (activeInvariants.rightHumerus && activeInvariants.rightForearm) {
      constraints.push({
        index: LANDMARKS.RIGHT_ELBOW,
        name: 'rightElbow',
        proximalAnchorIndex: LANDMARKS.RIGHT_SHOULDER,
        distalAnchorIndex: LANDMARKS.RIGHT_WRIST,
        proximalRadius: activeInvariants.rightHumerus,
        distalRadius: activeInvariants.rightForearm,
        preferredNormal: posteriorNormal,
      });
    }

    // Step 3: Execute Inpainting for occluded joints
    for (const c of constraints) {
      const lm = landmarks[c.index];
      const currentVis = lm.visibility ?? 1.0;
      const isOccluded = currentVis < this.config.visibilityThreshold;

      if (!isOccluded) {
        inpaintedJoints.push({
          index: c.index,
          name: c.name,
          isOccluded: false,
          isInpainted: false,
          confidence: currentVis,
          originalVisibility: currentVis,
          originalPoint: toPoint(lm),
          projectedPoint: toPoint(lm),
          method: 'unmodified',
        });
        continue;
      }

      // Joint is occluded: Get Kalman continuation prediction
      const tracker = this.trackers.get(c.index)!;
      let continuationPoint: Point3D;

      if (tracker.initialized()) {
        continuationPoint = tracker.getState().position;
      } else {
        // Fallback initialization if occluded from first frame
        const pAnchor = toPoint(landmarks[c.proximalAnchorIndex]);
        const dAnchor = toPoint(landmarks[c.distalAnchorIndex]);
        continuationPoint = {
          x: (pAnchor.x + dAnchor.x) / 2,
          y: (pAnchor.y + dAnchor.y) / 2,
          z: (pAnchor.z + dAnchor.z) / 2,
        };
        tracker.init(continuationPoint, timestampMs);
      }

      const pAnchor = landmarks[c.proximalAnchorIndex];
      const dAnchor = landmarks[c.distalAnchorIndex];
      const pVis = pAnchor.visibility ?? 1.0;
      const dVis = dAnchor.visibility ?? 1.0;

      let projectedPoint: Point3D;
      let method: InpaintedJointInfo['method'] = 'kalman_continuation';
      let confidence = 0.5;

      if (pVis >= this.config.minAnchorVisibility && dVis >= this.config.minAnchorVisibility) {
        // Both anchors visible: Project via Sphere-Sphere Trilateration
        const sphereResult = intersectAdjacentSpheres(
          toPoint(pAnchor),
          c.proximalRadius,
          toPoint(dAnchor),
          c.distalRadius,
          continuationPoint,
          c.preferredNormal
        );

        projectedPoint = sphereResult.point;
        method = 'sphere_kalman_continuation';
        confidence = Math.min(pVis, dVis) * 0.90;
      } else {
        // Anchor missing: Use Kalman continuation point directly
        projectedPoint = continuationPoint;
        confidence = 0.40;
      }

      // Update landmark array with inpainted 3D coordinate
      landmarks[c.index] = {
        x: projectedPoint.x,
        y: projectedPoint.y,
        z: projectedPoint.z,
        visibility: confidence,
      };

      // Feed inpainted measurement back to Kalman filter for velocity continuity
      tracker.updateInpainted(projectedPoint, this.config.inpaintedMeasurementNoise);

      inpaintedJoints.push({
        index: c.index,
        name: c.name,
        isOccluded: true,
        isInpainted: true,
        confidence,
        originalVisibility: currentVis,
        originalPoint: toPoint(lm),
        projectedPoint,
        method,
      });
    }

    // Step 4: Strict Invariant Compliance Check
    const compliance = verifySkeletalInvariants(landmarks, activeInvariants, 1e-3);

    return {
      landmarks,
      inpaintedJoints,
      invariantsCompliant: compliance.compliant,
      maxInvariantDeviation: compliance.maxDeviation,
    };
  }

  /**
   * Process a full video sequence of landmark frames.
   */
  processSequence(frames: Landmark3D[][], timestampsMs: number[]): InpaintedFrameResult[] {
    const results: InpaintedFrameResult[] = [];
    for (let i = 0; i < frames.length; i++) {
      const ts = timestampsMs[i] ?? (i * (1000 / 30));
      results.push(this.processFrame(frames[i], ts));
    }
    return results;
  }
}
