// Spec-guided counting (SGC; 8 October 2026, bench only, the app imports none of it). PSC (src/lib/counting/psc.js)
// finds the signals that carry a rep by their periodicity alone, and guesses the rest side; the core counts one joint.
// SGC asks the exercise instead: its motion spec (test/real-phone/synth/motions/<key>.json, posed by hand for every
// catalogue exercise) is turned into a skeleton at rest and at the working end (fk.js), PSC's world signals are read on
// both, and the signals the rep should move, with their direction and expected size, form the rep's signal: every such
// signal, z-scored on the set (PSC's conditioning), signed so it rises from rest, weighted by its expected change over
// its noise. Their image-plane twins join when they agree with the world signal. The rest side is known (low, by
// construction). The period, the active segment and the cycles are PSC's (lagProfile, localPeriod, activeSegment, and
// its cycle count with the rest side given). One-limb exercises are counted on each side, the more active kept;
// alternating ones on each side, added; "mirror" ones (lunges) on the signals both sides move the same way.
// Every constant: UNSOURCED, experimental.
import { signalBank, rawSignals, lagProfile, pickPeriod, localPeriod, activeSegment, corrAt, FS } from '../../../src/lib/counting/psc.js';
import { specLandmarks } from './fk.js';

/** Noise scale of a world signal, by kind: angles in degrees, positions and distances in torso lengths. */
const NOISE = name => (/^(elbow|shoulder|hip|knee|ankle)[LR]$|^trunk$/.test(name) ? 4 : 0.04);
/** Signals whose meaning depends on the camera's side (left-right positions): left out of the spec's expectation. */
const VIEW_DEPENDENT = name => /X[LR]$|^noseX$/.test(name);
export const MIN_STRENGTH = 3; // expected change of at least 3 noise units
export const SHARE = 0.35; // and at least 35 % of the strongest expected change
export const IMAGE_AGREE = 0.5; // an image twin joins when it correlates at 0.5 or more with its world signal
export const W_CAP = 25; // a single signal's weight is capped at 25 noise units

const worldValues = lm => {
  const out = new Map();
  for (const r of rawSignals([lm], null, { useImage: false })) out.set(r.name.slice(2), r.values[0]);
  return out;
};
const swapName = n => n.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R');

/**
 * The spec's expected change per world signal: [{ name, delta, strength }], strongest first.
 * mode: 'both' (u on both sides), 'left' (only the left moves), 'mirror' (the signals both mirrored poses move alike).
 */
export function specProfile(spec, mode = 'both') {
  const a = worldValues(specLandmarks(spec, 0, 0));
  const ends = mode === 'left' ? [worldValues(specLandmarks(spec, 1, 0))] : mode === 'mirror' ? [worldValues(specLandmarks(spec, 1, 1)), worldValues(specLandmarks(spec, 1, 1, true))] : [worldValues(specLandmarks(spec, 1, 1))];
  const out = [];
  for (const [name, v0] of a) {
    if (VIEW_DEPENDENT(name) || !Number.isFinite(v0)) continue;
    const ds = ends.map(e => e.get(name) - v0);
    if (!ds.every(Number.isFinite)) continue;
    // Under mirror, a signal counts only if both halves of the cycle move it the same way.
    if (ds.length === 2 && Math.sign(ds[0]) !== Math.sign(ds[1])) continue;
    const delta = ds.reduce((p, q) => (Math.abs(q) < Math.abs(p) ? q : p));
    out.push({ name, delta, strength: Math.abs(delta) / NOISE(name) });
  }
  return out.sort((p, q) => q.strength - p.strength);
}

/**
 * The rep's signal on the bank's grid from a profile: { s, p, members } or null. s: the members' z-scores combined
 * (PSC's scale). p: progress through the spec's rep, in physical units: each member's change in its own noise units
 * (its robust scale on the set, given in scales), over the spec's expected change, so a full rep of the spec moves p
 * by about 1 whatever the set's own amplitude (a set with no rep keeps p small).
 * opts.anglesOnly: angle signals and the trunk only. opts.noImage: no image-plane twins.
 */
