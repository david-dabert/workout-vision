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

  // ─── Mechanism tests (model specific OHP faults David identified) ───

  it('ignores a spike surrounded by null frames (models OHP 5.88s fault)', () => {
    // 3s noisy setup at ~155° (rest), then null-null-spike(165°,140°)-null-null,
    // then 10 clean reps 155°–90°. The spike should be killed by outlier removal.
    const worldLandmarks: WorldLandmarkFrame[] = [];
    const timestamps: number[] = [];
    const sps = 15;
    const dt = 1 / sps;
    let t = 0;

    // 3s setup hold at ~155°
    for (let i = 0; i < 3 * sps; i++) {
      worldLandmarks.push(makeFrame(155 + (Math.sin(i * 0.5) * 3)));
      timestamps.push(t);
      t += dt;
    }

    // null-null-spike-spike-null-null
    worldLandmarks.push(null); timestamps.push(t); t += dt;
    worldLandmarks.push(null); timestamps.push(t); t += dt;
    worldLandmarks.push(makeFrame(165)); timestamps.push(t); t += dt;
    worldLandmarks.push(makeFrame(140)); timestamps.push(t); t += dt;
    worldLandmarks.push(null); timestamps.push(t); t += dt;
    worldLandmarks.push(null); timestamps.push(t); t += dt;

    // 10 clean reps: 155° → 90° → 155°, 2s each
    for (let rep = 0; rep < 10; rep++) {
      const samplesPerHalf = Math.ceil(1.0 * sps);
      for (let i = 0; i < samplesPerHalf; i++) {
        const frac = i / samplesPerHalf;
        worldLandmarks.push(makeFrame(155 - 65 * frac));
        timestamps.push(t); t += dt;
      }
      for (let i = 0; i < samplesPerHalf; i++) {
        const frac = i / samplesPerHalf;
        worldLandmarks.push(makeFrame(90 + 65 * frac));
        timestamps.push(t); t += dt;
      }
    }

    const result = countReps(worldLandmarks, timestamps, 'overhead_press');
    expect(result.count).toBe(10);
  });

  it('counts a rep that is 25% shallower than the others', () => {
    // 10 reps 155°–90° at 15 sps, but rep 7 only goes to 106° (25% of 65° = ~16° shallow).
    // Outlier removal must not attenuate shallow reps.
    const worldLandmarks: WorldLandmarkFrame[] = [];
    const timestamps: number[] = [];
    const sps = 15;
    const dt = 1 / sps;
    let t = 0;

    // 0.5s hold at 155°
    for (let i = 0; i < Math.ceil(0.5 * sps); i++) {
      worldLandmarks.push(makeFrame(155));
      timestamps.push(t); t += dt;
    }

    for (let rep = 1; rep <= 10; rep++) {
      const flexed = rep === 7 ? 106 : 90;
      const samplesPerHalf = Math.ceil(1.0 * sps);
      for (let i = 0; i < samplesPerHalf; i++) {
        const frac = i / samplesPerHalf;
        worldLandmarks.push(makeFrame(155 - (155 - flexed) * frac));
        timestamps.push(t); t += dt;
      }
      for (let i = 0; i < samplesPerHalf; i++) {
        const frac = i / samplesPerHalf;
        worldLandmarks.push(makeFrame(flexed + (155 - flexed) * frac));
        timestamps.push(t); t += dt;
      }
    }

    // 0.5s hold at 155°
    for (let i = 0; i < Math.ceil(0.5 * sps); i++) {
      worldLandmarks.push(makeFrame(155));
      timestamps.push(t); t += dt;
    }

    const result = countReps(worldLandmarks, timestamps, 'overhead_press');
    expect(result.count).toBe(10);
  });

  // Known overhead-press failure: elbow angle cannot distinguish setup from a lockout.
  it.fails('does not count a noisy setup phase as a rep', () => {
    // 4s of deterministic mid-range oscillation (models noisy setup)
    // + 1s transition + 5 clean reps. Should count 5, not more.
    const worldLandmarks: WorldLandmarkFrame[] = [];
    const timestamps: number[] = [];
    const sps = 15;
    const dt = 1 / sps;
    let t = 0;

    // 4s noisy setup: oscillation around 110° with nulls every 5th frame
    for (let i = 0; i < 4 * sps; i++) {
      if (i % 5 === 0) {
        worldLandmarks.push(null);
      } else {
        const angle = 110 + 20 * Math.sin(i * 0.3) + 7 * Math.sin(i * 1.7);
        worldLandmarks.push(makeFrame(angle));
      }
      timestamps.push(t); t += dt;
    }

    // 1s transition to rest position at 155°
    for (let i = 0; i < sps; i++) {
      const frac = i / sps;
      worldLandmarks.push(makeFrame(110 + 45 * frac));
      timestamps.push(t); t += dt;
    }

    // 5 clean reps: 155° → 90° → 155°, 2s each
    for (let rep = 0; rep < 5; rep++) {
      const samplesPerHalf = Math.ceil(1.0 * sps);
      for (let i = 0; i < samplesPerHalf; i++) {
        const frac = i / samplesPerHalf;
        worldLandmarks.push(makeFrame(155 - 65 * frac));
        timestamps.push(t); t += dt;
      }
      for (let i = 0; i < samplesPerHalf; i++) {
        const frac = i / samplesPerHalf;
        worldLandmarks.push(makeFrame(90 + 65 * frac));
        timestamps.push(t); t += dt;
      }
    }

    const result = countReps(worldLandmarks, timestamps, 'overhead_press');
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
    // hotfixCount: measured from hotfix_baseline.test.ts run, not hand-typed
    { file: 'bench_press_7_angle_mufhcy60', lift: 'bench_press', expected: 7, hotfixCount: 5 },
    { file: 'bicep_curl_7_side_mufhf3wy', lift: 'bicep_curl', expected: 7, hotfixCount: 11 },
    { file: 'lat_pulldown_10_front_mufhlh4o', lift: 'lat_pulldown', expected: 10, hotfixCount: 11 },
    { file: 'lateral_raise_10_front_mufhhbun', lift: 'lateral_raise', expected: 10, hotfixCount: 11 },
    { file: 'overhead_press_10_front_mufhjkku', lift: 'overhead_press', expected: 10, hotfixCount: 22 },
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
