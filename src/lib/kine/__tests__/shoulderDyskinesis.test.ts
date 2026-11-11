import { describe, expect, it } from 'vitest';
import {
  calculate3DAngle,
  evaluateScapularDyskinesis,
  analyzeScapularPlane,
  isScapularRelevantLift,
  type FrameLandmarks,
} from '../shoulderDyskinesis';

describe('shoulderDyskinesis engine', () => {
  function generateSyntheticScaption({
    durationSec = 6,
    fps = 30,
    leftPeak = 175,
    rightPeak = 175,
    shrugOnLeft = false,
    dropOnRight = false,
    trunkLeanDeg = 0,
  }) {
    const totalFrames = durationSec * fps;
    const landmarks: FrameLandmarks[] = [];
    const timestamps: number[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      timestamps.push(t);

      // Sinusoidal elevation: 0 at t=0, peak at t=3, back to 0 at t=6
      const progress = Math.sin((Math.PI * t) / durationSec);
      const angL = Math.max(10, leftPeak * progress);
      const angR = Math.max(10, rightPeak * progress);

      // Build 2D geometry for hip-shoulder-elbow
      // Shoulder at (0.4, 0.3) for left, (0.6, 0.3) for right
      // Hip at (0.4, 0.7) for left, (0.6, 0.7) for right
      const radL = (angL * Math.PI) / 180;
      const radR = (angR * Math.PI) / 180;

      // Ear vertical separation: baseline is 0.15
      let sepL = 0.15;
      let sepR = 0.15;

      // If shrug simulated on left during early rise (< 60 deg)
      if (shrugOnLeft && angL >= 25 && angL <= 55) {
        sepL = 0.08; // >45% collapse
      }

      // If eccentric drop simulated on right between 120 and 60 on the way down
      let actualAngR = angR;
      if (dropOnRight && t > durationSec / 2 && angR <= 120 && angR >= 70) {
        // Accelerate drop abruptly in next frame
        actualAngR = angR - 25;
      }

      const elLx = 0.4 - Math.sin(radL) * 0.25;
      const elLy = 0.3 + Math.cos(radL) * 0.25;

      const radRActual = (actualAngR * Math.PI) / 180;
      const elRx = 0.6 + Math.sin(radRActual) * 0.25;
      const elRy = 0.3 + Math.cos(radRActual) * 0.25;

      // Trunk lean shift (torso length is 0.4 vertically)
      const leanRad = (trunkLeanDeg * Math.PI) / 180;
      const shiftX = 0.4 * Math.tan(leanRad);
      const shLx = 0.4 + shiftX;
      const shRx = 0.6 + shiftX;

      const frame: FrameLandmarks = {
        7: { x: shLx, y: 0.3 - sepL, visibility: 0.95 }, // Ear Left
        8: { x: shRx, y: 0.3 - sepR, visibility: 0.95 }, // Ear Right
        11: { x: shLx, y: 0.3, visibility: 0.95 }, // Shoulder Left
        12: { x: shRx, y: 0.3, visibility: 0.95 }, // Shoulder Right
        13: { x: elLx, y: elLy, visibility: 0.95 }, // Elbow Left
        14: { x: elRx, y: elRy, visibility: 0.95 }, // Elbow Right
        23: { x: 0.4, y: 0.7, visibility: 0.95 }, // Hip Left
        24: { x: 0.6, y: 0.7, visibility: 0.95 }, // Hip Right
      };
      landmarks.push(frame);
    }

    return { landmarks, timestamps };
  }

  describe('calculate3DAngle', () => {
    it('calculates orthogonal 90 degree angle correctly', () => {
      const a = { x: 0, y: 1, z: 0 };
      const b = { x: 0, y: 0, z: 0 };
      const c = { x: 1, y: 0, z: 0 };
      expect(calculate3DAngle(a, b, c)).toBe(90);
    });

    it('calculates straight 180 degree angle correctly', () => {
      const a = { x: 0, y: 1, z: 0 };
      const b = { x: 0, y: 0, z: 0 };
      const c = { x: 0, y: -1, z: 0 };
      expect(calculate3DAngle(a, b, c)).toBe(180);
    });

    it('returns null if any landmark has low visibility', () => {
      const a = { x: 0, y: 1, z: 0, visibility: 0.1 };
      const b = { x: 0, y: 0, z: 0, visibility: 0.9 };
      const c = { x: 1, y: 0, z: 0, visibility: 0.9 };
      expect(calculate3DAngle(a, b, c)).toBeNull();
    });

    it('returns null on missing points', () => {
      expect(calculate3DAngle(undefined, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    });
  });

  describe('evaluateScapularDyskinesis', () => {
    it('returns null on streams with fewer than 15 samples', () => {
      expect(evaluateScapularDyskinesis([], [])).toBeNull();
      expect(evaluateScapularDyskinesis(new Array(10).fill({}), new Array(10).fill(0))).toBeNull();
    });

    it('classifies healthy, symmetric bilateral scaption as NORMAL with no alerts', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        leftPeak: 175,
        rightPeak: 175,
        shrugOnLeft: false,
        dropOnRight: false,
      });

      const report = evaluateScapularDyskinesis(landmarks, timestamps);
      expect(report).not.toBeNull();
      expect(report?.classification).toBe('NORMAL');
      expect(report?.asymmetry.isClinicallySignificant).toBe(false);
      expect(report?.asymmetry.asiPercent).toBeLessThan(5);
      expect(report?.shrugSign.detected).toBe(false);
      expect(report?.eccentricControl.leftDropDetected).toBe(false);
      expect(report?.eccentricControl.rightDropDetected).toBe(false);
      expect(report?.trunkCompensation.isCompensating).toBe(false);
      expect(report?.hypotheses).toEqual([]);
    });

    it('detects Shrug Sign (Trapezius Hiking) and flags SUPRASPINATUS_IMPINGEMENT hypothesis', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        leftPeak: 170,
        rightPeak: 170,
        shrugOnLeft: true,
      });

      const report = evaluateScapularDyskinesis(landmarks, timestamps);
      expect(report).not.toBeNull();
      expect(report?.shrugSign.detected).toBe(true);
      expect(report?.shrugSign.leftHikeRatio).toBeGreaterThan(0.20);
      expect(report?.classification).toMatch(/SUBTLE|OBVIOUS/);

      const supraHypo = report?.hypotheses.find(h => h.id === 'SUPRASPINATUS_IMPINGEMENT');
      expect(supraHypo).toBeDefined();
      expect(supraHypo?.severity).toBe('alert');
      expect(supraHypo?.titleFr).toContain('supra-épineux');
    });

    it('detects Eccentric Drop and flags SERRATUS_ANTERIOR_DEFICIT hypothesis', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        leftPeak: 170,
        rightPeak: 170,
        dropOnRight: true,
      });

      const report = evaluateScapularDyskinesis(landmarks, timestamps);
      expect(report).not.toBeNull();
      expect(report?.eccentricControl.rightDropDetected).toBe(true);
      expect(report?.classification).toBe('OBVIOUS');

      const serratusHypo = report?.hypotheses.find(h => h.id === 'SERRATUS_ANTERIOR_DEFICIT');
      expect(serratusHypo).toBeDefined();
      expect(serratusHypo?.severity).toBe('alert');
      expect(serratusHypo?.titleFr).toContain('dentelé antérieur');
    });

    it('flags CAPSULAR_RESTRICTION on significant bilateral asymmetry > 15%', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        leftPeak: 170,
        rightPeak: 130, // 40 deg deficit
      });

      const report = evaluateScapularDyskinesis(landmarks, timestamps);
      expect(report).not.toBeNull();
      expect(report?.asymmetry.isClinicallySignificant).toBe(true);
      expect(report?.asymmetry.dominantDeficitSide).toBe('right');
      expect(report?.asymmetry.asiPercent).toBeGreaterThan(15);

      const capsularHypo = report?.hypotheses.find(h => h.id === 'CAPSULAR_RESTRICTION');
      expect(capsularHypo).toBeDefined();
      expect(capsularHypo?.severity).toBe('warning');
    });

    it('detects TRUNK_COMPENSATION when lateral lean exceeds 5 degrees', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        trunkLeanDeg: 8,
      });

      const report = evaluateScapularDyskinesis(landmarks, timestamps);
      expect(report).not.toBeNull();
      expect(report?.trunkCompensation.isCompensating).toBe(true);
      expect(report?.trunkCompensation.maxLateralLeanDeg).toBeGreaterThanOrEqual(5);

      const trunkHypo = report?.hypotheses.find(h => h.id === 'TRUNK_COMPENSATION');
      expect(trunkHypo).toBeDefined();
    });
  });

  describe('isScapularRelevantLift', () => {
    it('identifies shoulder and overhead lifts as scapular relevant', () => {
      expect(isScapularRelevantLift('overhead_press')).toBe(true);
      expect(isScapularRelevantLift('lateral_raise')).toBe(true);
      expect(isScapularRelevantLift('pull_up')).toBe(true);
      expect(isScapularRelevantLift('arnold_press')).toBe(true);
      expect(isScapularRelevantLift('kine_scaption')).toBe(true);
    });

    it('returns false for lower body lifts or undefined', () => {
      expect(isScapularRelevantLift('squat')).toBe(false);
      expect(isScapularRelevantLift('deadlift')).toBe(false);
      expect(isScapularRelevantLift(undefined)).toBe(false);
    });
  });

  describe('analyzeScapularPlane', () => {
    it('returns null on streams with fewer than 15 samples', () => {
      expect(analyzeScapularPlane([], [])).toBeNull();
    });

    it('returns optimal verdict on smooth symmetric scaption', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        leftPeak: 170,
        rightPeak: 170,
      });

      const analysis = analyzeScapularPlane(landmarks, timestamps, { lift: 'overhead_press' });
      expect(analysis).not.toBeNull();
      expect(analysis?.scapularStabilityIndex).toBeGreaterThanOrEqual(85);
      expect(analysis?.verdict).toBe('optimal');
      expect(analysis?.shrugDetected).toBe(false);
      expect(analysis?.eccentricDropDetected).toBe(false);
      expect(analysis?.cueFr).toContain('Rythme scapulo-thoracique fluide');
    });

    it('detects shrug sign and yields mild or critical dyskinesis with clinical cue', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        shrugOnLeft: true,
      });

      const analysis = analyzeScapularPlane(landmarks, timestamps);
      expect(analysis).not.toBeNull();
      expect(analysis?.shrugDetected).toBe(true);
      expect(analysis?.scapularStabilityIndex).toBeLessThan(85);
      expect(analysis?.cueFr).toContain('Haussement prématuré du trapèze');
    });

    it('detects eccentric drop and lowers stability index accordingly', () => {
      const { landmarks, timestamps } = generateSyntheticScaption({
        dropOnRight: true,
      });

      const analysis = analyzeScapularPlane(landmarks, timestamps);
      expect(analysis).not.toBeNull();
      expect(analysis?.eccentricDropDetected).toBe(true);
      expect(analysis?.cueFr).toContain('Décrochage excentrique détecté');
    });
  });
});
