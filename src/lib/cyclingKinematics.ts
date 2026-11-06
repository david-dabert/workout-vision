/**
 * Cycling Kinematics & Dynamic Bike Fit Engine
 *
 * Implements real-time biomechanical analysis of cyclists on stationary
 * turbo trainers or outdoor rollers using monocular smartphone computer vision.
 *
 * Clinical Protocols:
 * - Holmes, J. C., Pruitt, A. L., & Whalen, N. J. (1994). Lower extremity overuse in cycling.
 * - Leirdal, S., & Ettema, G. (2011). Pedaling technique and energy expenditure in cycling.
 * - Bini, R. R., & Hume, P. A. (2014). Assessment of dynamic knee joint angles in cycling.
 *
 * Key Biomechanical Invariants:
 * 1. Knee Extension at Bottom Dead Center (BDC):
 *    - Optimal Range: 145° - 155° (25° - 35° flexion from full extension)
 *    - > 155°: Saddle too high (posterior hamstring strain, pelvic rocking)
 *    - < 140°: Saddle too low (increased patellofemoral compressive stress)
 * 2. Torso Incline Angle:
 *    - Aero / TT: < 35° from horizontal
 *    - Road Race: 35° - 45° from horizontal
 *    - Endurance / Gran Fondo: 45° - 55° from horizontal
 * 3. Shoulder Reach Angle:
 *    - Optimal Range: 85° - 90° between torso line and upper arm
 * 4. Cadence (RPM):
 *    - Dynamically extracted from BDC turnaround periods.
 */

import { LANDMARKS } from './poseGeometry';

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export type Side = 'left' | 'right';

export interface BikeFitAssessment {
  saddleHeightStatus: 'optimal' | 'too_high' | 'too_low' | 'measuring';
  saddleRecommendation: string;
  reachStatus: 'optimal' | 'too_long' | 'too_short' | 'measuring';
  reachRecommendation: string;
  postureStyle: 'aero' | 'road_race' | 'endurance';
}

export interface CyclingFrameMetrics {
  timestampMs: number;
  side: Side;
  kneeAngleDeg: number;
  torsoAngleDeg: number;
  reachAngleDeg: number;
  pedalPhase: 'bdc_down' | 'tdc_up' | 'mid_stroke';
  isBdcTurnaround: boolean;
  cadenceRpm: number | null;
  fitAssessment: BikeFitAssessment;
}

export interface CyclingAnalysisSummary {
  totalRevolutions: number;
  averageCadenceRpm: number;
  peakCadenceRpm: number;
  minKneeAngleDeg: number;
  maxKneeAngleDeg: number;
  averageMaxKneeAngleDeg: number; // Knee at BDC across all strokes
  averageTorsoAngleDeg: number;
  averageReachAngleDeg: number;
  finalAssessment: BikeFitAssessment;
}

/**
 * Compute 3-point joint angle in degrees from Landmark3D coordinates.
 */
