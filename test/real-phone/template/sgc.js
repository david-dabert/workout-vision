// Spec-guided counting (SGC; 8 October 2026, bench only). PSC (src/lib/counting/psc.js)
// finds the signals that carry a rep by their periodicity alone, and guesses the rest side; the core counts one joint.
// SGC asks the exercise instead: its motion spec (test/real-phone/synth/motions/<key>.json, posed by hand for every
// catalogue exercise) is turned into a skeleton at rest and at the working end (fk.js), PSC's world signals are read on
// both, and the signals the rep should move, with their direction and expected size, form the rep's signal: every such
// signal, z-scored on the set (PSC's conditioning), signed so it rises from rest, weighted by its expected change over
// its noise. Their image-plane twins join when they agree with the world signal. The rest side is known (low, by
// construction). The period, the active segment and the cycles are PSC's (lagProfile, localPeriod, activeSegment, and
// its cycle count with the rest side given). One-limb exercises are counted on each side, the more active kept;
// alternating ones on each side, added; "mirror" ones (lunges) on the signals both sides move the same way.
// Since 8 October the app reads the part it needs from src/lib/counting/sgc.js (the rep signal, the scales, the cycle
// count, the core on the signal), which this file imports, so the bench and the app run the same code; the profiles the
// app reads are this file's specProfile, written once by scripts/make-spec-profiles.mjs (src/lib/counting/
// spec-profiles.json). What stays here needs fk.js (the spec posed as a skeleton) and the bench's variants.
// Every constant: UNSOURCED, experimental.
import { signalBank, rawSignals } from '../../../src/lib/counting/psc.js';
import { NOISE, MIN_STRENGTH, SHARE, IMAGE_AGREE, W_CAP, swapName, repSignal, signalScales, countRising, countSignal, coreOnSignal } from '../../../src/lib/counting/sgc.js';
import { specLandmarks } from './fk.js';

export { MIN_STRENGTH, SHARE, IMAGE_AGREE, W_CAP, countRising, coreOnSignal };

/** Signals whose meaning depends on the camera's side (left-right positions): left out of the spec's expectation. */
const VIEW_DEPENDENT = name => /X[LR]$|^noseX$/.test(name);

const worldValues = lm => {
  const out = new Map();
  for (const r of rawSignals([lm], null, { useImage: false })) out.set(r.name.slice(2), r.values[0]);
  return out;
};

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
