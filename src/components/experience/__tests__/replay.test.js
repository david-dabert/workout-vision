/**
 * The replay: the body drawn at a moment of the video is the one tracked there,
 * the rep on screen is the one whose boundaries hold that moment, and its phases
 * are the ones the report measures.
 */
import { describe, it, expect } from 'vitest';
import { poseAt, repAt, phaseAt, nearest, angleAt, barLandmarks, loadPointAt, trajectoryAt } from '../replay-track';

const body = (x, visibility = 0.9) => Array.from({ length: 33 }, (_, k) => ({ x: x + k / 100, y: 0.5, visibility }));
const times = [0, 1 / 15, 2 / 15, 3 / 15];

describe('the tracked body at a moment of the video', () => {
  it('moves each point in a straight line between two samples', () => {
    const frames = [body(0.2), body(0.3), body(0.4), body(0.5)];
    const p = poseAt(frames, times, 0.5 / 15);
    expect(p[0].x).toBeCloseTo(0.25, 9);
    expect(p[13].x).toBeCloseTo(0.38, 9);
    expect(p[13].y).toBeCloseTo(0.5, 9);
  });

  it('shows a point only where both samples saw it', () => {
    const p = poseAt([body(0.2, 0.9), body(0.3, 0.2)], [0, 1 / 15], 0.2 / 15);
    expect(p[0].visibility).toBe(0.2);
  });

  it('draws nothing more than a tenth of a second before the first sample or after the last', () => {
    const frames = [body(0.2), body(0.3), body(0.4), body(0.5)];
    expect(poseAt(frames, times, -0.05)).toBe(frames[0]);
    expect(poseAt(frames, times, -0.15)).toBe(null);
    expect(poseAt(frames, times, 0.29)).toBe(frames[3]);
    expect(poseAt(frames, times, 0.31)).toBe(null);
    expect(poseAt([], [], 0)).toBe(null);
  });

  it('never draws a line across a gap in the samples: the nearest sample stands', () => {
    const frames = [body(0.2), body(0.6)];
    expect(poseAt(frames, [0, 0.5], 0.1)).toBe(frames[0]);
    expect(poseAt(frames, [0, 0.5], 0.4)).toBe(frames[1]);
  });

  it('draws nothing where the nearest sample found no one', () => {
    const frames = [body(0.2), null, body(0.4)];
    expect(poseAt(frames, [0, 1 / 15, 2 / 15], 0.9 / 15)).toBe(null);
    expect(poseAt(frames, [0, 1 / 15, 2 / 15], 0.2 / 15)).toBe(frames[0]);
  });

  it('finds the sample nearest a moment', () => {
    expect(nearest(times, 0.4 / 15)).toBe(0);
    expect(nearest(times, 0.6 / 15)).toBe(1);
    expect(nearest(times, -1)).toBe(0);
    expect(nearest(times, 9)).toBe(3);
  });
});

const rep = (start, end, conc, ecc, extra = {}) => ({ startTime: start, endTime: end, concentricSec: conc, eccentricSec: ecc, romDegrees: 90, ...extra });

describe('the rep on screen', () => {
  it('is the rep whose start and end hold the moment, and none between reps', () => {
    const reps = [rep(1, 3, 0.8, 1), rep(4, 6, 0.8, 1)];
    expect(repAt(reps, 0.5)).toBe(-1);
    expect(repAt(reps, 1)).toBe(0);
    expect(repAt(reps, 3.5)).toBe(-1);
    expect(repAt(reps, 6)).toBe(1);
  });

  it('is the latest begun when two reps overlap, as when the arms alternate', () => {
    expect(repAt([rep(1, 3, 0.8, 1), rep(2.5, 4.5, 0.8, 1)], 2.8)).toBe(1);
  });
});

describe('the phase on screen', () => {
  it('curl: concentric from the start, a hold at the top, eccentric to the end', () => {
    const r = rep(1, 3.2, 0.8, 1);
    expect(phaseAt(r, 1.5, 'concentric')).toBe('concentric');
    expect(phaseAt(r, 2, 'concentric')).toBe(null);
    expect(phaseAt(r, 2.5, 'concentric')).toBe('eccentric');
  });

  it('bench press: eccentric first', () => {
    const r = rep(1, 3.2, 0.8, 1);
    expect(phaseAt(r, 1.5, 'eccentric')).toBe('eccentric');
    expect(phaseAt(r, 3, 'eccentric')).toBe('concentric');
  });

  it('a rep the recording cut has no phases', () => {
    expect(phaseAt(rep(0, 1.1, 0.1, 1, { clipped: true }), 0.05, 'concentric')).toBe(null);
  });
});

