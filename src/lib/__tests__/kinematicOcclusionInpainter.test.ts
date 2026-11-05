import { describe, it, expect, beforeEach } from 'vitest';
import {
  KinematicOcclusionInpainter,
  intersectAdjacentSpheres,
  calibrateSkeletalInvariants,
  verifySkeletalInvariants,
  computeDistance3D,
  AxisKalmanFilter,
  JointKalmanTracker3D,
  Landmark3D,
  Point3D,
  SkeletalInvariants,
} from '../kinematicOcclusionInpainter';
import { LANDMARKS } from '../poseGeometry';

describe('Kinematic Occlusion Inpainting Engine', () => {
  describe('Geometric Sphere-Sphere Trilateration Solver', () => {
    it('enforces exact bone segment lengths to machine precision', () => {
      // Proximal anchor: Hip at (0.5, 0.5, 0.0)
      const hip: Point3D = { x: 0.5, y: 0.5, z: 0.0 };
      // Distal anchor: Ankle at (0.5, 1.1, 0.0) (distance D = 0.6)
      const ankle: Point3D = { x: 0.5, y: 1.1, z: 0.0 };

      const femurLength = 0.35; // L1
      const tibiaLength = 0.35; // L2
      // Continuation point from Kalman filter (knee bending forward in x and z)
      const continuation: Point3D = { x: 0.7, y: 0.8, z: 0.1 };

      const result = intersectAdjacentSpheres(hip, femurLength, ankle, tibiaLength, continuation);

      expect(result.isLockout).toBe(false);
      expect(result.isDegenerate).toBe(false);

      // Distance from Hip to Knee must be EXACTLY femurLength (0.35)
      const dHipKnee = Math.hypot(
        result.point.x - hip.x,
        result.point.y - hip.y,
        result.point.z - hip.z
      );
      expect(dHipKnee).toBeCloseTo(femurLength, 5);

      // Distance from Ankle to Knee must be EXACTLY tibiaLength (0.35)
      const dAnkleKnee = Math.hypot(
        result.point.x - ankle.x,
        result.point.y - ankle.y,
        result.point.z - ankle.z
      );
      expect(dAnkleKnee).toBeCloseTo(tibiaLength, 5);
    });

    it('handles lockout extension singularity without NaN or division by zero', () => {
      const hip: Point3D = { x: 0.5, y: 0.2, z: 0 };
      const ankle: Point3D = { x: 0.5, y: 0.9, z: 0 }; // D = 0.7
      const femur = 0.35;
      const tibia = 0.35; // femur + tibia = 0.70 == D
      const continuation: Point3D = { x: 0.5, y: 0.55, z: 0 };

      const result = intersectAdjacentSpheres(hip, femur, ankle, tibia, continuation);
      expect(result.isLockout).toBe(true);
      expect(result.point.x).toBeCloseTo(0.5, 5);
      expect(result.point.y).toBeCloseTo(0.55, 5);
      expect(result.point.z).toBeCloseTo(0, 5);
    });

    it('resolves collinear ambiguity using preferred anatomical normal', () => {
      const hip: Point3D = { x: 0.5, y: 0.2, z: 0 };
      const ankle: Point3D = { x: 0.5, y: 0.8, z: 0 }; // D = 0.6
      const femur = 0.35;
      const tibia = 0.35;

      // Continuation point is directly on the axis between hip and ankle
      const collinearContinuation: Point3D = { x: 0.5, y: 0.5, z: 0 };
      const anteriorNormal: Point3D = { x: 0, y: 0, z: -1 }; // forward into camera

      const result = intersectAdjacentSpheres(
        hip,
        femur,
        ankle,
        tibia,
        collinearContinuation,
        anteriorNormal
      );

      expect(result.point.z).toBeLessThan(0); // projected anteriorly along preferred normal
      const dHip = Math.hypot(result.point.x - hip.x, result.point.y - hip.y, result.point.z - hip.z);
      expect(dHip).toBeCloseTo(femur, 5);
    });
  });

  describe('3D Kinematic Kalman Filter & Velocity Continuation', () => {
    it('tracks 1D constant velocity motion accurately', () => {
      const filter = new AxisKalmanFilter(1.0, 0.01);
      filter.reset(0, 0);

      // Feed observations moving at v = 2.0 m/s with dt = 0.05s
      const dt = 0.05;
      for (let i = 1; i <= 20; i++) {
        const truePos = 2.0 * (i * dt);
        filter.predict(dt);
        filter.update(truePos);
      }

      expect(filter.v).toBeCloseTo(2.0, 1);
    });

    it('continues velocity trajectory during missing observation frames', () => {
      const tracker = new JointKalmanTracker3D(1.0, 0.01);
      const start: Point3D = { x: 0.5, y: 0.5, z: 0.0 };
      tracker.init(start, 0, { x: 0.1, y: 0.5, z: 0.0 });

      // Run 5 visible frames moving downward at vy = 0.5
      let ts = 0;
      for (let i = 1; i <= 5; i++) {
        ts += 33.3; // 30 fps
        const meas: Point3D = { x: 0.5 + 0.1 * (ts / 1000), y: 0.5 + 0.5 * (ts / 1000), z: 0 };
        tracker.predict(ts);
        tracker.update(meas);
      }

      // Now simulate 3 occluded frames without measurement update
      const predPositions: Point3D[] = [];
      for (let i = 1; i <= 3; i++) {
        ts += 33.3;
        const pred = tracker.predict(ts);
        predPositions.push(pred);
      }

      // Position should extrapolate continuously downward
      expect(predPositions[0].y).toBeGreaterThan(0.5);
      expect(predPositions[1].y).toBeGreaterThan(predPositions[0].y);
      expect(predPositions[2].y).toBeGreaterThan(predPositions[1].y);
    });
  });

  describe('Standing Calibration & Invariant Extraction', () => {
    function createStandingFrame(femur = 0.42, tibia = 0.40, torso = 0.48): Landmark3D[] {
      const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));

      // Left side coordinates
      const lHipY = 0.50;
      const lKneeY = lHipY + femur;
      const lAnkleY = lKneeY + tibia;
      const lShoulderY = lHipY - torso;

      lms[LANDMARKS.LEFT_SHOULDER] = { x: 0.45, y: lShoulderY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: lShoulderY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.LEFT_HIP] = { x: 0.45, y: lHipY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.RIGHT_HIP] = { x: 0.55, y: lHipY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.LEFT_KNEE] = { x: 0.45, y: lKneeY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.RIGHT_KNEE] = { x: 0.55, y: lKneeY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.LEFT_ANKLE] = { x: 0.45, y: lAnkleY, z: 0, visibility: 0.98 };
      lms[LANDMARKS.RIGHT_ANKLE] = { x: 0.55, y: lAnkleY, z: 0, visibility: 0.98 };

      return lms;
    }

    it('extracts exact skeletal invariants from clean standing frames', () => {
      const standingFrames = [
        createStandingFrame(0.42, 0.40, 0.48),
        createStandingFrame(0.42, 0.40, 0.48),
        createStandingFrame(0.42, 0.40, 0.48),
      ];

      const invariants = calibrateSkeletalInvariants(standingFrames);
      expect(invariants).not.toBeNull();
      expect(invariants!.leftFemur).toBeCloseTo(0.42, 3);
      expect(invariants!.rightFemur).toBeCloseTo(0.42, 3);
      expect(invariants!.leftTibia).toBeCloseTo(0.40, 3);
      expect(invariants!.rightTibia).toBeCloseTo(0.40, 3);
      expect(invariants!.leftTorso).toBeCloseTo(0.48, 3);
      expect(invariants!.rightTorso).toBeCloseTo(0.48, 3);
    });

    it('verifies zero deviation on standing frame conforming to invariants', () => {
      const frame = createStandingFrame(0.42, 0.40, 0.48);
      const invariants: SkeletalInvariants = {
        leftFemur: 0.42,
        rightFemur: 0.42,
        leftTibia: 0.40,
        rightTibia: 0.40,
        leftTorso: 0.48,
        rightTorso: 0.48,
      };

      const check = verifySkeletalInvariants(frame, invariants);
      expect(check.compliant).toBe(true);
      expect(check.maxDeviation).toBeLessThan(1e-4);
    });
  });

  describe('Synthetic 45 cm Olympic Bumper Plate Occlusions during Squat', () => {
    let inpainter: KinematicOcclusionInpainter;
    const femurLen = 0.42;
    const tibiaLen = 0.40;
    const torsoLen = 0.48;

    const invariants: SkeletalInvariants = {
      leftFemur: femurLen,
      rightFemur: femurLen,
      leftTibia: tibiaLen,
      rightTibia: tibiaLen,
      leftTorso: torsoLen,
      rightTorso: torsoLen,
    };

    beforeEach(() => {
      inpainter = new KinematicOcclusionInpainter({ invariants, visibilityThreshold: 0.50 });
    });

    /**
     * Generates a 60-frame synthetic squat sequence (30 fps, 2.0s duration).
     * Ankle remains anchored at floor level.
     * Hip descends and moves posterior (hinge).
     * Knee flexes forward (anterior) while maintaining rigid segment invariants.
     */
    function generateSyntheticSquat(totalFrames = 60): {
      frames: Landmark3D[][];
      groundTruthKnees: Point3D[];
    } {
      const frames: Landmark3D[][] = [];
      const groundTruthKnees: Point3D[] = [];

      const ankleY = 0.90;
      const standingHipY = ankleY - (femurLen + tibiaLen) * 0.98; // Near lockout

      for (let i = 0; i < totalFrames; i++) {
        // Squat cycle: progress t from 0 -> 1 (descent) -> 0 (ascent)
        const phase = (i / (totalFrames - 1)) * 2 * Math.PI; // 0 to 2pi
        const depthFactor = 0.5 * (1 - Math.cos(phase)); // 0 at standing, 1 at bottom

        // Hip travels down by 0.28m, and hinges back by 0.08m
        const hipX = 0.50 - 0.08 * depthFactor;
        const hipY = standingHipY + 0.28 * depthFactor;
        const hipZ = 0;

        const torsoDx = 0.10 * depthFactor;
        const torsoDy = Math.sqrt(Math.max(0, torsoLen * torsoLen - torsoDx * torsoDx));
        const shoulderX = hipX + torsoDx; // Torso forward lean
        const shoulderY = hipY - torsoDy;
        const shoulderZ = 0;

        const ankleX = 0.50;
        const ankleZ = 0;

        // True knee position: intersection of sphere(hip, femur) and sphere(ankle, tibia)
        const trueIntersection = intersectAdjacentSpheres(
          { x: hipX, y: hipY, z: hipZ },
          femurLen,
          { x: ankleX, y: ankleY, z: ankleZ },
          tibiaLen,
          { x: 0.56, y: hipY + 0.20, z: -0.1 }, // forward prior
          { x: 1, y: 0, z: 0 }
        );

        groundTruthKnees.push(trueIntersection.point);

        const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));

        lms[LANDMARKS.LEFT_SHOULDER] = { x: shoulderX, y: shoulderY, z: shoulderZ, visibility: 0.95 };
        lms[LANDMARKS.RIGHT_SHOULDER] = { x: shoulderX + 0.1, y: shoulderY, z: shoulderZ, visibility: 0.95 };
        lms[LANDMARKS.LEFT_HIP] = { x: hipX, y: hipY, z: hipZ, visibility: 0.95 };
        lms[LANDMARKS.RIGHT_HIP] = { x: hipX + 0.1, y: hipY, z: hipZ, visibility: 0.95 };
        lms[LANDMARKS.LEFT_ANKLE] = { x: ankleX, y: ankleY, z: ankleZ, visibility: 0.95 };
        lms[LANDMARKS.RIGHT_ANKLE] = { x: ankleX + 0.1, y: ankleY, z: ankleZ, visibility: 0.95 };

        // Ground truth clean knee
        lms[LANDMARKS.LEFT_KNEE] = {
          x: trueIntersection.point.x,
          y: trueIntersection.point.y,
          z: trueIntersection.point.z,
          visibility: 0.95,
        };
        lms[LANDMARKS.RIGHT_KNEE] = {
          x: trueIntersection.point.x + 0.1,
          y: trueIntersection.point.y,
          z: trueIntersection.point.z,
          visibility: 0.95,
        };

        frames.push(lms);
      }

      return { frames, groundTruthKnees };
    }

    it('achieves 100% reconstruction of occluded knee during squat ascent/descent behind 45 cm plate', () => {
      const { frames, groundTruthKnees } = generateSyntheticSquat(60);

      // Model a 45 cm (0.45 m) Olympic bumper plate crossing the knee trajectory
      // In lateral/oblique view, the barbell plate covers the knee between frames 18 and 38 (21 consecutive frames)
      const occludedRange = { start: 18, end: 38 };
      let totalOccludedFrames = 0;

      for (let i = 0; i < frames.length; i++) {
        if (i >= occludedRange.start && i <= occludedRange.end) {
          totalOccludedFrames++;
          // Plate blocks optical sight: visibility drops to 0.08
          frames[i][LANDMARKS.LEFT_KNEE].visibility = 0.08;
          // Landmark coordinate is severely corrupted or zeroed
          frames[i][LANDMARKS.LEFT_KNEE].x = 0;
          frames[i][LANDMARKS.LEFT_KNEE].y = 0;
        }
      }

      const timestamps = frames.map((_, idx) => idx * 33.33);
      const results = inpainter.processSequence(frames, timestamps);

      expect(results.length).toBe(60);

      let reconstructedCount = 0;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const kneeInpaint = res.inpaintedJoints.find(j => j.index === LANDMARKS.LEFT_KNEE);

        if (i >= occludedRange.start && i <= occludedRange.end) {
          expect(kneeInpaint).toBeDefined();
          expect(kneeInpaint!.isOccluded).toBe(true);
          expect(kneeInpaint!.isInpainted).toBe(true);
          expect(kneeInpaint!.confidence).toBeGreaterThan(0.70);
          reconstructedCount++;

          // Invariant Check: Distance to Hip MUST equal femur length
          const hip = res.landmarks[LANDMARKS.LEFT_HIP];
          const knee = res.landmarks[LANDMARKS.LEFT_KNEE];
          const ankle = res.landmarks[LANDMARKS.LEFT_ANKLE];

          const dFemur = computeDistance3D(hip, knee);
          const dTibia = computeDistance3D(knee, ankle);

          expect(dFemur).toBeCloseTo(femurLen, 3);
          expect(dTibia).toBeCloseTo(tibiaLen, 3);

          // Proximity to ground truth trajectory (Kalman continuation keeps it close to true kinematics)
          const gt = groundTruthKnees[i];
          const error = Math.hypot(knee.x - gt.x, knee.y - gt.y, (knee.z ?? 0) - gt.z);
          expect(error).toBeLessThan(0.04); // Within 4 cm throughout deep occlusion
        } else {
          expect(kneeInpaint!.isInpainted).toBe(false);
        }

        // Entire frame invariant compliance
        expect(res.invariantsCompliant).toBe(true);
        expect(res.maxInvariantDeviation).toBeLessThan(1e-3);
      }

      // 100% reconstruction verified
      expect(reconstructedCount).toBe(totalOccludedFrames);
      expect(reconstructedCount).toBe(21);
    });

    it('reconstructs bilateral knee occlusions when both plates occlude lifter legs', () => {
      const { frames } = generateSyntheticSquat(40);
      const timestamps = frames.map((_, idx) => idx * 33.33);

      // Occlude both left and right knees for frames 15 to 25
      for (let i = 15; i <= 25; i++) {
        frames[i][LANDMARKS.LEFT_KNEE].visibility = 0.05;
        frames[i][LANDMARKS.RIGHT_KNEE].visibility = 0.05;
      }

      const results = inpainter.processSequence(frames, timestamps);

      for (let i = 15; i <= 25; i++) {
        const res = results[i];
        const lKnee = res.inpaintedJoints.find(j => j.index === LANDMARKS.LEFT_KNEE);
        const rKnee = res.inpaintedJoints.find(j => j.index === LANDMARKS.RIGHT_KNEE);

        expect(lKnee!.isInpainted).toBe(true);
        expect(rKnee!.isInpainted).toBe(true);

        const lFemur = computeDistance3D(res.landmarks[LANDMARKS.LEFT_HIP], res.landmarks[LANDMARKS.LEFT_KNEE]);
        const rFemur = computeDistance3D(res.landmarks[LANDMARKS.RIGHT_HIP], res.landmarks[LANDMARKS.RIGHT_KNEE]);
        const lTibia = computeDistance3D(res.landmarks[LANDMARKS.LEFT_KNEE], res.landmarks[LANDMARKS.LEFT_ANKLE]);
        const rTibia = computeDistance3D(res.landmarks[LANDMARKS.RIGHT_KNEE], res.landmarks[LANDMARKS.RIGHT_ANKLE]);

        expect(lFemur).toBeCloseTo(femurLen, 3);
        expect(rFemur).toBeCloseTo(femurLen, 3);
        expect(lTibia).toBeCloseTo(tibiaLen, 3);
        expect(rTibia).toBeCloseTo(tibiaLen, 3);

        expect(res.invariantsCompliant).toBe(true);
      }
    });

    it('reconstructs occluded hip behind machine chest pad / weight shield', () => {
      const { frames } = generateSyntheticSquat(40);
      const timestamps = frames.map((_, idx) => idx * 33.33);

      // Chest pad occludes Left Hip for 15 frames (frames 10 to 24)
      for (let i = 10; i <= 24; i++) {
        frames[i][LANDMARKS.LEFT_HIP].visibility = 0.0;
        frames[i][LANDMARKS.LEFT_HIP].x = 0;
        frames[i][LANDMARKS.LEFT_HIP].y = 0;
      }

      const results = inpainter.processSequence(frames, timestamps);

      let hipInpaintedCount = 0;
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        const hipInpaint = res.inpaintedJoints.find(j => j.index === LANDMARKS.LEFT_HIP);

        if (i >= 10 && i <= 24) {
          expect(hipInpaint!.isOccluded).toBe(true);
          expect(hipInpaint!.isInpainted).toBe(true);
          hipInpaintedCount++;

          // Invariant Check: Distance to Shoulder MUST equal torsoLen, and to Knee MUST equal femurLen
          const shoulder = res.landmarks[LANDMARKS.LEFT_SHOULDER];
          const hip = res.landmarks[LANDMARKS.LEFT_HIP];
          const knee = res.landmarks[LANDMARKS.LEFT_KNEE];

          const dTorso = computeDistance3D(shoulder, hip);
          const dFemur = computeDistance3D(hip, knee);

          expect(dTorso).toBeCloseTo(torsoLen, 3);
          expect(dFemur).toBeCloseTo(femurLen, 3);
        }
      }

      expect(hipInpaintedCount).toBe(15);
    });

    it('rejects sudden optical teleportation outliers while inpainting physically sound coordinates', () => {
      const { frames } = generateSyntheticSquat(30);
      const timestamps = frames.map((_, idx) => idx * 33.33);

      // Frame 15: MediaPipe jumps to another person across the gym or barbell collar (x: 0.95, y: 0.1) with low visibility
      frames[15][LANDMARKS.LEFT_KNEE] = {
        x: 0.95,
        y: 0.1,
        z: 0.5,
        visibility: 0.20,
      };

      const results = inpainter.processSequence(frames, timestamps);
      const res15 = results[15];

      const knee = res15.landmarks[LANDMARKS.LEFT_KNEE];
      expect(knee.x).not.toBe(0.95);
      expect(knee.y).not.toBe(0.1);

      // Knee must remain anatomically connected between hip and ankle
      const hip = res15.landmarks[LANDMARKS.LEFT_HIP];
      const ankle = res15.landmarks[LANDMARKS.LEFT_ANKLE];
      expect(computeDistance3D(hip, knee)).toBeCloseTo(femurLen, 3);
      expect(computeDistance3D(knee, ankle)).toBeCloseTo(tibiaLen, 3);
    });

    it('sustains 100% reconstruction and invariant preservation over a prolonged 30-frame plate occlusion', () => {
      const { frames } = generateSyntheticSquat(60);
      const timestamps = frames.map((_, idx) => idx * 33.33);

      // Plate lingers in front of knee for 30 consecutive frames (half of the lift!)
      for (let i = 15; i <= 45; i++) {
        frames[i][LANDMARKS.LEFT_KNEE].visibility = 0.04;
        frames[i][LANDMARKS.LEFT_KNEE].x = 0;
        frames[i][LANDMARKS.LEFT_KNEE].y = 0;
      }

      const results = inpainter.processSequence(frames, timestamps);

      for (let i = 15; i <= 45; i++) {
        const res = results[i];
        const kneeInpaint = res.inpaintedJoints.find(j => j.index === LANDMARKS.LEFT_KNEE);
        expect(kneeInpaint!.isInpainted).toBe(true);
        expect(res.invariantsCompliant).toBe(true);

        const hip = res.landmarks[LANDMARKS.LEFT_HIP];
        const knee = res.landmarks[LANDMARKS.LEFT_KNEE];
        const ankle = res.landmarks[LANDMARKS.LEFT_ANKLE];
        expect(computeDistance3D(hip, knee)).toBeCloseTo(femurLen, 3);
        expect(computeDistance3D(knee, ankle)).toBeCloseTo(tibiaLen, 3);
      }
    });

    it('reconstructs occluded elbow during arm exercises with arm invariants', () => {
      const armInvariants: SkeletalInvariants = {
        ...invariants,
        leftHumerus: 0.30,
        rightHumerus: 0.30,
        leftForearm: 0.28,
        rightForearm: 0.28,
      };

      const armInpainter = new KinematicOcclusionInpainter({ invariants: armInvariants });

      const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
      // Shoulder at (0.45, 0.25, 0), Wrist at (0.45, 0.75, 0) (D = 0.50)
      lms[LANDMARKS.LEFT_SHOULDER] = { x: 0.45, y: 0.25, z: 0, visibility: 0.95 };
      lms[LANDMARKS.RIGHT_SHOULDER] = { x: 0.55, y: 0.25, z: 0, visibility: 0.95 };
      lms[LANDMARKS.LEFT_HIP] = { x: 0.45, y: 0.25 + torsoLen, z: 0, visibility: 0.95 };
      lms[LANDMARKS.RIGHT_HIP] = { x: 0.55, y: 0.25 + torsoLen, z: 0, visibility: 0.95 };
      lms[LANDMARKS.LEFT_WRIST] = { x: 0.45, y: 0.75, z: 0, visibility: 0.95 };
      lms[LANDMARKS.RIGHT_WRIST] = { x: 0.55, y: 0.75, z: 0, visibility: 0.95 };
      // Occluded elbow
      lms[LANDMARKS.LEFT_ELBOW] = { x: 0, y: 0, z: 0, visibility: 0.10 };

      const res = armInpainter.processFrame(lms, 100);
      const elbowInpaint = res.inpaintedJoints.find(j => j.index === LANDMARKS.LEFT_ELBOW);

      expect(elbowInpaint!.isInpainted).toBe(true);

      const shoulder = res.landmarks[LANDMARKS.LEFT_SHOULDER];
      const elbow = res.landmarks[LANDMARKS.LEFT_ELBOW];
      const wrist = res.landmarks[LANDMARKS.LEFT_WRIST];

      expect(computeDistance3D(shoulder, elbow)).toBeCloseTo(0.30, 3);
      expect(computeDistance3D(elbow, wrist)).toBeCloseTo(0.28, 3);
    });

    it('auto-calibrates invariants from first visible standing frame when none provided', () => {
      const autoInpainter = new KinematicOcclusionInpainter({ invariants: undefined });
      const { frames } = generateSyntheticSquat(10);

      // Frame 0 is clean standing
      autoInpainter.processFrame(frames[0], 0);
      expect(autoInpainter.getInvariants()).not.toBeNull();
      expect(autoInpainter.getInvariants()!.leftFemur).toBeCloseTo(femurLen, 2);
      expect(autoInpainter.getInvariants()!.leftTibia).toBeCloseTo(tibiaLen, 2);
    });
  });
});
