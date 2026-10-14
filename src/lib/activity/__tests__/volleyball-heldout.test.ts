/**
 * The volleyball margins on runs never used to set them (CLAUDE.md R2, R3; docs/VISION.md, the truth lab, level 1).
 *
 * TUNING runs: the runs the engine's constants (engine.ts: ARRIVE_SHARE, SPEED_SE_K, NOISE_K, APEX_K) were set and
 * checked on: seeds 1 to 300 per rate, noise 0.5 to 1.5 px, flights of 0.40 to 0.80 s, the hip landing 0 to 5 cm lower
 * than it took off, toe-offs of 0 to 30 ms, a run-up's last contact of 0.30 s.
 * DEVELOPMENT runs, consulted once while the engine was rebuilt on 14 October 2026 and not printed here: seeds 5001 to
 * 5300 and 100001 to 100500 (one failure there, at 240 a second, led to the noise term of a takeoff, engine.ts contact).
 * HELD-OUT runs: seeds 200001 to 200300 per rate, first run after the constants were frozen, in conditions wider than
 * the tuning's: noise 0 to 2 px, flights of 0.25 to 1.00 s, the hip landing 0 to 8 cm lower, toe-offs of 0 to 40 ms,
 * last contacts of 0.20 to 0.50 s.
 *
 * Each run is one jump on a 360x640 frame, standing or after a three-stride run-up, at a random phase. The generator
 * (synthetic.ts) is the engine's only judge here: these are not filmed people, and the pose model's own errors come on
 * top (level 2 and 3). TOE_LAG_MAX in engine.ts is an assumption equal to the top of the held-out toe-offs: a toe that
 * takes longer than 40 ms to reach the body's speed is outside what this test can vouch for.
 */
import { describe, expect, it } from 'vitest';
import { gaussian, seeded } from '../../counting/__tests__/synthetic';
import { runActivity } from '../engine';
import { volleyball } from '../specs/volleyball';
import { syntheticJumps } from '../synthetic';

type Range = [number, number];
interface Conditions { noise: Range; flight: Range; drop: Range; lag: Range; plant: Range }

const TUNING: Conditions = { noise: [0.5, 1.5], flight: [0.4, 0.8], drop: [0, 0.05], lag: [0, 0.03], plant: [0.3, 0.3] };
const HELD_OUT: Conditions = { noise: [0, 2], flight: [0.25, 1], drop: [0, 0.08], lag: [0, 0.04], plant: [0.2, 0.5] };
const RATES = [15, 30, 60, 120, 240];

const pick = (r: Range, rng: () => number) => r[0] + (r[1] - r[0]) * rng();
const measure = (r: ReturnType<typeof runActivity>, key: string) => r.measures.find(m => m.key === key)!;

interface Row {
  runs: number; counted: number; countedTall: number; tall: number;
  shown: number; inside: number; errors: number[]; margins: number[];
  runupShown: number; runupInside: number; runupMargins: number[]; runupWorst: number;
}

