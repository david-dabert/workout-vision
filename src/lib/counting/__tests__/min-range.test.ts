/**
 * A rep's range is measured from the rest it leaves (28 September 2026). A rep counts only if it
 * covers MIN_ROM_DEGREES (20°), but the state machine measured that range from the first sample
 * past the rest threshold, a fifth of the set's range inside the rest. With noise on the angle,
 * reps of 25 to 35° then failed the minimum, and the reset of bf50199 sent more reps through that
 * short measure (the review of 28 September: noisy sets of 22 to 30° further from the truth).
 * The range is now measured from the level of the rest the rep left, over its last second, to the
 * level of its working end (detectReps in core.ts says how each is found).
 * - The first fifteen tests fail on bf50199. From the raises after a false start on, they also
 *   pin documented choices, and five guards pin more (the flickers, the rest that moves, the
 *   fuller pause, the fuller rest after a partial and the weights held out at the start): code
 *   that differs from a choice on that point fails the test that names it (the third review of
 *   28 September: nothing pinned them; the sixth: nothing told the last second of rest from the
 *   last second of time; the seventh: the first rep's stand-in ignored how long the video had run).
 * - The five tests after them fail on d7f6e02, the draft before this one. It left out of the rest
 *   any pause held further than a band from the rest's last stay: noise broke such a pause up,
 *   so a fuller one still lengthened a partial (the fifth review of 28 September), and on slow
 *   reps the last stay fell on the rise out of the rest, which read the rest less full.
 * - The window of one second is pinned from both sides: at 0.75 s, the slow 20.5° reps and the
 *   noisy slow 24° reps miss; at 1.5 s, the noisy partials after a fuller pause count; at 2 s, so
 *   does the fourth review's partial with no noise.
 * - The guards pass on bf50199. Each partial in them crosses both thresholds, so it reaches the
 *   range check, and every partial guard fails with the check removed (the second review of 28
 *   September: the first guards never reached it). The part-way holds come from that review.
 * - The it.fails tests are the measure's known limits.
 *   - A rep that turns within one sample reads 2° to 4° short at 15 samples per second, as its
 *     reported range has since 3c. The first test's reps turn as a joint does, easing out of one
 *     end and into the other along the minimum-jerk profile (Flash and Hogan 1985, J Neurosci
 *     5:1688; status: literature).
 *   - A partial held at the top reads a little long in noise: the most extreme third of a second
 *     is picked from the hold. A fuller pause left half a second before it lengthens it further.
 *   - A pause left less than a second before the rep still moves its rest: an 18° partial 0.2 s
 *     after 2 s held 8° fuller counts, with no noise (the sixth review of 28 September).
 *   - A slow rep's rise out of the rest can fill the last second before it, which then reads the
 *     rest less full: clean 21° reps moving 3.5 s each way all miss (the sixth review), and with
 *     noise, sets of slow 21.5° reps miss a rep about 40 % of the time.
 *   - A turn at the rest without a pause, once it lasts REST_LEVEL_MIN_SEC, is taken at its
 *     median, well inside its fullest point: such 22° curls count 1 of 10 (the third review).
 *   d7f6e02 counted the two clean sets of the sixth review right. test/real-phone/range-from-rest/
 *   curve.txt records the first two limits, by true range, and rest-level.txt the pauses and the
 *   slow reps, by timing and by range, against bf50199 and d7f6e02.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift } from '../core';
import { jointFrame, sample, timestamps, seeded, gaussian, type Joint, type Segment } from './synthetic';

const SPS = 15; // the app's sampling
const HEAVY_MS = 30_000; // tests that replay 800 to 1200 sets take 1 to 3 s; vitest's default limit is 5 s

/** As sample(), but each move follows the minimum-jerk profile instead of a straight line. */
function sampleSmooth(path: Segment[], start: number): number[] {
  const out: number[] = [];
  let angle = start;
  for (const seg of path) {
    const n = Math.max(1, Math.round(seg.sec * SPS));
    if ('hold' in seg) {
      angle = seg.hold;
      for (let i = 0; i < n; i++) out.push(angle);
    } else {
      const from = angle;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        out.push(from + (seg.to - from) * t * t * t * (10 - 15 * t + 6 * t * t));
      }
      angle = seg.to;
    }
  }
  return out;
}

