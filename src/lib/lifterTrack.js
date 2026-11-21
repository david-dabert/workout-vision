/**
 * The lifter chosen over the whole set by motion (card B, 19 November 2026; TRIED.md, 7 October: the lifter lock and
 * the continuity gate were closed with the reopen condition "a lifter identified over the whole set, e.g. by motion").
 *
 * Input: every pose the phone saw on every sample (coreAnalysis.js ?poses=1 records them). Output: one pose per sample,
 * the lifter's, or null where the lifter was not found. Three steps, all on the finished read (no frame ahead is needed
 * because the set is analysed after it is filmed):
 *   0. Duplicates: two poses of one sample at the same place (DUPLICATE_TORSOS) are one body; the first is kept.
 *   1. Tracklets: poses linked from sample to sample by torso continuity (the torso centre, the mean of shoulders and
 *      hips in the picture, moves less than LINK_TORSOS torso lengths since the tracklet's last pose, within
 *      LINK_GAP_SEC). The torso length is the set's median (TRIED.md, 7 October: a per-frame torso length reads
 *      half-collapsed skeletons as jumps of several torso lengths).
 *   2. People: tracklets that never share a sample and sit at the same place over the set (median torso centres within
 *      GROUP_TORSOS torso lengths) are one person. A lifter's skeleton that jumps for a few samples and comes back is
 *      thus one person again; a bystander elsewhere is another.
 *   3. The lifter: the person whose lift joint moves most, and most regularly, over the most samples
 *      (score = samples seen x range of the angle x periodicity). A still bystander scores near 0; a person seen for
 *      2 s scores far below a lifter seen for the whole set.
 *   4. A sample where the lifter has no pose keeps a pose of a fragment (a person never seen without a break for
 *      MIN_PERSON_SEC), the one nearest the lifter's place; a pose of another person proper is dropped.
 *
 * Every constant here is UNSOURCED. Status: experimental (no count reads this module yet; it is measured on stored
 * reads and on David's phone file first: TRIED.md, 19 November 2026).
 */
import { liftDefinition, sideAngles } from './counting/core';

export const LINK_TORSOS = 1.0;
/** Two poses of one sample whose torso centres are closer than this (torso lengths) are one person found twice: the
 * model can return the same body as two poses (seen on the synthetic bystander sets, 19 November 2026); the first it
 * lists is kept. */
export const DUPLICATE_TORSOS = 0.5;
export const LINK_GAP_SEC = 1.0;
export const GROUP_TORSOS = 1.5;
/** Another person must be seen without a break for this long before a sample is taken from the lifter on his account:
 * a shorter fragment cannot be told from the lifter's own skeleton thrown off for a few samples, which on gym videos is
 * far more frequent than a bystander (TRIED.md, 7 October: 13 to 152 jumps per set). */
export const MIN_PERSON_SEC = 1.0;
/** Rep periods searched for the periodicity, in seconds. */
export const PERIOD_MIN_SEC = 0.8;
export const PERIOD_MAX_SEC = 10;
/** Floor of the periodicity factor, so a lifter whose reps are irregular still outscores a still bystander. */
export const PERIODICITY_FLOOR = 0.1;

const L_SH = 11, R_SH = 12, L_HIP = 23, R_HIP = 24;

/** Torso centre and length in picture units (x scaled by aspect = width / height), or null when a point is missing. */
export function torso(image, aspect = 1) {
  const p = [L_SH, R_SH, L_HIP, R_HIP].map(i => image?.[i]);
  if (p.some(q => !q || !Number.isFinite(q.x) || !Number.isFinite(q.y))) return null;
  const sx = (p[0].x + p[1].x) / 2 * aspect, sy = (p[0].y + p[1].y) / 2;
  const hx = (p[2].x + p[3].x) / 2 * aspect, hy = (p[2].y + p[3].y) / 2;
  return { x: (sx + hx) / 2, y: (sy + hy) / 2, length: Math.hypot(sx - hx, sy - hy) };
}

