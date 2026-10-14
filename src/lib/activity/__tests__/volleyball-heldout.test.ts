/**
 * The volleyball margins on runs never used to set them (CLAUDE.md R2, R3; docs/VISION.md, the truth lab, level 1).
 *
 * TUNING runs: the runs the engine's constants (engine.ts: ARRIVE_SHARE, SPEED_SE_K, NOISE_K, APEX_K) were set and
 * checked on: seeds 1 to 300 per rate, noise 0.5 to 1.5 px, flights of 0.40 to 0.80 s, the hip landing 0 to 5 cm lower
 * than it took off, toe-offs of 0 to 30 ms, a run-up's last contact of 0.30 s, at 15, 30, 60, 120 and 240 a second.
 * DEVELOPMENT runs, consulted while the engine was built and not used as evidence: seeds 5001 to 5300 and 100001 to
 * 100500 (first rebuild, 14 October 2026); seeds 200001 to 200300, the first held-out set, which became development
 * runs when the second review of the same day changed the engine (the takeoff's speed-read term, the flight-time cap
 * as a check, engine.ts); seeds 7001 to 7060 and 8001 to 8100 (the bias checks below were sized on them).
 * HELD-OUT runs: seeds 400001 to 400300 per rate, first run after the second review's changes were frozen, in
 * conditions wider than the tuning's: noise 0 to 2 px, flights of 0.25 to 1.00 s, the hip landing 0 to 8 cm lower,
 * toe-offs of 0 to 40 ms, last contacts of 0.20 to 0.50 s, and four frame rates never tuned on (20, 24, 25 and 50 a
 * second). The bias, noise-free and hip checks below run on their own fresh seeds (410001 and up).
 *
 * Each run is one jump on a 360x640 frame, standing or after a three-stride run-up, at a random phase. The generator
 * (synthetic.ts) is the engine's only judge here: these are not filmed people, and the pose model's own errors come on
 * top (level 2 and 3). TOE_LAG_MAX in engine.ts is an assumption equal to the top of the held-out toe-offs: a toe that
 * takes longer than 40 ms to reach the body's speed is outside what this test can vouch for. The hip is the generator's
 * centre of mass unless a run says otherwise (the hip check, last): the engine takes it for one.
 */
import { describe, expect, it } from 'vitest';
import { gaussian, seeded } from '../../counting/__tests__/synthetic';
import { G, runActivity, TOE_LAG_MAX } from '../engine';
import { volleyball } from '../specs/volleyball';
import { syntheticBodyAt, syntheticJumps } from '../synthetic';

type Range = [number, number];
interface Conditions { noise: Range; flight: Range; drop: Range; lag: Range; plant: Range; hipShift?: Range }

const TUNING: Conditions = { noise: [0.5, 1.5], flight: [0.4, 0.8], drop: [0, 0.05], lag: [0, 0.03], plant: [0.3, 0.3] };
const HELD_OUT: Conditions = { noise: [0, 2], flight: [0.25, 1], drop: [0, 0.08], lag: [0, 0.04], plant: [0.2, 0.5] };
const TUNED_RATES = [15, 30, 60, 120, 240];
const RATES = [15, 20, 24, 25, 30, 50, 60, 120, 240];
// The frame scale of the generator's default frame (synthetic.ts: the 1.75 m body takes 55 % of a 640 px height).
const PX_PER_M = (0.55 * 640) / 1.75;

const pick = (r: Range, rng: () => number) => r[0] + (r[1] - r[0]) * rng();
const measure = (r: ReturnType<typeof runActivity>, key: string) => r.measures.find(m => m.key === key)!;
const DISAGREE = /flight time and the hip's curve disagree/;

interface Row {
  runs: number; counted: number; countedTall: number; tall: number;
  shown: number; inside: number; errors: number[]; margins: number[]; disagree: number;
  runupShown: number; runupInside: number; runupMargins: number[]; runupWorst: number;
  takeoffs: number; takeoffsInside: number;
  /** For the fast end of the toe-off range: the height offset expected from first principles, per height shown. */
  expected: number[];
}

/**
 * `n` runs from `seed0` at `rate`, half standing and half after a run-up, in the conditions `c`. A height is counted
 * as shown when the engine gives that jump a value with a margin (each jump's value is kept even when the best of a
 * read cannot be named; here a read holds one jump).
 */