const curls = (a: number[]) => countReps(a.map(x => jointFrame('elbow', { left: x })), timestamps(a.length, SPS), 'bicep_curl');
const raises = (a: number[]) => countReps(a.map(x => jointFrame('shoulder', { left: x })), timestamps(a.length, SPS), 'lateral_raise');
const countHeld = (a: number[], restsLow: boolean) => (restsLow ? raises(a) : curls(a));

/** Gaussian noise of 1° to 1.5° on every sample, seeded. */
function noisy(a: number[], seed: number): number[] {
  const rng = seeded(seed);
  const noise = 1 + 0.5 * rng();
  return a.map(x => x + gaussian(rng, noise));
}

/**
 * A seeded set: 6 to 12 reps of the given range, each within 10 % of it, at a varied pace, with
 * Gaussian noise of 0.5° to 2° on the angle, resting high (curl) or low (lateral raise). Its reps
 * turn smoothly, or within one sample.
 */
function noisySet(seed: number, rangeMin: number, rangeMax: number, turn: 'smooth' | 'sharp') {
  const rng = seeded(seed);
  const u = (a: number, b: number) => a + (b - a) * rng();
  const restsLow = seed % 2 === 0;
  const lift: Lift = restsLow ? 'lateral_raise' : 'bicep_curl';
  const joint: Joint = restsLow ? 'shoulder' : 'elbow';
  const range = u(rangeMin, rangeMax), rest = restsLow ? u(15, 30) : u(150, 170), dir = restsLow ? 1 : -1;
  const reps = 6 + Math.floor(rng() * 7), noise = u(0.5, 2);
  const path: Segment[] = [{ hold: rest, sec: u(0.5, 2) }];
  for (let r = 0; r < reps; r++) {
    path.push({ to: rest + dir * range * u(0.9, 1.1), sec: u(0.6, 1.2) }, { to: rest, sec: u(0.6, 1.2) }, { hold: rest, sec: u(0.5, 2) });
  }
  const clean = turn === 'smooth' ? sampleSmooth(path, rest) : sample(path, rest, SPS);
  const angles = clean.map(a => a + gaussian(rng, noise));
  const count = countReps(angles.map(a => jointFrame(joint, { left: a })), timestamps(angles.length, SPS), lift).count;
  return { reps, count };
}

function miscounted(turn: 'smooth' | 'sharp'): string[] {
  const wrong: string[] = [];
  for (let seed = 1; seed <= 200; seed++) {
    const { reps, count } = noisySet(seed, 25, 35, turn);
    if (count !== reps) wrong.push(`seed ${seed}: ${count} of ${reps}`);
  }
  return wrong;
}

/**
 * A seeded set of eight slow reps, each within 3 % of `depth`, every move taking 2 to 4 s along
 * the minimum-jerk profile, held 0 to 0.5 s at the top and 0 to `pauseMax` s at the rest, with
 * Gaussian noise of 0.5° to 2°: a curl resting at 150 to 170°, or a lateral raise at 15 to 30°.
 */
function slowSetCount(seed: number, depth: number, restsLow: boolean, pauseMax: number): number {
  const rng = seeded(seed);
  const u = (a: number, b: number) => a + (b - a) * rng();
  const rest = restsLow ? u(15, 30) : u(150, 170), dir = restsLow ? 1 : -1, noise = u(0.5, 2);
  const path: Segment[] = [{ hold: rest, sec: u(0.5, 2) }];
  for (let r = 0; r < 8; r++) {
    const top = rest + dir * depth * u(0.97, 1.03);
    path.push({ to: top, sec: u(2, 4) }, { hold: top, sec: u(0, 0.5) }, { to: rest, sec: u(2, 4) }, { hold: rest, sec: u(0, pauseMax) });
  }
  const angles = sampleSmooth(path, rest).map(a => a + gaussian(rng, noise));
  return (restsLow ? raises(angles) : curls(angles)).count;
}

/** Slow sets of `depth`, both lifts, pauses up to 0.3 s and up to 1.5 s, 200 seeds each: the sets that miss a rep. */
function slowMiscounted(depth: number): string[] {
  const wrong: string[] = [];
  for (const restsLow of [false, true]) for (const pauseMax of [0.3, 1.5]) for (let seed = 1; seed <= 200; seed++) {
    const count = slowSetCount(seed, depth, restsLow, pauseMax);
    if (count !== 8) wrong.push(`${restsLow ? 'rest low' : 'rest high'}, pauses to ${pauseMax} s, seed ${seed}: ${count} of 8`);
  }
  return wrong;
}

