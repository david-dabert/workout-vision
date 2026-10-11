/**
 * The replay: the body drawn at a moment of the video is the one tracked there,
 * the rep on screen is the one whose boundaries hold that moment, and its phases
 * are the ones the report measures.
 */
import { describe, it, expect } from 'vitest';
import { poseAt, repAt, phaseAt, nearest } from '../replay-track';

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
