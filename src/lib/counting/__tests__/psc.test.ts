// Unit checks of the class-agnostic counter (src/lib/counting/psc.js) on generated poses with a known count. Not a measure of
// accuracy (psc.test.ts is): these pin the mechanics (period, rest side, alternation, abstaining on stillness).
import { describe, expect, it } from 'vitest';
import { fusePsc, pickPeriod, pscCount, pscProposal } from '../psc.js';
import { PROPOSAL_MAX_SAMPLES, withProposal } from '../../coreAnalysis';

// A standing body (MediaPipe world landmarks, hips at the origin, y down) whose elbows bend `reps` times.
function body(reps: number, { period = 2, rest = 1, fs = 15, alternate = false, still = false } = {}) {
  const total = rest + reps * period * (alternate ? 0.5 : 1) + (alternate ? period / 2 : 0) + rest;
  const wl: any[] = [], ts: number[] = [];
  for (let k = 0; k * (1 / fs) <= total; k++) {
    const t = k / fs, active = t > rest && t < total - rest;
    const phase = active && !still ? ((t - rest) / period) * 2 * Math.PI : 0;
    const bend = (ph: number) => (active && !still ? (1 - Math.cos(ph)) / 2 : 0);
    // Alternating: the right arm starts half a period after the left (and stops half a period after it).
    const bl = t < total - rest - (alternate ? period / 2 : 0) ? bend(phase) : 0, br = alternate ? (t - rest > period / 2 ? bend(phase - Math.PI) : 0) : bend(phase);
    const p = (x: number, y: number, z = 0) => ({ x, y, z, visibility: 0.99 });
    const f = Array.from({ length: 33 }, () => p(0, 0));
    f[0] = p(0, -0.6); f[11] = p(0.18, -0.5); f[12] = p(-0.18, -0.5); f[23] = p(0.1, 0); f[24] = p(-0.1, 0);
    f[25] = p(0.1, 0.45); f[26] = p(-0.1, 0.45); f[27] = p(0.1, 0.9); f[28] = p(-0.1, 0.9); f[31] = p(0.1, 0.95, -0.1); f[32] = p(-0.1, 0.95, -0.1);
    // Elbow under the shoulder; the forearm swings from hanging (0) to curled (1).
    f[13] = p(0.2, -0.2); f[14] = p(-0.2, -0.2);
    const fore = (b: number) => [Math.sin(b * 2.4) * 0.25, Math.cos(b * 2.4) * 0.25];
    const [lx, ly] = fore(bl), [rx, ry] = fore(br);
    f[15] = p(0.2, -0.2 + ly, -lx); f[16] = p(-0.2, -0.2 + ry, -rx);
    wl.push(f); ts.push(t);
  }
  return { wl, ts };
}

describe('PSC bench counter', () => {
  it('counts eight curls of 2 s with rests at both ends', () => {
    const r = pscCount(body(8));
    expect(r.count).toBe(8);
    expect(r.period).toBeCloseTo(2, 0);
  });
  it('counts eight alternating curls (four per arm) as eight', () => {
    const r = pscCount(body(8, { alternate: true, period: 2.4 }));
    expect(r.alternating).toBe(true);
    expect(r.count).toBe(8);
  });
  it('gives no count for a body that does not move', () => {
    expect(pscCount(body(6, { still: true })).count).toBeNull();
  });
  it('picks the shortest of two near-equal peaks, not their double', () => {
    const prof = new Float64Array(70).fill(0);
    for (let l = 0; l < 70; l++) prof[l] = Math.max(0, Math.cos((2 * Math.PI * l) / 30)) * (l > 45 ? 0.95 : 0.9);
    expect(pickPeriod(prof, 12, 65)!.lag).toBeCloseTo(30, 0);
  });
  it('fusion: agreement on count and period is confident; low pose coverage offers the rhythm to confirm', () => {
    const psc = { count: 8, period: 2, confirm: false, coverage: 1 } as any;
    expect(fusePsc(psc, { count: 8, period: 2.1, confidence: 0.8 }).confident).toBe(true);
    expect(fusePsc({ ...psc, coverage: 0.5 }, { count: 7, period: 2, confidence: 0.8 })).toMatchObject({ count: 7, source: 'rhythm', confident: false });
    expect(fusePsc(psc, { count: 6, period: 2, confidence: 0.8 }).confident).toBe(false);
  });
});

// The app's use (8 October 2026): PSC's count offered on a refused set, to confirm (R8). pscProposal reads the set as
// the result holds it; withProposal adds it to a refused result only.
describe('PSC as a proposal on a refused set', () => {
  const set = (b: { wl: any[]; ts: number[] }) => ({ worldLandmarks: b.wl, timestamps: b.ts, imageLandmarks: b.wl.map(f => f.map((p: any) => ({ x: p.x + 0.5, y: p.y + 0.5, z: 0, visibility: p.visibility }))) });
  it('proposes the count with the times of each rep, reading the image landmarks as {x, y} objects', () => {
    const p = pscProposal(set(body(8)))!;
    expect(p.count).toBe(8);
    expect(p.reps).toHaveLength(8);
    for (const r of p.reps) expect(r.endTime).toBeGreaterThan(r.startTime);
  });
  it('proposes nothing for a body that does not move, an empty set or mismatched lengths', () => {
    expect(pscProposal(set(body(6, { still: true })))).toBeNull();
    expect(pscProposal({ worldLandmarks: [], timestamps: [] })).toBeNull();
    const b = body(8);
    expect(pscProposal({ worldLandmarks: b.wl, timestamps: b.ts.slice(1) })).toBeNull();
  });
  it('is added to a refused result only, never to a counted set or a fitness test', () => {
    const b = set(body(8));
    expect(withProposal({ ...b, refused: true, count: 0 }, 'bicep_curl').proposal).toMatchObject({ count: 8 });
    const counted = { ...b, refused: false, count: 7 };
    expect(withProposal(counted, 'bicep_curl')).toBe(counted);
    const test = { ...b, refused: true, count: 0 };
    expect(withProposal(test, 'arm_curl_test')).toBe(test);
  });
  it('is not run on a set longer than three minutes', () => {
    expect(PROPOSAL_MAX_SAMPLES).toBe(2700);
    const long = { refused: true, worldLandmarks: new Array(2701).fill(null), timestamps: Array.from({ length: 2701 }, (_, k) => k / 15) };
    expect(withProposal(long, 'bicep_curl')).toBe(long);
  });
});
