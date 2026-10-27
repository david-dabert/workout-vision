/**
 * Gravity-View Coordinate Alignment (GVCA)
 *
 * Inspired by GVHMR (World-Grounded Human Motion Recovery via Gravity-View Coordinates).
 * Standard monocular tracking estimates poses relative to the tilted camera frame.
 * When a smartphone is placed on the gym floor propped at an angle (10° - 25° upward pitch),
 * purely vertical barbell motion appears diagonal in camera space, artificially inflating
 * sagittal drift and corrupting velocity-based metrics.
 *
 * This module estimates the true Earth gravity vector from the subject's standing anatomical
 * axis and rotates all landmarks into a gravity-aligned world frame.
 */

import { Landmark3D } from './kinematicFootLocking';

export interface GravityAlignmentResult {
  landmarks: Landmark3D[];
  pitchDeg: number;       // Camera tilt angle (upward / downward pitch)
  rollDeg: number;        // Camera lateral roll angle
  isTiltCorrected: boolean;
  gravityVector: [number, number, number];
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export class GravityAligner {
  private calibratedPitchRad: number = 0;
  private calibratedRollRad: number = 0;
  private isCalibrated: boolean = false;
  private calibrationSamples: { pitch: number; roll: number }[] = [];

  constructor() {}

  /**
   * Resets the calibration state.
   */
  public reset(): void {
    this.calibratedPitchRad = 0;
    this.calibratedRollRad = 0;
    this.isCalibrated = false;
    this.calibrationSamples = [];
  }

  /**
   * Estimates camera pitch and roll from the anatomical vertical axis of an upright posture.
   * Uses midpoint of ankles (27/28) to midpoint of hips (23/24) and shoulders (11/12).
   */
  public estimateAnglesFromPose(landmarks: Landmark3D[]): { pitchDeg: number; rollDeg: number } {
    if (!landmarks || landmarks.length < 33) {
      return { pitchDeg: 0, rollDeg: 0 };
    }

    // Midpoints
    const midAnkle: Vector3D = {
      x: (landmarks[27].x + landmarks[28].x) / 2,
      y: (landmarks[27].y + landmarks[28].y) / 2,
      z: ((landmarks[27].z ?? 0) + (landmarks[28].z ?? 0)) / 2,
    };
    const midHip: Vector3D = {
      x: (landmarks[23].x + landmarks[24].x) / 2,
      y: (landmarks[23].y + landmarks[24].y) / 2,
      z: ((landmarks[23].z ?? 0) + (landmarks[24].z ?? 0)) / 2,
    };
    const midShoulder: Vector3D = {
      x: (landmarks[11].x + landmarks[12].x) / 2,
      y: (landmarks[11].y + landmarks[12].y) / 2,
      z: ((landmarks[11].z ?? 0) + (landmarks[12].z ?? 0)) / 2,
    };

    // Vector from ankles to shoulders: in an upright standing person, this defines Earth vertical (anti-gravity)
    const trunkV: Vector3D = {
      x: midShoulder.x - midAnkle.x,
      y: midShoulder.y - midAnkle.y, // MediaPipe Y goes down
      z: midShoulder.z - midAnkle.z,
    };

    const len = Math.hypot(trunkV.x, trunkV.y, trunkV.z);
    if (len < 1e-4) return { pitchDeg: 0, rollDeg: 0 };

    // Pitch: angle in the Y-Z plane.
    // If the camera is tilted UP, a vertical person leans "away" in Z (negative Z or positive Z depending on coord system).
    // MediaPipe coords: X right, Y down, Z forward towards camera or into screen.
    const pitchRad = Math.atan2(trunkV.z, -trunkV.y);
    // Roll: angle in the X-Y plane (lateral tilt)
    const rollRad = Math.atan2(trunkV.x, -trunkV.y);

    const pitchDeg = Math.round((pitchRad * 180) / Math.PI * 10) / 10;
    const rollDeg = Math.round((rollRad * 180) / Math.PI * 10) / 10;

    return { pitchDeg, rollDeg };
  }

  /**
   * Adds an upright pose sample to the calibration buffer.
   */
  public addCalibrationSample(landmarks: Landmark3D[]): boolean {
    const { pitchDeg, rollDeg } = this.estimateAnglesFromPose(landmarks);
    // Filter out extreme non-upright poses
    if (Math.abs(pitchDeg) <= 45 && Math.abs(rollDeg) <= 30) {
      this.calibrationSamples.push({
        pitch: (pitchDeg * Math.PI) / 180,
        roll: (rollDeg * Math.PI) / 180,
      });

      if (this.calibrationSamples.length >= 5) {
        // Compute median pitch and roll
        const pitches = [...this.calibrationSamples.map(s => s.pitch)].sort((a, b) => a - b);
        const rolls = [...this.calibrationSamples.map(s => s.roll)].sort((a, b) => a - b);
        this.calibratedPitchRad = pitches[Math.floor(pitches.length / 2)];
        this.calibratedRollRad = rolls[Math.floor(rolls.length / 2)];
        this.isCalibrated = true;
      }
    }
    return this.isCalibrated;
  }

  /**
   * Manually sets or overrides the calibration angles (e.g. from device gyroscope).
   */
  public setCalibration(pitchDeg: number, rollDeg: number): void {
    this.calibratedPitchRad = (pitchDeg * Math.PI) / 180;
    this.calibratedRollRad = (rollDeg * Math.PI) / 180;
    this.isCalibrated = true;
  }

  /**
   * Aligns 33 landmarks into true gravity-view coordinates using the calibrated rotation.
   */
  public alignLandmarks(landmarks: Landmark3D[]): GravityAlignmentResult {
    if (!landmarks || landmarks.length === 0) {
      return {
        landmarks,
        pitchDeg: 0,
        rollDeg: 0,
        isTiltCorrected: false,
        gravityVector: [0, 1, 0],
      };
    }

    if (!this.isCalibrated && this.calibrationSamples.length === 0) {
      this.addCalibrationSample(landmarks);
    }

    const pitch = this.calibratedPitchRad;
    const roll = this.calibratedRollRad;
    const pitchDeg = Math.round((pitch * 180) / Math.PI * 10) / 10;
    const rollDeg = Math.round((roll * 180) / Math.PI * 10) / 10;

    // Center of rotation: midpoint of ankles (ground anchor)
    const rootX = (landmarks[27].x + landmarks[28].x) / 2;
    const rootY = (landmarks[27].y + landmarks[28].y) / 2;
    const rootZ = ((landmarks[27].z ?? 0) + (landmarks[28].z ?? 0)) / 2;

    const cosP = Math.cos(pitch);
    const sinP = Math.sin(pitch);
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);

    const aligned: Landmark3D[] = landmarks.map(lm => {
      // 1. Shift to ground anchor (mid-ankles)
      const x0 = lm.x - rootX;
      const y0 = lm.y - rootY;
      const z0 = (lm.z ?? 0) - rootZ;

      // 2. Roll correction around Z-axis (lateral tilt)
      const x1 = x0 * cosR + y0 * sinR;
      const y1 = -x0 * sinR + y0 * cosR;
      const z1 = z0;

      // 3. Pitch correction around X-axis (ground-upward alignment)
      const x2 = x1;
      const y2 = y1 * cosP - z1 * sinP;
      const z2 = y1 * sinP + z1 * cosP;

      // 4. Shift back to world frame
      return {
        ...lm,
        x: x2 + rootX,
        y: y2 + rootY,
        z: z2 + rootZ,
      };
    });

    return {
      landmarks: aligned,
      pitchDeg,
      rollDeg,
      isTiltCorrected: Math.abs(pitchDeg) >= 2 || Math.abs(rollDeg) >= 2,
      gravityVector: [sinR, cosP * cosR, -sinP * cosR],
    };
  }
}
