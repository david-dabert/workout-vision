import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import {
  computeKineticPower,
  detectActiveBout,
  extractNormalizedPosture,
  buildSelfSimilarityMatrix,
  estimateDominantPeriod,
  runUniversalRecurrenceSegmenter,
} from '../recurrenceSegmenter';
import { WorldLandmark, WorldLandmarkFrame } from '../core';

/**
 * Creates a synthetic full-body skeleton performing periodic squats.
 */
function generateSyntheticSquatFrames(
  numReps = 5,
  repPeriodSec = 2.0,
  fps = 15
): { frames: WorldLandmarkFrame[]; timestamps: number[] } {
  const frames: WorldLandmarkFrame[] = [];
  const timestamps: number[] = [];

  const totalDuration = (numReps + 2) * repPeriodSec;
  const totalFrames = Math.round(totalDuration * fps);

  for (let f = 0; f < totalFrames; f++) {
    const t = f / fps;
    timestamps.push(t);

    // Initial 1 rep duration is still, then active, then 1 rep duration still
    let phase = 0;
    if (t >= repPeriodSec && t < (numReps + 1) * repPeriodSec) {
      const activeT = t - repPeriodSec;
      phase = (Math.cos((2 * Math.PI * activeT) / repPeriodSec) - 1) * 0.5; // [-1, 0]
    }

    const squatDepth = Math.abs(phase) * 0.4; // 0 (standing) to 0.4m down

    const frame: WorldLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0,
      y: 0,
      z: 0,
      visibility: 0.99,
    }));

    // Torso / shoulders
    frame[11] = { x: -0.2, y: -0.6 + squatDepth, z: 0, visibility: 0.99 };
    frame[12] = { x: 0.2, y: -0.6 + squatDepth, z: 0, visibility: 0.99 };

    // Elbows & wrists
    frame[13] = { x: -0.25, y: -0.3 + squatDepth, z: 0.1, visibility: 0.99 };
    frame[14] = { x: 0.25, y: -0.3 + squatDepth, z: 0.1, visibility: 0.99 };
    frame[15] = { x: -0.2, y: 0.0 + squatDepth, z: 0.2, visibility: 0.99 };
    frame[16] = { x: 0.2, y: 0.0 + squatDepth, z: 0.2, visibility: 0.99 };

    // Hips
    frame[23] = { x: -0.15, y: -0.1 + squatDepth, z: 0, visibility: 0.99 };
    frame[24] = { x: 0.15, y: -0.1 + squatDepth, z: 0, visibility: 0.99 };

    // Knees (move forward and down during squat)
    frame[25] = { x: -0.15, y: 0.3 + squatDepth * 0.5, z: -squatDepth * 0.3, visibility: 0.99 };
    frame[26] = { x: 0.15, y: 0.3 + squatDepth * 0.5, z: -squatDepth * 0.3, visibility: 0.99 };

    // Ankles (fixed on floor)
    frame[27] = { x: -0.15, y: 0.7, z: 0, visibility: 0.99 };
    frame[28] = { x: 0.15, y: 0.7, z: 0, visibility: 0.99 };

    frames.push(frame);
  }

  return { frames, timestamps };
}

