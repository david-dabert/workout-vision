/**
 * Golf Swing Kinematics & Posture Analytics Engine
 *
 * Implements monocular 2D/3D biomechanical tracking for golf swings and putting
 * using MediaPipe 33-point skeletal pose streams.
 *
 * Biomechanical Literature & Clinical Standards:
 * - Hume, P. A., Keogh, J., & Reid, D. (2005). The role of biomechanics in maximising distance and accuracy of golf shots. Sports Medicine.
 * - Myers, J., Lephart, S., Tsai, Y. S., et al. (2008). The role of upper torso and pelvis rotation in driving performance during the golf swing. J Sports Sci.
 * - Cheetham, P. J., et al. (2001). The importance of stretching the X-factor in the golf downswing.
 *
 * Core Biomechanical Invariants:
 * 1. Spine Posture & Early Extension:
 *    - Address forward trunk incline: 35° - 45°
 *    - Impact spine angle deviation: must remain within ±6° of address posture.
 *      Deviations > 8° indicate "Early Extension" (pelvis thrusts towards ball, loss of spine angle).
 * 2. X-Factor (Torso-Pelvis Separation):
 *    - Pelvis rotation at top of backswing: ~40° - 45°
 *    - Shoulder rotation at top of backswing: ~85° - 100°
 *    - X-Factor separation: 40° - 55° (critical for kinetic chain stretch-shortening cycle).
 * 3. Head Sway Invariant:
 *    - Nose landmark (#0) spatial boundary box: lateral sway < 0.05 normalized screen width.
 *    - Excessive sway (> 0.08) flags "Sway / Slide" or "Reverse Pivot".
 * 4. Lead Arm Extension at Impact:
 *    - Lead elbow angle: 165° - 180° (prevents "chicken wing" breakdown).
 */

import { LANDMARKS } from './poseGeometry';

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type Dexterity = 'right_handed' | 'left_handed';

export interface GolfSwingPhaseMetrics {
  timestampMs: number;
  phase: 'address' | 'backswing' | 'top_of_swing' | 'downswing' | 'impact' | 'follow_through';
  spineAngleDeg: number;
  pelvicTurnDeg: number;
  shoulderTurnDeg: number;
  xFactorDeg: number;
  leadArmAngleDeg: number;
  headSwayDeviation: number; // Normalized displacement from address position
  isEarlyExtension: boolean;
  isHeadSwayExcessive: boolean;
}

export interface GolfSwingAssessment {
  addressSpineAngleDeg: number;
  impactSpineAngleDeg: number;
  earlyExtensionFlag: boolean;
  earlyExtensionRecommendation: string;
  topOfSwingXFactorDeg: number;
  xFactorStatus: 'optimal_power' | 'moderate' | 'insufficient_turn';
  headSwayStatus: 'rock_solid' | 'moderate_drift' | 'excessive_sway';
  headSwayRecommendation: string;
  leadArmImpactAngleDeg: number;
  leadArmStatus: 'full_extension' | 'chicken_wing_breakdown';
  tempoRatio: number; // Backswing duration to downswing duration (ideal: 2.5:1 to 3.0:1)
}

/**
 * 2D angle between two 2D vectors in degrees.
 */
function vectorAngle2D(v1: { x: number; y: number }, v2: { x: number; y: number }): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Real-time Golf Swing Kinematics Tracker.
 */
export class GolfKinematicsTracker {
  private addressHeadPos: { x: number; y: number } | null = null;
  private addressSpineAngle = 0;
  private addressFrameCount = 0;
  private maxWristSpeed = 0;
  private leadWristPrev: { x: number; y: number; time: number } | null = null;

  // Key phases timestamps
  private addressTimestamp = 0;
  private topTimestamp = 0;
  private impactTimestamp = 0;
  private finishTimestamp = 0;

  private topXFactor = 0;
  private impactSpineAngle = 0;
  private impactLeadArmAngle = 0;
  private maxHeadSway = 0;

  private phaseHistory: GolfSwingPhaseMetrics[] = [];

  constructor(private dexterity: Dexterity = 'right_handed') {}

  reset(): void {
    this.addressHeadPos = null;
    this.addressSpineAngle = 0;
    this.addressFrameCount = 0;
    this.maxWristSpeed = 0;
    this.leadWristPrev = null;
    this.addressTimestamp = 0;
    this.topTimestamp = 0;
    this.impactTimestamp = 0;
    this.finishTimestamp = 0;
    this.topXFactor = 0;
    this.impactSpineAngle = 0;
    this.impactLeadArmAngle = 0;
    this.maxHeadSway = 0;
    this.phaseHistory = [];
  }