function runSet(rate: number, seed0: number, n: number, c: Conditions): Row {
  const row: Row = { runs: 0, counted: 0, countedTall: 0, tall: 0, shown: 0, inside: 0, errors: [], margins: [], disagree: 0, runupShown: 0, runupInside: 0, runupMargins: [], runupWorst: 0, takeoffs: 0, takeoffsInside: 0, expected: [] };
  for (let k = 0; k < n; k++) {
    const seed = seed0 + k;
    for (const approach of [0, 3]) {
      const rng = seeded(seed * 7919 + rate * 31 + approach);
      const flight = pick(c.flight, rng), noisePx = pick(c.noise, rng), drop = pick(c.drop, rng), toeLag = pick(c.lag, rng), plant = pick(c.plant, rng);
      const phase = rng() / rate, hipShift = c.hipShift ? pick(c.hipShift, rng) : 0;
      const noise = seeded(seed * 104729 + rate * 13 + approach);
      const jumps = [{ flight, drop, toeLag, plant, approach, hipShift }];
      const read = syntheticJumps({ jumps, rate, phase, noisePx, noise: sd => gaussian(noise, sd) });
      const r = runActivity(volleyball, read);
      const truth = read.truth.jumps[0];
      row.runs += 1;
      const counted = measure(r, 'jumps').value === 1;
      if (counted) row.counted += 1;
      // The count is built to miss jumps whose hip barely rises (minRise in the specification): 15 cm and up must count.
      if (truth.heightCm >= 15) { row.tall += 1; if (counted) row.countedTall += 1; }
      const j = r.events.jump?.[0];
      if (j?.takeoff !== undefined) {
        row.takeoffs += 1;
        if (Math.abs(j.takeoff - truth.takeoff) <= (j.takeoffMargin as number)) row.takeoffsInside += 1;
      }
      const h = measure(r, 'height'), v = h.values[0];
      if (v && v.margin !== null) {
        const e = v.value - truth.heightCm;
        row.shown += 1; row.errors.push(e); row.margins.push(v.margin);
        if (Math.abs(e) <= v.margin) row.inside += 1;
      } else if (DISAGREE.test(h.refused?.en ?? '')) row.disagree += 1;
      if (v && v.margin !== null && c.lag[1] === 0) {
        // The fast end of the toe-off range, from first principles: a toe that leaves at full speed covers the band ℓ
        // in ℓ/v0, the engine takes the middle of [ℓ/v0, √(2ℓ·TOE_LAG_MAX/v0)] (engine.ts, contact), so the takeoff
        // reads early by the difference and the height high by v0 times it. The true time is read on the generator.
        const leg = (r.legLength as number) / PX_PER_M, level = (r.band as number) * leg;
        const v0 = (G * flight * flight / 2 - drop) / flight;
        const lo = level / v0, hi = level <= (v0 * TOE_LAG_MAX) / 2 ? Math.sqrt((2 * level * TOE_LAG_MAX) / v0) : lo + TOE_LAG_MAX / 2;
        let a = 0, b = 0.1;
        for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (syntheticBodyAt(jumps, truth.takeoff + m).feet >= level) b = m; else a = m; }
        const early = (lo + hi) / 2 - b;
        row.expected.push(100 * (v0 * early + (G * early * early) / 2));
      }
      if (approach) {
        const a = measure(r, 'approach');
        if (a.value !== null && a.margin !== null) {
          const e = a.value - (truth.plant as number);
          row.runupShown += 1; row.runupMargins.push(a.margin);
          if (Math.abs(e) <= a.margin) row.runupInside += 1;
          row.runupWorst = Math.max(row.runupWorst, Math.abs(e) / a.margin);
        }
      }
    }
  }
  return row;
}

const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN);
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;
const worstOf = (w: Row) => Math.max(0, ...w.errors.map((e, i) => Math.abs(e) / w.margins[i]));
function table(title: string, rows: [number, Row][]) {
  const lines = rows.map(([rate, w]) => `${String(rate).padStart(3)} /s | count exact ${w.counted} of ${w.runs} (${w.countedTall} of ${w.tall} at 15 cm and up)`
    + ` | height shown ${w.shown}, inside ${w.inside}, bias ${signed(mean(w.errors))} cm, mean margin ±${mean(w.margins).toFixed(2)} cm, worst |error|/margin ${worstOf(w).toFixed(2)}`
    + ` | run-up shown ${w.runupShown} of ${w.runs / 2}, inside ${w.runupInside}${w.runupShown ? `, mean margin ±${(1000 * mean(w.runupMargins)).toFixed(1)} ms, worst ${w.runupWorst.toFixed(2)}` : ''}`);
  console.log(`${title}\n${lines.join('\n')}`);
}

