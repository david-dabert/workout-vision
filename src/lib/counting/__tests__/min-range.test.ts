/**
 * A rep's range is measured from the rest it leaves (28 September 2026). A rep counts only if it
 * covers MIN_ROM_DEGREES (20°), but the state machine measured that range from the first sample
 * past the rest threshold, a fifth of the set's range inside the rest. With noise on the angle,
 * reps of 25 to 35° then failed the minimum, and the reset of bf50199 sent more reps through that
 * short measure (the review of 28 September: noisy sets of 22 to 30° further from the truth).
 * The range is now measured from the level of the rest the rep left to the level of its working
 * end (detectReps in core.ts says how each is found).
 * - The first ten tests fail on bf50199. Seven of them, from the curls that turn at the rest on,
 *   also pin documented choices, and four guards pin more (the flickers, the rest that moves,
 *   the fuller pause and the fuller rest after a partial): code that differs from a choice on
 *   that point fails the test that names it (the third review of 28 September: nothing pinned
 *   them). The first test also fails if single samples beyond the band are left out.
 * - The guards pass on bf50199. Each partial in them crosses both thresholds, so it reaches the
 *   range check, and every partial guard fails with the check removed (the second review of 28
 *   September: the first guards never reached it). The part-way holds come from that review.
 * - The it.fails tests are the measure's known limits.
 *   - A rep that turns within one sample reads 2° to 4° short at 15 samples per second, as its
 *     reported range has since 3c. The first test's reps turn as a joint does, easing out of one
 *     end and into the other along the minimum-jerk profile (Flash and Hogan 1985, J Neurosci
 *     5:1688; status: literature).
 *   - A partial held at the top reads a little long in noise: the most extreme third of a second
 *     is picked from the hold.
 *   - A pause within the band of the rest's last stay stays in the rest, and can outweigh it.
 *   - A turn at the rest without a pause, once it lasts REST_LEVEL_MIN_SEC, is taken at its
 *     median, inside its fullest point (the third review of 28 September).
 *   test/real-phone/range-from-rest/curve.txt records the first two, by true range.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift } from '../core';
import { jointFrame, sample, timestamps, seeded, gaussian, type Joint, type Segment } from './synthetic';

const SPS = 15; // the app's sampling

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
  if (seed === null) return a;
  const rng = seeded(seed);
  const noise = 1 + 0.5 * rng();
  return a.map(x => x + gaussian(rng, noise));
}

const countHeld = (a: number[], restsLow: boolean) => (restsLow ? raises(a) : curls(a));

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

  it('ten 20.5° raises easing into 1.5 s rests count 10: the rest is taken over its whole length, not its first samples', () => {
    const p: Segment[] = [{ hold: 20, sec: 1.5 }];
    for (let r = 0; r < 10; r++) p.push({ to: 40.5, sec: 1 }, { hold: 40.5, sec: 0.3 }, { to: 20, sec: 1.2 }, { hold: 20, sec: 1.5 });
    expect(raises(sampleSmooth(p, 20)).count).toBe(10);
  });

  it('ten 22° curls in a clip that starts one sample into the first curl count 10: a first rest cut short by the start gives way to the rest the rep comes back to', () => {
    // The third review of 28 September, unchanged.
    const p: Segment[] = [];
    for (let r = 0; r < 10; r++) p.push({ to: 138, sec: 0.8 }, { hold: 138, sec: 0.3 }, { to: 160, sec: 0.8 }, { hold: 160, sec: 1 });
    expect(curls(sample(p, 160, SPS).slice(1)).count).toBe(10);
  });

  // The third review of 28 September, unchanged: a pause still at rest, 3.5° out, outlasted the
  // rest the rep left and was taken for it. A pause more than the band from the last stay is left out.
  it('holding the dumbbells 3.5° out for 4 s, then 0.4 s fully down, before a set of 23° raises does not cost the first raise', () => {
    const p: Segment[] = [{ hold: 23.5, sec: 4 }, { to: 20, sec: 0.5 }, { hold: 20, sec: 0.4 }];
    for (let r = 0; r < 10; r++) p.push({ to: 43, sec: 0.8 }, { hold: 43, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
    const r = raises(sample(p, 23.5, SPS));
    expect(r.lowThreshold).toBeGreaterThan(23.5);
    expect(r.count).toBe(10);
  });

  it('a curl paused 3.5° short of straight for 3 s, then straightened for 0.8 s, before the fifth 23° curl does not cost it', () => {
    const p: Segment[] = [{ hold: 160, sec: 1 }];
    for (let r = 0; r < 10; r++) {
      if (r === 4) p.push({ to: 156.5, sec: 0.5 }, { hold: 156.5, sec: 3 }, { to: 160, sec: 0.5 }, { hold: 160, sec: 0.8 });
      p.push({ to: 137, sec: 0.8 }, { hold: 137, sec: 0.3 }, { to: 160, sec: 0.8 }, { hold: 160, sec: 0.8 });
    }
    const r = curls(sample(p, 160, SPS));
    expect(r.highThreshold).toBeLessThan(156.5);
    expect(r.count).toBe(10);
  });

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

  it('18.5° partials after the rest moves 2° out, following six 25° reps with 2 s rests, do not count: each rep is measured from the rest since the last cycle, not the whole video', () => {
    for (const restsLow of [false, true]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1, moved = rest + dir * 2;
      const p: Segment[] = [{ hold: rest, sec: 2 }];
      for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: r < 5 ? rest : moved, sec: 1 }, { hold: r < 5 ? rest : moved, sec: 2 });
      for (let r = 0; r < 4; r++) p.push({ to: moved + dir * 18.5, sec: 0.8 }, { hold: moved + dir * 18.5, sec: 1.5 }, { to: moved, sec: 0.8 }, { hold: moved, sec: 1 });
      expect(countHeld(sample(p, rest, SPS), restsLow).count).toBe(6);
    }
  });

  it('18° partials after 2 s held 3.5°, 5° or 8° fuller than the rest, then 0.5 s back at it, do not count: a pause the rep did not leave does not lengthen it', () => {
    // The fourth review of 28 September: the pause outweighed the rest the partial left.
    const wrong: string[] = [];
    for (const restsLow of [false, true]) for (const out of [3.5, 5, 8]) {
      const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
      const p: Segment[] = [{ hold: rest, sec: 1 }];
      for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 });
      for (let r = 0; r < 4; r++) {
        if (r === 3) p.push({ to: rest - dir * out, sec: 0.5 }, { hold: rest - dir * out, sec: 2 }, { to: rest, sec: 0.5 }, { hold: rest, sec: 0.5 });
        p.push({ to: rest + dir * 18, sec: 0.8 }, { hold: rest + dir * 18, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 });
      }
      const count = countHeld(sample(p, rest, SPS), restsLow).count;
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

  it.fails('holding the dumbbells 2.5° out for 4 s, then 0.4 s fully down, before ten 22° raises does not cost the first raise', () => {
    // A pause within the band of the last stay stays in the rest and outweighs it.
    const p: Segment[] = [{ hold: 22.5, sec: 4 }, { to: 20, sec: 0.5 }, { hold: 20, sec: 0.4 }];
    for (let r = 0; r < 10; r++) p.push({ to: 42, sec: 0.8 }, { hold: 42, sec: 0.3 }, { to: 20, sec: 0.8 }, { hold: 20, sec: 0.8 });
    expect(raises(sample(p, 22.5, SPS)).count).toBe(10);
  });

  it.fails('ten 22° curls that turn at the rest without pausing, 0.8 s each way, count 10', () => {
    // The third review of 28 September, unchanged. The turn stays past the rest threshold longer
    // than REST_LEVEL_MIN_SEC, so its median is taken, which lies inside its fullest point.
    const p: Segment[] = [{ hold: 160, sec: 1 }];
    for (let r = 0; r < 10; r++) p.push({ to: 138, sec: 0.8 }, { hold: 138, sec: 0.3 }, { to: 160, sec: 0.8 });
    expect(curls(sample(p, 160, SPS)).count).toBe(10);
  });
});