const median = xs => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Step 1. frames: [{ t (seconds, as the app's timestamps), poses: [{ image, world }] }]. Returns tracklets: [{ items: [{ f, k, c }] }], f the
 * sample index, k the pose index in that sample, c its torso.
 */
export function linkTracklets(frames, { aspect = 1, scale, locate } = {}) {
  // locate: where a pose stands, for reads that kept no picture points (the occlusion bench keeps a box per sample).
  const where = locate ?? (p => torso(p.image, aspect));
  const torsos = frames.map(fr => (fr.poses ?? []).map(where));
  const unit = scale ?? median(torsos.flat().filter(Boolean).map(c => c.length).filter(l => l > 0));
  const tracklets = [];
  if (!(unit > 0)) return { tracklets, unit: NaN, torsos };
  // Step 0: a pose standing where an earlier pose of the same sample stands is the same body found twice.
  for (const row of torsos) {
    for (let k = 1; k < row.length; k++) {
      if (row[k] && row.slice(0, k).some(c => c && Math.hypot(c.x - row[k].x, c.y - row[k].y) < DUPLICATE_TORSOS * unit)) row[k] = null;
    }
  }
  const active = [];
  frames.forEach((fr, f) => {
    const t = fr.t;
    for (let i = active.length - 1; i >= 0; i--) if (t - frames[active[i].items.at(-1).f].t > LINK_GAP_SEC) active.splice(i, 1);
    // Every pair (tracklet, pose) within reach, nearest first; each tracklet and each pose taken once.
    const pairs = [];
    torsos[f].forEach((c, k) => {
      if (!c) return;
      active.forEach((tr, a) => {
        const last = tr.items.at(-1).c, d = Math.hypot(c.x - last.x, c.y - last.y);
        if (d <= LINK_TORSOS * unit) pairs.push({ a, k, d });
      });
    });
    pairs.sort((p, q) => p.d - q.d);
    const usedA = new Set(), usedK = new Set();
    for (const { a, k } of pairs) {
      if (usedA.has(a) || usedK.has(k)) continue;
      usedA.add(a); usedK.add(k);
      active[a].items.push({ f, k, c: torsos[f][k] });
    }
    torsos[f].forEach((c, k) => {
      if (!c || usedK.has(k)) return;
      const tr = { items: [{ f, k, c }] };
      tracklets.push(tr); active.push(tr);
    });
  });
  return { tracklets, unit, torsos };
}

/** Step 2. Tracklets joined into people: same place over the set, never in the same sample. */
export function groupPeople(tracklets, unit) {
  const order = [...tracklets].sort((a, b) => b.items.length - a.items.length);
  const people = [];
  for (const tr of order) {
    const at = { x: median(tr.items.map(i => i.c.x)), y: median(tr.items.map(i => i.c.y)) };
    const frames = new Set(tr.items.map(i => i.f));
    const home = people.find(p => Math.hypot(p.at.x - at.x, p.at.y - at.y) <= GROUP_TORSOS * unit && !tr.items.some(i => p.frames.has(i.f)));
    if (home) {
      home.items.push(...tr.items);
      for (const f of frames) home.frames.add(f);
    } else people.push({ at, items: [...tr.items], frames });
  }
  for (const p of people) p.items.sort((a, b) => a.f - b.f);
  return people;
}

/** Normalised autocorrelation peak of a series (nulls skipped pairwise) over lags of PERIOD_MIN_SEC..PERIOD_MAX_SEC. */
export function periodicity(values, timestamps) {
  const xs = values.filter(v => v !== null);
  if (xs.length < 8 || timestamps.length < 2) return 0;
  const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
  const dt = (timestamps.at(-1) - timestamps[0]) / (timestamps.length - 1);
  if (!(dt > 0)) return 0;
  const lo = Math.max(1, Math.round(PERIOD_MIN_SEC / dt)), hi = Math.min(values.length - 4, Math.round(PERIOD_MAX_SEC / dt));
  let best = 0;
  for (let lag = lo; lag <= hi; lag++) {
    let num = 0, d1 = 0, d2 = 0, n = 0;
    for (let i = 0; i + lag < values.length; i++) {
      const a = values[i], b = values[i + lag];
      if (a === null || b === null) continue;
      num += (a - mean) * (b - mean); d1 += (a - mean) ** 2; d2 += (b - mean) ** 2; n++;
    }
    if (n >= 8 && d1 > 0 && d2 > 0) best = Math.max(best, num / Math.sqrt(d1 * d2));
  }
  return best;
}

/** The longest stretch, in seconds, over which a person's samples follow one another with no sample missing. */
function longestRunSec(items, timestamps) {
  let best = 0, start = 0;
  for (let j = 1; j <= items.length; j++) {
    if (j < items.length && items[j].f === items[j - 1].f + 1) continue;
    best = Math.max(best, timestamps[items[j - 1].f] - timestamps[items[start].f]);
    start = j;
  }
  return items.length ? best : 0;
}

const quantile = (s, q) => s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];

/** Step 3's score of one person: samples seen x range of the lift joint's angle x periodicity, best side. */
export function motionScore(world, timestamps, lift) {
  const def = liftDefinition(lift);
  const seen = world.filter(Boolean).length;
  if (!def || seen < 2) return { score: 0, seen, range: 0, periodic: 0 };
  let best = { score: 0, seen, range: 0, periodic: 0 };
  for (const arm of ['left', 'right']) {
    let smoothed;
    try { ({ smoothed } = sideAngles(world, timestamps, def, arm)); } catch { continue; }
    // Only the samples this person was seen on: the smoothing bridges gaps, and a bridge is not motion.
    const own = smoothed.map((v, i) => (world[i] && Number.isFinite(v) ? v : null));
    const vals = own.filter(v => v !== null).sort((a, b) => a - b);
    if (vals.length < 2) continue;
    const range = quantile(vals, 0.9) - quantile(vals, 0.1);
    const periodic = periodicity(own, timestamps);
    const score = vals.length * range * Math.max(PERIODICITY_FLOOR, periodic);
    if (score > best.score) best = { score, seen, range, periodic };
  }
  return best;
}

/**
 * The lifter's pose on every sample. frames: [{ t, poses: [{ image, world }] }] (image and world: arrays of
 * { x, y, z, visibility }). Returns { image, world, timestamps, people, chosen } with image and world one entry per
 * sample (null where the lifter was not found).
 */
export function chooseLifter(frames, lift, { aspect = 1, locate } = {}) {
  const timestamps = frames.map(f => f.t);
  const none = () => frames.map(() => null);
  // A read with one pose per sample has no choice to make: it is returned as it is. Dropping its samples by place
  // alone lost an exact count on the synthetic bench (michelle curl side 6 -> refused, TRIED.md 19 November 2026).
  if (!frames.some(f => (f.poses?.length ?? 0) > 1)) {
    return { image: frames.map(f => f.poses?.[0]?.image ?? null), world: frames.map(f => f.poses?.[0]?.world ?? null), timestamps, people: [], chosen: -1, single: true };
  }
  const { tracklets, unit } = linkTracklets(frames, { aspect, locate });
  if (!tracklets.length) {
    return { image: frames.map(f => f.poses?.[0]?.image ?? null), world: frames.map(f => f.poses?.[0]?.world ?? null), timestamps, people: [], chosen: -1, single: true };
  }
  const people = groupPeople(tracklets, unit).map(p => {
    const world = none(), image = none();
    for (const { f, k } of p.items) { world[f] = frames[f].poses[k].world ?? null; image[f] = frames[f].poses[k].image ?? null; }
    return { ...p, world, image, ...motionScore(world, timestamps, lift) };
  });
  if (!people.length) {
    return { image: frames.map(f => f.poses?.[0]?.image ?? null), world: frames.map(f => f.poses?.[0]?.world ?? null), timestamps, people: [], chosen: -1, single: true };
  }
  let chosen = 0;
  people.forEach((p, i) => { if (p.score > people[chosen].score || (p.score === people[chosen].score && p.seen > people[chosen].seen)) chosen = i; });
  const lifter = people[chosen];
  people.forEach(p => { p.longestSec = longestRunSec(p.items, timestamps); p.fragment = p !== lifter && p.longestSec < MIN_PERSON_SEC; });
  const image = [...lifter.image], world = [...lifter.world];
  let fromFragments = 0;
  frames.forEach((fr, f) => {
    if (world[f]) return;
    let best = null;
    for (const p of people) {
      if (!p.fragment || !p.world[f]) continue;
      const it = p.items.find(i => i.f === f), d = Math.hypot(it.c.x - lifter.at.x, it.c.y - lifter.at.y);
      if (!best || d < best.d) best = { d, p };
    }
    if (best) { world[f] = best.p.world[f]; image[f] = best.p.image[f]; fromFragments++; }
  });
  return { image, world, timestamps, people, chosen, fromFragments };
}

/** A pose file saved by ?poses=1 (coreAnalysis.js saveAllPoses) as frames for chooseLifter. World points take the
 * visibility of the same picture point (the file keeps it on the picture points only; MediaPipe gives both the same). */
export function framesFromPoseFile(file) {
  const one = p => {
    const image = p.image?.map(([x, y, v]) => ({ x, y, z: 0, visibility: v })) ?? null;
    const world = p.world?.map(([x, y, z], i) => ({ x, y, z, visibility: image?.[i]?.visibility ?? 0 })) ?? null;
    return { image, world };
  };
  // A sample with no pose on the whole frame whose crop retry found one (`crop`) reads that pose, as the app's count did.
  return file.frames.map(fr => ({ t: fr.t, poses: fr.poses.length ? fr.poses.map(one) : fr.crop ? [one(fr.crop)] : [] }));
}
