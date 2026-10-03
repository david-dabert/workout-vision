/**
 * Counting core findings of the audit of 2 October (Astra, on 3f55fcf), each with the synthetic case that
 * showed it. FINDING-010: a lost pose did not end a rep, so a rise seen before a long gap and a return seen
 * after it made a rep whose middle nobody saw.
 */
import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 15;
const frames = (a: number[], joint: 'elbow' | 'knee' = 'elbow') => a.map(x => jointFrame(joint, { left: x, right: x }));

describe('a lost pose ends the rep it falls in (FINDING-010)', () => {
  // Expected to fail: the fix tried on 2 October cost 11 exact public sets (TRIED.md); the case stays visible.
  it.fails('a curl up, three seconds unseen, then down: no rep is made of what was not seen', () => {
    const a = sample([{ hold: 165, sec: 1 }, { to: 50, sec: 0.8 }, { hold: 50, sec: 3.4 }, { to: 165, sec: 0.8 }, { hold: 165, sec: 1 },
      ...cycles({ rest: 165, work: 50, reps: 4, firstSec: 0.8, secondSec: 1, restSec: 0.6 })], 165, SPS);
    const ts = timestamps(a.length, SPS);
    const wl = frames(a).map((f, i) => (ts[i] > 2 && ts[i] < 5 ? null : f));
    expect(countReps(wl, ts, 'bicep_curl').count).toBe(4);
  });
  it('a short dropout, bridged, still keeps its rep', () => {
    const a = sample(cycles({ rest: 165, work: 50, reps: 6, firstSec: 0.8, secondSec: 1, restSec: 0.6 }), 165, SPS);
    const ts = timestamps(a.length, SPS);
    const wl = frames(a).map((f, i) => (ts[i] > 2.0 && ts[i] < 2.3 ? null : f));
    expect(countReps(wl, ts, 'bicep_curl').count).toBe(6);
  });
});

describe('a rep done with both arms keeps one arm\'s measurements (FINDING-013)', () => {
  it('its phases and speeds are those of the arm with the larger range, its cut mark either arm\'s', () => {
    // Both arms curl together; the left goes further and slower, the right shorter and faster.
    const left = sample(cycles({ rest: 165, work: 45, reps: 5, firstSec: 1.2, secondSec: 1.2, restSec: 0.6 }), 165, SPS);
    const right = sample(cycles({ rest: 165, work: 90, reps: 5, firstSec: 0.8, secondSec: 1.6, restSec: 0.6 }), 165, SPS);
    const n = Math.min(left.length, right.length), ts = timestamps(n, SPS);
    const wl = ts.map((_, i) => jointFrame('elbow', { left: left[i], right: right[i] }));
    const r = countReps(wl, ts, 'bicep_curl_alternating');
    const both = r.reps.filter(x => x.side === 'both');
    expect(both.length).toBeGreaterThan(0);
    for (const m of both) {
      const l = r.sides!.left.reps.find(x => Math.abs(x.startTime - m.startTime) < 1.5)!;
      const rr = r.sides!.right.reps.find(x => Math.abs(x.startTime - m.startTime) < 1.5)!;
      const big = l.romDegrees >= rr.romDegrees ? l : rr;
      expect(m.romDegrees).toBe(big.romDegrees);
      expect(m.concentricSec).toBe(big.concentricSec);
      expect(m.eccentricSec).toBe(big.eccentricSec);
      expect(m.peakSpeed).toBe(big.peakSpeed);
      expect(m.meanSpeed).toBe(big.meanSpeed);
    }
  });
});

import { summarizeCount } from '../../coreAnalysis';

describe('a two-sided exercise needs both sides in sight (FINDING-012)', () => {
  it('one arm hidden for the whole set: refused, not counted on the arm in sight', () => {
    const a = sample(cycles({ rest: 165, work: 50, reps: 8, firstSec: 0.8, secondSec: 1, restSec: 0.6 }), 165, SPS);
    const ts = timestamps(a.length, SPS);
    const wl = a.map(x => jointFrame('elbow', { left: x }));
    const r: { refused: boolean } = summarizeCount(wl, ts, 'bicep_curl_alternating');
    expect(r.refused).toBe(true);
  });
  it('both arms in sight: counted', () => {
    const a = sample(cycles({ rest: 165, work: 50, reps: 8, firstSec: 0.8, secondSec: 1, restSec: 0.6 }), 165, SPS);
    const ts = timestamps(a.length, SPS);
    const r: { refused: boolean } = summarizeCount(a.map(x => jointFrame('elbow', { left: x, right: x })), ts, 'bicep_curl_alternating');
    expect(r.refused).toBe(false);
  });
});