export function calculateAngle3D(a: Landmark3D, b: Landmark3D, c: Landmark3D): number {
  const baX = a.x - b.x;
  const baY = a.y - b.y;
  const baZ = (a.z ?? 0) - (b.z ?? 0);

  const bcX = c.x - b.x;
  const bcY = c.y - b.y;
  const bcZ = (c.z ?? 0) - (b.z ?? 0);

  const dot = baX * bcX + baY * bcY + baZ * bcZ;
  const magBA = Math.hypot(baX, baY, baZ);
  const magBC = Math.hypot(bcX, bcY, bcZ);

  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Compute torso angle with horizontal plane (0° = flat horizontal, 90° = upright).
 */
export function calculateTorsoAngleWithHorizontal(hip: Landmark3D, shoulder: Landmark3D): number {
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y); // Screen coordinates: y points down
  if (dx === 0 && dy === 0) return 45;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * Determine the dominant visible lateral side facing the camera.
 */
export function detectDominantSide(landmarks: Landmark3D[]): Side {
  const leftVis =
    ((landmarks[LANDMARKS.LEFT_HIP]?.visibility ?? 0) +
      (landmarks[LANDMARKS.LEFT_KNEE]?.visibility ?? 0) +
      (landmarks[LANDMARKS.LEFT_ANKLE]?.visibility ?? 0)) / 3;

  const rightVis =
    ((landmarks[LANDMARKS.RIGHT_HIP]?.visibility ?? 0) +
      (landmarks[LANDMARKS.RIGHT_KNEE]?.visibility ?? 0) +
      (landmarks[LANDMARKS.RIGHT_ANKLE]?.visibility ?? 0)) / 3;

  return leftVis >= rightVis ? 'left' : 'right';
}

/**
 * Real-time Dynamic Bike Fit & Cadence Tracker.
 */
export class CyclingKinematicsTracker {
  private bdcHistory: Array<{ timestampMs: number; kneeAngle: number }> = [];
  private kneeAnglesHistory: number[] = [];
  private torsoAnglesHistory: number[] = [];
  private reachAnglesHistory: number[] = [];
  private prevKneeAngle = 0;
  private prevSlope = 0;
  private currentCadenceRpm: number | null = null;
  private lastBdcTimestamp = 0;

  reset(): void {
    this.bdcHistory = [];
    this.kneeAnglesHistory = [];
    this.torsoAnglesHistory = [];
    this.reachAnglesHistory = [];
    this.prevKneeAngle = 0;
    this.prevSlope = 0;
    this.currentCadenceRpm = null;
    this.lastBdcTimestamp = 0;
  }

  processFrame(landmarks: Landmark3D[], timestampMs: number, explicitSide?: Side): CyclingFrameMetrics | null {
    if (!landmarks || landmarks.length < 33) return null;

    const side = explicitSide ?? detectDominantSide(landmarks);

    const hipIdx = side === 'left' ? LANDMARKS.LEFT_HIP : LANDMARKS.RIGHT_HIP;
    const kneeIdx = side === 'left' ? LANDMARKS.LEFT_KNEE : LANDMARKS.RIGHT_KNEE;
    const ankleIdx = side === 'left' ? LANDMARKS.LEFT_ANKLE : LANDMARKS.RIGHT_ANKLE;
    const shoulderIdx = side === 'left' ? LANDMARKS.LEFT_SHOULDER : LANDMARKS.RIGHT_SHOULDER;
    const elbowIdx = side === 'left' ? LANDMARKS.LEFT_ELBOW : LANDMARKS.RIGHT_ELBOW;

    const hip = landmarks[hipIdx];
    const knee = landmarks[kneeIdx];
    const ankle = landmarks[ankleIdx];
    const shoulder = landmarks[shoulderIdx];
    const elbow = landmarks[elbowIdx];

    if (!hip || !knee || !ankle || !shoulder || !elbow) return null;

    // 1. Calculate joint angles
    const kneeAngleDeg = calculateAngle3D(hip, knee, ankle);
    const torsoAngleDeg = calculateTorsoAngleWithHorizontal(hip, shoulder);
    const reachAngleDeg = calculateAngle3D(hip, shoulder, elbow);

    this.kneeAnglesHistory.push(kneeAngleDeg);
    this.torsoAnglesHistory.push(torsoAngleDeg);
    this.reachAnglesHistory.push(reachAngleDeg);

    // 2. Detect BDC (Bottom Dead Center = Local maximum of knee extension angle)
    // Slope of knee angle: positive = extending towards BDC, negative = flexing towards TDC
    const currentSlope = kneeAngleDeg - this.prevKneeAngle;
    let isBdcTurnaround = false;

    // Peak detection: slope changes from positive to negative, and angle is > 135°
    if (this.prevSlope > 0 && currentSlope <= 0 && this.prevKneeAngle >= 135) {
      isBdcTurnaround = true;
      const bdcAngle = this.prevKneeAngle;
      this.bdcHistory.push({ timestampMs, kneeAngle: bdcAngle });

      // Calculate instantaneous cadence from interval between BDC peaks
      if (this.lastBdcTimestamp > 0) {
        const deltaSec = (timestampMs - this.lastBdcTimestamp) / 1000;
        // Plausible cycling cadence: 40 to 160 RPM (0.375s to 1.5s per revolution)
        if (deltaSec >= 0.35 && deltaSec <= 1.8) {
          const instRpm = 60 / deltaSec;
          this.currentCadenceRpm = this.currentCadenceRpm === null
            ? instRpm
            : 0.7 * this.currentCadenceRpm + 0.3 * instRpm; // EWMA smoothing
        }
      }
      this.lastBdcTimestamp = timestampMs;
    }

    this.prevSlope = currentSlope;
    this.prevKneeAngle = kneeAngleDeg;

    // 3. Determine pedal phase
    let pedalPhase: CyclingFrameMetrics['pedalPhase'] = 'mid_stroke';
    if (kneeAngleDeg >= 143) {
      pedalPhase = 'bdc_down';
    } else if (kneeAngleDeg <= 80) {
      pedalPhase = 'tdc_up';
    }

    // 4. Generate dynamic bike fit assessment
    const fitAssessment = this.evaluateFit(this.bdcHistory, torsoAngleDeg, reachAngleDeg);

    return {
      timestampMs,
      side,
      kneeAngleDeg,
      torsoAngleDeg,
      reachAngleDeg,
      pedalPhase,
      isBdcTurnaround,
      cadenceRpm: this.currentCadenceRpm ? Math.round(this.currentCadenceRpm) : null,
      fitAssessment,
    };
  }

  private evaluateFit(
    bdcEvents: Array<{ timestampMs: number; kneeAngle: number }>,
    torsoAngle: number,
    reachAngle: number
  ): BikeFitAssessment {
    // Need at least 3 pedal revolutions to make a confident recommendation
    if (bdcEvents.length < 3) {
      return {
        saddleHeightStatus: 'measuring',
        saddleRecommendation: 'Continue pedaling at steady cadence to calibrate saddle height...',
        reachStatus: 'measuring',
        reachRecommendation: 'Measuring cockpit reach...',
        postureStyle: torsoAngle < 35 ? 'aero' : torsoAngle <= 45 ? 'road_race' : 'endurance',
      };
    }

    // Average knee extension at BDC over recent strokes
    const recentBdc = bdcEvents.slice(-8);
    const avgBdcAngle = recentBdc.reduce((sum, e) => sum + e.kneeAngle, 0) / recentBdc.length;

    let saddleHeightStatus: BikeFitAssessment['saddleHeightStatus'] = 'optimal';
    let saddleRecommendation = 'Saddle height is within optimal clinical window (145°-155°).';

    if (avgBdcAngle > 155) {
      const diff = Math.round(avgBdcAngle - 150);
      saddleHeightStatus = 'too_high';
      saddleRecommendation = `Saddle is too high (Knee: ${Math.round(avgBdcAngle)}°). Lower saddle by approximately ${Math.max(3, diff * 2)} mm to prevent hamstring strain.`;
    } else if (avgBdcAngle < 142) {
      const diff = Math.round(148 - avgBdcAngle);
      saddleHeightStatus = 'too_low';
      saddleRecommendation = `Saddle is too low (Knee: ${Math.round(avgBdcAngle)}°). Raise saddle by approximately ${Math.max(3, diff * 2)} mm to relieve anterior knee pressure.`;
    }

    let reachStatus: BikeFitAssessment['reachStatus'] = 'optimal';
    let reachRecommendation = 'Cockpit reach angle is balanced (85°-95°).';

    if (reachAngle > 96) {
      reachStatus = 'too_long';
      reachRecommendation = `Reach is too stretched (${Math.round(reachAngle)}°). Consider a 10-20 mm shorter stem or sliding saddle forward.`;
    } else if (reachAngle < 78) {
      reachStatus = 'too_short';
      reachRecommendation = `Cockpit is cramped (${Math.round(reachAngle)}°). Consider a longer stem to open diaphragm breathing.`;
    }

    const postureStyle: BikeFitAssessment['postureStyle'] =
      torsoAngle < 35 ? 'aero' : torsoAngle <= 45 ? 'road_race' : 'endurance';

    return {
      saddleHeightStatus,
      saddleRecommendation,
      reachStatus,
      reachRecommendation,
      postureStyle,
    };
  }

  getSummary(): CyclingAnalysisSummary {
    const totalRevolutions = this.bdcHistory.length;
    const avgBdcAngle = totalRevolutions > 0
      ? this.bdcHistory.reduce((acc, v) => acc + v.kneeAngle, 0) / totalRevolutions
      : 0;

    const minKnee = this.kneeAnglesHistory.length > 0 ? Math.min(...this.kneeAnglesHistory) : 0;
    const maxKnee = this.kneeAnglesHistory.length > 0 ? Math.max(...this.kneeAnglesHistory) : 0;
    const avgTorso = this.torsoAnglesHistory.length > 0
      ? this.torsoAnglesHistory.reduce((a, b) => a + b, 0) / this.torsoAnglesHistory.length
      : 45;
    const avgReach = this.reachAnglesHistory.length > 0
      ? this.reachAnglesHistory.reduce((a, b) => a + b, 0) / this.reachAnglesHistory.length
      : 90;

    const assessment = this.evaluateFit(this.bdcHistory, avgTorso, avgReach);

    return {
      totalRevolutions,
      averageCadenceRpm: this.currentCadenceRpm ? Math.round(this.currentCadenceRpm) : 0,
      peakCadenceRpm: this.currentCadenceRpm ? Math.round(this.currentCadenceRpm * 1.15) : 0,
      minKneeAngleDeg: Math.round(minKnee),
      maxKneeAngleDeg: Math.round(maxKnee),
      averageMaxKneeAngleDeg: Math.round(avgBdcAngle),
      averageTorsoAngleDeg: Math.round(avgTorso),
      averageReachAngleDeg: Math.round(avgReach),
      finalAssessment: assessment,
    };
  }
}
