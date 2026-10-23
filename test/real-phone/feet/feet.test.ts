// FEET_OUT=<dir> npx vitest run --no-cache test/real-phone/feet/feet.test.ts
// The foot solver (solver.js) measured (bench only; the app imports none of it; measured, decides nothing). Writes
// <dir>/feet.txt and, for compare-variants, <dir>/base.json, <dir>/pin.json, <dir>/pinFixed.json.
// What is measured, and against what (R16: a named reference; none world-class exists on disk for feet, so every
// measure here stays experimental):
// 1. Contacts against physical facts that need no label: on the synthetic sets whose lower body never moves (the
//    renderer moves only the arms on curls, raises and presses, synth.js poseAt), both feet touch every frame; on
//    David's hanging sets (chin-up, hanging leg raise) they touch nothing.
// 2. Foot slide per sample, in the hip-centred frame MediaPipe gives (raw), after the root is recovered, after pinning.
// 3. Root drift on the synthetic static sets, whose true root does not move.
// 4. Knee-angle error against the synthetic truth (truth.knee, the renderer's own skeleton), raw against solved.
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
import { solveFeet } from './solver.js';
// @ts-expect-error: a JavaScript module without types
import { perturbSet } from '../stability/noise.mjs';

const OUT = process.env.FEET_OUT;
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
const med = (xs: number[]) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const q = (xs: number[], p: number) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const S = { left: { hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 }, right: { hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 } } as const;
const v3 = (p: any) => [p.x, p.y, p.z];
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const angle = (a: number[], b: number[], c: number[]) => {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const cos = (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
};
const footMid = (f: any, side: 'left' | 'right') => { const s = S[side]; const a = v3(f[s.heel]), b = v3(f[s.toe]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; };

/** Median per-sample displacement (mm) of the feet over frames where `counted(t, side)` holds. */
function slide(frames: any[], counted: (t: number, side: 'left' | 'right') => boolean) {
  const d: number[] = [];
  for (let t = 1; t < frames.length; t++) {
    if (!frames[t] || !frames[t - 1]) continue;
    for (const side of ['left', 'right'] as const) if (counted(t, side) && counted(t - 1, side)) d.push(1000 * dist(footMid(frames[t], side), footMid(frames[t - 1], side)));
  }
  return med(d);
}

type Measure = Record<string, any>;
function measure(wl: any[], ts: number[], image: any[] | null, frame: any, truth: any[] | null): Measure {
  const t0 = performance.now();
  const root = solveFeet(wl, ts, { image, frame, mode: 'root' });
  const pin = solveFeet(wl, ts, { image, frame, mode: 'pin' });
  const pinFixed = solveFeet(wl, ts, { image, frame, mode: 'pinFixed' });
  const ms = (performance.now() - t0) / 3;
  const posed = wl.filter(Boolean).length;
  const share = (side: 'left' | 'right') => root.contact[side].filter(Boolean).length / Math.max(1, posed);
  const inContact = (t: number, side: 'left' | 'right') => root.contact[side][t];
  const all = (t: number) => !!wl[t];
  const rootPts = root.root.filter(Boolean) as number[][];
  const axis = (k: number) => (rootPts.length ? 1000 * (q(rootPts.map(r => r[k]), 0.95) - q(rootPts.map(r => r[k]), 0.05)) : NaN);
  const rootAxes = [axis(0), axis(1), axis(2)];
  const rootRange = Math.hypot(...rootAxes);
  const knee = (frames: any[]) => {
    if (!truth) return NaN;
    const e: number[] = [];
    frames.forEach((f, t) => { if (!f || !truth[t]?.knee) return; for (const side of ['left', 'right'] as const) { const s = S[side]; e.push(Math.abs(angle(v3(f[s.hip]), v3(f[s.knee]), v3(f[s.ankle])) - truth[t].knee[side])); } });
    return med(e);
  };
  const legCV = (frames: any[]) => {
    const cv = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return (100 * Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)) / m; };
    const r: number[] = [];
    for (const side of ['left', 'right'] as const) { const s = S[side]; const th = frames.filter(Boolean).map(f => dist(v3(f[s.hip]), v3(f[s.knee]))), sh = frames.filter(Boolean).map(f => dist(v3(f[s.knee]), v3(f[s.ankle]))); if (th.length) r.push(cv(th), cv(sh)); }
    return med(r);
  };
  const pen = (frames: any[], floor: number | null) => (floor == null ? NaN : frames.filter(f => f && [29, 30, 31, 32].some(i => f[i].y > floor + 0.01)).length / Math.max(1, posed));
  return {
    contactL: share('left'), contactR: share('right'), usedImage: root.usedImage, ms,
    rawSlide: slide(wl, t => all(t)),
    rootSlide: slide(root.global, inContact),
    pinSlide: slide(pin.global, inContact),
    rootRange, rootX: rootAxes[0], rootY: rootAxes[1], rootZ: rootAxes[2],
    kneeRaw: knee(wl), kneePin: knee(pin.world), kneePinFixed: knee(pinFixed.world),
    legCVRaw: legCV(wl), legCVPin: legCV(pin.world), legCVPinFixed: legCV(pinFixed.world),
    penRaw: pen(root.global, root.floor), penPin: pen(pin.global, pin.floor),
    unreached: pin.pinned ? pin.unreached / pin.pinned : 0,
    pinWorld: pin.world, pinFixedWorld: pinFixed.world,
  };
}

