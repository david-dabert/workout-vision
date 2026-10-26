import { describe, it, expect } from 'vitest';
import {
  decodeBiomechanicalPhases,
  PHASE_NAMES,
  BiomechanicalDecodeResult,
} from '../BiomechanicalDecoder';

describe('Biomechanical Continuous Temporal Beam Decoder', () => {
  it('returns safe default values for empty or insufficient inputs', () => {
    const res = decodeBiomechanicalPhases([], []);
    expect(res.count).toBe(0);
    expect(res.reps).toEqual([]);
    expect(res.states).toEqual([]);

    const short = decodeBiomechanicalPhases([100, 105, 102], [0.1, 0.2, 0.3]);
    expect(short.count).toBe(0);
  });

  it('rejects flat signals where total excursion is below threshold', () => {
    // 30 samples of isometric standing (80 degrees with slight 1 deg jitter)
    const timestamps = Array.from({ length: 30 }, (_, i) => i * 0.1);
    const angles = timestamps.map((_, i) => 80 + Math.sin(i * 0.5) * 1.0);

    const res = decodeBiomechanicalPhases(angles, timestamps, { minRomDegrees: 20 });
    expect(res.count).toBe(0);
    expect(res.reps.length).toBe(0);
  });

  it('decodes clean cyclic squats into distinct movement phases and reps', () => {
    // Simulate 3 clean squats:
    // Standing rest at 170 deg, squatting to 80 deg (90 deg ROM), back to 170 deg.
    // 3 seconds per rep (1.5s eccentric, 0.3s pause, 1.2s concentric) at 20 fps (0.05s steps).
    const fps = 20;
    const dt = 1 / fps;
    const timestamps: number[] = [];
    const angles: number[] = [];

    // 1 second setup
    for (let t = 0; t <= 1.0; t += dt) {
      timestamps.push(t);
      angles.push(170);
    }

    // 3 reps
    let curTime = 1.0 + dt;
    for (let r = 0; r < 3; r++) {
      // Eccentric (1.4s): 170 down to 80
      for (let t = 0; t <= 1.4; t += dt) {
        timestamps.push(curTime);
        const progress = t / 1.4;
        angles.push(170 - progress * 90);
        curTime += dt;
      }
      // Amortization inflection (0.3s): hold around 80
      for (let t = 0; t <= 0.3; t += dt) {
        timestamps.push(curTime);
        angles.push(80);
        curTime += dt;
      }
      // Concentric (1.2s): 80 up to 170
      for (let t = 0; t <= 1.2; t += dt) {
        timestamps.push(curTime);
        const progress = t / 1.2;
        angles.push(80 + progress * 90);
        curTime += dt;
      }
      // Brief top pause (0.5s)
      for (let t = 0; t <= 0.5; t += dt) {
        timestamps.push(curTime);
        angles.push(170);
        curTime += dt;
      }
    }

    const res: BiomechanicalDecodeResult = decodeBiomechanicalPhases(angles, timestamps, {
      restType: 'high',
      minRomDegrees: 40,
    });

    expect(res.count).toBe(3);
    expect(res.reps.length).toBe(3);

    // Verify first rep phase structure
    const rep1 = res.reps[0];
    expect(rep1.repIndex).toBe(1);
    expect(rep1.romDegrees).toBeGreaterThanOrEqual(80);
    expect(rep1.eccentricSec).toBeGreaterThanOrEqual(1.0);
    expect(rep1.concentricSec).toBeGreaterThanOrEqual(0.8);
    expect(rep1.turnaroundTime).toBeGreaterThan(rep1.startTime);
    expect(rep1.endTime).toBeGreaterThan(rep1.turnaroundTime);

    // Verify states coverage
    expect(res.states).toContain('SETUP');
    expect(res.states).toContain('ECCENTRIC');
    expect(res.states).toContain('AMORTIZATION');
    expect(res.states).toContain('CONCENTRIC');
    expect(res.turnarounds.length).toBe(3);
  });

  it('filters out impossible physical angular acceleration jumps (Skeletal Prior)', () => {
    // 2 clean reps, but with a sudden 1-frame MediaPipe tracking anomaly (+8000 deg/s teleportation spike)
    const fps = 20;
    const dt = 1 / fps;
    const timestamps: number[] = [];
    const angles: number[] = [];

    let curTime = 0;
    for (let r = 0; r < 2; r++) {
      // Eccentric: 170 to 85
      for (let t = 0; t <= 1.2; t += dt) {
        timestamps.push(curTime);
        angles.push(170 - (t / 1.2) * 85);
        curTime += dt;
      }
      // In middle of rep 1 turnaround, insert a wild single-frame glitch (snapping to 180 then back)
      if (r === 0) {
        timestamps.push(curTime);
        angles.push(180); // Teleportation spike
        curTime += dt;
      }
      // Concentric: 85 to 170
      for (let t = 0; t <= 1.2; t += dt) {
        timestamps.push(curTime);
        angles.push(85 + (t / 1.2) * 85);
        curTime += dt;
      }
      // Pause
      for (let t = 0; t <= 0.4; t += dt) {
        timestamps.push(curTime);
        angles.push(170);
        curTime += dt;
      }
    }

    const res = decodeBiomechanicalPhases(angles, timestamps, { restType: 'high' });
    // The glitch must be rejected by acceleration gating and not split or break the rep count
    expect(res.count).toBe(2);
  });

  it('handles partial occlusions (null gaps) smoothly without dropping reps', () => {
    const fps = 20;
    const dt = 1 / fps;
    const timestamps: number[] = [];
    const angles: (number | null)[] = [];

    let curTime = 0;
    for (let r = 0; r < 2; r++) {
      // Eccentric
      for (let t = 0; t <= 1.2; t += dt) {
        timestamps.push(curTime);
        angles.push(170 - (t / 1.2) * 85);
        curTime += dt;
      }
      // Occlusion gap (3 consecutive null frames behind a plate)
      for (let k = 0; k < 3; k++) {
        timestamps.push(curTime);
        angles.push(null);
        curTime += dt;
      }
      // Concentric
      for (let t = 0; t <= 1.2; t += dt) {
        timestamps.push(curTime);
        angles.push(85 + (t / 1.2) * 85);
        curTime += dt;
      }
      // Pause
      for (let t = 0; t <= 0.4; t += dt) {
        timestamps.push(curTime);
        angles.push(170);
        curTime += dt;
      }
    }

    const res = decodeBiomechanicalPhases(angles, timestamps, { restType: 'high' });
    expect(res.count).toBe(2);
    expect(res.reps.length).toBe(2);
  });
});