// The replay line's keys (Replay.jsx, keys): a slider's keys, one rep a step (audit of 6 October: Up and Down did nothing).
import { keyedTime, into } from '../replay-track';
describe('the keys of the replay line', () => {
  const reps = [{ startTime: 1, endTime: 2 }, { startTime: 3, endTime: 4 }, { startTime: 5, endTime: 6 }];
  it('goes to the next rep with Right, Up and Page Up, to the previous with Left, Down and Page Down', () => {
    for (const key of ['ArrowRight', 'ArrowUp', 'PageUp']) expect(keyedTime(key, reps, 3.04, 8), key).toBe(into(reps[2]));
    for (const key of ['ArrowLeft', 'ArrowDown', 'PageDown']) expect(keyedTime(key, reps, 3.04, 8), key).toBe(into(reps[0]));
  });
  it('goes to the ends past the first and last rep, and with Home and End', () => {
    expect(keyedTime('ArrowUp', reps, 5.5, 8)).toBe(8);
    expect(keyedTime('ArrowDown', reps, 0.5, 8)).toBe(0);
    expect(keyedTime('Home', reps, 4, 8)).toBe(0);
    expect(keyedTime('End', reps, 4, 8)).toBe(8);
  });
  it('leaves every other key alone', () => {
    for (const key of ['Enter', ' ', 'Tab', 'a']) expect(keyedTime(key, reps, 3, 8)).toBe(null);
  });
});

describe('the 3D angle and bar path trajectory on screen', () => {
  it('reads the joint angle at the time nearest t', () => {
    const angles = [170, 140, 100, 85];
    const ts = [0, 1, 2, 3];
    expect(angleAt(angles, ts, 0.2)).toBe(170);
    expect(angleAt(angles, ts, 1.8)).toBe(100);
    expect(angleAt(angles, ts, 2.9)).toBe(85);
    expect(angleAt(null, ts, 1)).toBe(null);
    expect(angleAt([null, 90], [0, 1], 0)).toBe(null);
  });

  it('selects the correct landmarks for barbell/load position', () => {
    expect(barLandmarks('squat', { joint: 'knee' })).toEqual([11, 12]);
    expect(barLandmarks('hip_thrust', { joint: 'hip' })).toEqual([23, 24]);
    expect(barLandmarks('leg_extension', { joint: 'knee' })).toEqual([27, 28]);
    expect(barLandmarks('bench_press', { joint: 'elbow' })).toEqual([15, 16]);
    expect(barLandmarks('bicep_curl', { joint: 'elbow' })).toEqual([15, 16]);
  });

  it('extracts load point taking into account visibility and side', () => {
    const f = body(0.5, 0.9);
    f[15] = { x: 0.3, y: 0.4, visibility: 0.9 };
    f[16] = { x: 0.5, y: 0.4, visibility: 0.9 };
    // Midpoint when both visible
    expect(loadPointAt(f, 'bench_press', { joint: 'elbow' }, 'both')).toEqual({ x: 0.4, y: 0.4 });
    // Left wrist when left arm
    expect(loadPointAt(f, 'bicep_curl', { joint: 'elbow' }, 'left')).toEqual({ x: 0.3, y: 0.4 });
    // Right wrist when right arm
    expect(loadPointAt(f, 'bicep_curl', { joint: 'elbow' }, 'right')).toEqual({ x: 0.5, y: 0.4 });
    // Hidden when visibility below threshold
    f[15].visibility = 0.2;
    expect(loadPointAt(f, 'bicep_curl', { joint: 'elbow' }, 'left')).toBe(null);
  });

  it('generates trajectory during active rep and fading trail outside rep', () => {
    const frames = [body(0.1), body(0.2), body(0.3), body(0.4), body(0.5)];
    const ts = [0, 1, 2, 3, 4];
    const r = rep(1, 3, 1, 1);
    // Inside rep: points within [startTime, endTime]
    const repTraj = trajectoryAt(frames, ts, 2, r, 'bench_press', { joint: 'elbow' }, 'both');
    expect(repTraj.length).toBeGreaterThanOrEqual(3);
    expect(repTraj[0].t).toBe(1);
    // Outside rep: trailing points
    const trail = trajectoryAt(frames, ts, 3.5, null, 'bench_press', { joint: 'elbow' }, 'both');
    expect(trail.length).toBeGreaterThanOrEqual(1);
  });
});
