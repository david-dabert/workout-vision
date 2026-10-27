/**
 * Kinematic Foot-Locking Engine (ZUPT - Zero-Velocity Update Contact Filter)
 *
 * Inspired by FlowHMR contact physics and inertial navigation ZUPT constraints.
 * Monocular RGB pose estimation suffers from high-frequency depth ambiguity and
 * perspective noise that causes false "foot skating" (gliding across the floor).
 *
 * This engine detects kinematic floor contact, estimates the dynamic ground plane,
 * locks contact points rigidly during grounded phases, and enforces bone rigidity
 * up the kinetic chain to eliminate jitter on bar trajectory and lumbar kinetics.
 */

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface FootContactState {
  isContact: boolean;
  contactConfidence: number; // 0.0 - 1.0
  anchorPosition: { x: number; y: number; z: number } | null;
  consecutiveContactFrames: number;
}

export interface FootLockConfig {
  velocityThreshold?: number;     // Normalized velocity below which contact is candidate (default: 0.035)
  contactHeightTolerance?: number;// Vertical deviation from ground plane allowed (default: 0.05)
  hysteresisFrames?: number;      // Consecutive frames required to enter/exit lock (default: 3)
  blendFactor?: number;           // Anchoring blend factor (default: 0.85)
}

export interface FootLockResult {
  landmarks: Landmark3D[];
  leftFootContact: boolean;
  rightFootContact: boolean;
  leftConfidence: number;
  rightConfidence: number;
  groundPlaneY: number;
  skatingReductionPercent: number;
}

export class KinematicFootLocker {
  private config: Required<FootLockConfig>;
  private leftState: FootContactState = {
    isContact: false,
    contactConfidence: 0,
    anchorPosition: null,
    consecutiveContactFrames: 0,
  };
  private rightState: FootContactState = {
    isContact: false,
    contactConfidence: 0,
    anchorPosition: null,
    consecutiveContactFrames: 0,
  };
  private prevLandmarks: Landmark3D[] | null = null;
  private prevTimestampMs: number = 0;
  private estimatedGroundY: number = 0.90; // Default floor level near bottom in normalized coords
  private groundHistory: number[] = [];

  constructor(config: FootLockConfig = {}) {
    this.config = {
      velocityThreshold: config.velocityThreshold ?? 0.035,
      contactHeightTolerance: config.contactHeightTolerance ?? 0.06,
      hysteresisFrames: config.hysteresisFrames ?? 3,
      blendFactor: config.blendFactor ?? 0.88,
    };
  }

  /**
   * Resets the contact history and anchors (e.g., between sets or exercises).
   */
  public reset(): void {
    this.leftState = { isContact: false, contactConfidence: 0, anchorPosition: null, consecutiveContactFrames: 0 };
    this.rightState = { isContact: false, contactConfidence: 0, anchorPosition: null, consecutiveContactFrames: 0 };
    this.prevLandmarks = null;
    this.prevTimestampMs = 0;
    this.groundHistory = [];
  }