describe('Universal Kinetic Recurrence Segmenter', () => {
  it('computes near-zero kinetic power during stillness and elevated power during motion', () => {
    const { frames, timestamps } = generateSyntheticSquatFrames(3, 2.0, 15);
    const power = computeKineticPower(frames, timestamps);

    expect(power.length).toBe(frames.length);

    // Initial stillness (first 1.5s)
    const initialPower = power.slice(0, 15).reduce((a, b) => a + b, 0) / 15;
    // Moving section (between 3s and 5s, indices 45 to 75)
    const movingPower = power.slice(45, 75).reduce((a, b) => a + b, 0) / 30;

    expect(movingPower).toBeGreaterThan(initialPower * 5);
  });

  it('detects the active resistance set bounds accurately', () => {
    const repPeriod = 2.0;
    const numReps = 4;
    const { frames, timestamps } = generateSyntheticSquatFrames(numReps, repPeriod, 15);
    const power = computeKineticPower(frames, timestamps);
    const bout = detectActiveBout(power, timestamps);

    // Active movement begins at t = 2.0s and ends at t = (4 + 1) * 2.0 = 10.0s
    expect(bout.startTime).toBeLessThanOrEqual(2.5);
    expect(bout.endTime).toBeGreaterThanOrEqual(9.5);
  });

  it('preserves posture representation under global translation and uniform scaling', () => {
    const { frames } = generateSyntheticSquatFrames(1, 2.0, 15);
    const baseFrame = frames[15] as WorldLandmark[];

    const postureBase = extractNormalizedPosture(baseFrame);

    // Translate by (+5m, -3m, +8m)
    const translatedFrame = baseFrame.map(p => ({
      ...p,
      x: p.x + 5.0,
      y: p.y - 3.0,
      z: p.z + 8.0,
    }));
    const postureTranslated = extractNormalizedPosture(translatedFrame);

    // Uniformly scale by 2.0x
    const scaledFrame = baseFrame.map(p => ({
      ...p,
      x: p.x * 2.0,
      y: p.y * 2.0,
      z: p.z * 2.0,
    }));
    const postureScaled = extractNormalizedPosture(scaledFrame);

    for (let k = 0; k < postureBase.length; k++) {
      expect(postureTranslated[k]).toBeCloseTo(postureBase[k], 4);
      expect(postureScaled[k]).toBeCloseTo(postureBase[k], 4);
    }
  });

  it('accurately estimates dominant recurrence period T from Self-Similarity Matrix', () => {
    const targetPeriod = 2.0;
    const { frames, timestamps } = generateSyntheticSquatFrames(5, targetPeriod, 15);
    const postures = frames.map(f => extractNormalizedPosture(f as WorldLandmark[]));
    const ssm = buildSelfSimilarityMatrix(postures);
    const estimatedT = estimateDominantPeriod(ssm, timestamps);

    expect(estimatedT).toBeGreaterThanOrEqual(1.7);
    expect(estimatedT).toBeLessThanOrEqual(2.3);
  });

  it('decomposes synthetic repetitions and builds canonical phase envelope', () => {
    const numReps = 4;
    const repPeriod = 2.0;
    const { frames, timestamps } = generateSyntheticSquatFrames(numReps, repPeriod, 15);

    const result = runUniversalRecurrenceSegmenter(frames, timestamps);

    expect(result.reps.length).toBe(numReps);
    expect(result.canonicalEnvelope).not.toBeNull();

    if (result.canonicalEnvelope) {
      expect(result.canonicalEnvelope.tau.length).toBe(50);
      expect(result.canonicalEnvelope.meanTrajectory.length).toBe(50);
      expect(result.canonicalEnvelope.stdTrajectory.length).toBe(50);
      // Turnaround / bottom should be centered around mid-phase (~0.5)
      expect(result.canonicalEnvelope.peakPhaseTau).toBeGreaterThan(0.35);
      expect(result.canonicalEnvelope.peakPhaseTau).toBeLessThan(0.65);
    }
  });

  it('runs successfully on real phone recorded landmark stream from repository', () => {
    const fixturePath = path.resolve(
      __dirname,
      '../../../../test/real-phone/landmarks/bicep_curl_7_side_mufhf3wy.json.gz'
    );
    const raw = readFileSync(fixturePath);
    const data = JSON.parse(gunzipSync(raw).toString());

    expect(data.worldLandmarks).toBeDefined();
    expect(data.timestamps).toBeDefined();

    const result = runUniversalRecurrenceSegmenter(data.worldLandmarks, data.timestamps);

    // Label is 7 reps; recurrence segmenter identifies the periodic cycles
    expect(result.reps.length).toBeGreaterThanOrEqual(6);
    expect(result.reps.length).toBeLessThanOrEqual(8);
    expect(result.estimatedPeriodSec).toBeGreaterThan(1.0);
    expect(result.estimatedPeriodSec).toBeLessThan(4.0);
  });
});
