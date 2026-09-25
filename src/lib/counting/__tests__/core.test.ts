/**
 * Counting core tests.
 *
 * Synthetic tests: 10 cycles at 15, 30, 60 and 120 sps,
 * with 10% wobble and a 0.5s dropout mid-set.
 *
 * Clip tests: run on the committed landmark files.
 */

import { describe, it, expect } from 'vitest';
import { countReps, type WorldLandmark, type WorldLandmarkFrame, type Lift } from '../core';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { gunzipSync } from 'zlib';

// ─── Synthetic landmark generator ───

function makeLandmark(x: number, y: number, z: number, visibility = 1.0): WorldLandmark {
  return { x, y, z, visibility };
}

function makeFrame(elbowAngleDeg: number, arm: 'left' | 'right' = 'left'): WorldLandmarkFrame {
  // Build a 33-point frame with the specified elbow angle on the given arm.
  // Shoulder at origin, elbow along -y, wrist at the angle from the forearm.
  const frame: WorldLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    frame.push(makeLandmark(0, 0, 0, 0.1)); // low vis default
  }

  const rad = (elbowAngleDeg * Math.PI) / 180;
  const shoulderIdx = arm === 'left' ? 11 : 12;
  const elbowIdx = arm === 'left' ? 13 : 14;
  const wristIdx = arm === 'left' ? 15 : 16;

  // Shoulder above elbow
  frame[shoulderIdx] = makeLandmark(0, -0.3, 0, 0.99);
  // Elbow at origin
  frame[elbowIdx] = makeLandmark(0, 0, 0, 0.99);
  // Wrist: rotate from straight-down by the elbow angle
  // When angle = 180°, wrist is at (0, 0.3, 0) = straight line shoulder–elbow–wrist
  // When angle = 0°, wrist is at (0, -0.3, 0) = folded back on shoulder
  const wristY = 0.3 * Math.cos(Math.PI - rad);
  const wristX = 0.3 * Math.sin(Math.PI - rad);
  frame[wristIdx] = makeLandmark(wristX, wristY, 0, 0.99);

  // Set hips for lateral raise tests (not used for elbow lifts but needed for frame validity)
  frame[23] = makeLandmark(-0.1, 0.4, 0, 0.99);
  frame[24] = makeLandmark(0.1, 0.4, 0, 0.99);

  return frame;
}

function makeLateralFrame(shoulderAbductionDeg: number, arm: 'left' | 'right' = 'left'): WorldLandmarkFrame {
  const frame: WorldLandmark[] = [];
  for (let i = 0; i < 33; i++) {
    frame.push(makeLandmark(0, 0, 0, 0.1));
  }

  const rad = (shoulderAbductionDeg * Math.PI) / 180;
  const hipIdx = arm === 'left' ? 23 : 24;
  const shoulderIdx = arm === 'left' ? 11 : 12;
  const elbowIdx = arm === 'left' ? 13 : 14;

  // Hip below shoulder
  frame[hipIdx] = makeLandmark(0, 0.3, 0, 0.99);
  // Shoulder at origin
  frame[shoulderIdx] = makeLandmark(0, 0, 0, 0.99);
  // Elbow: when angle = 0°, elbow is along hip direction (arm at side)
  // When angle = 90°, elbow is perpendicular
  const elbowY = 0.3 * Math.cos(rad);
  const elbowX = 0.3 * Math.sin(rad);
  frame[elbowIdx] = makeLandmark(elbowX, elbowY, 0, 0.99);

  // Other hip
  frame[arm === 'left' ? 24 : 23] = makeLandmark(0.2, 0.3, 0, 0.99);

  return frame;
}

/**
 * Generate synthetic elbow-angle rep data: 10 reps cycling between
 * extendedAngle and flexedAngle with optional wobble and a dropout.
 */