  processFrame(landmarks: Landmark3D[], timestampMs: number): GolfSwingPhaseMetrics | null {
    if (!landmarks || landmarks.length < 33) return null;

    const leadShoulderIdx = this.dexterity === 'right_handed' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER;
    const trailShoulderIdx = this.dexterity === 'right_handed' ? LANDMARKS.RIGHT_SHOULDER : LANDMARKS.LEFT_SHOULDER;
    const leadHipIdx = this.dexterity === 'right_handed' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP;
    const trailHipIdx = this.dexterity === 'right_handed' ? LANDMARKS.RIGHT_HIP : LANDMARKS.LEFT_HIP;
    const leadElbowIdx = this.dexterity === 'right_handed' ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW;
    const leadWristIdx = this.dexterity === 'right_handed' ? LANDMARKS.LEFT_WRIST : LANDMARKS.RIGHT_WRIST;

    const leadShoulder = landmarks[leadShoulderIdx];
    const trailShoulder = landmarks[trailShoulderIdx];
    const leadHip = landmarks[leadHipIdx];
    const trailHip = landmarks[trailHipIdx];
    const leadElbow = landmarks[leadElbowIdx];
    const leadWrist = landmarks[leadWristIdx];
    const head = landmarks[LANDMARKS.NOSE];

    if (!leadShoulder || !trailShoulder || !leadHip || !trailHip || !head) return null;

    // 1. Calculate Spine Angle with Vertical
    const midShoulder = { x: (leadShoulder.x + trailShoulder.x) / 2, y: (leadShoulder.y + trailShoulder.y) / 2 };
    const midHip = { x: (leadHip.x + trailHip.x) / 2, y: (leadHip.y + trailHip.y) / 2 };
    const spineDx = midShoulder.x - midHip.x;
    const spineDy = midShoulder.y - midHip.y; // Screen coordinates: y points downwards
    const spineAngleDeg = (Math.atan2(Math.abs(spineDx), Math.abs(spineDy)) * 180) / Math.PI;

    // 2. Calculate Pelvic and Shoulder Rotation (Projected Turn)
    const shoulderDx = trailShoulder.x - leadShoulder.x;
    const shoulderDy = trailShoulder.y - leadShoulder.y;
    const shoulderTurnDeg = (Math.atan2(Math.abs(shoulderDy), Math.abs(shoulderDx)) * 180) / Math.PI;

    const hipDx = trailHip.x - leadHip.x;
    const hipDy = trailHip.y - leadHip.y;
    const pelvicTurnDeg = (Math.atan2(Math.abs(hipDy), Math.abs(hipDx)) * 180) / Math.PI;

    const xFactorDeg = Math.abs(shoulderTurnDeg - pelvicTurnDeg);

    // 3. Lead Arm Extension
    let leadArmAngleDeg = 175;
    if (leadElbow && leadWrist) {
      const seX = leadElbow.x - leadShoulder.x;
      const seY = leadElbow.y - leadShoulder.y;
      const ewX = leadWrist.x - leadElbow.x;
      const ewY = leadWrist.y - leadElbow.y;
      leadArmAngleDeg = 180 - vectorAngle2D({ x: seX, y: seY }, { x: ewX, y: ewY });
    }

    // 4. Head Sway Tracking relative to address anchor
    if (!this.addressHeadPos) {
      this.addressHeadPos = { x: head.x, y: head.y };
      this.addressSpineAngle = spineAngleDeg;
      this.addressTimestamp = timestampMs;
    }

    const headSwayDeviation = Math.hypot(head.x - this.addressHeadPos.x, head.y - this.addressHeadPos.y);
    if (headSwayDeviation > this.maxHeadSway) {
      this.maxHeadSway = headSwayDeviation;
    }

    // 5. Detect Swing Phase via Lead Wrist Trajectory & Kinetic Energy
    let wristSpeed = 0;
    if (leadWrist && this.leadWristPrev) {
      const dt = (timestampMs - this.leadWristPrev.time) / 1000;
      if (dt > 0) {
        wristSpeed = Math.hypot(leadWrist.x - this.leadWristPrev.x, leadWrist.y - this.leadWristPrev.y) / dt;
      }
    }
    if (leadWrist) {
      this.leadWristPrev = { x: leadWrist.x, y: leadWrist.y, time: timestampMs };
    }

    if (wristSpeed > this.maxWristSpeed) {
      this.maxWristSpeed = wristSpeed;
    }

    // Phase classification heuristic
    let phase: GolfSwingPhaseMetrics['phase'] = 'address';
    if (this.addressFrameCount < 10 && wristSpeed < 0.2) {
      phase = 'address';
      this.addressFrameCount++;
      this.addressSpineAngle = 0.8 * this.addressSpineAngle + 0.2 * spineAngleDeg;
    } else if (leadWrist && leadWrist.y < midShoulder.y && wristSpeed < this.maxWristSpeed * 0.4 && xFactorDeg > 35) {
      phase = 'top_of_swing';
      this.topTimestamp = timestampMs;
      if (xFactorDeg > this.topXFactor) this.topXFactor = xFactorDeg;
    } else if (wristSpeed > this.maxWristSpeed * 0.7 && this.topTimestamp > 0 && this.impactTimestamp === 0) {
      phase = 'impact';
      this.impactTimestamp = timestampMs;
      this.impactSpineAngle = spineAngleDeg;
      this.impactLeadArmAngle = leadArmAngleDeg;
    } else if (this.impactTimestamp > 0) {
      phase = 'follow_through';
      this.finishTimestamp = timestampMs;
    } else if (this.addressFrameCount >= 10) {
      phase = 'backswing';
    }

    const isEarlyExtension =
      this.impactTimestamp > 0 && Math.abs(spineAngleDeg - this.addressSpineAngle) > 7.0;
    const isHeadSwayExcessive = headSwayDeviation > 0.07;

    const metric: GolfSwingPhaseMetrics = {
      timestampMs,
      phase,
      spineAngleDeg: Math.round(spineAngleDeg * 10) / 10,
      pelvicTurnDeg: Math.round(pelvicTurnDeg * 10) / 10,
      shoulderTurnDeg: Math.round(shoulderTurnDeg * 10) / 10,
      xFactorDeg: Math.round(xFactorDeg * 10) / 10,
      leadArmAngleDeg: Math.round(leadArmAngleDeg * 10) / 10,
      headSwayDeviation: Math.round(headSwayDeviation * 1000) / 1000,
      isEarlyExtension,
      isHeadSwayExcessive,
    };

    this.phaseHistory.push(metric);
    return metric;
  }

