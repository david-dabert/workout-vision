// SYNTH_DIR=<folder of run.mjs output> npx vitest run test/real-phone/synth/analyse.test.ts
// The app's count, ranges, phase times and left/right gap on synthetic sets (synth.js), against their exact
// truth. Writes synth.txt beside this file. Reads only the rendered sets' landmarks; changes no parameter.
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps, liftDefinition } from '../../../src/lib/counting/core';
import { compareSides, GAP_ERROR_POINTS } from '../../../src/lib/counting/symmetry';
import { timedReps } from '../../../src/components/experience/tempo';

const DIR = process.env.SYNTH_DIR;
const JOINT: Record<string, 'shoulder' | 'elbow' | 'knee'> = { lateral_raise: 'shoulder', bicep_curl: 'elbow', overhead_press: 'elbow', squat: 'knee' };
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f0 = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '-'), f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');

test.skipIf(!DIR)('synthetic sets against their truth', () => {
  const rows: any[] = [];
  for (const f of readdirSync(DIR!).filter(f => f.endsWith('.json.gz')).sort()) {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(DIR!, f))).toString());
    const p = r.params, lift = p.exercise, j = JOINT[lift], def = liftDefinition(lift)!;
    const ts: number[] = r.timestamps;
    const c = countReps(r.worldLandmarks, ts, lift);
    // Truth per rep: each side's range over the rep (highest minus lowest angle), and its two phase times.
    // The phase leaving rest is the concentric one for a concentric-first lift, else the eccentric one.
    const truthReps = r.reps.map((tr: any) => {
      const idx = ts.map((t, i) => [t, i] as const).filter(([t]) => t >= tr.start && t <= tr.end).map(([, i]) => i);
      const rom = (side: 'left' | 'right') => { const a = idx.map((i: number) => r.truth[i][j][side]); return Math.max(...a) - Math.min(...a); };
      const out = tr.top - tr.start, back = tr.end - tr.hold;
      return { ...tr, romL: rom('left'), romR: rom('right'), conc: def.first === 'concentric' ? out : back, ecc: def.first === 'concentric' ? back : out };
    });
    // Each counted rep matched to the true rep containing its middle.
    const matched = c.reps.map(cr => { const m = (cr.startTime + cr.endTime) / 2; return { cr, tr: truthReps.find((t: any) => m >= t.start - 0.2 && m <= t.end + 0.2) }; }).filter(x => x.tr);
    const sideKey = c.arm === 'left' ? 'romL' : 'romR';
    const romErr = matched.map(x => x.cr.romDegrees - x.tr[sideKey]);
    const whole = matched.filter(x => !x.cr.clipped);
    const concErr = whole.map(x => x.cr.concentricSec - x.tr.conc), eccErr = whole.map(x => x.cr.eccentricSec - x.tr.ecc);
    // Relative phase-time errors (%) on the whole reps, and the time under tension as the report states it
    // (setMeasures: the timed reps' lengths) against the true reps' lengths, in % (printed, not gated).
    const concRel = whole.filter(x => x.tr.conc > 0).map(x => (x.cr.concentricSec - x.tr.conc) / x.tr.conc * 100);
    const eccRel = whole.filter(x => x.tr.ecc > 0).map(x => (x.cr.eccentricSec - x.tr.ecc) / x.tr.ecc * 100);
    const appTut = timedReps(c.reps).reduce((a: number, cr: any) => a + cr.endTime - cr.startTime, 0);
    const trueTut = truthReps.reduce((a: number, t: any) => a + t.end - t.start, 0);
    const L = med(truthReps.map((t: any) => t.romL)), R = med(truthReps.map((t: any) => t.romR));
    const trueSI = ((R - L) / ((L + R) / 2)) * 100;
    const s = compareSides(r.worldLandmarks, ts, lift, c.reps);
    rows.push({ id: f.replace('.json.gz', ''), model: p.model, lift, view: p.view, asym: Math.round(((p.peakR - p.peakL) / p.peakL) * 100), truth: r.reps.length, count: c.count,
      romErr: mean(romErr), concRel: mean(concRel), eccRel: mean(eccRel), tutRel: trueTut > 0 ? (appTut - trueTut) / trueTut * 100 : NaN, romRel: mean(matched.map(x => (x.cr.romDegrees - x.tr[sideKey]) / x.tr[sideKey] * 100)), concErr: mean(concErr), eccErr: mean(eccErr),
      seen: r.worldLandmarks.filter(Boolean).length / ts.length, status: s.status, trueSI, appSI: s.status === 'measured' ? s.comparison.si : NaN });
  }
  expect(rows.length).toBeGreaterThan(0);
  // The symmetry bound below is checked on at least one measured set, or it checks nothing (audit FINDING-021).
  expect(rows.filter(r => r.status === 'measured').length, 'sets whose left/right gap was measured').toBeGreaterThan(0);
  // The bound the screen states for the left/right gap (sides-line.js) must hold on these sets.
  for (const r of rows.filter(r => r.status === 'measured')) expect(Math.abs(r.appSI - r.trueSI)).toBeLessThanOrEqual(GAP_ERROR_POINTS);

  const out: string[] = [];
  out.push(`Synthetic sets (test/real-phone/synth): ${rows.length} sets, two rigged bodies (Michelle, Soldier; three.js examples, Mixamo rigs),`);
  out.push('rendered at the app analysis size (360x640, 15 fps), each frame through the app pose detection, counted by core.ts.');
  out.push('Truth from the skeleton joint positions with the counter three-point angles. Synthetic bodies are not people:');
  out.push('these figures bound what the pipeline can do in clean conditions; they do not replace real-phone sets.');
  out.push('');
  const summary = (name: string, xs: any[]) => {
    if (!xs.length) return;
    const exact = xs.filter(x => x.count === x.truth).length, cat = xs.filter(x => Math.abs(x.count - x.truth) >= 3).length;
    const re = xs.map(x => x.romErr).filter(Number.isFinite), rr = xs.map(x => x.romRel).filter(Number.isFinite);
    const ce = xs.map(x => x.concErr).filter(Number.isFinite), ee = xs.map(x => x.eccErr).filter(Number.isFinite);
    out.push(`${name.padEnd(22)} n ${String(xs.length).padStart(3)}  count exact ${String(exact).padStart(3)} (${f0(100 * exact / xs.length)} %), off >= 3: ${cat}  range error mean ${f0(mean(re))} deg (${f0(mean(rr))} %)  conc. ${f1(mean(ce))} s  ecc. ${f1(mean(ee))} s`);
  };
  summary('all', rows);
  for (const l of Object.keys(JOINT)) summary(l, rows.filter(r => r.lift === l));
  for (const v of [0, 30, 60, 90]) summary(`view ${v} deg`, rows.filter(r => r.view === v));
  for (const m of ['michelle', 'soldier']) summary(m, rows.filter(r => r.model === m));
  // Each lift at the view its filming guide asks for (lift-poses.json: lateral raise and press from the
  // front, curl and squat from the side): the fair test of the count.
  const REC: Record<string, number> = { lateral_raise: 0, overhead_press: 0, bicep_curl: 90, squat: 90 };
  out.push('');
  out.push('At the view the filming guide asks for:');
  for (const l of Object.keys(JOINT)) summary(`${l} (${REC[l] ? 'side' : 'front'})`, rows.filter(r => r.lift === l && r.view === REC[l]));
  summary('all, guided view', rows.filter(r => r.view === REC[r.lift]));
  out.push('');
  // Printed, not gated (audit of 6 October, action 9): the measure errors per view, relative to the truth.
  // Phase times: mean signed relative error of the whole reps' concentric and eccentric times; time under tension:
  // the report's figure (timed reps only) against the true reps' total length, a missed or extra rep included.
  out.push('Measure errors per view (printed, not gated): phase time relative error, time under tension error, range error.');
  for (const v of [0, 30, 60, 90]) {
    const xs = rows.filter(r => r.view === v);
    const pick = (k: string) => xs.map(r => r[k]).filter(Number.isFinite);
    out.push(`view ${String(v).padStart(2)} deg: conc. ${f0(mean(pick('concRel')))} %  ecc. ${f0(mean(pick('eccRel')))} %  time under tension ${f0(mean(pick('tutRel')))} % (mean absolute ${f0(mean(pick('tutRel').map(Math.abs)))} %)  range ${f0(mean(pick('romRel')))} %`);
  }
  out.push('');
  out.push('Left/right comparison (symmetry.ts): which views the gate measures, and the gap error where it does.');
  for (const v of [0, 30, 60, 90]) {
    const xs = rows.filter(r => r.view === v), m = xs.filter(r => r.status === 'measured');
    const err = m.map(r => r.appSI - r.trueSI);
    const signOk = m.filter(r => Math.abs(r.trueSI) >= 10).filter(r => Math.sign(r.appSI) === Math.sign(r.trueSI)).length, signN = m.filter(r => Math.abs(r.trueSI) >= 10).length;
    out.push(`view ${String(v).padStart(2)} deg: measured ${m.length} of ${xs.length}${m.length ? `; gap error mean ${f1(mean(err))} points, mean absolute ${f1(mean(err.map(Math.abs)))}; side right in ${signOk} of ${signN} sets with a true gap of 10 % or more` : ''}; refused: ${[...new Set(xs.filter(r => r.status !== 'measured').map(r => r.status))].join(', ') || 'none'}`);
  }
  out.push('');
  out.push('Each set: id, true reps, app count, range error (deg), conc./ecc. error (s), pose found share, left/right status, true gap, app gap.');
  for (const r of rows) out.push(`  ${r.id.padEnd(40)} ${String(r.truth).padStart(2)} ${String(r.count).padStart(2)}  ${f0(r.romErr).padStart(4)}  ${f1(r.concErr).padStart(5)} ${f1(r.eccErr).padStart(5)}  ${(r.seen * 100).toFixed(0).padStart(3)} %  ${r.status.padEnd(14)} ${f0(r.trueSI).padStart(4)} ${f0(r.appSI).padStart(4)}`);
  // A gate, not only a report (audit FINDING-021): against the committed synth.txt, on the same sets, the count
  // may not lose an exact set or gain a set off by 3 or more, and the mean range and phase errors may not grow
  // (by more than 1° and 0.05 s, the rounding of the file). The file is rewritten only when the run passes.
  const file = resolve(__dirname, 'synth.txt');
  const read = (txt: string, name: string) => {
    const m = txt.split('\n').find(l => l.startsWith(name.padEnd(22)))?.match(/n\s+(\d+)\s+count exact\s+(\d+).*off >= 3: (\d+)\s+range error mean (-?\d+) deg.*conc\. (-?[\d.]+) s\s+ecc\. (-?[\d.]+) s/);
    return m ? { n: +m[1], exact: +m[2], cat: +m[3], rom: Math.abs(+m[4]), conc: Math.abs(+m[5]), ecc: Math.abs(+m[6]) } : null;
  };
  // In CI, the base branch's synth.txt (SYNTH_BASE): a change cannot lower the bar by editing it (audit of 3 October).
  const from = process.env.SYNTH_BASE || file;
  const before = existsSync(from) ? readFileSync(from, 'utf8') : '', now = out.join('\n');
  for (const name of ['all', 'all, guided view']) {
    const b = read(before, name), a = read(now, name);
    // A changed number of sets is named, never passed over in silence: in CI it fails, so adding or removing a
    // set is a decision taken on its own (audit of 3 October).
    if (process.env.SYNTH_BASE) expect(a && b && a.n, `${name}: number of sets against the base branch`).toBe(b?.n);
    if (!b || !a || b.n !== a.n) continue;
    expect(a.exact, `${name}: exact counts`).toBeGreaterThanOrEqual(b.exact);
    expect(a.cat, `${name}: sets off by 3 or more`).toBeLessThanOrEqual(b.cat);
    expect(a.rom, `${name}: mean range error (deg)`).toBeLessThanOrEqual(b.rom + 1);
    expect(a.conc, `${name}: mean concentric error (s)`).toBeLessThanOrEqual(b.conc + 0.05);
    expect(a.ecc, `${name}: mean eccentric error (s)`).toBeLessThanOrEqual(b.ecc + 0.05);
  }
  writeFileSync(file, now + '\n');
}, 600_000);