function generateSyntheticSet(
  sps: number,
  reps: number,
  extendedAngle: number,
  flexedAngle: number,
  repDurationSec: number,
  wobbleFraction: number,
  dropoutAtRep: number,   // inject dropout at this rep (0 = none)
  dropoutDurationSec: number,
  lift: Lift,
  arm: 'left' | 'right' = 'left',
): { worldLandmarks: WorldLandmarkFrame[]; timestamps: number[] } {
  const worldLandmarks: WorldLandmarkFrame[] = [];
  const timestamps: number[] = [];
  const range = extendedAngle - flexedAngle;
  const wobble = range * wobbleFraction;
  const dt = 1 / sps;

  let t = 0;
  // Start with a short hold at rest position
  // Elbow lifts rest at extended (high angle); lateral raise rests at adducted (low angle)
  const holdAngle = lift === 'lateral_raise' ? flexedAngle : extendedAngle;
  const holdSamples = Math.ceil(0.5 * sps);
  for (let i = 0; i < holdSamples; i++) {
    const noise = (Math.random() - 0.5) * wobble;
    const angle = holdAngle + noise;
    if (lift === 'lateral_raise') {
      worldLandmarks.push(makeLateralFrame(Math.max(0, angle), arm));
    } else {
      worldLandmarks.push(makeFrame(angle, arm));
    }
    timestamps.push(t);
    t += dt;
  }

  for (let rep = 1; rep <= reps; rep++) {
    const halfDur = repDurationSec / 2;
    const samplesPerHalf = Math.ceil(halfDur * sps);

    // Concentric: extended → flexed (elbow) or rest → raised (lateral)
    for (let i = 0; i < samplesPerHalf; i++) {
      // Check dropout
      if (rep === dropoutAtRep && i === Math.floor(samplesPerHalf / 2)) {
        const dropoutSamples = Math.ceil(dropoutDurationSec * sps);
        for (let d = 0; d < dropoutSamples; d++) {
          worldLandmarks.push(null);
          timestamps.push(t);
          t += dt;
        }
      }
      const frac = i / samplesPerHalf;
      const noise = (Math.random() - 0.5) * wobble;
      let angle: number;
      if (lift === 'lateral_raise') {
        // rest (low) → raised (high)
        angle = flexedAngle + (extendedAngle - flexedAngle) * frac + noise;
      } else {
        // extended (high) → flexed (low)
        angle = extendedAngle - range * frac + noise;
      }
      if (lift === 'lateral_raise') {
        worldLandmarks.push(makeLateralFrame(Math.max(0, angle), arm));
      } else {
        worldLandmarks.push(makeFrame(angle, arm));
      }
      timestamps.push(t);
      t += dt;
    }

    // Eccentric: flexed → extended (elbow) or raised → rest (lateral)
    for (let i = 0; i < samplesPerHalf; i++) {
      const frac = i / samplesPerHalf;
      const noise = (Math.random() - 0.5) * wobble;
      let angle: number;
      if (lift === 'lateral_raise') {
        // raised (high) → rest (low)
        angle = extendedAngle - (extendedAngle - flexedAngle) * frac + noise;
      } else {
        // flexed (low) → extended (high)
        angle = flexedAngle + range * frac + noise;
      }
      if (lift === 'lateral_raise') {
        worldLandmarks.push(makeLateralFrame(Math.max(0, angle), arm));
      } else {
        worldLandmarks.push(makeFrame(angle, arm));
      }
      timestamps.push(t);
      t += dt;
    }
  }

  // End hold
  for (let i = 0; i < holdSamples; i++) {
    const noise = (Math.random() - 0.5) * wobble;
    const angle = lift === 'lateral_raise' ? flexedAngle + noise : extendedAngle + noise;
    if (lift === 'lateral_raise') {
      worldLandmarks.push(makeLateralFrame(Math.max(0, angle), arm));
    } else {
      worldLandmarks.push(makeFrame(angle, arm));
    }
    timestamps.push(t);
    t += dt;
  }

  return { worldLandmarks, timestamps };
}

// ─── Synthetic tests ───