function repSignal(sigs, profile, scales, opts = {}) {
  const byName = new Map(sigs.map(x => [x.name, x]));
  const prof = opts.anglesOnly ? profile.filter(p => NOISE(p.name) === 4) : profile;
  const top = prof.length ? prof[0].strength : 0;
  const members = [];
  for (const p of prof) {
    if (p.strength < MIN_STRENGTH || p.strength < SHARE * top) continue;
    const w = byName.get(`w.${p.name}`);
    if (!w) continue;
    const weight = Math.min(p.strength, W_CAP), sign = Math.sign(p.delta);
    members.push({ name: w.name, z: w.z, sign, weight, strength: p.strength, scale: scales.get(w.name), noise: NOISE(p.name) });
    const im = byName.get(`i.${p.name}`);
    if (!opts.noImage && im && corrAt(w.z, im.z) >= IMAGE_AGREE) members.push({ name: im.name, z: im.z, sign, weight, strength: p.strength, scale: scales.get(im.name), noise: NOISE(p.name) });
  }
  if (!members.length) return null;
  const G = members[0].z.length, s = new Float64Array(G).fill(NaN), pr = new Float64Array(G).fill(NaN);
  const amp = members.reduce((x, m) => x + m.weight * m.strength, 0) / members.reduce((x, m) => x + m.weight, 0);
  for (let t = 0; t < G; t++) {
    let acc = 0, wsum = 0, accP = 0, wP = 0;
    for (const m of members) {
      const v = m.z[t];
      if (v !== v) continue;
      acc += m.sign * m.weight * v; wsum += m.weight;
      if (m.scale > 0) { accP += m.sign * m.weight * (v * m.scale) / m.noise; wP += m.weight; }
    }
    if (wsum > 0) s[t] = acc / wsum;
    if (wP > 0) pr[t] = accP / wP / amp;
  }
  return { s, p: pr, members: members.map(m => `${m.sign > 0 ? '+' : '-'}${m.name}`) };
}

/** Robust scale (1.4826 x median absolute deviation) of every raw signal of the set, by bank name. */
function signalScales(wl, image, useImage) {
  const out = new Map();
  for (const r of rawSignals(wl, image, { useImage })) {
    const v = Array.from(r.values).filter(Number.isFinite);
    if (v.length < 8) continue;
    const m = quantile(v, 0.5);
    out.set(r.name, 1.4826 * quantile(v.map(x => Math.abs(x - m)), 0.5));
  }
  return out;
}

