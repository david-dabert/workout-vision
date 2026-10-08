/**
 * The body check (8 October 2026): does the joint the core counts move as the rest of the body says it should?
 *
 * The core counts one catalogue joint (core.ts). On real videos that joint is sometimes misread while its visibility
 * stays high (a barbell plate over the knee, the ankle a pendulum squat's pose model invents, a forward fold), and a
 * wrong count, or a right one by luck, is then shown as measured (test/real-phone/accuracy/anatomy-8oct.md, critique
 * sections 2 and 4). The exercise's motion spec says which other signals a rep moves and which way (spec-profiles.json,
 * from fk.js through the bench's sgc.js specProfile). Those signals, on PSC's bank (psc.js signalBank: outliers out,
 * gaps bridged, 15 Hz, smoothed, robust z), are signed by the spec, weighted by their expected change (capped, W_CAP)
 * times the square of their agreement with the others (leave-one-out correlation, two passes; a member under R_MIN is
 * dropped), and combined per sample by a weighted median: the body's consensus, which leaves out the counted joint's
 * own angle on both sides. The agreement is the correlation of the core's smoothed angle of the counted joint (signed
 * so it rises from its rest) with that consensus over the set. Below AGREE_MIN the set is flagged: the screen shows its
 * count as one to confirm, with no grade (R8), and the spec-guided count beside it when it differs (coreAnalysis.js,
 * withBodyCheck). It changes no count, no refusal and no proposal.
 *
 * The critic's scratch run (sgcx/rsc.ts, threshold fixed before the run) flagged exactly the 7 misread or lucky sets of
 * David's 30 scorable sets, and on 464 real-world sets flagged 81 (17 %), the core exact on 28 % of the flagged against
 * 64 % of the others. This module follows it, with three choices of the app's own, fixed before the calibration
 * (test/real-phone/accuracy/body-check.txt): a one-limb exercise is checked on the side the core counted (rsc.ts read
 * the left side always), an alternating lift counted on both sides (bothSides, not together) is not checked (its
 * angle is one side's, its count both sides'; as for the PSC proposal), and a set with under MIN_OVERLAP samples
 * seen is not checked. On the 450 real-world sets both check, the flags are the critic's, set for set.
 */
import { signalBank, corrAt, FS } from './psc.js';
import { W_CAP, sideSignals } from './sgc.js';
import { liftDefinition } from './core';
import PROFILES from './spec-profiles.json';

/** Flagged below this agreement. Source: the critic's sgcx/rsc.ts (TAU, fixed before its first run, 8 October 2026;
 * anatomy-8oct.md). Status: experimental (calibrated after the fact on the official sets: body-check.txt). */
export const AGREE_MIN = 0.5;
/** A consensus member agreeing with the others under this is dropped. Source: sgcx/rsc.ts (R_MIN, fixed before its
 * first run). Status: experimental. */
export const R_MIN = 0.3;
/** Too little seen: fewer samples of the grid where both the counted joint and the consensus are seen. Two seconds.
 * Source: UNSOURCED (the app's own, fixed before the calibration). Status: experimental. */
export const MIN_OVERLAP = 2 * FS;

/**
 * An exercise's signal profile (spec-profiles.json): { mode, first, signals: [{ name, delta, strength }] } or null.
 * See sgc.js specGuidedCount and scripts/make-spec-profiles.mjs.
 */
export function signalProfile(lift) {
  const e = Object.hasOwn(PROFILES.profiles, lift) ? PROFILES.profiles[lift] : null;
  if (!e) return null;
  return { mode: e.mode, first: e.first, signals: e.signals.map(([name, delta, strength]) => ({ name, delta, strength })) };
}

/** The set's image landmarks as PSC reads them (flat [x0, y0, x1, y1, ...] per sample), as pscProposal flattens them. */
export function flatImage({ worldLandmarks = [], imageLandmarks = null, imageXY = null } = {}) {
  const fits = a => Array.isArray(a) && a.length === worldLandmarks.length && a.some(Boolean);
  return fits(imageXY) ? imageXY : fits(imageLandmarks) ? imageLandmarks.map(f => (f ? f.flatMap(p => [p.x, p.y]) : null)) : null;
}

const weightedMedian = (vals, ws) => {
  const o = vals.map((v, i) => [v, ws[i]]).sort((a, b) => a[0] - b[0]);
  const tot = ws.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (const [v, w] of o) { acc += w; if (acc >= tot / 2) return v; }
  return NaN;
};
const weightedMean = (zs, ws, G) => {
  const out = new Float64Array(G).fill(NaN);
  for (let t = 0; t < G; t++) {
    let a = 0, s = 0;
    for (let i = 0; i < zs.length; i++) { const v = zs[i][t]; if (v === v) { a += ws[i] * v; s += ws[i]; } }
    if (s > 0) out[t] = a / s;
  }
  return out;
};

