/**
 * The volleyball specification against synthetic jumps whose flight times are known exactly (synthetic.ts), at the
 * sample rates a phone video is read at. The noise is the counting tests' own (seeded mulberry32 and Box–Muller,
 * src/lib/counting/__tests__/synthetic.ts), so a failing seed can be replayed.
 *
 * What these jumps are: landmark signals of a body whose hip follows a ballistic arc and whose toes leave and touch
 * the ground at known instants, sampled at a random phase, with Gaussian noise on every point. What they are not: a
 * rendered body read by the pose model, nor a filmed person (docs/VISION.md, the truth lab). The errors here are the
 * engine's own, from sampling and noise; the pose model's errors come on top and are not measured yet.
 */
import { describe, expect, it } from 'vitest';
import { gaussian, seeded } from '../../counting/__tests__/synthetic';
import { flightHeightCm, heightMarginCm, runActivity } from '../engine';
import { volleyball } from '../specs/volleyball';
import { syntheticJumps, type SyntheticJump } from '../synthetic';

const noiseOf = (seed: number) => { const rng = seeded(seed); return (sd: number) => gaussian(rng, sd); };
const measure = (r: ReturnType<typeof runActivity>, key: string) => {
  const m = r.measures.find(x => x.key === key);
  if (!m) throw new Error(`no measure ${key}`);
  return m;
};

describe('the flight-time formula', () => {
  it('h = g·t²/8: a 0.60 s flight is a 44.1 cm jump', () => {
    expect(flightHeightCm(0.6)).toBeCloseTo(44.13, 1);
    expect(flightHeightCm(0)).toBe(0);
  });

  it('a contact known to one sample in 15 a second gives about ±10 cm on a 0.60 s flight, ±2.5 cm at 60', () => {
    expect(heightMarginCm(0.6, 1 / 15)).toBeGreaterThan(9);
    expect(heightMarginCm(0.6, 1 / 15)).toBeLessThan(11);
    expect(heightMarginCm(0.6, 1 / 60)).toBeGreaterThan(2.2);
    expect(heightMarginCm(0.6, 1 / 60)).toBeLessThan(2.8);
  });
});