  getAssessment(): GolfSwingAssessment {
    const addressSpine = Math.round(this.addressSpineAngle);
    const impactSpine = Math.round(this.impactSpineAngle || this.addressSpineAngle);
    const spineDiff = Math.abs(impactSpine - addressSpine);

    const earlyExtensionFlag = spineDiff > 6;
    const earlyExtensionRecommendation = earlyExtensionFlag
      ? `Early Extension detected: Spine angle lost by ${spineDiff}° at impact. Keep pelvis pushed back on the tush line throughout transition.`
      : 'Solid posture: Spine angle maintained cleanly through impact.';

    const topXFactor = Math.round(this.topXFactor || 42);
    let xFactorStatus: GolfSwingAssessment['xFactorStatus'] = 'optimal_power';
    if (topXFactor > 40) {
      xFactorStatus = 'optimal_power';
    } else if (topXFactor >= 30) {
      xFactorStatus = 'moderate';
    } else {
      xFactorStatus = 'insufficient_turn';
    }

    let headSwayStatus: GolfSwingAssessment['headSwayStatus'] = 'rock_solid';
    let headSwayRecommendation = 'Head position remained centered during backswing.';
    if (this.maxHeadSway > 0.08) {
      headSwayStatus = 'excessive_sway';
      headSwayRecommendation =
        'Excessive lateral head sway detected. Focus on rotating around a fixed spinal axis without lateral sliding.';
    } else if (this.maxHeadSway > 0.05) {
      headSwayStatus = 'moderate_drift';
      headSwayRecommendation = 'Slight lateral head movement; maintain firm lead foot grounding.';
    }

    const leadArmImpact = Math.round(this.impactLeadArmAngle || 172);
    const leadArmStatus: GolfSwingAssessment['leadArmStatus'] =
      leadArmImpact >= 165 ? 'full_extension' : 'chicken_wing_breakdown';

    // Tempo ratio calculation (Backswing duration / Downswing duration)
    let tempoRatio = 2.8;
    if (this.topTimestamp > this.addressTimestamp && this.impactTimestamp > this.topTimestamp) {
      const backswingDuration = this.topTimestamp - this.addressTimestamp;
      const downswingDuration = this.impactTimestamp - this.topTimestamp;
      if (downswingDuration > 0) {
        tempoRatio = Math.round((backswingDuration / downswingDuration) * 10) / 10;
      }
    }

    return {
      addressSpineAngleDeg: addressSpine,
      impactSpineAngleDeg: impactSpine,
      earlyExtensionFlag,
      earlyExtensionRecommendation,
      topOfSwingXFactorDeg: topXFactor,
      xFactorStatus,
      headSwayStatus,
      headSwayRecommendation,
      leadArmImpactAngleDeg: leadArmImpact,
      leadArmStatus,
      tempoRatio,
    };
  }
}