/**
 * The body's consensus without the counted joint: { s, grid, members } or null when none of the profile's other
 * signals is seen. members: [{ name, r, weight }] kept, r its agreement with the others.
 */
export function bodyConsensus(bank, signals, joint) {
  const { grid, sigs } = bank;
  const byName = new Map(sigs.map(x => [x.name, x]));
  const mem = [];
  for (const p of signals) {
    if (p.name.replace(/[LR]$/, '') === joint) continue;
    for (const pre of ['w.', 'i.']) {
      const s = byName.get(pre + p.name);
      if (!s) continue;
      const sign = Math.sign(p.delta);
      mem.push({ name: pre + p.name, z: Float64Array.from(s.z, v => sign * v), w: Math.min(p.strength, W_CAP) });
    }
  }
  if (!mem.length) return null;
  const G = grid.length;
  // Agreement: each member's correlation with the strength-weighted mean of the others, the others weighted by their
  // own agreement squared from the pass before (two passes).
  let rel = mem.map(() => 1);
  for (let pass = 0; pass < 2; pass++) {
    const prev = rel;
    rel = mem.map((m, i) => {
      if (mem.length < 2) return 1;
      const zs = [], ws = [];
      for (let j = 0; j < mem.length; j++) if (j !== i) { zs.push(mem[j].z); ws.push(mem[j].w * Math.max(prev[j], 0) ** 2); }
      if (ws.every(x => x === 0)) return 0;
      return corrAt(m.z, weightedMean(zs, ws, G));
    });
  }
  const keep = mem.map((m, i) => ({ ...m, r: rel[i], ww: m.w * Math.max(rel[i], 0) ** 2 })).filter(m => mem.length < 2 || m.r >= R_MIN);
  if (!keep.length) return null;
  const s = new Float64Array(G).fill(NaN);
  for (let t = 0; t < G; t++) {
    const v = [], w = [];
    for (const m of keep) if (m.z[t] === m.z[t]) { v.push(m.z[t]); w.push(m.ww); }
    if (v.length) s[t] = weightedMedian(v, w);
  }
  return { s, grid, members: keep.map(m => ({ name: m.name, r: Math.round(m.r * 100) / 100, weight: Math.round(m.ww * 100) / 100 })) };
}

/**
 * The body check of a counted set: { agreement, flagged, signals } or null when the exercise has no profile (no
 * motion spec, no reps in it, or sides that alternate), is counted on both sides one after the other, the set was
 * refused, or too little is seen (no other signal of the profile, or under MIN_OVERLAP samples where both are seen).
 * agreement: the correlation (-1 to 1, 2 decimals) of the counted joint's angle with the body's consensus; flagged when
 * under AGREE_MIN. signals: the consensus's members, [{ name, r, weight }].
 * @param {{ worldLandmarks: any[], timestamps: number[], imageLandmarks?: any[]|null, imageXY?: any[]|null,
 *   smoothedAngles?: (number|null)[], arm?: string, refused?: boolean }} result summarizeCount's result with the set
 * @param {string} lift
 * @param {{ grid: number[], sigs: any[] } | null} [bank] PSC's signal bank of the set, when already built
 */
export function bodyCheck(result, lift, bank = null) {
  const def = liftDefinition(lift), profile = signalProfile(lift);
  if (!def || !profile || !result || result.refused) return null;
  if (def.bothSides && !def.together) return null;
  const { worldLandmarks: wl = [], timestamps: ts = [], smoothedAngles: ang } = result;
  if (!Array.isArray(ang) || ang.length !== ts.length || wl.length !== ts.length || ts.length < 10) return null;
  const b = bank ?? signalBank(wl, ts, flatImage(result), { useImage: true });
  if (!b.sigs.length) return null;
  const signals = profile.mode === 'side' ? sideSignals(profile.signals, result.arm === 'right' ? 'right' : 'left') : profile.signals;
  const cons = bodyConsensus(b, signals, def.joint);
  if (!cons) return null;
  // The core's smoothed angle at each grid time (the last sample at or before it, within 1.5 samples), signed to rise
  // from its rest.
  const g = cons.grid, a = new Float64Array(g.length).fill(NaN);
  let j = 0;
  for (let k = 0; k < g.length; k++) {
    while (j + 1 < ts.length && ts[j + 1] <= g[k]) j++;
    const v = ang[j];
    if (v != null && Math.abs(ts[j] - g[k]) < 1.5 / FS) a[k] = def.rest === 'high' ? -v : v;
  }
  let both = 0;
  for (let k = 0; k < g.length; k++) if (a[k] === a[k] && cons.s[k] === cons.s[k]) both++;
  if (both < MIN_OVERLAP) return null;
  const r = corrAt(a, cons.s);
  return { agreement: Math.round(r * 100) / 100, flagged: r < AGREE_MIN, signals: cons.members };
}