describe('the side counted is the side that moves (FINDING-011)', () => {
  // Expected to fail: the fix tried on 2 October cost 7 exact public sets and 19 off by 3 or more (TRIED.md).
  it.fails('a still left arm slightly better seen does not take the count from the right arm curling', () => {
    const a = sample(cycles({ rest: 165, work: 50, reps: 8, firstSec: 0.8, secondSec: 1, restSec: 0.6 }), 165, SPS);
    const ts = timestamps(a.length, SPS);
    const wl = a.map(x => {
      const f = jointFrame('elbow', { left: 165, right: x })!;
      for (const k of [12, 14, 16]) f[k] = { ...f[k], visibility: 0.9 };
      return f;
    });
    expect(countReps(wl, ts, 'bicep_curl').count).toBe(8);
  });
});

// Second audit, 3 October: the outlier filter's median window (0.5 s, nine samples at 15 a second) spans most of a
// fast rep, so the turn of a 0.7 s curl sat more than 40° from the median and was erased as a glitch.
describe('fast reps keep their turn (second audit)', () => {
  // Expected to fail: three fixes tried on 3 October each failed a gate (TRIED.md); the case stays visible.
  it.fails('eight continuous curls of 0.7 s are eight', () => {
    const a = sample([{ hold: 160, sec: 1 }, ...cycles({ rest: 160, work: 40, reps: 8, firstSec: 0.35, secondSec: 0.35, restSec: 0 }), { hold: 160, sec: 1 }], 160, SPS);
    const ts = timestamps(a.length, SPS);
    expect(countReps(frames(a), ts, 'bicep_curl').count).toBe(8);
  });
  // A guard, not the proof of this change (it read 87° before it too): five separate 0.6 s curls stay five, and
  // their range stays over 80°. Below 120° is the rule that each end of a rep is the mean of its most extreme
  // third of a second (EXTREME_HOLD_SEC), which a 0.3 s half does not hold: a separate, experimental measure.
  it('five separate 0.6 s curls of 120° are five, each read over 80°', () => {
    const a = sample([{ hold: 160, sec: 1 }, ...cycles({ rest: 160, work: 40, reps: 5, firstSec: 0.3, secondSec: 0.3, restSec: 1 }), { hold: 160, sec: 1 }], 160, SPS);
    const ts = timestamps(a.length, SPS);
    const r = countReps(frames(a), ts, 'bicep_curl');
    expect(r.count).toBe(5);
    for (const rep of r.reps) expect(rep.romDegrees).toBeGreaterThan(80);
  });
  it('a one-sample glitch of 70° is still removed', () => {
    const a = sample([{ hold: 160, sec: 1 }, ...cycles({ rest: 160, work: 40, reps: 4, firstSec: 1, secondSec: 1, restSec: 0.6 }), { hold: 160, sec: 1 }], 160, SPS);
    const ts = timestamps(a.length, SPS);
    const glitched = a.map((x, i) => (i === 8 ? x - 70 : x));
    expect(countReps(frames(glitched), ts, 'bicep_curl').count).toBe(4);
  });
});

// Second audit, 3 October: speeds were read on the bridged angle, so the jump where a pose comes back after a
// short loss made a peak no limb made (a 0.4 s loss mid-rep: 151 °/s became 503 °/s).
describe('a bridged gap makes no speed', () => {
  it('a rep with a 0.4 s pose loss keeps the peak speed of the same rep seen whole', () => {
    const a = sample([{ hold: 165, sec: 1 }, ...cycles({ rest: 165, work: 50, reps: 4, firstSec: 1, secondSec: 1, restSec: 0.8 }), { hold: 165, sec: 1 }], 165, SPS);
    const ts = timestamps(a.length, SPS);
    const whole = countReps(frames(a), ts, 'bicep_curl');
    // The loss falls inside the second rep's rise.
    const r2 = whole.reps[1], from = r2.startTime + 0.3;
    const gapped = countReps(frames(a).map((f, i) => (ts[i] > from && ts[i] < from + 0.4 ? null : f)), ts, 'bicep_curl');
    expect(gapped.count).toBe(4);
    expect(gapped.reps[1].peakSpeed).toBeLessThan(whole.reps[1].peakSpeed * 1.25);
  });
});
