import { describe, expect, it } from 'vitest';
import { countReps, JOINT_POINTS } from '../core';
import { summarizeCount } from '../../coreAnalysis';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

describe('single-side countability before summed visibility (Phase 1.2)', () => {
  it('counts the countable side of seated_cable_row when selectSide picks an uncountable side with higher summed visibility', () => {
    const sps = 15;
    const angles = sample(cycles({ rest: 170, work: 60, reps: 8, firstSec: 0.9, secondSec: 1.0, restSec: 0.5 }), 170, sps);
    const ts = timestamps(angles.length, sps);

    // Left arm has higher summed visibility across shoulder+elbow+wrist (0.99 + 0.99 + 0.45/0.95 = ~2.63/frame),
    // yet its wrist falls below VIS_THRESHOLD (0.50) on 60% of frames so it is visible on only 40% (< 50% countable)
    // while still moving/counting partial reps on those visible frames.
    // Right arm is visible on 100% of frames at 0.70 each (sum = 2.10/frame < 2.63) and performs all 8 reps.
    const wl = angles.map((a, i) => {
      const f = jointFrame('elbow', { left: a, right: a })!;
      const [lSh, lEl, lWr] = JOINT_POINTS.elbow.left;
      const [rSh, rEl, rWr] = JOINT_POINTS.elbow.right;
      const leftWristVis = i % 5 < 2 ? 0.95 : 0.45;
      f[lSh] = { ...f[lSh], visibility: 0.99 };
      f[lEl] = { ...f[lEl], visibility: 0.99 };
      f[lWr] = { ...f[lWr], visibility: leftWristVis };
      f[rSh] = { ...f[rSh], visibility: 0.70 };
      f[rEl] = { ...f[rEl], visibility: 0.70 };
      f[rWr] = { ...f[rWr], visibility: 0.70 };
      return f;
    });

    const summary = summarizeCount(wl, ts, 'seated_cable_row');
    expect(summary.refused).toBe(false);
    expect(summary.count).toBe(8);
    expect(summary.arm).toBe('right');
  });

  it('switches from an uncountable drifting side to a countable still side instead of refusing on bad pose', () => {
    const sps = 15;
    const angles = sample([{ hold: 170, sec: 6 }], 170, sps);
    const ts = timestamps(angles.length, sps);
    const wl = angles.map((_, i) => {
      const drift = 170 - (i % 15) * 2; // >= 10 deg spread on the few visible frames
      const f = jointFrame('elbow', { left: drift, right: 170 })!;
      const [lSh, lEl, lWr] = JOINT_POINTS.elbow.left;
      const [rSh, rEl, rWr] = JOINT_POINTS.elbow.right;
      f[lSh] = { ...f[lSh], visibility: 0.99 };
      f[lEl] = { ...f[lEl], visibility: 0.99 };
      f[lWr] = { ...f[lWr], visibility: i % 3 === 0 ? 0.95 : 0.45 };
      f[rSh] = { ...f[rSh], visibility: 0.70 };
      f[rEl] = { ...f[rEl], visibility: 0.70 };
      f[rWr] = { ...f[rWr], visibility: 0.70 };
      return f;
    });

    const res = countReps(wl, ts, 'seated_cable_row');
    expect(res.arm).toBe('right');
    const summary = summarizeCount(wl, ts, 'seated_cable_row');
    expect(summary.refused).toBe(false);
    expect(summary.count).toBe(0);
  });
});
