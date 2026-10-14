/**
 * The volleyball specification against synthetic jumps whose contacts and rise are known exactly (synthetic.ts), at the
 * sample rates a phone video is read at. The noise is the counting tests' own (seeded mulberry32 and Box–Muller,
 * src/lib/counting/__tests__/synthetic.ts), so a failing seed can be replayed. The margins' coverage on runs never used
 * to set them is in volleyball-heldout.test.ts.
 *
 * What these jumps are: landmark signals of a body whose hip follows a ballistic arc and whose toes leave and touch
 * the ground at known instants, sampled at a random phase, with Gaussian noise on every point. What they are not: a
 * rendered body read by the pose model, nor a filmed person (docs/VISION.md, the truth lab). The errors here are the
 * engine's own, from sampling and noise; the pose model's errors come on top and are not measured yet.
 */
import { describe, expect, it } from 'vitest';
import { gaussian, seeded } from '../../counting/__tests__/synthetic';
import { flightHeightCm, G, heightMarginCm, riseCm, runActivity } from '../engine';
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

  it('a body that lands lower than it took off flies longer than its rise: g·t²/8 overstates it, v0²/2g does not', () => {
    expect(riseCm(0.6, 0)).toBeCloseTo(flightHeightCm(0.6), 9);
    // 5 cm lower at touchdown: the flight-time formula reads 2.4 cm too high on a 0.60 s flight.
    expect(flightHeightCm(0.6) - riseCm(0.6, 0.05)).toBeGreaterThan(2.3);
    expect(flightHeightCm(0.6) - riseCm(0.6, 0.05)).toBeLessThan(2.6);
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

  it('reads the frame rate it was given, and a noiseless jump at 240 samples a second inside its margin, at both toe-offs', () => {
    for (const toeLag of [0, 0.02]) {
      const read = syntheticJumps({ jumps: [{ flight: 0.6, toeLag }], rate: 240, phase: 0.001 });
      const r = runActivity(volleyball, read);
      expect(r.rate).toBeCloseTo(240, 0);
      const h = measure(r, 'height'), j = r.events.jump[0], truth = read.truth.jumps[0];
      expect(Math.abs(j.takeoff! - truth.takeoff), `toe-off ${toeLag}`).toBeLessThanOrEqual(j.takeoffMargin!);
      expect(Math.abs((h.value ?? 0) - truth.heightCm), `toe-off ${toeLag}`).toBeLessThanOrEqual(h.margin ?? 0);
      // Not knowing how fast the toe left the ground is the largest term here. Measured (14 October 2026): toes leaving
      // at full speed, the fast end of the range the engine allows for, the takeoff reads 10.5 ms early against a
      // margin of ±11.6 ms and the height 1.7 cm high against ±2.2 cm; reaching the body's speed in 20 ms, the middle
      // of that range, the takeoff reads 2.8 ms early and the height 0.04 cm low against ±2.6 cm.
      expect(h.margin, `toe-off ${toeLag}`).toBeLessThan(3);
    }
  });

  // History (14 October 2026): the first version timed the height from the flight alone, h = g·t²/8, which assumes the
  // hip lands where it took off. With the hip 5 cm lower at touchdown, 6 of 300 heights at 240 a second fell inside
  // their margin (117 of 300 at 120), all too high by about 2.5 cm. The height is now the rise to the top of the hip's
  // flight, which is that formula corrected for Δ read on the hip's parabola.
  // The toes reach the body's speed 20 ms after leaving the ground here, the middle of the range the engine allows for:
  // at the fast end (toe-off 0) the takeoff reads about 9 ms early, which moves the drop read by g·t times half of it
  // (2 to 3.6 cm over these flights) and adds g·t/4 times it (1 to 2 cm) to g·t²/8 on this engine's flight time;
  // volleyball-heldout.test.ts checks that end against first principles.
  it('corrects a landing lower than the takeoff: the drop is read from the hip, the height stays inside its margin', () => {
    const rows: string[] = [];
    for (const rate of [30, 60, 120, 240]) {
      let inside = 0, shown = 0, oldInside = 0, bias = 0, methodBias = 0, engineBias = 0, timed = 0, dropErr = 0, drops = 0, dropsWithin = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const rng = seeded(31 * rate + seed);
        const flight = 0.45 + 0.35 * rng(), drop = 0.05 + 0.03 * rng();
        const read = syntheticJumps({ jumps: [{ flight, drop, toeLag: 0.02 }], rate, phase: rng() / rate, noisePx: 1, noise: noiseOf(seed) });
        const r = runActivity(volleyball, read);
        const j = r.events.jump[0], truth = read.truth.jumps[0];
        // The flight-time method's own error, on the exact flight time: about Δ/2 (g·t²/8 − v0²/2g = Δ/2 − Δ²/(2g·t²)).
        methodBias += flightHeightCm(truth.flight) - truth.heightCm;
        if (j?.drop !== undefined) {
          // The drop, Δ = g·t·(mid-flight − top), read from the takeoff, the touchdown and the top, each known to its
          // margin: from first principles it is known to g·(their sum)·|mid-flight − top| + g·t·(half the two contacts'
          // margins plus the top's).
          const err = j.drop - drop, mid = (j.takeoff! + j.landing!) / 2, contacts = j.takeoffMargin! + j.landingMargin!;
          const bound = G * contacts * Math.abs(mid - j.apex!) + G * j.flight! * (contacts / 2 + j.apexMargin!);
          dropErr += err; drops += 1;
          if (Math.abs(err) <= bound) dropsWithin += 1;
        }
        // The flight-time formula on this engine's flight time, with its own margin (the takeoff's correction included).
        if (j?.flight !== undefined) {
          const e = flightHeightCm(j.flight) - truth.heightCm;
          engineBias += e; timed += 1;
          if (Math.abs(e) <= heightMarginCm(j.flight, j.flightMargin as number)) oldInside += 1;
        }
        const h = measure(r, 'height');
        if (h.value === null) continue;
        shown += 1;
        bias += h.value - truth.heightCm;
        if (Math.abs(h.value - truth.heightCm) <= (h.margin as number)) inside += 1;
      }
      rows.push(`${String(rate).padStart(3)} /s  corrected: shown ${shown} of 100, inside ${inside}, bias ${(bias / shown).toFixed(2)} cm, drop read ${(100 * dropErr / drops).toFixed(2)} cm off on average, ${dropsWithin} of ${drops} within their bound`
        + `  |  g·t²/8 on the true flight time: bias +${(methodBias / 100).toFixed(2)} cm  |  g·t²/8 on this engine's flight time: inside ${oldInside} of ${timed}, bias +${(engineBias / timed).toFixed(2)} cm`);
      expect(inside, `rate ${rate}`).toBe(shown);
      if (rate >= 60) expect(shown, `rate ${rate}`).toBeGreaterThanOrEqual(80);
      expect(dropsWithin, `rate ${rate}`).toBe(drops);
      // The method's own error is about half the drop (5 to 8 cm here): 2.4 to 4 cm, 3.25 cm on average.
      expect(methodBias / 100, `rate ${rate}`).toBeGreaterThan(2.9);
      expect(methodBias / 100, `rate ${rate}`).toBeLessThan(3.6);
    }
    console.log(`Jumps landing 5 to 8 cm lower than they took off, flights of 0.45 to 0.80 s, toe-off 20 ms, noise 1 px:\n${rows.join('\n')}`);
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
    // At 15 a second a stride's flight of a tenth of a second spans one sample at most: no value, and the reason says
    // the rate, not a standing jump.
    for (let seed = 1; seed <= 10; seed++) {
      const at15 = syntheticJumps({ jumps: [{ flight: 0.6, approach: 3 }], rate: 15, phase: (seed / 11) / 15, noisePx: 1, noise: noiseOf(seed) });
      const m15 = measure(runActivity(volleyball, at15), 'approach');
      expect(m15.value, `seed ${seed}`).toBeNull();
      expect(m15.refused?.fr, `seed ${seed}`).toMatch(/^Élan non mesurable à 15\u00A0images par seconde/);
    }
  });

  // History (14 October 2026): at 30 a second without noise, this run-up was shown 64.5 ms short against a margin of
  // ±57.8 ms. The speed of the last stride's touchdown was read from two samples on either side of the stride's top
  // (0.039 leg lengths a second), and the correction then reached 0.077 s past the first sample on the ground. The
  // slope now never reads the top, and the speed is never taken under the chord from the top to the crossing.
  it('times the noise-free run-up of seed 310 at 30 samples a second inside its margin (a speed read across a stride\'s top)', () => {
    const rng = seeded(7000 * 30 + 310);
    const flight = 0.4 + 0.4 * rng();
    const read = syntheticJumps({ jumps: [{ flight, approach: 3 }], rate: 30, phase: rng() / 30 });
    const r = runActivity(volleyball, read);
    const truth = read.truth.jumps[0], touchdown = truth.takeoff - (truth.plant as number);
    const last = r.events.stride.at(-1)!;
    expect(Math.abs((last.landing as number) - touchdown)).toBeLessThanOrEqual(last.landingMargin as number);
    const m = measure(r, 'approach');
    expect(m.value).not.toBeNull();
    expect(Math.abs((m.value as number) - (truth.plant as number))).toBeLessThanOrEqual(m.margin as number);
  });

  // History (14 October 2026): at 240 a second and 1 px, the foot's noise around the band split this run-up's last
  // stride into two flights, [466-479] and [481-481], and the run-up was refused for "a step too brief to read". Across
  // 1000 such run-ups, 73 were refused that way. With the two levels of the band (EXIT_SHARE), none is.
  it('keeps the last stride of seed 3 at 240 samples a second whole, and times its run-up inside its margin', () => {
    const rng = seeded(7000 * 240 + 3);
    const flight = 0.4 + 0.4 * rng();
    const read = syntheticJumps({ jumps: [{ flight, approach: 3 }], rate: 240, phase: rng() / 240, noisePx: 1, noise: noiseOf(3) });
    const r = runActivity(volleyball, read);
    expect(r.events.flight.length).toBe(4);
    expect(r.events.stride.length).toBe(3);
    const m = measure(r, 'approach');
    expect(m.refused).toBeNull();
    expect(Math.abs((m.value as number) - (read.truth.jumps[0].plant as number))).toBeLessThanOrEqual(m.margin as number);
    let brief = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = seeded(7000 * 240 + seed), f = 0.4 + 0.4 * g();
      const x = syntheticJumps({ jumps: [{ flight: f, approach: 3 }], rate: 240, phase: g() / 240, noisePx: 1, noise: noiseOf(seed) });
      if (/briefly/.test(measure(runActivity(volleyball, x), 'approach').refused?.en ?? '')) brief += 1;
    }
    expect(brief).toBe(0);
  }, 30000);

  // History (14 October 2026): at 120 a second and 1.75 px, one toe sample read 3 cm up 6 ms after this jump's
  // touchdown, the jump took that one-sample flight for its last, and its landing came late against its margin.
  it('does not take a one-sample rise of the foot after the touchdown for the landing (seed 255, 120 a second, 1.75 px)', () => {
    const rng = seeded(1000 * 120 + 255);
    const flight = 0.4 + 0.4 * rng();
    const read = syntheticJumps({ jumps: [{ flight }], rate: 120, phase: rng() / 120, noisePx: 1.75, noise: noiseOf(255) });
    const r = runActivity(volleyball, read);
    expect(r.events.flight.at(-1)!.end - r.events.flight.at(-1)!.start).toBe(0);
    const j = r.events.jump[0];
    expect(Math.abs((j.landing as number) - read.truth.jumps[0].landing)).toBeLessThanOrEqual(j.landingMargin as number);
    const h = measure(r, 'height');
    expect(Math.abs((h.value as number) - read.truth.jumps[0].heightCm)).toBeLessThanOrEqual(h.margin as number);
  });

  it('keeps every run-up timing it shows inside its margin at 30, 60, 120 and 240 samples a second (200 run-ups each, last contacts of 0.20 to 0.50 s)', () => {
    const rows: string[] = [];
    for (const rate of [30, 60, 120, 240]) {
      const errors: number[] = [], margins: number[] = [];
      let inside = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const rng = seeded(7000 * rate + seed);
        const flight = 0.4 + 0.4 * rng();
        const plant = 0.2 + 0.3 * rng();
        const read = syntheticJumps({ jumps: [{ flight, approach: 3, plant }], rate, phase: rng() / rate, noisePx: 1, noise: noiseOf(seed) });
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
    console.log(`Last contact of a run-up, synthetic run-ups of three strides, last contacts of 0.20 to 0.50 s, noise 1 px on a 360x640 frame:\n${rows.join('\n')}`);
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

  it('names the knee check\'s refusal for what it measures when a landing\'s knees are not seen', () => {
    const read = syntheticJumps({ jumps: [{ flight: 0.6, knees: 0.6 }, { flight: 0.6, knees: 0.6 }], rate: 30, noisePx: 1, noise: noiseOf(12) });
    const second = read.truth.jumps[1];
    read.timestamps.forEach((t, i) => {
      if (t > second.landing && t < second.landing + 0.9) for (const k of [25, 26]) read.landmarks[i]![k] = { ...read.landmarks[i]![k], visibility: 0.1 };
    });
    const r = runActivity(volleyball, read);
    expect(measure(r, 'jumps').value).toBe(2);
    const k = measure(r, 'landing');
    expect(k.value).toBeNull();
    expect(k.values.length).toBe(1);
    expect(k.refused?.fr).toBe('Genoux vus sur 1\u00A0réception sur 2\u00A0: impossible de désigner celle où ils rentrent le plus.');
  });

  it('refuses a height when the flight time and the hip\'s curve disagree (a hip rising 15 cm relative to the centre of mass)', () => {
    let refused = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const read = syntheticJumps({ jumps: [{ flight: 0.6, hipShift: 0.15 }], rate: 240, phase: seed / 21 / 240, noisePx: 1, noise: noiseOf(seed) });
      const r = runActivity(volleyball, read), h = measure(r, 'height'), j = r.events.jump[0];
      if (h.value === null && /disagree/.test(h.refused?.en ?? '')) refused += 1;
      // A height still shown keeps at least the flight-time method's own margin: the cap never makes it falsely tight.
      if (h.value !== null) expect(h.margin as number, `seed ${seed}`).toBeGreaterThanOrEqual(heightMarginCm(j.flight!, j.flightMargin!) - 1e-9);
    }
    expect(refused).toBeGreaterThan(10);
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