/** `n` runs from `seed0` at `rate`, half standing and half after a run-up, in the conditions `c`. */
function runSet(rate: number, seed0: number, n: number, c: Conditions): Row {
  const row: Row = { runs: 0, counted: 0, countedTall: 0, tall: 0, shown: 0, inside: 0, errors: [], margins: [], runupShown: 0, runupInside: 0, runupMargins: [], runupWorst: 0 };
  for (let k = 0; k < n; k++) {
    const seed = seed0 + k;
    for (const approach of [0, 3]) {
      const rng = seeded(seed * 7919 + rate * 31 + approach);
      const flight = pick(c.flight, rng), noisePx = pick(c.noise, rng), drop = pick(c.drop, rng), toeLag = pick(c.lag, rng), plant = pick(c.plant, rng);
      const noise = seeded(seed * 104729 + rate * 13 + approach);
      const read = syntheticJumps({ jumps: [{ flight, drop, toeLag, plant, approach }], rate, phase: rng() / rate, noisePx, noise: sd => gaussian(noise, sd) });
      const r = runActivity(volleyball, read);
      const truth = read.truth.jumps[0];
      row.runs += 1;
      const counted = measure(r, 'jumps').value === 1;
      if (counted) row.counted += 1;
      // The count is built to miss jumps whose hip barely rises (minRise in the specification): 15 cm and up must count.
      if (truth.heightCm >= 15) { row.tall += 1; if (counted) row.countedTall += 1; }
      const h = measure(r, 'height');
      if (h.value !== null && h.margin !== null) {
        const e = h.value - truth.heightCm;
        row.shown += 1; row.errors.push(e); row.margins.push(h.margin);
        if (Math.abs(e) <= h.margin) row.inside += 1;
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
function table(title: string, rows: [number, Row][]) {
  const lines = rows.map(([rate, w]) => {
    const worst = Math.max(0, ...w.errors.map((e, i) => Math.abs(e) / w.margins[i]));
    return `${String(rate).padStart(3)} /s | count exact ${w.counted} of ${w.runs} (${w.countedTall} of ${w.tall} at 15 cm and up)`
      + ` | height shown ${w.shown}, inside ${w.inside}, bias ${signed(mean(w.errors))} cm, mean margin ±${mean(w.margins).toFixed(2)} cm, worst |error|/margin ${worst.toFixed(2)}`
      + ` | run-up shown ${w.runupShown} of ${w.runs / 2}, inside ${w.runupInside}${w.runupShown ? `, mean margin ±${(1000 * mean(w.runupMargins)).toFixed(1)} ms` : ''}`;
  });
  console.log(`${title}\n${lines.join('\n')}`);
}

describe('volleyball margins, tuning and held-out runs', () => {
  it('tuning runs (seeds 1 to 300 per rate): every height and run-up shown is inside its margin', () => {
    const rows = RATES.map(rate => [rate, runSet(rate, 1, 300, TUNING)] as [number, Row]);
    table('TUNING runs, seeds 1 to 300 per rate (300 standing jumps and 300 run-ups each):', rows);
    for (const [rate, w] of rows) {
      expect(w.inside, `rate ${rate}`).toBe(w.shown);
      expect(w.runupInside, `rate ${rate}`).toBe(w.runupShown);
      expect(w.countedTall, `rate ${rate}`).toBe(w.tall);
    }
  }, 120000);

  it('held-out runs (seeds 200001 to 200300 per rate, wider conditions): heights and run-ups shown inside their margin', () => {
    const rows = RATES.map(rate => [rate, runSet(rate, 200001, 300, HELD_OUT)] as [number, Row]);
    table('HELD-OUT runs, seeds 200001 to 200300 per rate (300 standing jumps and 300 run-ups each), noise 0 to 2 px, flights 0.25 to 1.00 s, drop 0 to 8 cm, toe-off 0 to 40 ms, last contact 0.20 to 0.50 s:', rows);
    for (const [rate, w] of rows) {
      // The margins are not a hard bound: they must hold for at least 99 values in 100 shown.
      expect(w.inside / w.shown, `rate ${rate}`).toBeGreaterThanOrEqual(0.99);
      if (w.runupShown) expect(w.runupInside / w.runupShown, `rate ${rate}`).toBeGreaterThanOrEqual(0.99);
      expect(w.countedTall, `rate ${rate}`).toBe(w.tall);
    }
    // At 15 a second no run-up is ever timed; from 60 a second most heights are shown.
    expect(rows[0][1].runupShown).toBe(0);
    for (const [rate, w] of rows) if (rate >= 60) expect(w.shown / w.runs, `rate ${rate}`).toBeGreaterThan(0.6);
  }, 120000);

  // The bias, across noise levels and toe-offs. The takeoff's correction is the middle of the range a toe-off of 0 to
  // 40 ms allows (engine.ts, TOE_LAG_MAX): a toe that leaves at full speed reads high, one that takes 40 ms reads low.
  // That one-sided offset is stated here and covered by the margin; it is not removed, since the toe-off is not known.
  it('states the height bias at each noise level and for the two ends of the toe-off range', () => {
    const lines: string[] = [];
    for (const rate of [30, 60, 120, 240]) {
      const cells: string[] = [];
      for (const noise of [0, 0.5, 1, 1.5, 2]) {
        const w = runSet(rate, 300001, 60, { ...HELD_OUT, noise: [noise, noise] });
        const bias = mean(w.errors), margin = mean(w.margins);
        cells.push(`${noise} px ${signed(bias)} (±${margin.toFixed(1)})`);
        expect(Math.abs(bias), `rate ${rate} noise ${noise}`).toBeLessThan(margin / 2);
        expect(w.inside, `rate ${rate} noise ${noise}`).toBe(w.shown);
      }
      const fast = runSet(rate, 310001, 60, { ...HELD_OUT, noise: [1, 1], drop: [0, 0], lag: [0, 0] });
      const slow = runSet(rate, 310001, 60, { ...HELD_OUT, noise: [1, 1], drop: [0, 0], lag: [0.04, 0.04] });
      cells.push(`toe-off 0 ms ${signed(mean(fast.errors))}, 40 ms ${signed(mean(slow.errors))}`);
      expect(mean(fast.errors), `rate ${rate}`).toBeGreaterThan(0);
      expect(mean(slow.errors), `rate ${rate}`).toBeLessThan(mean(fast.errors));
      expect(fast.inside + slow.inside, `rate ${rate}`).toBe(fast.shown + slow.shown);
      lines.push(`${String(rate).padStart(3)} /s  ${cells.join('  ')}`);
    }
    console.log(`Height bias in cm (mean stated margin), held-out conditions, by noise; then for toe-offs of 0 and 40 ms at 1 px:\n${lines.join('\n')}`);
  }, 120000);
});
