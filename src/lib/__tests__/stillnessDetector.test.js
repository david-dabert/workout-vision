import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import {
  computeMotionEnergy,
  StillnessDetector,
  detectRestBoundaries,
} from '../stillnessDetector';
import { framesFromPoseFile } from '../lifterTrack.js';

function makeLandmarks(x = 0, y = 0, z = 0) {
  // Return an array with at least indices 11, 12, 23, 24, 25, 26
  const lm = [];
  for (let i = 0; i <= 32; i++) {
    lm.push({ x: x + i * 0.01, y: y + i * 0.01, z: z + i * 0.01 });
  }
  return lm;
}

describe('Card 057: Stillness and Rest Boundary Detection', () => {
  it('computes motion energy: 0 for identical frames, proportional to displacement', () => {
    const p1 = makeLandmarks(0, 0, 0);
    const p2 = makeLandmarks(0, 0, 0);
    const p3 = makeLandmarks(0.1, 0.1, 0);

    expect(computeMotionEnergy(p1, p2, 0.033)).toBe(0);

    const energy = computeMotionEnergy(p3, p1, 0.1);
    expect(energy).toBeGreaterThan(0.5);
    expect(computeMotionEnergy(null, p1, 0.1)).toBe(0);
    expect(computeMotionEnergy(p1, null, 0.1)).toBe(0);
  });

  it('StillnessDetector tracks continuous stillness and triggers isSettled at target duration', () => {
    const detector = new StillnessDetector({ stillThreshold: 0.05, targetStillSec: 2.0 });

    const baseLm = makeLandmarks(0, 0, 0);

    // Initial frame
    let res = detector.update(baseLm, 0.0);
    expect(res.isStill).toBe(true);
    expect(res.isSettled).toBe(false);

    // 1.5 seconds of stationary rest (below 2.0s threshold)
    for (let t = 0.1; t <= 1.5; t += 0.1) {
      res = detector.update(baseLm, t);
      expect(res.isStill).toBe(true);
      expect(res.isSettled).toBe(false);
    }

    // Reach 2.1 seconds of stillness -> triggers isSettled
    for (let t = 1.6; t <= 2.1; t += 0.1) {
      res = detector.update(baseLm, t);
    }
    expect(res.isStill).toBe(true);
    expect(res.isSettled).toBe(true);
    expect(res.stillDuration).toBeGreaterThanOrEqual(2.0);

    // Sudden movement breaks stillness
    const movingLm = makeLandmarks(0.2, 0.2, 0);
    res = detector.update(movingLm, 2.2);
    expect(res.isStill).toBe(false);
    expect(res.isSettled).toBe(false);
    expect(res.stillDuration).toBe(0);
  });

  it('detectRestBoundaries identifies rest-bounded sets vs truncated sets', () => {
    // 1. Synthesize a clean set: 2.5s rest, 5s motion, 2.5s rest
    const fps = 30;
    const totalSec = 10;
    const n = fps * totalSec;
    const timestamps = [];
    const landmarks = [];

    for (let i = 0; i < n; i++) {
      const t = i / fps;
      timestamps.push(t);
      if (t < 2.5) {
        // stationary start
        landmarks.push(makeLandmarks(0, 0, 0));
      } else if (t < 7.5) {
        // active motion (sinusoidal displacement)
        const displacement = Math.sin((t - 2.5) * Math.PI * 2) * 0.15;
        landmarks.push(makeLandmarks(displacement, displacement, 0));
      } else {
        // stationary end
        landmarks.push(makeLandmarks(0, 0, 0));
      }
    }

    const cleanResult = detectRestBoundaries(landmarks, timestamps, { minRestSec: 2.0 });
    expect(cleanResult.openedAtRest).toBe(true);
    expect(cleanResult.closedAtRest).toBe(true);
    expect(cleanResult.restStartDuration).toBeGreaterThanOrEqual(2.0);
    expect(cleanResult.restEndDuration).toBeGreaterThanOrEqual(2.0);

    // 2. Synthesize a truncated set: starts in motion, ends abruptly in motion
    const truncLandmarks = [];
    const truncTimestamps = [];
    for (let i = 0; i < 90; i++) {
      const t = i / fps;
      truncTimestamps.push(t);
      const displacement = Math.sin(t * Math.PI * 4) * 0.2;
      truncLandmarks.push(makeLandmarks(displacement, displacement, 0));
    }

    const truncResult = detectRestBoundaries(truncLandmarks, truncTimestamps, { minRestSec: 2.0 });
    expect(truncResult.openedAtRest).toBe(false);
    expect(truncResult.closedAtRest).toBe(false);
  });

  it('evaluates Card 057 rest boundaries on real iPhone pose recording', () => {
    // Read recorded phone pose file: IMG_4186-seated_row-label10.json.gz
    const gzPath = resolve(process.cwd(), 'test/real-phone/phone-poses/files/IMG_4186-seated_row-label10.json.gz');
    const gzBuf = readFileSync(gzPath);
    const file = JSON.parse(gunzipSync(gzBuf).toString());
    const frames = framesFromPoseFile(file);

    const timestamps = frames.map(fr => fr.t);
    const worldLandmarks = frames.map(fr => fr.poses[0]?.world ?? null);

    const result = detectRestBoundaries(worldLandmarks, timestamps, { minRestSec: 1.5, stillThreshold: 0.15 });
    // Verify the detector evaluates real pose data without crashing
    expect(typeof result.openedAtRest).toBe('boolean');
    expect(typeof result.closedAtRest).toBe('boolean');
    expect(result.restStartDuration).toBeGreaterThanOrEqual(0);
    expect(result.restEndDuration).toBeGreaterThanOrEqual(0);
  });
});