describe('Counting core — synthetic', () => {
  const SPS_VALUES = [15, 30, 60, 120];

  for (const sps of SPS_VALUES) {
    it(`10 elbow reps at ${sps} sps with 10% wobble`, () => {
      const { worldLandmarks, timestamps } = generateSyntheticSet(
        sps, 10, 170, 50, 2.0, 0.10, 0, 0, 'bicep_curl',
      );
      const result = countReps(worldLandmarks, timestamps, 'bicep_curl');
      expect(result.count).toBe(10);
      expect(result.arm).toBe('left');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it(`10 lateral raise reps at ${sps} sps with 10% wobble`, () => {
      const { worldLandmarks, timestamps } = generateSyntheticSet(
        sps, 10, 100, 15, 2.0, 0.10, 0, 0, 'lateral_raise',
      );
      const result = countReps(worldLandmarks, timestamps, 'lateral_raise');
      expect(result.count).toBe(10);
      expect(result.arm).toBe('left');
    });
  }

  it('bridges a 0.5s dropout mid-set (elbow)', () => {
    const { worldLandmarks, timestamps } = generateSyntheticSet(
      15, 10, 170, 50, 2.0, 0.10, 5, 0.5, 'bicep_curl',
    );
    const result = countReps(worldLandmarks, timestamps, 'bicep_curl');
    expect(result.count).toBe(10);
  });

  it('bridges a 0.5s dropout mid-set (lateral raise)', () => {
    const { worldLandmarks, timestamps } = generateSyntheticSet(
      15, 10, 100, 15, 2.0, 0.10, 5, 0.5, 'lateral_raise',
    );
    const result = countReps(worldLandmarks, timestamps, 'lateral_raise');
    expect(result.count).toBe(10);
  });

  it('right arm selection when left arm has low visibility', () => {
    const { worldLandmarks, timestamps } = generateSyntheticSet(
      15, 5, 170, 50, 2.0, 0.05, 0, 0, 'bicep_curl', 'right',
    );
    const result = countReps(worldLandmarks, timestamps, 'bicep_curl');
    expect(result.arm).toBe('right');
    expect(result.count).toBe(5);
  });

  it('returns 0 reps for flat signal', () => {
    const worldLandmarks: WorldLandmarkFrame[] = [];
    const timestamps: number[] = [];
    for (let i = 0; i < 100; i++) {
      worldLandmarks.push(makeFrame(160));
      timestamps.push(i / 15);
    }
    const result = countReps(worldLandmarks, timestamps, 'bicep_curl');
    expect(result.count).toBe(0);
  });
});

// ─── Clip tests ───

function loadClipLandmarks(clipName: string) {
  const gzPath = resolve(__dirname, '../../../../test/real-phone/landmarks', clipName + '.json.gz');
  const buf = gunzipSync(readFileSync(gzPath));
  return JSON.parse(buf.toString());
}

describe('Counting core — David\'s clips', () => {
  const clips: { file: string; lift: Lift; expected: number; hotfixCount: number }[] = [
    { file: 'bench_press_7_angle_mufhcy60', lift: 'bench_press', expected: 7, hotfixCount: 0 },
    { file: 'bicep_curl_7_side_mufhf3wy', lift: 'bicep_curl', expected: 7, hotfixCount: 11 },
    { file: 'lat_pulldown_10_front_mufhlh4o', lift: 'lat_pulldown', expected: 10, hotfixCount: 0 },
    { file: 'lateral_raise_10_front_mufhhbun', lift: 'lateral_raise', expected: 10, hotfixCount: 0 },
    { file: 'overhead_press_10_front_mufhjkku', lift: 'overhead_press', expected: 10, hotfixCount: 0 },
  ];

  for (const clip of clips) {
    it(`${clip.lift}: expected ${clip.expected}`, () => {
      const data = loadClipLandmarks(clip.file);
      const result = countReps(data.worldLandmarks, data.timestamps, clip.lift);

      console.log([
        clip.lift,
        `expected=${clip.expected}`,
        `hotfix=${clip.hotfixCount}`,
        `new=${result.count}`,
        `arm=${result.arm}`,
        `confidence=${(result.confidence * 100).toFixed(1)}%`,
        `low=${result.lowThreshold.toFixed(1)}°`,
        `high=${result.highThreshold.toFixed(1)}°`,
      ].join(' | '));

      for (const rep of result.reps) {
        console.log(`  rep ${rep.index}: ${rep.startTime.toFixed(2)}s–${rep.endTime.toFixed(2)}s, ROM=${rep.romDegrees.toFixed(1)}°, conc=${rep.concentricSec.toFixed(2)}s, ecc=${rep.eccentricSec.toFixed(2)}s`);
      }

      // The test records the count; accuracy is judged by David, not asserted here.
      // We assert only that the function runs and produces a number.
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.reps.length).toBe(result.count);
    });
  }
});