test.skipIf(!OUT)('the foot solver: contacts, slide, root, knee truth, counts and the honesty signal', () => {
  mkdirSync(OUT!, { recursive: true });
  const rows: { name: string; suite: string; group: string; lift: string; label: number | null; m: Measure }[] = [];
  const counts: Record<string, Record<string, any>> = { base: {}, pin: {}, pinFixed: {} };
  const sure: { name: string; suite: string; lift: string; err: number; score: number; raw: number; proxyMoves: number }[] = [];
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
        if (s.err !== null && !s.flagged && !s.moved && Number.isFinite(m.rootSlide)) sure.push({ name, suite, lift, err: s.err, score: m.rootSlide, raw: m.rawSlide, proxyMoves: proxyMoves(wl, ts, lift, countOf(res), o.window) });
      }
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
      take(`${dir.split('/').pop()}/${f}`, suite === 'far' ? 'far' : suite, group, lift, suite === 'far' ? null : r.reps.length, r.worldLandmarks, r.timestamps, { truth: r.truth });
    }
  }
  // David's stored sets and videos, with their image landmarks and frame size.
  const hanging = (n: string) => /chin_up|hanging/.test(n);
  const sled = (n: string) => /leg_press|pendulum|hack_squat/.test(n);
  for (const s of labelledSets().sets) {
    const d = gz(resolve(ROOT, s.name)), il = d.imageLandmarks ?? null;
    take(s.name, 'david', hanging(s.name) ? 'David hanging' : sled(s.name) ? 'David sled or platform' : 'David floor', s.lift, s.label, s.wl, s.ts, { image: il, frame: d.frame, sureResult: () => appPath(s.lift, s.wl, s.ts, il) });
  }
  for (const s of videoSets().sets as any[]) {
    if (s.appRefused) continue;
    const d = gz(resolve(ROOT, s.name));
    take(s.name, 'video', hanging(s.name) ? 'David hanging' : sled(s.name) ? 'David sled or platform' : 'David floor', s.lift, s.label, s.wl, s.ts, { image: s.il ?? null, frame: d.frame, sureResult: () => appPath(s.lift, s.wl, s.ts, s.il ?? null) });
  }
  // Public sets: world landmarks only.
  for (const s of publicSets('build').sets) take(s.name, half(s.name), 'public', s.lift, s.label, s.wl, s.ts, { window: s.window, sureResult: () => { const r: any = summarizeCount(s.wl, s.ts, s.lift); return withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null }, s.lift); } });
  for (const s of benchSets('repcount', 'build').sets) if (s.lift && liftDefinition(s.lift)) take(s.name, 'repcount', 'RepCount-A', s.lift, s.label, s.wl, s.ts, { sureResult: () => { const r: any = summarizeCount(s.wl, s.ts, s.lift!); return withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null, imageXY: s.image ?? null }, s.lift!); } });

  for (const k of Object.keys(counts)) writeFileSync(resolve(OUT!, `${k}.json`), JSON.stringify({ sets: counts[k] }) + '\n');
  writeFileSync(resolve(OUT!, 'rows.json'), JSON.stringify({ rows: rows.map(r => ({ name: r.name, suite: r.suite, group: r.group, lift: r.lift, label: r.label, ...r.m })), sure }) + '\n');
  const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toString() : '-'), pc = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)} %` : '-');
  const groups = [...new Set(rows.map(r => r.group))];
  const lines = [
    `Foot solver, ${new Date().toISOString().slice(0, 10)} (solver.js; feet.test.ts; measured, decides nothing). Medians over sets of per-set medians.`,
    'contact: share of posed samples each foot is planted. slide: mm per sample of the foot midpoint (heel and toe), raw = MediaPipe\'s hip-centred',
    'frame over all samples, root = after the root is recovered, pin = after pinning, both over planted samples. root range: p95-p5 of the',
    'recovered root (mm). knee err: degrees from the synthetic truth, raw / pin / pinFixed. leg CV: thigh and shin length spread (%), raw / pin /',
    'pinFixed. below floor: share of samples with a foot point over 1 cm below the floor, root only / pin. ms: solver time per mode per set.',
    '',
    'group                                 sets  contact L/R   slide raw/root/pin   root range  knee err raw/pin/fixed  leg CV raw/pin/fixed  below floor  unreached  ms',
  ];
  for (const g of groups) {
    const rs = rows.filter(r => r.group === g), m = (k: string) => med(rs.map(r => r.m[k]));
    lines.push(`${g.padEnd(37)} ${String(rs.length).padStart(4)}  ${pc(m('contactL')).padStart(5)}/${pc(m('contactR')).padEnd(5)}  ${f0(m('rawSlide')).padStart(5)}/${f0(m('rootSlide')).padStart(4)}/${f0(m('pinSlide')).padEnd(4)}       ${f0(m('rootRange')).padStart(5)}      ${f1(m('kneeRaw')).padStart(5)}/${f1(m('kneePin'))}/${f1(m('kneePinFixed')).padEnd(5)}        ${f1(m('legCVRaw')).padStart(5)}/${f1(m('legCVPin'))}/${f1(m('legCVPinFixed')).padEnd(5)}      ${pc(m('penRaw'))}/${pc(m('penPin'))}   ${pc(m('unreached')).padStart(5)}   ${f1(m('ms'))}`);
  }
  lines.push('', 'David\'s sets one by one (image landmarks used where stored): contact L/R, slide raw/root/pin mm.');
  for (const r of rows.filter(r => r.suite === 'david' || r.suite === 'video')) lines.push(`   ${r.group.padEnd(24)} ${r.name.split('/').slice(-1)[0].padEnd(48)} ${pc(r.m.contactL).padStart(5)}/${pc(r.m.contactR).padEnd(5)} ${f0(r.m.rawSlide)}/${f0(r.m.rootSlide)}/${f0(r.m.pinSlide)}${r.m.usedImage ? '' : '  (no image)'}`);
  // Honesty: the residual slide of the planted feet after the root (label-free) against the count's error, on the sets
  // the app shows as sure (sure.ts). Quartiles, within each lift, against the noise-proxy flag, and one absolute
  // threshold chosen on half A (the most exact kept while asking on at most a fifth of half A's sure sets), judged on
  // half B and read on David's sets and RepCount-A.
  type SureSet = (typeof sure)[number];
  const part = (ys: SureSet[]) => { const ex = ys.filter(y => y.err === 0).length; return `${ys.length} sets, ${ex} exact (${pc(ex / Math.max(1, ys.length))}), ${ys.filter(y => y.err >= 3).length} off by 3+`; };
  const pub = sure.filter(x => x.suite === 'publicA' || x.suite === 'publicB');
  lines.push('', 'Honesty signal: the residual slide of the planted feet after the root (mm, label-free), on the sets shown as sure (sure.ts) that decide.');
  for (const key of ['score', 'raw'] as const) {
    const xs = [...pub].sort((a, b) => a[key] - b[key]), n = xs.length;
    for (let i = 0; i < 4; i++) { const g = xs.slice(Math.floor((i * n) / 4), Math.floor(((i + 1) * n) / 4)); lines.push(`   public, ${key === 'score' ? 'after the root' : 'raw (no solver)'} Q${i + 1} (${f0(g[0][key])}-${f0(g[g.length - 1][key])} mm): ${part(g)}`); }
  }
  const lifts = [...new Set(pub.map(x => x.lift))], lo: SureSet[] = [], hi: SureSet[] = [];
  for (const l of lifts) { const xs = pub.filter(x => x.lift === l); if (xs.length < 10) continue; const c = med(xs.map(x => x.score)); lo.push(...xs.filter(x => x.score <= c)); hi.push(...xs.filter(x => x.score > c)); }
  lines.push(`   public, split within each lift of 10 sets or more: feet agree ${part(lo)}; disagree ${part(hi)}`);
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
