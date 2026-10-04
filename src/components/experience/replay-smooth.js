// The skeleton the replay draws, steadied for the eye. The pose model places each point afresh in every sample,
// so a point trembles by a few pixels from one sample to the next and, now and then, leaps for one sample and
// comes back (a hand taken for the bar, a knee for the bench). Drawn as they come, the bones shiver and jump.
// Here each point's track is cleaned once, over the whole set, before anything is drawn:
//   1. a leap of one sample is undone: each coordinate takes the median of itself and its two neighbours
//      (Tukey's running median of three; literature: Tukey, Exploratory Data Analysis, 1977);
//   2. the trembling is averaged out with the binomial weights 1-4-6-4-1 over two samples either side, each
//      sample weighted by how sure the model was of the point, so an unsure sample moves the line least.
// The average is centred: it looks as far ahead as behind, so the drawing never lags the picture.
// Display only. The count, the measures and the report read the samples as the model gave them (R2: nothing here
// can change a count). The window and the weights are experimental, UNSOURCED for this use (R9), chosen by eye on
// David's sets; at 15 samples a second they span a third of a second, well under a rep.
import { HOLE } from './replay-track';

const KERNEL = [1, 4, 6, 4, 1];
const R = (KERNEL.length - 1) >> 1;
const FLOOR = 0.05; // the least weight a sample keeps, so a point the model barely saw anywhere still has a place

// The samples near i that belong to the same stretch of video: none across a gap longer than HOLE.
function reach(times, i, r) {
  let lo = i, hi = i;
  while (lo > 0 && i - lo < r && times[lo] - times[lo - 1] <= HOLE) lo--;
  while (hi < times.length - 1 && hi - i < r && times[hi + 1] - times[hi] <= HOLE) hi++;
  return [lo, hi];
}

const median3 = (a, b, c) => Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));

/** frames: one array of points ({ x, y, visibility }) per sample, or null; times: seconds. Same shape out. */
export function steadyFrames(frames, times) {
  const n = Math.min(frames?.length ?? 0, times?.length ?? 0);
  if (n < 3) return frames || [];
  const has = (j, k) => !!frames[j] && !!frames[j][k];
  // Step 1: a one-sample leap undone, coordinate by coordinate, where both neighbours are in the same stretch.
  const mid = frames.slice(0, n).map((f, i) => {
    if (!f) return f;
    const [lo, hi] = reach(times, i, 1);
    if (lo === i || hi === i) return f;
    return f.map((p, k) => {
      if (!p || !has(lo, k) || !has(hi, k)) return p;
      const a = frames[lo][k], c = frames[hi][k];
      return { ...p, x: median3(a.x, p.x, c.x), y: median3(a.y, p.y, c.y) };
    });
  });
  // Step 2: the centred, sureness-weighted average.
  return mid.map((f, i) => {
    if (!f) return f;
    const [lo, hi] = reach(times, i, R);
    return f.map((p, k) => {
      if (!p) return p;
      let sw = 0, sx = 0, sy = 0, kw = 0, sv = 0;
      for (let j = lo; j <= hi; j++) {
        const q = mid[j]?.[k];
        if (!q) continue;
        const g = KERNEL[j - i + R], v = Number.isFinite(q.visibility) ? q.visibility : 0;
        const w = g * Math.max(FLOOR, v);
        sw += w; sx += w * q.x; sy += w * q.y;
        kw += g; sv += g * v;
      }
      // The sureness is averaged as well, so a point fades in and out of sight instead of blinking.
      return { ...p, x: sx / sw, y: sy / sw, visibility: sv / kw };
    });
  });
}

/**
 * The path the point k has drawn over the last `span` seconds up to t, oldest first, from the steadied frames,
 * ending at `now` (the point as drawn at t). Only points the model was sure of; the path stops at a gap.
 */
export function trailAt(frames, times, t, k, now, { span = 0.6, sure = 0.5 } = {}) {
  // No trail to a point not seen now: it would lead the eye to a limb the drawing has faded out (review of 4 October).
  if (now && !(now.visibility >= sure)) return [];
  const out = [];
  let i = times.length - 1;
  while (i >= 0 && times[i] > t) i--;
  let last = t;
  for (; i >= 0 && t - times[i] <= span; i--) {
    if (last - times[i] > HOLE) break;
    const p = frames[i]?.[k];
    if (!p || !(p.visibility >= sure)) break;
    out.push({ x: p.x, y: p.y, age: (t - times[i]) / span });
    last = times[i];
  }
  out.reverse();
  if (now) out.push({ x: now.x, y: now.y, age: 0 });
  return out;
}
