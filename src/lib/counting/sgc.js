/**
 * Spec-guided signals (SGC) for the app: the part of the bench's spec-guided counter (test/real-phone/template/sgc.js,
 * 8 October 2026) that the body check (bodyCheck.js) and its second candidate need, moved here on 8 October so the
 * app and the bench run the same code; the bench imports these from here. The exercise's motion spec
 * (test/real-phone/synth/motions/<key>.json) is read through fk.js on the bench only: its signal profile (which of
 * PSC's signals the rep should move, which way and how much) is generated once by scripts/make-spec-profiles.mjs into
 * spec-profiles.json, which the app reads (bodyCheck.js, signalProfile), so the app never poses a skeleton. This file
 * imports no JSON, so the bench and the generator can load it in plain Node.
 *
 * In the app since 8 October only as a second candidate on the low-confidence screen when the body check flags a
 * counted set (coreAnalysis.js, withBodyCheck): a number to confirm, never a silent count, never a grade (R8). Not a
 * counter: as a counter it loses 15 exact sets of 1,000 and makes two of David's sets catastrophic (TRIED.md,
 * "Spec-guided counting", 8 October).
 *
 * Every constant: Source UNSOURCED (the bench's values, set before its first run); Status experimental (R9).
 */
import { signalBank, rawSignals, lagProfile, pickPeriod, localPeriod, activeSegment, corrAt, FS } from './psc.js';

/** Noise scale of a world signal, by kind: angles in degrees, positions and distances in torso lengths. UNSOURCED, experimental. */
export const NOISE = name => (/^(elbow|shoulder|hip|knee|ankle)[LR]$|^trunk$/.test(name) ? 4 : 0.04);
export const MIN_STRENGTH = 3; // expected change of at least 3 noise units. UNSOURCED, experimental.
export const SHARE = 0.35; // and at least 35 % of the strongest expected change. UNSOURCED, experimental.
export const IMAGE_AGREE = 0.5; // an image twin joins when it correlates at 0.5 or more with its world signal. UNSOURCED, experimental.
export const W_CAP = 25; // a single signal's weight is capped at 25 noise units. UNSOURCED, experimental.

/** A signal's name for the other side (elbowL <-> elbowR); a name with no side is unchanged. */
export const swapName = n => n.replace(/L$/, '#').replace(/R$/, 'L').replace(/#$/, 'R');

/**
 * The rep's signal on the bank's grid from a profile: { s, p, members } or null. s: the members' z-scores combined
 * (PSC's scale). p: progress through the spec's rep, in physical units: each member's change in its own noise units
 * (its robust scale on the set, given in scales), over the spec's expected change, so a full rep of the spec moves p
 * by about 1 whatever the set's own amplitude (a set with no rep keeps p small).
 * profile: [{ name, delta, strength }], strongest first (only the sign of delta is read).
 * opts.anglesOnly: angle signals and the trunk only. opts.noImage: no image-plane twins.
 */
export function repSignal(sigs, profile, scales, opts = {}) {
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
export function signalScales(wl, image, useImage) {
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
// PSC's cycle-count constants (psc.js), as the bench set them. UNSOURCED, experimental.
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
export function countSignal(s, G) {
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
// concentric, bench_press eccentric). No core code changes.
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
/**
 * The core's rep logic on a rep signal: { count, reps, refused, reason }. summarize is coreAnalysis.js summarizeCount
 * (passed in: this module is imported by coreAnalysis.js). reps: the core's reps, in the set's seconds (the grid's).
 */
export function coreOnSignal(s, grid, first, summarize, physical = false) {
  const fin = Array.from(s).filter(Number.isFinite).sort((a, b) => a - b);
  if (fin.length < 10) return { count: null, reps: [], reason: 'too few samples' };
  // physical: s is progress (a full rep of the spec moves it by 1), so 1 maps to 120 degrees from its 5th percentile;
  // otherwise the set's own 5-95 % band maps to 120 degrees.
  const lo = fin[Math.floor(0.05 * (fin.length - 1))], hi = physical ? lo + 1 : fin[Math.floor(0.95 * (fin.length - 1))];
  const r = summarize(carrierLandmarks(s, lo, hi), grid, CARRIER[first] ?? CARRIER.concentric);
  return { count: r.refused ? null : r.count, reps: r.refused ? [] : r.reps, refused: !!r.refused, reason: r.refused ? 'core refused the signal' : undefined };
}

/** A one-limb profile's signals for the side given: the left as stored, the right their mirror. */
export const sideSignals = (signals, side) => (side === 'right' ? signals.map(p => ({ ...p, name: swapName(p.name) })) : signals);

/**
 * The spec-guided count of a set (the bench's sgcCount with physical progress and the core's rep logic, its
 * coreCount) from the exercise's stored profile: { count, reps } or null when none of the profile's signals is seen,
 * the set is too short, or the core refuses the signal. A one-limb exercise is read on each side and the more
 * periodic side kept, as the bench does. bank: PSC's signal bank of the set when already built (signalBank).
 * @param {{ wl: any[], ts: number[], image?: Array<number[]|null>|null }} set
 * @param {{ mode: string, first: string, signals: Array<{ name: string, delta: number, strength: number }> }} profile
 * @param {(wl: any[], ts: number[], lift: string) => any} summarize coreAnalysis.js summarizeCount
 */
export function specGuidedCount({ wl, ts, image = null }, profile, summarize, bank = null) {
  if (!profile || !ts || ts.length < 10) return null;
  const { grid, sigs } = bank ?? signalBank(wl, ts, image, { useImage: true });
  if (!sigs.length) return null;
  const G = grid.length, scales = signalScales(wl, image, true);
  let r;
  if (profile.mode === 'side') {
    // Each side's own signals; the side whose rep signal is more periodic (countSignal's period score), among the
    // sides with a period.
    const sides = ['left', 'right'].map(side => repSignal(sigs, sideSignals(profile.signals, side), scales))
      .filter(Boolean).map(x => ({ x, c: countSignal(x.s, G) })).filter(o => o.c.count != null);
    sides.sort((p, q) => (q.c.periodScore ?? -1) - (p.c.periodScore ?? -1));
    r = sides[0]?.x ?? null;
  } else r = repSignal(sigs, profile.signals, scales);
  if (!r) return null;
  const c = coreOnSignal(r.p, grid, profile.first, summarize, true);
  return Number.isInteger(c.count) ? { count: c.count, reps: c.reps } : null;
}