const quantile = (xs, q) => { const a = Float64Array.from(xs).sort(); if (!a.length) return NaN; const i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const REST_AT = 0.3, WORK_AT = 0.7, AMP_SHARE = 0.5, SPACING_SHARE = 0.5, HEAD_RETURN_SHARE = 0.5, CUT_RETURN_SHARE = 0.7;

/** PSC's cycle count (psc.js countCycles) with the rest side given: the signal rises from rest. */
export function countRising(s, a, b, tau) {
  const seg = [];
  for (let k = a; k <= b; k++) if (Number.isFinite(s[k])) seg.push(s[k]);
  if (seg.length < 8) return { count: 0, cycles: [], span: 0 };
  const p10 = quantile(seg, 0.1), p90 = quantile(seg, 0.9), span = p90 - p10;
  if (!(span > 0)) return { count: 0, cycles: [], span: 0 };
  const u = k => (Number.isFinite(s[k]) ? (s[k] - p10) / span : NaN);
  const cand = [];
  let state = null, cur = null, head = null;
  for (let k = a; k <= b; k++) {
    const x = u(k);
    if (!Number.isFinite(x)) continue;
    if (state === null) { state = x >= WORK_AT ? 'work' : x <= REST_AT ? 'rest' : 'between'; if (state === 'work') { head = { start: k, peak: k, top: x }; cur = null; } continue; }
    if (state !== 'work') {
      if (x <= REST_AT) { if (state !== 'rest' || !cur || x < cur.low) cur = { start: k, low: x }; state = 'rest'; }
      if (x >= WORK_AT) { state = 'work'; if (!cur) cur = { start: k, low: x }; cur.peak = k; cur.top = x; }
      continue;
    }
    if (head && !cur) { if (x > head.top) { head.top = x; head.peak = k; } }
    else if (x > cur.top) { cur.top = x; cur.peak = k; }
    if (x <= REST_AT) {
      if (head && !cur) { head.end = k; head.low = x; head.done = true; }
      else cand.push({ start: cur.start, peak: cur.peak, end: k, amp: cur.top - Math.max(cur.low, x) });
      state = 'rest'; cur = { start: k, low: x };
    }
  }
  const medAmp = quantile(cand.map(c => c.amp), 0.5);
  const accepted = [];
  for (const c of cand) {
    if (cand.length >= 2 && c.amp < AMP_SHARE * medAmp) continue;
    const prev = accepted[accepted.length - 1];
    if (prev && c.peak - prev.peak < SPACING_SHARE * tau[c.peak]) { if (c.amp > prev.amp) accepted[accepted.length - 1] = c; continue; }
    accepted.push(c);
  }
  const ref = accepted.length ? quantile(accepted.map(c => c.amp), 0.5) : NaN;
  const near = (k, other) => other !== undefined && Math.abs(k - other) >= 0.5 * tau[k] && Math.abs(k - other) <= 1.5 * tau[k];
  if (head && head.done && accepted.length >= 2 && head.top - head.low >= HEAD_RETURN_SHARE * ref && near(head.peak, accepted[0].peak)) accepted.unshift({ start: head.start, peak: head.peak, end: head.end, amp: head.top - head.low, edge: 'head' });
  if (state === 'work' && cur && cur.peak !== undefined && accepted.length >= 2) {
    let lastX = NaN;
    for (let k = b; k >= a && !Number.isFinite(lastX); k--) lastX = u(k);
    const amp = cur.top - cur.low;
    if (amp >= AMP_SHARE * ref && cur.top - lastX >= CUT_RETURN_SHARE * amp && near(cur.peak, accepted[accepted.length - 1].peak)) accepted.push({ start: cur.start, peak: cur.peak, end: b, amp, edge: 'tail' });
  }
  return { count: accepted.length, cycles: accepted, span };
}

/** Count one rep signal on the grid: period, active segment, cycles. */
function countSignal(s, G) {
  const lo = Math.max(2, Math.round(0.8 * FS)), hi = Math.min(Math.floor(0.6 * G), Math.round(8 * FS));
  const sig = [{ z: s }];
  if (hi <= lo) return { count: null, reason: 'too short' };
  const per = pickPeriod(lagProfile(sig, [1], lo - 1, hi + 1), lo, hi);
  if (!per) return { count: null, reason: 'no period' };
  const lag = per.lag, local = localPeriod(sig, [1], lag);
  let a = 0, b = G - 1;
  const seg = activeSegment(local.score, lag);
  if (seg) { a = Math.max(0, Math.floor(seg[0] - lag)); b = Math.min(G - 1, Math.ceil(seg[1] + lag)); }
  const c = countRising(s, a, b, local.tau);
  return { count: c.count, cycles: c.cycles, period: lag / FS, periodScore: per.score, segment: [a, b] };
}

// The core's own rep logic (thresholds, rep detection, edges, refusals: coreAnalysis.js summarizeCount) on the rep
// signal, by handing it a skeleton whose elbow bends as the signal rises: rest 170 degrees, the signal's 95th
// percentile 50 degrees. The carrier exercise has the elbow joint, rest high, and the spec's first phase (bicep_curl
// concentric, bench_press eccentric). No app code changes; bench only.
const CARRIER = { concentric: 'bicep_curl', eccentric: 'bench_press' };
function carrierLandmarks(s, lo, hi) {
  return Array.from(s, x => {
    if (!Number.isFinite(x)) return null;
    const v = Math.max(-0.05, Math.min(1.4, (x - lo) / (hi - lo || 1)));
    const th = (170 - 120 * v) * Math.PI / 180;
    const P = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    for (const [sh, el, wr, hip, sg] of [[11, 13, 15, 23, 1], [12, 14, 16, 24, -1]]) {
      P[sh] = { x: sg * 0.18, y: -0.5, z: 0, visibility: 1 };
      P[el] = { x: sg * 0.18, y: -0.21, z: 0, visibility: 1 };
      P[wr] = { x: sg * 0.18, y: -0.21 + 0.26 * Math.cos(Math.PI - th), z: -0.26 * Math.sin(Math.PI - th), visibility: 1 };
      P[hip] = { x: sg * 0.09, y: 0, z: 0, visibility: 1 };
    }
    return P;
  });
}
export function coreOnSignal(s, grid, first, summarize, physical = false) {
  const fin = Array.from(s).filter(Number.isFinite).sort((a, b) => a - b);
  if (fin.length < 10) return { count: null, reason: 'too few samples' };
  // physical: s is progress (a full rep of the spec moves it by 1), so 1 maps to 120 degrees from its 5th percentile;
  // otherwise the set's own 5-95 % band maps to 120 degrees.
  const lo = fin[Math.floor(0.05 * (fin.length - 1))], hi = physical ? lo + 1 : fin[Math.floor(0.95 * (fin.length - 1))];
  const r = summarize(carrierLandmarks(s, lo, hi), grid, CARRIER[first] ?? CARRIER.concentric);
  return { count: r.refused ? null : r.count, refused: !!r.refused, reason: r.refused ? 'core refused the signal' : undefined };
}

/**
 * The rep signals of a set from its spec (repSignal), as sgcCount and specProgress read them: { grid, G, oneSide, rs }
 * (rs: [left, right] for a one-limb or alternating spec, else [both]; an entry is null when none of its signals is
 * seen), or { reason } when there is nothing to read.
 */
function specSignals({ wl, ts, image = null }, spec, opts) {
  if (!spec || spec.noReps) return { reason: 'no reps in the spec' };
  if (!ts || ts.length < 10) return { reason: 'too short' };
  const { grid, sigs } = signalBank(wl, ts, image, { useImage: opts.useImage !== false });
  if (!sigs.length) return { reason: 'no signal seen' };
  const G = grid.length, scales = signalScales(wl, image, opts.useImage !== false);
  const rs = pr => repSignal(sigs, pr, scales, opts);
  if (spec.side || spec.alternate === true) {
    // Each side's own signals: the spec's moving side as written, and its mirror for the other side.
    const left = specProfile(spec, 'left').filter(p => !/R$/.test(p.name));
    const right = left.map(p => ({ ...p, name: swapName(p.name) }));
    return { grid, G, oneSide: true, rs: [rs(left), rs(right)] };
  }
  return { grid, G, oneSide: false, rs: [rs(specProfile(spec, spec.alternate === 'mirror' ? 'mirror' : 'both'))] };
}

/**
 * Count a set with its exercise's motion spec.
 * @param {{ wl: any[], ts: number[], image?: Array<number[]|null>|null }} set
 * @param {object} spec a motion spec (motions/<key>.json)
 * @returns {{ count: number|null, members: string[], period?: number, reason?: string, sides?: number[] }}
 */
export function sgcCount(set, spec, opts = {}) {
  const b = specSignals(set, spec, opts);
  if (b.reason) return { count: null, members: [], reason: b.reason };
  const { grid, G } = b;
  // opts.summarize (coreAnalysis.js summarizeCount): the core's rep logic on the rep signal as well (coreCount), on
  // the progress p (opts.physical) or on the z-combination s.
  const withCore = r => (opts.summarize ? (({ count, reason }) => ({ coreCount: count, coreReason: reason }))(opts.physical ? coreOnSignal(r.p, grid, opts.first, opts.summarize, true) : coreOnSignal(r.s, grid, opts.first, opts.summarize)) : {});
  if (b.oneSide) {
    const res = b.rs.map(r => (r ? { ...countSignal(r.s, G), ...withCore(r), members: r.members } : { count: null, coreCount: null, members: [] }));
    if (spec.alternate === true) {
      const n = res.filter(r => r.count != null), m = res.filter(r => r.coreCount != null);
      return { count: n.length ? n.reduce((x, r) => x + r.count, 0) : null, coreCount: m.length ? m.reduce((x, r) => x + r.coreCount, 0) : null, members: res.flatMap(r => r.members), sides: res.map(r => r.count) };
    }
    // One limb: the side whose rep signal is more periodic.
    const best = res.filter(r => r.count != null).sort((p, q) => (q.periodScore ?? -1) - (p.periodScore ?? -1))[0];
    return best ? { ...best, sides: res.map(r => r.count) } : { count: null, coreCount: null, members: [], reason: 'no period on either side' };
  }
  const r = b.rs[0];
  if (!r) return { count: null, coreCount: null, members: [], reason: 'none of the spec\'s signals seen' };
  return { ...countSignal(r.s, G), ...withCore(r), members: r.members };
}

/**
 * The spec's progress through the rep (repSignal's p, physical units: a full rep of the spec moves it by about 1), on
 * PSC's 15 Hz grid from the set's first timestamp: { t0, p } (p NaN where no member is seen), or null when there is no
 * spec, the spec has no reps, or none of its signals is seen. One-limb specs: the side sgcCount counts (the more
 * periodic; when neither side has a period, the one whose p spans more). Alternating specs: the side-wise maximum (the
 * moving side rises, the other stays near its rest), since the two sides' sum is not a progress. Used as an input of
 * the learned phase counter (learned-phase/data.js progressOnGrid). Bench only; experimental.
 * @param {{ wl: any[], ts: number[], image?: Array<number[]|null>|null }} set
 * @param {object|null} spec a motion spec (motions/<key>.json)
 * @returns {{ t0: number, p: Float64Array } | null}
 */
export function specProgress(set, spec, opts = {}) {
  const b = specSignals(set, spec, opts);
  if (b.reason || !b.rs.some(Boolean)) return null;
  let p;
  if (!b.oneSide) p = b.rs[0].p;
  else if (spec.alternate === true) {
    const [l, r] = b.rs;
    p = new Float64Array(b.G).fill(NaN);
    for (let t = 0; t < b.G; t++) {
      const a = l ? l.p[t] : NaN, c = r ? r.p[t] : NaN;
      p[t] = Number.isFinite(a) && Number.isFinite(c) ? Math.max(a, c) : Number.isFinite(a) ? a : c;
    }
  } else {
    const spread = x => { const v = Array.from(x).filter(Number.isFinite); return v.length ? quantile(v, 0.95) - quantile(v, 0.05) : -1; };
    const sides = b.rs.filter(Boolean).map(r => ({ r, c: countSignal(r.s, b.G) }));
    const best = sides.filter(x => x.c.count != null).sort((x, y) => (y.c.periodScore ?? -1) - (x.c.periodScore ?? -1))[0]
      ?? sides.sort((x, y) => spread(y.r.p) - spread(x.r.p))[0];
    p = best.r.p;
  }
  if (!p.some(Number.isFinite)) return null;
  return { t0: b.grid[0], p: Float64Array.from(p) };
}
