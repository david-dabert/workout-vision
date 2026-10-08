// BODY_CHECK=1 [BODY_CHECK_TXT=<file>] [BODY_CHECK_JSON=<file>] npx vitest run --no-cache test/real-phone/accuracy/body-check.test.ts
// The body check's calibration (src/lib/counting/bodyCheck.js, coreAnalysis.js withBodyCheck; 8 October 2026) on the
// official sets of variant-eval.test.ts: David's 20 stored sets and 13 real videos (a read the app refused stays
// refused), the public build half in its two fixed halves A and B, the RepCount-A build half on its classes with a
// counter, the 96 synthetic and the 68 occlusion sets. Never the held-out half. Each set goes through the app's own
// path: summarizeCount, then withBodyCheck on the result with the landmarks the file stores (the image ones too, as
// the app has them). Per suite: how many counted sets the check flags, the core's exact rate on flagged and unflagged
// sets, and on the flagged ones how often the second candidate (the spec-guided count) is offered and right. Its
// cost: milliseconds per minute of recording in Node for the check and for the second candidate (the latter timed on
// every checked set, though the app runs it on flagged sets only). Writes BODY_CHECK_TXT (default body-check.txt
// beside this file). Research tool: it changes nothing and gates nothing; the threshold was fixed before this run.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { BODY_CHECK_MAX_SAMPLES, summarizeCount, withBodyCheck } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { pscProposal, signalBank } from '../../../src/lib/counting/psc.js';
import { AGREE_MIN, bodyCheck, flatImage, signalProfile } from '../../../src/lib/counting/bodyCheck.js';
import { specGuidedCount } from '../../../src/lib/counting/sgc.js';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from './sets';

type Item = { suite: string; name: string; lift: string; label: number; set: any; window?: [number, number]; appRefused?: boolean };
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());

function load(): Item[] {
  const items: Item[] = [];
  for (const s of labelledSets().sets) items.push({ suite: 'david', name: s.name, lift: s.lift, label: s.label, set: gz(resolve(ROOT, s.name)) });
  for (const s of videoSets().sets) items.push({ suite: 'video', name: s.name, lift: s.lift, label: s.label, set: gz(resolve(ROOT, s.name)), appRefused: s.appRefused });
  const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
  for (const s of publicSets('build').sets) items.push({ suite: half(s.name), name: s.name, lift: s.lift, label: s.label, set: gz(resolve(ROOT, s.name)), window: s.window });
  for (const s of benchSets('repcount', 'build').sets) {
    if (!s.lift || !liftDefinition(s.lift)) continue;
    items.push({ suite: 'repcount', name: s.name, lift: s.lift, label: s.label, set: { worldLandmarks: s.wl, timestamps: s.ts, imageXY: s.image } });
  }
  for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']] as const) {
    const D = resolve(__dirname, dir);
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const r = gz(resolve(D, f)), lift = suite === 'synthetic' ? r.params?.exercise ?? r.lift : r.params.lift ?? r.params.exercise;
      items.push({ suite, name: `${suite === 'synthetic' ? 'synth' : suite}/${f}`, lift, label: r.reps.length, set: r });
    }
  }
  return items;
}

type Row = { suite: string; name: string; lift: string; label: number; core: number | 'refused'; whole: number | null; check: 'none' | 'null' | 'ok';
  agreement: number | null; flagged: boolean; second: number | null; secondWhole: number | null; minutes: number; msCheck: number | null; msSecond: number | null };