describe('volleyball on synthetic jumps', () => {
  const jumps: SyntheticJump[] = [{ flight: 0.55 }, { flight: 0.7, approach: 3 }, { flight: 0.45 }, { flight: 0.62, approach: 3 }];

  for (const rate of [15, 30, 60]) {
    it(`counts four jumps, standing and after a run-up, at ${rate} samples a second, over 40 seeds`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const read = syntheticJumps({ jumps, rate, phase: (seed % 7) / 7 / rate, noisePx: 1.5, noise: noiseOf(seed) });
        const r = runActivity(volleyball, read);
        expect(r.refused, `seed ${seed}`).toBeNull();
        expect(measure(r, 'jumps').value, `seed ${seed}`).toBe(4);
      }
    });
  }

  it('reads the frame rate it was given, and a noiseless jump at 240 samples a second to within 1 cm', () => {
    const read = syntheticJumps({ jumps: [{ flight: 0.6 }], rate: 240, phase: 0.001 });
    const r = runActivity(volleyball, read);
    expect(r.rate).toBeCloseTo(240, 0);
    const h = measure(r, 'height');
    expect(Math.abs((h.value ?? 0) - read.truth.jumps[0].heightCm)).toBeLessThan(1);
  });

  it('keeps each height inside its stated margin at 15, 30 and 60 samples a second (200 jumps each)', () => {
    const rows: string[] = [];
    for (const rate of [15, 30, 60, 120, 240]) {
      const errors: number[] = [], margins: number[] = [];
      let inside = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const rng = seeded(1000 * rate + seed);
        const flight = 0.4 + 0.4 * rng();
        const read = syntheticJumps({ jumps: [{ flight }], rate, phase: rng() / rate, noisePx: 1.5, noise: noiseOf(seed) });
        const r = runActivity(volleyball, read);
        const h = measure(r, 'height');
        expect(h.value, `rate ${rate} seed ${seed}`).not.toBeNull();
        const error = (h.value as number) - read.truth.jumps[0].heightCm;
        errors.push(error);
        margins.push(h.margin as number);
        if (Math.abs(error) <= (h.margin as number)) inside += 1;
      }
      const abs = errors.map(Math.abs).sort((a, b) => a - b);
      const mean = abs.reduce((s, v) => s + v, 0) / abs.length;
      const bias = errors.reduce((s, v) => s + v, 0) / errors.length;
      const p95 = abs[Math.floor(0.95 * (abs.length - 1))];
      rows.push(`${String(rate).padStart(3)} /s  mean |error| ${mean.toFixed(1)} cm  bias ${bias >= 0 ? '+' : ''}${bias.toFixed(1)} cm  95th ${p95.toFixed(1)} cm  max ${abs.at(-1)!.toFixed(1)} cm  stated margin at 0.60 s ±${heightMarginCm(0.6, 1 / rate).toFixed(1)} cm  inside the stated margin ${inside} of 200`);
      expect(inside / 200, `rate ${rate}`).toBeGreaterThanOrEqual(0.95);
      expect(Math.abs(bias), `rate ${rate}`).toBeLessThan(heightMarginCm(0.6, 1 / rate) / 3);
    }
    console.log(`Jump height from flight time, synthetic jumps of 0.40 to 0.80 s, noise 1.5 px on a 360x640 frame:\n${rows.join('\n')}`);
  });

  it('a squat is no jump, and a foot point that leaves the ground for one sample is no jump', () => {
    const read = syntheticJumps({ jumps: [{ flight: 0, squat: true }, { flight: 0, squat: true }], rate: 30, noisePx: 1, noise: noiseOf(3) });
    const toe = read.landmarks[40]![31];
    read.landmarks[40]![31] = { ...toe, y: toe.y - 0.08 };
    read.landmarks[40]![32] = { ...read.landmarks[40]![32], y: toe.y - 0.08 };
    read.landmarks[40]![29] = { ...read.landmarks[40]![29], y: toe.y - 0.08 };
    read.landmarks[40]![30] = { ...read.landmarks[40]![30], y: toe.y - 0.08 };
    const r = runActivity(volleyball, read);
    expect(r.refused).toBeNull();
    expect(measure(r, 'jumps').value).toBe(0);
    expect(measure(r, 'height').refused).not.toBeNull();
  });

  it('one jump stays one jump when the feet are lost for a sample at the top of the flight', () => {
    const read = syntheticJumps({ jumps: [{ flight: 0.7 }], rate: 30, noisePx: 1, noise: noiseOf(5) });
    const t = read.truth.jumps[0];
    const top = read.timestamps.findIndex(x => x >= (t.takeoff + t.landing) / 2);
    // The feet read on the ground for one sample at the top: a pose model's slip.
    const ground = read.landmarks[0]!;
    for (const i of [29, 30, 31, 32]) read.landmarks[top]![i] = { ...read.landmarks[top]![i], y: ground[i].y };
    const r = runActivity(volleyball, read);
    expect(measure(r, 'jumps').value).toBe(1);
    expect(Math.abs((measure(r, 'height').value ?? 0) - t.heightCm)).toBeLessThan((measure(r, 'height').margin ?? 0) + 0.5);
  });

  it('times the last contact of a run-up at 60 samples a second, within its margin, and does not at 15', () => {
    const at60 = syntheticJumps({ jumps: [{ flight: 0.6, approach: 3 }], rate: 60, phase: 0.004, noisePx: 1, noise: noiseOf(7) });
    const m60 = measure(runActivity(volleyball, at60), 'approach');
    expect(m60.refused).toBeNull();
    expect(Math.abs((m60.value ?? 0) - (at60.truth.jumps[0].plant ?? 0))).toBeLessThanOrEqual((m60.margin ?? 0) + 1e-9);
    // At 15 a second a stride's flight of a tenth of a second spans one sample at most: no run-up is seen, or its
    // margin is too wide to show. Either way no value.
    for (let seed = 1; seed <= 10; seed++) {
      const at15 = syntheticJumps({ jumps: [{ flight: 0.6, approach: 3 }], rate: 15, phase: (seed / 11) / 15, noisePx: 1, noise: noiseOf(seed) });
      expect(measure(runActivity(volleyball, at15), 'approach').value, `seed ${seed}`).toBeNull();
    }
  });

  it('a standing jump has no run-up to time', () => {
    const read = syntheticJumps({ jumps: [{ flight: 0.6 }], rate: 60, noisePx: 1, noise: noiseOf(8) });
    const m = measure(runActivity(volleyball, read), 'approach');
    expect(m.value).toBeNull();
    expect(m.refused?.en).toMatch(/run-up/);
  });

  it('flags knees that come in on landing, read from the front, and refuses the check from the side', () => {
    const inward = runActivity(volleyball, syntheticJumps({ jumps: [{ flight: 0.6, knees: 0.6 }], rate: 30, noisePx: 1, noise: noiseOf(9) }));
    expect(inward.view).toBe('front');
    const k = measure(inward, 'landing');
    expect(k.value).toBeGreaterThan(0.5);
    expect(k.value).toBeLessThan(0.7);
    expect(k.flagged).toBe(true);
    const aligned = measure(runActivity(volleyball, syntheticJumps({ jumps: [{ flight: 0.6, knees: 1 }], rate: 30, noisePx: 1, noise: noiseOf(10) })), 'landing');
    expect(aligned.value).toBeGreaterThan(0.9);
    expect(aligned.flagged).toBe(false);
    const side = runActivity(volleyball, syntheticJumps({ jumps: [{ flight: 0.6, knees: 0.6 }], rate: 30, view: 'side', noisePx: 1, noise: noiseOf(11) }));
    expect(side.view).toBe('side');
    expect(measure(side, 'landing').value).toBeNull();
    expect(measure(side, 'landing').refused?.en).toMatch(/front/);
    // From the side the jumps are still counted and timed.
    expect(measure(side, 'jumps').value).toBe(1);
  });

  it('refuses a read where the feet are never seen, rather than guessing', () => {
    const read = syntheticJumps({ jumps: [{ flight: 0.6 }], rate: 30 });
    for (const frame of read.landmarks) for (const i of [27, 28, 29, 30, 31, 32]) frame![i] = { ...frame![i], visibility: 0.1 };
    const r = runActivity(volleyball, read);
    expect(r.refused).not.toBeNull();
    for (const m of r.measures) expect(m.value).toBeNull();
  });
});

describe('the specification is data', () => {
  it('survives JSON, and every measure carries a unit or none, a formula, a source, an R9 status and an error model', () => {
    expect(JSON.parse(JSON.stringify(volleyball))).toEqual(volleyball);
    for (const m of volleyball.measures) {
      expect(['validated', 'literature', 'convention', 'experimental']).toContain(m.status);
      expect(m.source.length).toBeGreaterThan(10);
      expect(m.formulaText.fr.length && m.formulaText.en.length).toBeTruthy();
      expect(['sampling', 'none']).toContain(m.error.kind);
      expect(volleyball.events[m.of]).toBeTruthy();
    }
    // Every number in an event or a formula carries its own source and status (R9).
    const settings: unknown[] = [];
    const walk = (v: unknown) => {
      if (v && typeof v === 'object') {
        if ('value' in v && 'source' in v && 'status' in v) settings.push(v);
        else Object.values(v).forEach(walk);
      } else if (typeof v === 'number') throw new Error(`a bare number in the specification: ${v}`);
    };
    walk(volleyball.events);
    volleyball.measures.forEach(m => walk(m.formula));
    expect(settings.length).toBeGreaterThan(5);
  });
});