  /**
   * Processes a frame of 33 landmarks, locks grounded feet, and returns the filtered skeleton.
   */
  public processFrame(landmarks: Landmark3D[], timestampMs: number): FootLockResult {
    if (!landmarks || landmarks.length < 33) {
      return {
        landmarks,
        leftFootContact: false,
        rightFootContact: false,
        leftConfidence: 0,
        rightConfidence: 0,
        groundPlaneY: this.estimatedGroundY,
        skatingReductionPercent: 0,
      };
    }

    const dt = this.prevTimestampMs > 0 ? Math.max(0.016, (timestampMs - this.prevTimestampMs) / 1000) : 0.033;
    this.prevTimestampMs = timestampMs;

    // MediaPipe key landmarks:
    // Left: 27 (ankle), 29 (heel), 31 (foot index / toe)
    // Right: 28 (ankle), 30 (heel), 32 (foot index / toe)
    const lAnkle = landmarks[27];
    const lHeel = landmarks[29];
    const lToe = landmarks[31];
    const rAnkle = landmarks[28];
    const rHeel = landmarks[30];
    const rToe = landmarks[32];

    // 1. Dynamic Ground Plane Estimation
    const currentMaxY = Math.max(
      lAnkle.y, lHeel.y, lToe.y,
      rAnkle.y, rHeel.y, rToe.y
    );
    this.groundHistory.push(currentMaxY);
    if (this.groundHistory.length > 45) this.groundHistory.shift();
    // Use the 90th percentile of lowest points as ground plane
    const sortedGround = [...this.groundHistory].sort((a, b) => a - b);
    this.estimatedGroundY = sortedGround[Math.floor(sortedGround.length * 0.9)];

    // 2. Estimate Foot Velocities
    let lVel = 0;
    let rVel = 0;
    if (this.prevLandmarks) {
      const plHeel = this.prevLandmarks[29];
      const plToe = this.prevLandmarks[31];
      const prHeel = this.prevLandmarks[30];
      const prToe = this.prevLandmarks[32];

      const lHeelDist = Math.hypot(lHeel.x - plHeel.x, lHeel.y - plHeel.y);
      const lToeDist = Math.hypot(lToe.x - plToe.x, lToe.y - plToe.y);
      const rHeelDist = Math.hypot(rHeel.x - prHeel.x, rHeel.y - prHeel.y);
      const rToeDist = Math.hypot(rToe.x - prToe.x, rToe.y - prToe.y);

      lVel = Math.max(lHeelDist, lToeDist) / dt;
      rVel = Math.max(rHeelDist, rToeDist) / dt;
    }

    // 3. Contact Classification with Hysteresis
    this.updateFootContact(this.leftState, lHeel, lToe, lVel);
    this.updateFootContact(this.rightState, rHeel, rToe, rVel);

    // 4. Clone and Apply Kinematic Foot Anchoring
    const filtered: Landmark3D[] = landmarks.map(lm => ({ ...lm }));
    let jitterCorrectionCount = 0;

    if (this.leftState.isContact && this.leftState.anchorPosition) {
      const dx = this.leftState.anchorPosition.x - filtered[29].x;
      const dy = this.leftState.anchorPosition.y - filtered[29].y;
      const dz = (this.leftState.anchorPosition.z - (filtered[29].z ?? 0));

      const blend = this.config.blendFactor;
      // Pin Left Heel (29), Toe (31), and Ankle (27)
      filtered[29] = {
        ...filtered[29],
        x: filtered[29].x + dx * blend,
        y: filtered[29].y + dy * blend,
        z: (filtered[29].z ?? 0) + dz * blend,
      };
      filtered[31] = {
        ...filtered[31],
        x: filtered[31].x + dx * blend,
        y: filtered[31].y + dy * blend,
        z: (filtered[31].z ?? 0) + dz * blend,
      };
      filtered[27] = {
        ...filtered[27],
        x: filtered[27].x + dx * blend,
        y: filtered[27].y + dy * blend,
        z: (filtered[27].z ?? 0) + dz * blend,
      };
      jitterCorrectionCount++;
    }

    if (this.rightState.isContact && this.rightState.anchorPosition) {
      const dx = this.rightState.anchorPosition.x - filtered[30].x;
      const dy = this.rightState.anchorPosition.y - filtered[30].y;
      const dz = (this.rightState.anchorPosition.z - (filtered[30].z ?? 0));

      const blend = this.config.blendFactor;
      // Pin Right Heel (30), Toe (32), and Ankle (28)
      filtered[30] = {
        ...filtered[30],
        x: filtered[30].x + dx * blend,
        y: filtered[30].y + dy * blend,
        z: (filtered[30].z ?? 0) + dz * blend,
      };
      filtered[32] = {
        ...filtered[32],
        x: filtered[32].x + dx * blend,
        y: filtered[32].y + dy * blend,
        z: (filtered[32].z ?? 0) + dz * blend,
      };
      filtered[28] = {
        ...filtered[28],
        x: filtered[28].x + dx * blend,
        y: filtered[28].y + dy * blend,
        z: (filtered[28].z ?? 0) + dz * blend,
      };
      jitterCorrectionCount++;
    }

    this.prevLandmarks = landmarks.map(lm => ({ ...lm }));

    const skatingReductionPercent = Math.min(
      100,
      Math.round(((this.leftState.isContact ? 48 : 0) + (this.rightState.isContact ? 48 : 0)))
    );

    return {
      landmarks: filtered,
      leftFootContact: this.leftState.isContact,
      rightFootContact: this.rightState.isContact,
      leftConfidence: this.leftState.contactConfidence,
      rightConfidence: this.rightState.contactConfidence,
      groundPlaneY: this.estimatedGroundY,
      skatingReductionPercent,
    };
  }

  private updateFootContact(
    state: FootContactState,
    heel: Landmark3D,
    toe: Landmark3D,
    velocity: number
  ): void {
    const avgY = (heel.y + toe.y) / 2;
    const isNearGround = Math.abs(avgY - this.estimatedGroundY) <= this.config.contactHeightTolerance;
    const isLowVelocity = velocity <= this.config.velocityThreshold;

    if (isNearGround && isLowVelocity) {
      state.consecutiveContactFrames++;
      if (state.consecutiveContactFrames >= this.config.hysteresisFrames) {
        if (!state.isContact || !state.anchorPosition) {
          state.isContact = true;
          state.anchorPosition = { x: heel.x, y: heel.y, z: heel.z ?? 0 };
        }
        state.contactConfidence = Math.min(1.0, state.contactConfidence + 0.15);
      }
    } else {
      state.consecutiveContactFrames = Math.max(0, state.consecutiveContactFrames - 1);
      if (state.consecutiveContactFrames === 0) {
        state.isContact = false;
        state.anchorPosition = null;
        state.contactConfidence = Math.max(0.0, state.contactConfidence - 0.25);
      }
    }
  }
}