test.skipIf(!process.env.BODY_CHECK)('body check: calibration and cost on the official sets', () => {
  const rows: Row[] = [];
  for (const it of load()) {
    const wl = it.set.worldLandmarks, ts = it.set.timestamps;
    const c = summarizeCount(wl, ts, it.lift);
    const refused = !!c.refused || !!it.appRefused;
    const minutes = ts.length ? (ts[ts.length - 1] - ts[0] + 1 / 15) / 60 : 0;
    const base: Row = { suite: it.suite, name: it.name, lift: it.lift, label: it.label, core: refused ? 'refused' : (it.window ? countInWindow(c.reps, it.window) : c.count),
      whole: refused ? null : c.count, check: 'none', agreement: null, flagged: false, second: null, secondWhole: null, minutes, msCheck: null, msSecond: null };
    if (refused || !(c.count > 0)) { rows.push(base); continue; }
    // The app's path.
    const result: any = { ...c, exercise: it.lift, worldLandmarks: wl, timestamps: ts, imageLandmarks: it.set.imageLandmarks ?? null, imageXY: it.set.imageXY ?? null };
    const out = withBodyCheck(result, it.lift);
    // The check changes nothing of the result but adds its field.
    expect(out.count).toBe(c.count);
    expect(out.reps).toBe(c.reps);
    expect(out.refused).toBe(c.refused);
    const bc = out.bodyCheck;
    const row: Row = { ...base, check: signalProfile(it.lift) ? (bc ? 'ok' : 'null') : 'none' };
    if (bc) {
      row.agreement = bc.agreement; row.flagged = bc.flagged;
      if (bc.second) { row.secondWhole = bc.second.count; row.second = it.window ? countInWindow(bc.second.reps, it.window) : bc.second.count; }
      // Cost, timed apart: the check (PSC's bank and the consensus), then the second candidate on the same bank.
      const image = flatImage(result);
      const t0 = performance.now();
      const bank = signalBank(wl, ts, image, { useImage: true });
      const again = bodyCheck(result, it.lift, bank);
      const t1 = performance.now();
      specGuidedCount({ wl, ts, image }, signalProfile(it.lift), summarizeCount, bank);
      const t2 = performance.now();
      expect(again?.agreement).toBe(bc.agreement);
      row.msCheck = t1 - t0; row.msSecond = t2 - t1;
    }
    rows.push(row);
  }
  if (process.env.BODY_CHECK_JSON) writeFileSync(process.env.BODY_CHECK_JSON, JSON.stringify(rows));

  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '-');
  const exact = (r: Row) => r.core === r.label, off3 = (r: Row) => typeof r.core === 'number' && Math.abs(r.core - r.label) >= 3;
  // Offered: the second candidate differs from the core's count (the app compares the whole set's counts).
  const offered = (r: Row) => r.flagged && r.secondWhole !== null && r.secondWhole !== r.whole;
  const line = (label: string, rs: Row[]) => {
    const counted = rs.filter(r => typeof r.core === 'number' && (r.whole ?? 0) > 0), checked = counted.filter(r => r.check === 'ok');
    const fl = checked.filter(r => r.flagged), un = checked.filter(r => !r.flagged), of = fl.filter(offered);
    const right2 = of.filter(r => r.second === r.label).length, either = fl.filter(r => exact(r) || (offered(r) && r.second === r.label)).length;
    return `${label} | ${rs.length} | ${counted.length} | ${checked.length} (${counted.filter(r => r.check === 'none').length} no profile, ${counted.filter(r => r.check === 'null').length} too little seen) | ${fl.length} (${pct(fl.length, checked.length)}) | ${fl.filter(exact).length}/${fl.length} (${pct(fl.filter(exact).length, fl.length)}) | ${un.filter(exact).length}/${un.length} (${pct(un.filter(exact).length, un.length)}) | ${fl.filter(off3).length}/${fl.length} (${pct(fl.filter(off3).length, fl.length)}) | ${un.filter(off3).length}/${un.length} (${pct(un.filter(off3).length, un.length)}) | ${of.length} | ${right2}/${of.length} (${pct(right2, of.length)}); core right on those ${of.filter(exact).length} | ${either}/${fl.length} (${pct(either, fl.length)})`;
  };
  const suites = ['david', 'video', 'publicA', 'publicB', 'repcount', 'synthetic', 'occlusion'];
  const real = rows.filter(r => ['david', 'video', 'publicA', 'publicB', 'repcount'].includes(r.suite));
  const timed = rows.filter(r => r.msCheck !== null);
  const mins = timed.reduce((a, r) => a + r.minutes, 0), msC = timed.reduce((a, r) => a + r.msCheck!, 0), msS = timed.reduce((a, r) => a + r.msSecond!, 0);
  const perMin = (k: 'msCheck' | 'msSecond') => timed.map(r => r[k]! / r.minutes).sort((a, b) => a - b);
  const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * (xs.length - 1)))];
  const longest = timed.reduce((a, r) => (r.minutes > a.minutes ? r : a), timed[0]);
  const fmt = (x: number) => x.toFixed(1);
  // The longest set the app checks (coreAnalysis.js BODY_CHECK_MAX_SAMPLES, PSC's proposal's bound): two of David's
  // videos repeated to that length, the check and the second candidate timed as above, and PSC's proposal on the same
  // samples (the per-set budget the bound shares).
  const long = ['sets-07oct-video/pendulum_squat_7.json.gz', 'sets-07oct-video/seated_dumbbell_curl_10.json.gz'].map(name => {
    const d = gz(resolve(ROOT, name)), n = BODY_CHECK_MAX_SAMPLES, N = d.timestamps.length;
    const wl: any[] = [], im: any[] = [], ts: number[] = [];
    for (let k = 0; k < n; k++) { wl.push(d.worldLandmarks[k % N]); im.push(d.imageLandmarks[k % N]); ts.push(k / 15); }
    const result: any = { ...summarizeCount(wl, ts, d.lift), worldLandmarks: wl, timestamps: ts, imageLandmarks: im };
    const image = flatImage(result), t0 = performance.now();
    const bank = signalBank(wl, ts, image, { useImage: true }), bc = bodyCheck(result, d.lift, bank);
    const t1 = performance.now();
    specGuidedCount({ wl, ts, image }, signalProfile(d.lift), summarizeCount, bank);
    const t2 = performance.now();
    pscProposal({ ...result, refused: true });
    const t3 = performance.now();
    return `${name} repeated to the bound (${n} samples, ${fmt(n / 15 / 60)} minutes, agreement ${bc?.agreement}): check ${fmt(t1 - t0)} ms, second ${fmt(t2 - t1)} ms; PSC's proposal on the same samples ${fmt(t3 - t2)} ms`;
  });
  const lines = [
    `Body check (src/lib/counting/bodyCheck.js, coreAnalysis.js withBodyCheck), ${new Date().toISOString().slice(0, 10)}: the counted joint's angle against the body's consensus of the motion spec's other signals; flagged under ${AGREE_MIN} (the critic's threshold, fixed before its run and before this one). It changes no count: every result below kept its count, reps and refusal (asserted per set).`,
    'Official sets of variant-eval.test.ts, each through the app\'s path (summarizeCount, then withBodyCheck with the landmarks the file stores, image ones included). Labels: David\'s (R1) and the public datasets\' human labels; synthetic and occlusion: the rendered count.',
    'Columns: suite | sets | counted (not refused, count > 0) | checked (no profile: no motion spec or an alternating lift; too little seen) | flagged (share of checked) | core exact on flagged | core exact on unflagged | core off by 3+ on flagged | on unflagged | second candidate offered (differs) | second right where offered; core right there | right number among the candidates on flagged sets.',
    '',
    ...suites.map(s => line(s, rows.filter(r => r.suite === s))),
    line('real-world (david, video, publicA, publicB, repcount)', real),
    line('all', rows),
    '',
    `Cost in Node on this machine (shared, 4 cores, other jobs running; ${timed.length} checked sets, ${fmt(mins)} minutes of recording): the check ${fmt(msC / mins)} ms per minute of recording in all (per set: median ${fmt(q(perMin('msCheck'), 0.5))}, 90th percentile ${fmt(q(perMin('msCheck'), 0.9))}); the second candidate on the same bank ${fmt(msS / mins)} ms per minute (median ${fmt(q(perMin('msSecond'), 0.5))}, 90th percentile ${fmt(q(perMin('msSecond'), 0.9))}), run by the app on flagged sets only. Longest set: ${longest ? `${longest.name}, ${fmt(longest.minutes * 60)} s, check ${fmt(longest.msCheck!)} ms, second ${fmt(longest.msSecond!)} ms` : '-'}.`,
    ...long.map(l => `- ${l}`),
    'Not measured: the cost on a phone (Safari on David\'s iPhone runs this after the count, once per set).',
    '',
    'David\'s sets (stored, then videos): label | core | agreement | flagged | second candidate (when offered).',
    ...rows.filter(r => r.suite === 'david' || r.suite === 'video').map(r => `- ${r.name}: ${r.label} | ${r.core} | ${r.agreement ?? (r.check === 'none' ? 'no profile' : r.core === 'refused' ? 'refused' : 'too little seen')} | ${r.flagged ? 'FLAGGED' : ''} | ${offered(r) ? r.second : ''}`),
    '',
    'Flagged sets elsewhere (suite, set, lift: label | core | agreement | second candidate when offered):',
    ...rows.filter(r => r.flagged && r.suite !== 'david' && r.suite !== 'video').map(r => `- ${r.suite} ${r.name} ${r.lift}: ${r.label} | ${r.core} | ${r.agreement} | ${offered(r) ? r.second : ''}`),
  ];
  writeFileSync(process.env.BODY_CHECK_TXT || resolve(__dirname, 'body-check.txt'), lines.join('\n') + '\n');
  console.log(lines.slice(0, 16).join('\n'));
}, 3_600_000);