/**
 * Six 25° reps held 0.3 s at the working end, then four partials of `depth` held 1.5 s there, so
 * that the partials set the set's working percentile and cross both thresholds; with a seed,
 * Gaussian noise of 1° to 1.5°. A curl resting at 160°, or a lateral raise resting at 20°.
 * `flicker` puts two one-sample errors that far further out, 10 samples apart, in each partial's hold.
 */
function heldPartials(restsLow: boolean, depth: number, seed: number | null, flicker = 0): number[] {
  const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
  const a: number[] = [];
  const add = (path: Segment[]) => { a.push(...sample(path, a.length ? a[a.length - 1] : rest, SPS)); };
  add([{ hold: rest, sec: 1 }]);
  for (let r = 0; r < 6; r++) add([{ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 }]);
  for (let r = 0; r < 4; r++) {
    add([{ to: rest + dir * depth, sec: 0.8 }]);
    const held = a.length;
    add([{ hold: rest + dir * depth, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 }]);
    if (flicker) { a[held + 4] += dir * flicker; a[held + 14] += dir * flicker; }
  }
  return seed === null ? a : noisy(a, seed);
}

/**
 * The fourth review's set (28 September): six 25° reps with 1 s rests, then four partials of
 * `depth` held 1.5 s at the top, the last one after 2 s held `out` fuller than the rest and 0.5 s
 * back at it. A curl resting at 160°, or a lateral raise resting at 20°.
 */
function fullerPause(restsLow: boolean, out: number, depth: number): number[] {
  const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
  const p: Segment[] = [{ hold: rest, sec: 1 }];
  for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 });
  for (let r = 0; r < 4; r++) {
    if (r === 3) p.push({ to: rest - dir * out, sec: 0.5 }, { hold: rest - dir * out, sec: 2 }, { to: rest, sec: 0.5 }, { hold: rest, sec: 0.5 });
    p.push({ to: rest + dir * depth, sec: 0.8 }, { hold: rest + dir * depth, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 });
  }
  return sample(p, rest, SPS);
}

/** Every set of fullerPause() at 3.5°, 5° and 8° out, both lifts, with the noise of 200 seeds: the sets not counted 6. */
function fullerPauseMiscounted(depth: number): string[] {
  const wrong: string[] = [];
  for (const restsLow of [false, true]) for (const out of [3.5, 5, 8]) {
    const clean = fullerPause(restsLow, out, depth);
    for (let seed = 1; seed <= 200; seed++) {
      const count = countHeld(noisy(clean, seed), restsLow).count;
      if (count !== 6) wrong.push(`${restsLow ? 'rest low' : 'rest high'}, ${out}° fuller, seed ${seed}: ${count}`);
    }
  }
  return wrong;
}