describe('volleyball margins, tuning and held-out runs', () => {
  it('tuning runs (seeds 1 to 300 per rate): every height and run-up shown is inside its margin', () => {
    const rows = TUNED_RATES.map(rate => [rate, runSet(rate, 1, 300, TUNING)] as [number, Row]);
    table('TUNING runs, seeds 1 to 300 per rate (300 standing jumps and 300 run-ups each):', rows);
    for (const [rate, w] of rows) {
      expect(w.inside, `rate ${rate}`).toBe(w.shown);
      expect(w.runupInside, `rate ${rate}`).toBe(w.runupShown);
      expect(w.countedTall, `rate ${rate}`).toBe(w.tall);
    }
  }, 120000);

  it('held-out runs (seeds 400001 to 400300 per rate, wider conditions, four untuned rates): heights and run-ups shown inside their margin', () => {
    const rows = RATES.map(rate => [rate, runSet(rate, 400001, 300, HELD_OUT)] as [number, Row]);
    table('HELD-OUT runs, seeds 400001 to 400300 per rate (300 standing jumps and 300 run-ups each), noise 0 to 2 px, flights 0.25 to 1.00 s, drop 0 to 8 cm, toe-off 0 to 40 ms, last contact 0.20 to 0.50 s:', rows);
    for (const [rate, w] of rows) {
      // The margins are not a hard bound: they must hold for at least 99 values in 100 shown.
      expect(w.inside / w.shown, `rate ${rate}`).toBeGreaterThanOrEqual(0.99);
      if (w.runupShown) expect(w.runupInside / w.runupShown, `rate ${rate}`).toBeGreaterThanOrEqual(0.99);
      expect(w.countedTall, `rate ${rate}`).toBe(w.tall);
    }
    // Under 20 a second no run-up is ever timed (minRate); from 60 a second most heights are shown.
    expect(rows[0][1].runupShown).toBe(0);
    for (const [rate, w] of rows) if (rate >= 60) expect(w.shown / w.runs, `rate ${rate}`).toBeGreaterThan(0.6);
  }, 240000);

  // The takeoff's margin with no noise to hide in: a toe that leaves at full speed is the fast end of the range the
  // correction allows for, where the range's half-width equals the offset; the speed read after the crossing must be in
  // the margin too (engine.ts, contact). History (14 October 2026): without that term, 10 of 400 takeoffs at 240 a
  // second fell just outside, worst 1.02 times the margin.
  it('noise-free, toes leaving at full speed, random phases: every takeoff and height inside its margin', () => {
    const lines: string[] = [];
    for (const rate of [20, 30, 60, 120, 240]) {
      const w = runSet(rate, 410001, 200, { ...HELD_OUT, noise: [0, 0], lag: [0, 0] });
      lines.push(`${String(rate).padStart(3)} /s  takeoffs inside ${w.takeoffsInside} of ${w.takeoffs}  heights inside ${w.inside} of ${w.shown}, worst |error|/margin ${worstOf(w).toFixed(2)}`);
      expect(w.takeoffsInside, `rate ${rate}`).toBe(w.takeoffs);
      expect(w.inside, `rate ${rate}`).toBe(w.shown);
    }
    console.log(`No noise, toe-off 0 ms, held-out flights and drops, 400 jumps per rate:\n${lines.join('\n')}`);
  }, 120000);

  // The bias, across noise levels, on the generator's toe-offs. The takeoff's correction is the middle of the range a
  // toe-off of 0 to 40 ms allows when the toe's speed rises no slower than uniformly (engine.ts, TOE_LAG_MAX). A toe
  // that leaves at full speed, the range's fast end, reads high by an offset known from first principles, checked here.
  // The generator's toe speed rises faster than uniformly at first (synthetic.ts), so its 40 ms toe-off lies inside the
  // range, not at its slow end (a speed rising uniformly over 40 ms, not generated, so not checked): it is checked only
  // to read within 1 cm of zero. The bias therefore depends on the toe-off profile, which the video does not show; the
  // figures below are the generator's profile's. Bounds: on development seeds 8001 to 8100 the mean bias over the
  // held-out conditions was +0.45 to +0.96 cm at every noise level and rate; the bounds allow ±0.75 cm around that for
  // the sampling error of a mean of 100 to 200 heights (a +3 cm regression, as a landing bias would be, fails them).
  it('states the height bias on the generator\'s toe-offs at each noise level; checks a toe leaving at full speed against first principles and the generator\'s 40 ms toe-off within 1 cm of zero', () => {
    const lines: string[] = [];
    for (const rate of [30, 60, 120, 240]) {
      const cells: string[] = [];
      for (const noise of [0, 0.5, 1, 1.5, 2]) {
        const w = runSet(rate, 420001, 100, { ...HELD_OUT, noise: [noise, noise] });
        const bias = mean(w.errors), margin = mean(w.margins);
        cells.push(`${noise} px ${signed(bias)} (±${margin.toFixed(1)})`);
        expect(bias, `rate ${rate} noise ${noise}`).toBeGreaterThan(-0.25);
        expect(bias, `rate ${rate} noise ${noise}`).toBeLessThan(1.75);
        expect(w.inside / w.shown, `rate ${rate} noise ${noise}`).toBeGreaterThanOrEqual(0.99);
      }
      // A toe leaving at full speed and the generator's 40 ms toe-off at 1 px, with the hip landing 5 to 8 cm lower, so
      // the flight-time cap does not clip the offset.
      const ends = { ...HELD_OUT, noise: [1, 1] as Range, drop: [0.05, 0.08] as Range };
      const fast = runSet(rate, 430001, 100, { ...ends, lag: [0, 0] });
      const slow = runSet(rate, 430001, 100, { ...ends, lag: [TOE_LAG_MAX, TOE_LAG_MAX] });
      cells.push(`toe-off 0 ms ${signed(mean(fast.errors))} (expected ${signed(mean(fast.expected))}), ${TOE_LAG_MAX * 1000} ms ${signed(mean(slow.errors))}`);
      // Measured on development seeds 7001 to 7060: within 0.4 cm of the expected offset for a toe at full speed, and
      // within 0.65 cm of zero for the generator's 40 ms toe-off.
      expect(Math.abs(mean(fast.errors) - mean(fast.expected)), `rate ${rate}`).toBeLessThan(0.6);
      expect(Math.abs(mean(slow.errors)), `rate ${rate}`).toBeLessThan(1);
      expect((fast.inside + slow.inside) / (fast.shown + slow.shown), `rate ${rate}`).toBeGreaterThanOrEqual(0.99);
      lines.push(`${String(rate).padStart(3)} /s  ${cells.join('  ')}`);
    }
    console.log(`Height bias in cm (mean stated margin), held-out conditions, by noise; then a toe at full speed and the generator's 40 ms toe-off at 1 px, the hip landing 5 to 8 cm lower:\n${lines.join('\n')}`);
  }, 240000);

  // The engine takes the hip for the body's centre of mass. On a person the arms and legs move the centre of mass
  // relative to the hip in the air; the generator moves the hip instead (hipShift), the truth staying the centre of
  // mass's rise. This states how far the margins hold when that assumption fails, and how often the flight-time cap
  // refuses a height for it (engine.ts, CAP_MIN_SHARE). It is the generator's model of the error, not a filmed one.
  it('states how the height margins hold when the hip moves relative to the centre of mass', () => {
    const lines: string[] = [];
    for (const rate of [60, 240]) {
      for (const shift of [-0.03, -0.01, 0.01, 0.03] as const) {
        const w = runSet(rate, 440001, 150, { ...HELD_OUT, hipShift: [shift, shift] });
        lines.push(`${String(rate).padStart(3)} /s  hip ${signed(100 * shift)} cm: inside ${w.inside} of ${w.shown}, bias ${signed(mean(w.errors))} cm, refused as disagreeing ${w.disagree}`);
        // Within 1 cm the margins still hold for 99 heights in 100; at 3 cm they do not, and the screen's note says so.
        if (Math.abs(shift) <= 0.01) expect(w.inside / w.shown, `rate ${rate} shift ${shift}`).toBeGreaterThanOrEqual(0.99);
      }
    }
    console.log(`Hip moving relative to the centre of mass over the flight (held-out conditions otherwise, 300 jumps each):\n${lines.join('\n')}`);
  }, 120000);
});
