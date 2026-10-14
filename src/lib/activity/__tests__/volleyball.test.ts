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

  // The margin per contact is half a sample plus the band correction's uncertainty (engine.ts, BAND_SHARE, SPEED_SE_K,
  // NOISE_K). The noise term does not shrink with the frame rate: at 240 samples a second it is larger than the sampling
  // term, so the stated margin there is about 2 cm, not the ±0.6 cm that sampling alone gives at 0.60 s.
  // History: this test once failed at 240 on the bias line, +0.34 cm against a limit of 0.21. The cause was the foot's
  // speed, read over 0.06 s after a takeoff or before a touchdown, which mixed samples far from the contact; read
  // within 1/30 s of the band crossing and capped at the first sample that reads on the ground, the bias is +0.16 cm.
  it('keeps each height inside its stated margin at 15, 30, 60, 120 and 240 samples a second (200 jumps each)', () => {
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
      const stated = margins.reduce((s, v) => s + v, 0) / margins.length;
      rows.push(`${String(rate).padStart(3)} /s  mean |error| ${mean.toFixed(2)} cm  bias ${bias >= 0 ? '+' : ''}${bias.toFixed(2)} cm  95th ${p95.toFixed(2)} cm  max ${abs.at(-1)!.toFixed(2)} cm  mean stated margin ±${stated.toFixed(2)} cm (sampling alone at 0.60 s ±${heightMarginCm(0.6, 1 / rate).toFixed(2)})  inside the stated margin ${inside} of 200`);
      expect(inside / 200, `rate ${rate}`).toBeGreaterThanOrEqual(0.95);
      expect(Math.abs(bias), `rate ${rate}`).toBeLessThan(heightMarginCm(0.6, 1 / rate) / 3);
    }
    console.log(`Jump height from flight time, synthetic jumps of 0.40 to 0.80 s, noise 1.5 px on a 360x640 frame:\n${rows.join('\n')}`);
  }, 30000);

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

  // History: this test once failed, 0.024 s off against a margin of 0.019 s. A run-up stride's flight lasts 0.1 s and
  // clears the ground by 5 cm, so at 60 a second its touchdown lies about one sample past the band crossing. The foot's
  // speed was read over 0.06 s before the touchdown, across the top of the stride, where it rises then falls: the slope
  // came out at zero or rising, the band correction was dropped, and nothing in the margin stood for it. Over 200 such
  // run-ups at 60 a second the first version was 34 ms short on average and 14 of 200 values fell inside their margin
  // (0 of 200 at 120 and 240). The speed is now read within 1/30 s of the crossing and never across the stride's top.
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

  it('keeps every run-up timing it shows inside its margin at 30, 60, 120 and 240 samples a second (200 run-ups each)', () => {
    const rows: string[] = [];
    for (const rate of [30, 60, 120, 240]) {
      const errors: number[] = [], margins: number[] = [];
      let inside = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const rng = seeded(7000 * rate + seed);
        const flight = 0.4 + 0.4 * rng();
        const read = syntheticJumps({ jumps: [{ flight, approach: 3 }], rate, phase: rng() / rate, noisePx: 1, noise: noiseOf(seed) });
        const m = measure(runActivity(volleyball, read), 'approach');
        if (m.value === null) continue;
        const error = m.value - (read.truth.jumps[0].plant as number);
        errors.push(error);
        margins.push(m.margin as number);
        if (Math.abs(error) <= (m.margin as number)) inside += 1;
      }
      const abs = errors.map(Math.abs).sort((a, b) => a - b);
      const ms = (v: number) => (1000 * v).toFixed(1);
      rows.push(`${String(rate).padStart(3)} /s  shown ${errors.length} of 200  mean |error| ${ms(abs.reduce((s, v) => s + v, 0) / abs.length)} ms  max ${ms(abs.at(-1)!)} ms  mean stated margin ±${ms(margins.reduce((s, v) => s + v, 0) / margins.length)} ms  inside ${inside} of ${errors.length}`);
      // Every value shown is inside its margin: a step missed between the last one read and the takeoff is refused,
      // not timed from the step before it (without that check, 35 of the 92 values shown at 30 a second were more
      // than 0.2 s off, and 1 of 179 at 60).
      expect(inside, `rate ${rate}`).toBe(errors.length);
      if (rate >= 60) expect(errors.length, `rate ${rate}`).toBeGreaterThanOrEqual(150);
    }
    console.log(`Last contact of a run-up, synthetic run-ups of three strides, noise 1 px on a 360x640 frame:\n${rows.join('\n')}`);
  }, 30000);

  it('refuses to time a run-up when the feet are too noisy to read strides of a few centimetres', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const read = syntheticJumps({ jumps: [{ flight: 0.6, approach: 3 }], rate: 120, phase: (seed % 7) / 7 / 120, noisePx: 2.5, noise: noiseOf(seed) });
      const r = runActivity(volleyball, read);
      expect(measure(r, 'approach').value, `seed ${seed}`).toBeNull();
      expect(measure(r, 'approach').refused?.en, `seed ${seed}`).toMatch(/jitter/);
      // The jump itself is still counted and its height still shown, with its margin.
      expect(measure(r, 'jumps').value, `seed ${seed}`).toBe(1);
      expect(measure(r, 'height').margin, `seed ${seed}`).not.toBeNull();
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