/** Ten raises of `depth` after the dumbbells are held `out` degrees out for 4 s, then 0.4 s fully down at 20°. */
function heldOutThenDown(out: number, depth: number): number[] {
  const p: Segment[] = [{ hold: 20 + out, sec: 4 }, { to: 20, sec: 0.5 }, { hold: 20, sec: 0.4 }];
  for (let r = 0; r < 10; r++) p.push({ to: 20 + depth, sec: 0.8 }, { hold: 20 + depth, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
  return sample(p, 20 + out, SPS);
}

/** Ten 23° curls from 160°, the fifth after a pause 3.5° short of straight for 3 s, then 0.8 s straight. */
function curlPausedShort(): number[] {
  const p: Segment[] = [{ hold: 160, sec: 1 }];
  for (let r = 0; r < 10; r++) {
    if (r === 4) p.push({ to: 156.5, sec: 0.5 }, { hold: 156.5, sec: 3 }, { to: 160, sec: 0.5 }, { hold: 160, sec: 0.8 });
    p.push({ to: 137, sec: 0.8 }, { hold: 137, sec: 0.3 }, { to: 160, sec: 0.8 }, { hold: 160, sec: 0.8 });
  }
  return sample(p, 160, SPS);
}

describe('Counting core — a rep\'s range is measured from its rest', () => {
  it('noisy curl and lateral raise sets with 25 to 35° of range, turning as a joint does, count every rep, over 200 seeds', () => {
    expect(miscounted('smooth')).toEqual([]);
  });

  it('rest low: ten 23° raises that sink back under the rest threshold as they leave it count 10', () => {
    // The review of the first draft (28 September): a move that comes back ended the rest.
    const p: Segment[] = [{ hold: 20, sec: 1 }];
    for (let r = 0; r < 10; r++) p.push({ to: 26, sec: 0.4 }, { to: 24, sec: 0.3 }, { to: 43, sec: 0.8 }, { hold: 43, sec: 1 }, { to: 20, sec: 1 }, { hold: 20, sec: 1 });
    expect(raises(sample(p, 20, SPS)).count).toBe(10);
  });

  it('rest high: ten 22° curls that rise back over the rest threshold as they leave it count 10', () => {
    const p: Segment[] = [{ hold: 160, sec: 1 }];
    for (let r = 0; r < 10; r++) p.push({ to: 153, sec: 0.4 }, { to: 156.5, sec: 0.3 }, { to: 138, sec: 0.8 }, { hold: 138, sec: 1 }, { to: 160, sec: 1 }, { hold: 160, sec: 1 });
    expect(curls(sample(p, 160, SPS)).count).toBe(10);
  });

  // The third review of 28 September: each documented choice below had no test that told it apart.
  it('ten 23° raises and ten 23° curls, each after a false start 9° out that comes back 3.5° out for 0.1 s, count 10: the rest is the last second of samples at rest, across the false start, not the last second of time', () => {
    // The sixth review of 28 September. The false start comes back without reaching the working
    // end, so the rest it left goes on; the last second of time holds little more than 3.5° out.
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
      const p: Segment[] = [{ hold: rest, sec: 1 }];
      for (let r = 0; r < 10; r++) p.push({ to: rest + dir * 9, sec: 0.2 }, { hold: rest + dir * 9, sec: 0.6 }, { to: rest + dir * 3.5, sec: 0.5 }, { hold: rest + dir * 3.5, sec: 0.1 }, { to: rest + dir * 23, sec: 0.8 }, { hold: rest + dir * 23, sec: 0.3 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 });
      expect(countHeld(sample(p, rest, SPS), restsLow).count).toBe(10);
    }
  });

  it('ten 22° curls that turn at the rest without pausing count 10: a rest under REST_LEVEL_MIN_SEC is taken at its fullest point', () => {
    const p: Segment[] = [{ hold: 160, sec: 1 }];
    for (let r = 0; r < 10; r++) p.push({ to: 138, sec: 0.5 }, { hold: 138, sec: 0.3 }, { to: 160, sec: 0.5 });
    expect(curls(sample(p, 160, SPS)).count).toBe(10);
  });

  it('five raises from 3.5° out, the fifth lowered fully, then five from fully down count 5: a rep is measured from the rest it left, not the one it comes back to', () => {
    // The first five cover 19.5° from the rest they left; the last five 23°.
    const p: Segment[] = [{ hold: 23.5, sec: 2 }];
    for (let r = 0; r < 4; r++) p.push({ to: 43, sec: 0.8 }, { hold: 43, sec: 0.3 }, { to: 23.5, sec: 0.8 }, { hold: 23.5, sec: 2 });
    for (let r = 0; r < 6; r++) p.push({ to: 43, sec: 0.8 }, { hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 1 });
    expect(raises(sample(p, 23.5, SPS)).count).toBe(5);
  });

  it('a clip that starts at the top of a raise, and ends with 10 s held 3.5° out, counts 9: the first raise is measured from the rest it comes back to, until it leaves it', () => {
    const p: Segment[] = [{ hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 1 }];
    for (let r = 0; r < 8; r++) p.push({ to: 43, sec: 0.8 }, { hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
    p.push({ to: 23.5, sec: 0.5 }, { hold: 23.5, sec: 10 });
    expect(raises(sample(p, 43, SPS)).count).toBe(9);
  });

  it('a clip that starts at the top of a raise which comes back fully down for 0.6 s, then settles 3.5° out for 3 s before the next raise, counts 9: that rest is taken over its first second', () => {
    const p: Segment[] = [{ hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.6 }, { to: 23.5, sec: 0.5 }, { hold: 23.5, sec: 3 }, { to: 20, sec: 0.5 }, { hold: 20, sec: 1 }];
    for (let r = 0; r < 8; r++) p.push({ to: 43, sec: 0.8 }, { hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
    expect(raises(sample(p, 43, SPS)).count).toBe(9);
  });

  it('a clip that starts at the top of a raise which comes back 3.5° out for 0.2 s before the next raise counts 8: that rest ends where the angle leaves it', () => {
    // The first two raises cover 19.5° from 3.5° out; the next eight 23° from fully down.
    const p: Segment[] = [{ hold: 43, sec: 0.3 }, { to: 23.5, sec: 0.8 }, { hold: 23.5, sec: 0.2 }];
    for (let r = 0; r < 9; r++) p.push({ to: 43, sec: 0.8 }, { hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 1 });
    expect(raises(sample(p, 43, SPS)).count).toBe(8);
  });

  it('ten 20.5° raises easing into 1.5 s rests count 10: the rest is taken over its last second, not its first samples', () => {
    const p: Segment[] = [{ hold: 20, sec: 1.5 }];
    for (let r = 0; r < 10; r++) p.push({ to: 40.5, sec: 1 }, { hold: 40.5, sec: 0.3 }, { to: 20, sec: 1.2 }, { hold: 20, sec: 1.5 });
    expect(raises(sampleSmooth(p, 20)).count).toBe(10);
  });

  it('ten 20.5° raises and ten 20.5° curls moving 2.5 s each way into 1.5 s rests count 10: the rest is taken over a second, not less, which the rise out of it fills', () => {
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
      const p: Segment[] = [{ hold: rest, sec: 1.5 }];
      for (let r = 0; r < 10; r++) p.push({ to: rest + dir * 20.5, sec: 2.5 }, { hold: rest + dir * 20.5, sec: 0.3 }, { to: rest, sec: 2.5 }, { hold: rest, sec: 1.5 });
      expect(countHeld(sampleSmooth(p, rest), restsLow).count).toBe(10);
    }
  });

  it('ten 22° curls in a clip that starts one sample into the first curl count 10: a first rest cut short by the start gives way to the rest the rep comes back to', () => {
    // The third review of 28 September, unchanged.
    const p: Segment[] = [];
    for (let r = 0; r < 10; r++) p.push({ to: 138, sec: 0.8 }, { hold: 138, sec: 0.3 }, { to: 160, sec: 0.8 }, { hold: 160, sec: 1 });
    expect(curls(sample(p, 160, SPS).slice(1)).count).toBe(10);
  });

  it('ten 22° curls in a clip whose first second has no pose, then starts one sample into the first curl, count 10: the start of the video is its first sample with a pose', () => {
    const p: Segment[] = [];
    for (let r = 0; r < 10; r++) p.push({ to: 138, sec: 0.8 }, { hold: 138, sec: 0.3 }, { to: 160, sec: 0.8 }, { hold: 160, sec: 1 });
    const frames = [...Array(SPS).fill(null), ...sample(p, 160, SPS).slice(1).map(x => jointFrame('elbow', { left: x }))];
    expect(countReps(frames, timestamps(frames.length, SPS), 'bicep_curl').count).toBe(10);
  });

  // The third review of 28 September, unchanged: a pause still at rest, 3.5° out, outlasted the
  // rest the rep left and was taken for it. The rest is now taken over its last second.
  it('holding the dumbbells 3.5° out for 4 s, then 0.4 s fully down, before a set of 23° raises does not cost the first raise', () => {
    const r = raises(heldOutThenDown(3.5, 23));
    expect(r.lowThreshold).toBeGreaterThan(23.5);
    expect(r.count).toBe(10);
  });

  it('a curl paused 3.5° short of straight for 3 s, then straightened for 0.8 s, before the fifth 23° curl does not cost it', () => {
    const r = curls(curlPausedShort());
    expect(r.highThreshold).toBeLessThan(156.5);
    expect(r.count).toBe(10);
  });

  // They fail on d7f6e02, the draft before this one.
  it('holding the dumbbells 2.5° out for 4 s, then 0.4 s fully down, before ten 22° raises does not cost the first raise', () => {
    // A known limit of d7f6e02: the pause lay within the band of the rest's last stay, so it
    // stayed in the rest and outweighed it.
    expect(raises(heldOutThenDown(2.5, 22)).count).toBe(10);
  });

  it('noisy partials of 17° after 2 s held 3.5°, 5° or 8° fuller than the rest, then 0.5 s back at it, do not count, over 200 seeds', () => {
    // The fifth review of 28 September: noise broke the fuller pause up, and d7f6e02 kept its pieces.
    expect(fullerPauseMiscounted(17)).toEqual([]);
  }, HEAVY_MS);

  it('a noisy curl paused 3.5° short of straight for 3 s, then straightened for 0.8 s, does not cost the fifth 23° curl, over 200 seeds', () => {
    const clean = curlPausedShort();
    const wrong: number[] = [];
    for (let seed = 1; seed <= 200; seed++) if (curls(noisy(clean, seed)).count !== 10) wrong.push(seed);
    expect(wrong).toEqual([]);
  });

  it('noisy: holding the dumbbells 3.5° out for 4 s, then 0.4 s fully down, before ten 24° raises does not cost the first raise, over 200 seeds', () => {
    const clean = heldOutThenDown(3.5, 24);
    const wrong: number[] = [];
    for (let seed = 1; seed <= 200; seed++) if (raises(noisy(clean, seed)).count !== 10) wrong.push(seed);
    expect(wrong).toEqual([]);
  });

  it('noisy slow curls and raises of 24°, moving 2 to 4 s each way, count every rep, over 200 seeds', () => {
    // On d7f6e02 the rest's last stay fell on the slow rise out of it.
    expect(slowMiscounted(24)).toEqual([]);
  }, HEAVY_MS);

  // Guards: they pass on bf50199.
  it('partials of 18° held at the top after six 25° reps cross both thresholds and do not count', () => {
    for (const restsLow of [false, true]) {
      const r = countHeld(heldPartials(restsLow, 18, null), restsLow);
      // Each partial reaches the working threshold, so only the range check can refuse it.
      if (restsLow) expect(r.highThreshold).toBeLessThan(38);
      else expect(r.lowThreshold).toBeGreaterThan(142);
      expect(r.count).toBe(6);
    }
  });

  it('noisy partials of 17° held at the top after six 25° reps do not count, over 200 seeds', () => {
    const wrong: string[] = [];
    for (const restsLow of [false, true]) {
      for (let seed = 1; seed <= 200; seed++) {
        const count = countHeld(heldPartials(restsLow, 17, seed), restsLow).count;
        if (count !== 6) wrong.push(`${restsLow ? 'rest low' : 'rest high'}, seed ${seed}: ${count}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('two one-sample flickers of 6° in the hold of an 18.5° partial do not make it a rep: the working end is consecutive samples', () => {
    expect(curls(heldPartials(false, 18.5, null, 6)).count).toBe(6);
  });

  it('an 18° partial after eight 25° reps, then 4 s settled 6° fuller than the rest, does not count: a later rep is measured from the rest it left alone', () => {
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
      const p: Segment[] = [{ hold: rest, sec: 1 }];
      for (let r = 0; r < 8; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 0.8 });
      p.push({ to: rest + dir * 18, sec: 0.8 }, { hold: rest + dir * 18, sec: 0.8 }, { to: rest - dir * 6, sec: 1 }, { hold: rest - dir * 6, sec: 4 });
      expect(countHeld(sample(p, rest, SPS), restsLow).count).toBe(8);
    }
  });

  it('18.5° partials after the rest moves 2° out, following six 25° reps with 2 s rests, do not count: each rep is measured from its own rest, not the whole video\'s', () => {
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1, moved = rest + dir * 2;
      const p: Segment[] = [{ hold: rest, sec: 2 }];
      for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: r < 5 ? rest : moved, sec: 1 }, { hold: r < 5 ? rest : moved, sec: 2 });
      for (let r = 0; r < 4; r++) p.push({ to: moved + dir * 18.5, sec: 0.8 }, { hold: moved + dir * 18.5, sec: 1.5 }, { to: moved, sec: 0.8 }, { hold: moved, sec: 1 });
      expect(countHeld(sample(p, rest, SPS), restsLow).count).toBe(6);
    }
  });

  it('18° partials after 2 s held 3.5°, 5° or 8° fuller than the rest, then 0.5 s back at it, do not count: a pause left half a second before the partial does not lengthen it', () => {
    // The fourth review of 28 September: the pause outweighed the rest the partial left.
    const wrong: string[] = [];
    for (const restsLow of [false, true]) for (const out of [3.5, 5, 8]) {
      const count = countHeld(fullerPause(restsLow, out, 18), restsLow).count;
      if (count !== 6) wrong.push(`${restsLow ? 'rest low' : 'rest high'}, ${out}° fuller: ${count}`);
    }
    expect(wrong).toEqual([]);
  });

  // The second review of 28 September: a hold part way out of the rest was taken for the rest.
  it('a raise held part way for 3 s before the fifth raise does not cost the fifth raise', () => {
    const p: Segment[] = [{ hold: 20, sec: 1 }];
    for (let r = 0; r < 10; r++) {
      if (r === 4) p.push({ to: 29, sec: 0.5 }, { hold: 29, sec: 3 }, { to: 20, sec: 0.5 }, { hold: 20, sec: 0.3 });
      p.push({ to: 46, sec: 0.8 }, { hold: 46, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
    }
    expect(raises(sample(p, 20, SPS)).count).toBe(10);
  });

  it('a curl held part way for 3 s before the fifth curl does not cost the fifth curl', () => {
    const p: Segment[] = [{ hold: 160, sec: 1 }];
    for (let r = 0; r < 10; r++) {
      if (r === 4) p.push({ to: 151, sec: 0.5 }, { hold: 151, sec: 3 }, { to: 160, sec: 0.5 }, { hold: 160, sec: 0.3 });
      p.push({ to: 134, sec: 0.8 }, { hold: 134, sec: 0.3 }, { to: 160, sec: 0.8 }, { hold: 160, sec: 0.8 });
    }
    expect(curls(sample(p, 160, SPS)).count).toBe(10);
  });

  it('an 18° partial after the weights are held 10° out for the first 3 s of the clip, then 0.1 s back 3.5° short of the rest, does not count: the first rep takes the rest it comes back to only when the start of the video cut its rest short', () => {
    // The seventh review of 28 September: the stand-in applied however long the video had run,
    // so the partial was measured from the fuller rest after it, 7 for 6. bf50199 counted 6.
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1, from = rest + dir * 3.5;
      const p: Segment[] = [{ hold: rest + dir * 10, sec: 3 }, { to: from, sec: 0.3 }, { hold: from, sec: 0.1 }, { to: from + dir * 18, sec: 0.8 }, { hold: from + dir * 18, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 }];
      for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 });
      const r = countHeld(sample(p, rest + dir * 10, SPS), restsLow);
      // The partial reaches the working threshold, so only the range check can refuse it.
      if (restsLow) expect(r.highThreshold).toBeLessThan(from + 18);
      else expect(r.lowThreshold).toBeGreaterThan(from - 18);
      expect(r.count).toBe(6);
    }
  });

  it('holding the dumbbells 9° out for 4 s before the set does not cost the first raise', () => {
    const p: Segment[] = [{ hold: 29, sec: 4 }, { to: 20, sec: 0.5 }, { hold: 20, sec: 0.4 }];
    for (let r = 0; r < 10; r++) p.push({ to: 46, sec: 0.8 }, { hold: 46, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
    expect(raises(sample(p, 29, SPS)).count).toBe(10);
  });

  // Known limits.
  it.fails('the first test\'s sets with reps that turn within one sample count every rep, over 200 seeds', () => {
    expect(miscounted('sharp')).toEqual([]);
  });

  it.fails('noisy partials of 18° held at the top after six 25° reps do not count, over 200 seeds', () => {
    // The second review of 28 September, extended to raises by the third. bf50199 lets fewer
    // through, by measuring every rep short.
    const wrong: string[] = [];
    for (const restsLow of [false, true]) {
      for (let seed = 1; seed <= 200; seed++) {
        const count = countHeld(heldPartials(restsLow, 18, seed), restsLow).count;
        if (count !== 6) wrong.push(`${restsLow ? 'rest low' : 'rest high'}, seed ${seed}: ${count}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it.fails('noisy partials of 18° after 2 s held 3.5°, 5° or 8° fuller than the rest, then 0.5 s back at it, do not count, over 200 seeds', () => {
    // The fifth review of 28 September. The last second before the partial still holds some of
    // the way back from the pause. bf50199 lets fewer through, by measuring every rep short.
    expect(fullerPauseMiscounted(18)).toEqual([]);
  }, HEAVY_MS);

  it.fails('an 18° partial after 2 s held 8° fuller than the rest, then only 0.2 s back at it, does not count', () => {
    // The sixth review of 28 September: the last second before the partial holds more of the way
    // back from the pause than of the rest, which reads 2° fuller, and the partial measures
    // 20.03°: 7 for 6. d7f6e02 counted 6.
    const counts = [false, true].map(restsLow => {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
      const p: Segment[] = [{ hold: rest, sec: 1 }];
      for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 });
      for (let r = 0; r < 4; r++) {
        if (r === 3) p.push({ to: rest - dir * 8, sec: 0.5 }, { hold: rest - dir * 8, sec: 2 }, { to: rest, sec: 0.5 }, { hold: rest, sec: 0.2 });
        p.push({ to: rest + dir * 18, sec: 0.8 }, { hold: rest + dir * 18, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 });
      }
      return countHeld(sample(p, rest, SPS), restsLow).count;
    });
    expect(counts).toEqual([6, 6]);
  });

  it.fails('ten 21° curls and ten 21° raises moving 3.5 s each way into 1.5 s rests count 10', () => {
    // The sixth review of 28 September: the rise out of the rest fills the last second before
    // each rep, so the rest reads 1.04° less full and every rep measures 19.96°. d7f6e02 took the
    // whole rest and counted all ten.
    const counts = [false, true].map(restsLow => {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
      const p: Segment[] = [{ hold: rest, sec: 1.5 }];
      for (let r = 0; r < 10; r++) p.push({ to: rest + dir * 21, sec: 3.5 }, { hold: rest + dir * 21, sec: 0.3 }, { to: rest, sec: 3.5 }, { hold: rest, sec: 1.5 });
      return countHeld(sampleSmooth(p, rest), restsLow).count;
    });
    expect(counts).toEqual([10, 10]);
  });

  it.fails('noisy slow curls and raises of 21.5°, moving 2 to 4 s each way, count every rep, over 200 seeds', () => {
    // The rise out of a slow rep's rest fills the last second before it and reads the rest less
    // full. d7f6e02 missed about as many sets with short pauses and half as many with long ones
    // (rest-level.txt).
    expect(slowMiscounted(21.5)).toEqual([]);
  }, HEAVY_MS);

  it.fails('ten 22° curls that turn at the rest without pausing, 0.8 s each way, count 10', () => {
    // The third review of 28 September, unchanged. The turn stays past the rest threshold longer
    // than REST_LEVEL_MIN_SEC, so its median is taken, which lies well inside its fullest point:
    // 1 of the 10 counts.
    const p: Segment[] = [{ hold: 160, sec: 1 }];
    for (let r = 0; r < 10; r++) p.push({ to: 138, sec: 0.8 }, { hold: 138, sec: 0.3 }, { to: 160, sec: 0.8 });
    expect(curls(sample(p, 160, SPS)).count).toBe(10);
  });

  // The reviewer's test from the first version of this step (28 September 2026), added unchanged as a guard.
  it('an 18° partial 3 s into the clip, after the dumbbells are held 10° out and 0.1 s at rest, does not count although the rest after it is 3° fuller', () => {
    const p: Segment[] = [{ hold: 30, sec: 3 }, { to: 20, sec: 0.1 }, { hold: 20, sec: 0.1 }, { to: 38, sec: 0.8 }, { hold: 38, sec: 1.5 }, { to: 17, sec: 0.8 }, { hold: 17, sec: 1 }];
    for (let r = 0; r < 6; r++) p.push({ to: 42, sec: 1 }, { hold: 42, sec: 0.3 }, { to: 17, sec: 1 }, { hold: 17, sec: 1 });
    expect(raises(sample(p, 30, SPS)).count).toBe(6);
  });

  // The second version's reviewer's test (28 September 2026), added unchanged. It fails on core 00c852b8
  // (7 for 6 on both lifts) and passes on bf50199: the rest window reaches back across a pose dropout.
  it('an 18° partial after the arm hung 12° fuller, the pose lost 0.5 s while it came back, then 0.3 s seen at rest, does not count', () => {
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1, joint = restsLow ? 'shoulder' : 'elbow';
      const p: Segment[] = [{ hold: rest, sec: 1 }];
      for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 22, sec: 1 }, { hold: rest + dir * 22, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 });
      p.push({ to: rest - dir * 12, sec: 0.5 }, { hold: rest - dir * 12, sec: 2 });
      const seenBefore = sample(p, rest, SPS);
      const seenAfter = sample([{ hold: rest, sec: 0.3 }, { to: rest + dir * 18, sec: 0.8 }, { hold: rest + dir * 18, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 }], rest, SPS);
      const frames = [...seenBefore.map(x => jointFrame(joint, { left: x })), ...Array(8).fill(null), ...seenAfter.map(x => jointFrame(joint, { left: x }))];
      expect(countReps(frames, timestamps(frames.length, SPS), restsLow ? 'lateral_raise' : 'bicep_curl').count).toBe(6);
    }
  });
});
