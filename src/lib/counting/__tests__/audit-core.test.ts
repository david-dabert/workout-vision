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
