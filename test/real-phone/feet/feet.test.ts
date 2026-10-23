// FEET_OUT=<dir> npx vitest run --no-cache test/real-phone/feet/feet.test.ts
// The foot solver (solver.js) measured (bench only; the app imports none of it; measured, decides nothing). Writes
// <dir>/feet.txt, <dir>/rows.json (every set's figures) and, for compare-variants, <dir>/base.json, pin.json, pinFixed.json.
// What is measured, and against what (R16: a named reference; none world-class exists on disk for feet, so every
// measure here stays experimental):
// 1. Contacts against physical facts that need no label: on the synthetic sets whose lower body never moves (the
//    renderer moves only the arms on curls, raises and presses, synth.js poseAt), both feet touch every frame; on
//    David's hanging sets (chin-up, hanging leg raise) they touch nothing.
// 2. Foot slide per sample on the planted samples: MediaPipe's hip-centred frame (raw), after the root is recovered,
//    after pinning.
// 3. Root drift on the synthetic static sets, whose true root does not move.
// 4. Knee-angle error against the synthetic truth (truth.knee, the renderer's own skeleton), raw against solved; and
//    the knee's movement per sample, raw against solved (how still a displayed skeleton's knees would be).
// 5. Counts on every suite of variant-eval, through compare-variants (R2, net rule).
// 6. A label-free honesty signal: on the sets the app shows as sure (sure.ts), the exact rate where the planted feet
//    disagree most with being planted (residual slide after the root) against where they agree.
// The synthetic squats are reported apart: their truth is not a planted foot (the legacy squat slides the ankle by
// about 1 to 9 cm and puts the toes below the floor, feet-understand critic, 23 October 2026).
import { test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { ROOT, benchSets, countInWindow, decides, labelledSets, publicSets, videoSets } from '../accuracy/sets';
import { sureRow } from '../accuracy/sure';
// @ts-expect-error: a JavaScript module without types
import { median as med, solveFeet } from './solver.js';
// @ts-expect-error: a JavaScript module without types
import { perturbSet } from '../stability/noise.mjs';

const OUT = process.env.FEET_OUT;
const MODES = ['root', 'pin', 'pinFixed'] as const;
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
/** A linear-interpolation quantile. */
const q = (xs: number[], p: number) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return NaN;
  const i = p * (s.length - 1), lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const mean = (xs: number[]) => { const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN; };
const S = { left: { hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 }, right: { hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 } } as const;
const v3 = (p: any) => [p.x, p.y, p.z];
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a: number[], b: number[], c: number[]) => {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const cos = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};
const footMid = (f: any, side: 'left' | 'right') => { const s = S[side]; const a = v3(f[s.heel]), b = v3(f[s.toe]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };
/** The frame size of a stored set: its `frame`, else the extraction size in its metadata. */
const frameOf = (d: any) => d.frame ?? (d.metadata?.extractedWidth && d.metadata?.extractedHeight ? { width: d.metadata.extractedWidth, height: d.metadata.extractedHeight } : null);

/** Median per-sample displacement (mm) of the point `at` over consecutive frames where `counted(t)` holds. */
function stepMm(frames: any[], at: (f: any) => number[], counted: (t: number) => boolean) {
  const d: number[] = [];
  for (let t = 1; t < frames.length; t++) if (frames[t] && frames[t - 1] && counted(t) && counted(t - 1)) d.push(1000 * dist(at(frames[t]), at(frames[t - 1])));
  return med(d);
}
const sides = ['left', 'right'] as const;
/** The median over both feet of the per-sample foot slide, on the samples `counted(t, side)` allows. */
const slide = (frames: any[], counted: (t: number, side: 'left' | 'right') => boolean) => med(sides.map(s => stepMm(frames, f => footMid(f, s), t => counted(t, s))));

type Measure = Record<string, any>;
function measure(wl: any[], ts: number[], image: any[] | null, frame: any, truth: any[] | null): Measure {
  const ms: Record<string, number> = {}, r: Record<string, any> = {};
  for (const mode of MODES) { const t0 = performance.now(); r[mode] = solveFeet(wl, ts, { image, frame, mode }); ms[mode] = performance.now() - t0; }
  const { root, pin, pinFixed } = r;
  const posed = wl.filter(Boolean).length;
  const share = (side: 'left' | 'right') => root.contact[side].filter(Boolean).length / Math.max(1, posed);
  const planted = (t: number, side: 'left' | 'right') => root.contact[side][t];
  const rootPts = root.root.filter(Boolean) as number[][];
  const span = (pts: number[][]) => Math.hypot(...[0, 1, 2].map(k => 1000 * (q(pts.map(p => p[k]), 0.95) - q(pts.map(p => p[k]), 0.05))));
  // The mean of both feet under the hips (raw), the spread the root inherits.
  const feetMean = wl.filter(Boolean).map(f => { const a = footMid(f, 'left'), b = footMid(f, 'right'); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; });
  const kneeErr = (frames: any[]) => {
    if (!truth) return NaN;
    const e: number[] = [];
    frames.forEach((f, t) => { if (!f || !truth[t]?.knee) return; for (const side of sides) { const s = S[side]; e.push(Math.abs(angle(v3(f[s.hip]), v3(f[s.knee]), v3(f[s.ankle])) - truth[t].knee[side])); } });
    return med(e);
  };
  const kneeStep = (frames: any[]) => med(sides.map(s => stepMm(frames, f => v3(f[S[s].knee]), t => !!frames[t])));
  const legCV = (frames: any[]) => {
    const cv = (xs: number[]) => { const m = mean(xs); return (100 * Math.sqrt(mean(xs.map(x => (x - m) ** 2)))) / m; };
    const out: number[] = [];
    for (const side of sides) { const s = S[side]; const fs = frames.filter(Boolean); if (fs.length) out.push(cv(fs.map(f => dist(v3(f[s.hip]), v3(f[s.knee])))), cv(fs.map(f => dist(v3(f[s.knee]), v3(f[s.ankle]))))); }
    return med(out);
  };
  const below = (frames: any[], floor: number | null) => (floor == null ? NaN : frames.filter(f => f && [29, 30, 31, 32].some(i => f[i].y > floor + 0.01)).length / Math.max(1, posed));
  return {
    contactL: share('left'), contactR: share('right'), usedImage: root.usedImage,
    msRoot: ms.root, msPin: ms.pin, msPinFixed: ms.pinFixed,
    rawAll: slide(wl, t => !!wl[t]), rawPlanted: slide(wl, planted),
    rootSlide: slide(root.global, planted), pinSlide: slide(pin.global, planted), pinFixedSlide: slide(pinFixed.global, planted),
    rootSpan: rootPts.length ? span(rootPts) : NaN, feetSpan: feetMean.length ? span(feetMean) : NaN,
    kneeRaw: kneeErr(wl), kneePin: kneeErr(pin.world), kneePinFixed: kneeErr(pinFixed.world),
    kneeStepRaw: kneeStep(wl), kneeStepPin: kneeStep(pin.global), kneeStepPinFixed: kneeStep(pinFixed.global), kneeStepRootGlobal: kneeStep(root.global),
    legCVRaw: legCV(wl), legCVPin: legCV(pin.world), legCVPinFixed: legCV(pinFixed.world),
    belowRoot: below(root.global, root.floor), belowPinFixed: below(pinFixed.global, pinFixed.floor),
    unreachedPin: pin.pinned ? pin.unreached / pin.pinned : 0, unreachedPinFixed: pinFixed.pinned ? pinFixed.unreached / pinFixed.pinned : 0,
    pinWorld: pin.world, pinFixedWorld: pinFixed.world,
  };
}

test.skipIf(!OUT)('the foot solver: contacts, slide, root, knee truth, counts and the honesty signal', () => {
  mkdirSync(OUT!, { recursive: true });
  const rows: { name: string; suite: string; group: string; lift: string; label: number | null; m: Measure }[] = [];
  const counts: Record<string, Record<string, any>> = { base: {}, pin: {}, pinFixed: {} };
  const sure: { name: string; suite: string; lift: string; err: number; score: number; raw: number; proxyMoves: number }[] = [];
  const gate: { name: string; withImage: number; heightOnly: number }[] = [];
  // The noise proxy's moves of the core's scored count (flag.test.ts), so the two signals can be compared on one set.
  const proxyMoves = (wl: any[], ts: number[], lift: string, shown: number, window?: [number, number]) => {
    let k = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const p = perturbSet({ worldLandmarks: wl, timestamps: ts, imageLandmarks: null }, { seed });
      const r: any = summarizeCount(p.worldLandmarks, p.timestamps, lift);
      const c = r.refused ? null : window ? countInWindow(r.reps ?? [], window) : r.count;
      if (c !== shown) k++;
    }
    return k;
  };
  const count = (wl: any[], ts: number[], lift: string, window?: [number, number]) => {
    const r: any = summarizeCount(wl, ts, lift);
    return r.refused ? 'refused' : window ? countInWindow(r.reps ?? [], window) : r.count;
  };
  const take = (name: string, suite: string, group: string, lift: string, label: number | null, wl: any[], ts: number[], o: { image?: any[] | null; frame?: any; truth?: any[] | null; window?: [number, number]; sureResult?: () => any } = {}) => {
    const m = measure(wl, ts, o.image ?? null, o.frame ?? null, o.truth ?? null);
    if (label != null && liftDefinition(lift)) {
      counts.base[name] = { suite, lift, label, count: count(wl, ts, lift, o.window) };
      counts.pin[name] = { suite, lift, label, count: count(m.pinWorld, ts, lift, o.window) };
      counts.pinFixed[name] = { suite, lift, label, count: count(m.pinFixedWorld, ts, lift, o.window) };
      if (o.sureResult && decides(lift)) {
        const countOf = o.window ? (x: any) => countInWindow(x.reps ?? [], o.window) : (x: any) => x.count;
        const res = o.sureResult(), s = sureRow(res, lift, label, countOf);
        // A set with no planted sample has no residual slide: its feet do not agree with being planted (score +Infinity).
        if (s.err !== null && !s.flagged && !s.moved) sure.push({ name, suite, lift, err: s.err, score: Number.isFinite(m.rootSlide) ? m.rootSlide : Infinity, raw: m.rawAll, proxyMoves: proxyMoves(wl, ts, lift, countOf(res), o.window) });
      }
    }
    if (group === 'David floor' && o.image && o.frame) {
      const share = (r: any) => mean(sides.map(s => r.contact[s].filter(Boolean).length / Math.max(1, wl.filter(Boolean).length)));
      gate.push({ name, withImage: share(solveFeet(wl, ts, { image: o.image, frame: o.frame, mode: 'root' })), heightOnly: share(solveFeet(wl, ts, { mode: 'root' })) });
    }
    delete m.pinWorld; delete m.pinFixedWorld;
    rows.push({ name, suite, group, lift, label, m });
  };
  const appPath = (lift: string, wl: any[], ts: number[], il: any[] | null) => {
    const c: any = summarizeCount(wl, ts, lift);
    return withBodyCheck(withProposal({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, lift), lift);
  };
  // Synthetic: the static lower body (truth: feet planted, root still) and the squats (reported apart).
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets'], ['far', '../far-camera/sets'], ['far', '../far-camera/sets-backward']] as const) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = r.params?.lift ?? r.params?.exercise;
      const group = lift === 'squat' ? 'synthetic squat (flawed foot truth)' : 'synthetic static legs';
      take(`${dir.split('/').pop()}/${f}`, suite, group, lift, suite === 'far' ? null : r.reps.length, r.worldLandmarks, r.timestamps, { truth: r.truth });
    }
  }
  // David's stored sets and videos, with their image landmarks and frame size.
  const hanging = (n: string) => /chin_up|hanging/.test(n);
  const sled = (n: string) => /leg_press|pendulum|hack_squat/.test(n);
  const groupOf = (n: string) => (hanging(n) ? 'David hanging' : sled(n) ? 'David sled or platform' : 'David floor');
  for (const s of labelledSets().sets) {
    const d = gz(resolve(ROOT, s.name)), il = d.imageLandmarks ?? null;
    take(s.name, 'david', groupOf(s.name), s.lift, s.label, s.wl, s.ts, { image: il, frame: frameOf(d), sureResult: () => appPath(s.lift, s.wl, s.ts, il) });
  }
  for (const s of videoSets().sets as any[]) {
    if (s.appRefused) continue;
    const d = gz(resolve(ROOT, s.name));
    take(s.name, 'video', groupOf(s.name), s.lift, s.label, s.wl, s.ts, { image: s.il ?? null, frame: frameOf(d), sureResult: () => appPath(s.lift, s.wl, s.ts, s.il ?? null) });
  }
  // Public sets: world landmarks only. RepCount-A stores 2D points (imageXY) but no frame size, so its image gate is
  // not used (the speed in torso lengths needs the frame's aspect).
  for (const s of publicSets('build').sets) take(s.name, half(s.name), 'public', s.lift, s.label, s.wl, s.ts, { window: s.window, sureResult: () => { const r: any = summarizeCount(s.wl, s.ts, s.lift); return withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null }, s.lift); } });
  for (const s of benchSets('repcount', 'build').sets) if (s.lift && liftDefinition(s.lift)) take(s.name, 'repcount', 'RepCount-A', s.lift, s.label, s.wl, s.ts, { sureResult: () => { const r: any = summarizeCount(s.wl, s.ts, s.lift!); return withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null, imageXY: s.image ?? null }, s.lift!); } });

  for (const k of Object.keys(counts)) writeFileSync(resolve(OUT!, `${k}.json`), JSON.stringify({ sets: counts[k] }) + '\n');
  writeFileSync(resolve(OUT!, 'rows.json'), JSON.stringify({ rows: rows.map(r => ({ name: r.name, suite: r.suite, group: r.group, lift: r.lift, label: r.label, ...r.m })), sure, gate }) + '\n');
  const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toString() : '-'), pc = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)} %` : '-');
  const groups = [...new Set(rows.map(r => r.group))];
  const lines = [
    `Foot solver, ${new Date().toISOString().slice(0, 10)} (solver.js; feet.test.ts; measured, decides nothing). Each cell is the median over the group's sets of a per-set figure.`,
    'contact: share of a set\'s posed samples each foot is planted (left/right). slide: mm per sample of a planted foot\'s midpoint (heel and',
    'toe), on the planted samples: raw = MediaPipe\'s hip-centred frame, root = after the root is recovered, pin = after pinning (pinFixed).',
    'root span: p95-p5 of the recovered root (mm); feet span: the same of the raw mean of both feet under the hips. knee err: degrees from',
    'the synthetic truth, raw / pin / pinFixed. knee step: mm per sample of the knee in the global frame, unpinned (the raw landmarks placed',
    'by the same root) / pin / pinFixed. leg CV:',
    'thigh and shin length spread (%), raw / pinFixed. below floor: share of samples with a foot point over 1 cm below the floor, root',
    'only / pinFixed. unreached: share of IK solves whose goal was not met, pin / pinFixed.',
    '',
    'group                                 sets  contact L/R   slide raw/root/pin  root/feet span  knee err raw/pin/fixed  knee step raw/pin/fixed  leg CV raw/fixed  below floor  unreached',
  ];
  for (const g of groups) {
    const rs = rows.filter(r => r.group === g), m = (k: string) => med(rs.map(r => r.m[k]));
    lines.push(`${g.padEnd(37)} ${String(rs.length).padStart(4)}  ${pc(m('contactL')).padStart(5)}/${pc(m('contactR')).padEnd(5)}  ${f0(m('rawPlanted')).padStart(5)}/${f0(m('rootSlide')).padStart(3)}/${f0(m('pinFixedSlide')).padEnd(3)}      ${f0(m('rootSpan')).padStart(5)}/${f0(m('feetSpan')).padEnd(5)}      ${f1(m('kneeRaw')).padStart(5)}/${f1(m('kneePin'))}/${f1(m('kneePinFixed')).padEnd(5)}          ${f0(m('kneeStepRootGlobal')).padStart(3)}/${f0(m('kneeStepPin'))}/${f0(m('kneeStepPinFixed')).padEnd(3)}           ${f1(m('legCVRaw')).padStart(5)}/${f1(m('legCVPinFixed')).padEnd(5)}     ${pc(m('belowRoot'))}/${pc(m('belowPinFixed')).padEnd(4)}   ${pc(m('unreachedPin'))}/${pc(m('unreachedPinFixed'))}`);
  }
  // Tails the medians hide.
  const st = rows.filter(r => r.group === 'synthetic static legs');
  lines.push('', 'Tails:');
  lines.push(`   synthetic static legs: both feet planted on every sample in ${st.filter(r => r.m.contactL === 1 && r.m.contactR === 1).length} of ${st.length} sets; mean contact ${pc(mean(st.map(r => (r.m.contactL + r.m.contactR) / 2)))}; lowest ${pc(Math.min(...st.map(r => Math.min(r.m.contactL, r.m.contactR))))} (${st.reduce((a, r) => (Math.min(r.m.contactL, r.m.contactR) < Math.min(a.m.contactL, a.m.contactR) ? r : a)).name}).`);
  const withPlant = rows.filter(r => Number.isFinite(r.m.pinFixedSlide));
  lines.push(`   pinned (pinFixed) slide over 1 mm per sample: ${withPlant.filter(r => r.m.pinFixedSlide > 1).length} of ${withPlant.length} sets with a planted sample; largest ${f0(Math.max(...withPlant.map(r => r.m.pinFixedSlide)))} mm.`);
  lines.push(`   a foot below the floor after pinning (pinFixed) on some sample: ${rows.filter(r => r.m.belowPinFixed > 0).length} of ${rows.filter(r => Number.isFinite(r.m.belowPinFixed)).length} sets; largest share ${pc(Math.max(...rows.filter(r => Number.isFinite(r.m.belowPinFixed)).map(r => r.m.belowPinFixed)))}.`);
  for (const mode of ['msRoot', 'msPin', 'msPinFixed']) { const xs = rows.map(r => r.m[mode]); lines.push(`   solver time, ${mode.slice(2)} mode, this container's CPU: median ${f1(med(xs))} ms per set, p95 ${f1(q(xs, 0.95))}, largest ${f1(Math.max(...xs))} (${rows.length} sets).`); }
  lines.push(`   the image gate on David's floor sets with image landmarks and a frame size (${gate.length}): contact share (mean of both feet), median over sets, ${pc(med(gate.map(g => g.heightOnly)))} by the height test alone, ${pc(med(gate.map(g => g.withImage)))} with the image gate.`);
  lines.push('', 'David\'s sets one by one: contact L/R, slide raw/root/pin (pinFixed) mm, knee step unpinned/pinFixed mm (global).');
  for (const r of rows.filter(r => r.suite === 'david' || r.suite === 'video')) lines.push(`   ${r.group.padEnd(24)} ${r.name.split('/').slice(-1)[0].padEnd(48)} ${pc(r.m.contactL).padStart(5)}/${pc(r.m.contactR).padEnd(5)} ${f0(r.m.rawPlanted)}/${f0(r.m.rootSlide)}/${f0(r.m.pinFixedSlide)}  ${f0(r.m.kneeStepRootGlobal)}/${f0(r.m.kneeStepPinFixed)}${r.m.usedImage ? '' : '  (no image gate)'}`);
  // Honesty: the residual slide of the planted feet after the root (label-free) against the count's error, on the sets
  // the app shows as sure (sure.ts). Quartiles, within each lift, against the noise-proxy flag, and one absolute
  // threshold chosen on half A (the most exact kept while asking on at most a fifth of half A's sure sets), judged on
  // half B and read on David's sets and RepCount-A.
  type SureSet = (typeof sure)[number];
  const part = (ys: SureSet[]) => { const ex = ys.filter(y => y.err === 0).length; return `${ys.length} sets, ${ex} exact (${pc(ex / Math.max(1, ys.length))}), ${ys.filter(y => y.err >= 3).length} off by 3+`; };
  const pub = sure.filter(x => x.suite === 'publicA' || x.suite === 'publicB');
  lines.push('', `Honesty signal: the residual slide of the planted feet after the root (mm, label-free), on the sets shown as sure (sure.ts) that decide: ${pub.length} public, of which ${pub.filter(x => x.score === Infinity).length} with no planted sample (counted as feet that disagree).`);
  for (const key of ['score', 'raw'] as const) {
    const xs = [...pub].sort((a, b) => a[key] - b[key]), n = xs.length;
    for (let i = 0; i < 4; i++) { const g = xs.slice(Math.floor((i * n) / 4), Math.floor(((i + 1) * n) / 4)); lines.push(`   public, ${key === 'score' ? 'after the root' : 'raw, every sample (no solver)'} Q${i + 1} (${f0(g[0][key])}-${f0(g[g.length - 1][key])} mm): ${part(g)}`); }
  }
  const lifts = [...new Set(pub.map(x => x.lift))], lo: SureSet[] = [], hi: SureSet[] = [];
  for (const l of lifts) { const xs = pub.filter(x => x.lift === l); if (xs.length < 10) continue; const c = med(xs.map(x => x.score)); lo.push(...xs.filter(x => x.score <= c)); hi.push(...xs.filter(x => x.score > c)); }
  lines.push(`   public, split at each lift's own median (lifts with 10 sets or more): feet agree ${part(lo)}; disagree ${part(hi)}`);
  const cAll = med(pub.map(x => x.score));
  for (const [nm, f] of [['proxy still', (x: SureSet) => x.proxyMoves === 0], ['proxy moves', (x: SureSet) => x.proxyMoves > 0]] as const) {
    const xs = pub.filter(f); lines.push(`   public, ${nm}: feet agree (<= ${f0(cAll)} mm) ${part(xs.filter(x => x.score <= cAll))}; disagree ${part(xs.filter(x => x.score > cAll))}`);
  }
  const A = pub.filter(x => x.suite === 'publicA'), Bh = pub.filter(x => x.suite === 'publicB');
  let T = NaN, best = -1;
  for (let t = 20; t < 120; t += 2) { const kept = A.filter(x => x.score <= t); if (A.length - kept.length > 0.2 * A.length) continue; const r = kept.filter(x => x.err === 0).length / kept.length; if (r > best) { best = r; T = t; } }
  for (const [nm, H] of [['half A (chosen on)', A], ['half B (judged)', Bh], ['David stored+video', sure.filter(x => x.suite === 'david' || x.suite === 'video')], ['RepCount-A', sure.filter(x => x.suite === 'repcount')]] as const) {
    lines.push(`   T = ${T} mm, ${nm}: sure today ${part(H)}; kept ${part(H.filter(x => x.score <= T))}; asked ${part(H.filter(x => x.score > T))}`);
    lines.push(`      with the noise-proxy flag too: kept ${part(H.filter(x => x.score <= T && x.proxyMoves === 0))}; asked ${part(H.filter(x => !(x.score <= T && x.proxyMoves === 0)))}`);
    lines.push(`      the noise-proxy flag alone: kept ${part(H.filter(x => x.proxyMoves === 0))}; asked ${part(H.filter(x => x.proxyMoves > 0))}`);
  }
  writeFileSync(resolve(OUT!, 'feet.txt'), lines.join('\n') + '\n');
  process.stdout.write(lines.join('\n') + '\n');
}, 7_200_000);
