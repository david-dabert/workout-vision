// CHOICES=1 npx vitest run --no-cache test/real-phone/accuracy/choices.test.ts
// Pillar 2 of David's order of 9 October 2026: success is the right number recorded in one tap at most. On every
// labelled set of the real-world suites, the app's own path (summarizeCount, withProposal, withBodyCheck, as
// coreAnalysis.js runs them) and the list the result screen can offer (result-choices.js countChoices, imported, not
// mirrored): how often the number shown is exact (top-1), and how often the label is in the list of 2 [M, M + 1] and
// of 3 [M, M + 1, M - 1], per suite and per screen state, with Wilson 95 % intervals. Writes choices.txt.
// A set with nothing on the screen (state 'ask') counts as a miss. A whole public clip kept with its labelled window
// (countix-whole) is counted inside the window, as variant-eval.test.ts counts it.
// Research tool: it changes nothing and gates nothing.
import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount, withProposal, withBodyCheck, withSensitivity } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { countChoices, inList } from '../../../src/components/experience/result-choices';
import { ROOT, benchSets, countInWindow, labelledSets, publicSets, videoSets } from './sets';

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
type Row = { suite: string; name: string; dataset: string; id: string; label: number; state: string; top1: boolean; in2: boolean; in3: boolean; refused: boolean };

// The app's result on a set, with the counts read inside the labelled window when the clip has one.
function appResult(lift: string, d: any, appRefused = false, window?: [number, number]) {
  const c: any = summarizeCount(d.worldLandmarks, d.timestamps, lift);
  const r: any = withSensitivity(withBodyCheck(withProposal({ ...c, refused: c.refused || appRefused, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps, imageLandmarks: d.imageLandmarks ?? null, imageXY: d.imageXY ?? null }, lift), lift), lift);
  // A read the app refused itself (partial) shows its failure screen: no number, as countChoices reads notRead.
  if (appRefused) return { ...r, notRead: { kind: 'partial' } };
  if (!window) return r;
  return { ...r, count: r.refused ? r.count : countInWindow(r.reps ?? [], window), proposal: r.proposal ? { ...r.proposal, count: countInWindow(r.proposal.reps ?? [], window) } : r.proposal };
}
function row(suite: string, name: string, dataset: string, id: string, label: number, result: any): Row {
  const ch = countChoices(result);
  return { suite, name, dataset, id, label, state: ch.state, top1: ch.main === label, in2: inList(ch, label, 2), in3: inList(ch, label, 3), refused: !!result.refused };
}

// Wilson score interval, 95 %.
function wilson(k: number, n: number) {
  if (!n) return '-';
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return `${(100 * p).toFixed(1)} % [${(100 * Math.max(0, c - h)).toFixed(1)}-${(100 * Math.min(1, c + h)).toFixed(1)}]`;
}
const line = (g: string, rs: Row[]) => {
  const n = rs.length, t = rs.filter(r => r.top1).length, a = rs.filter(r => r.in2).length, b = rs.filter(r => r.in3).length;
  return `${g} | ${n} | ${t} ${wilson(t, n)} | ${a} ${wilson(a, n)} | ${b} ${wilson(b, n)}`;
};

test.skipIf(!process.env.CHOICES)('the label in the list the result screen can offer', () => {
  const rows: Row[] = [];
  for (const s of labelledSets().sets) rows.push(row('david', s.name, 'david', s.name, s.label, appResult(s.lift, { ...gz(resolve(ROOT, s.name)), worldLandmarks: s.wl, timestamps: s.ts })));
  for (const s of videoSets().sets) rows.push(row('video', s.name, 'video', s.name, s.label, appResult(s.lift, { worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il }, s.appRefused)));
  // The public build half in variant-eval's two fixed halves (the same salted hash).
  const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
  for (const s of publicSets('build').sets) {
    const id = s.name.split('/').pop()!.replace(/\.json\.gz$/, '');
    rows.push(row(half(s.name), s.name, s.dataset, id, s.label, appResult(s.lift, { ...gz(resolve(ROOT, s.name)), worldLandmarks: s.wl, timestamps: s.ts }, false, s.window)));
  }
  for (const s of benchSets('repcount', 'build').sets) {
    if (!s.lift || !liftDefinition(s.lift)) continue;
    rows.push(row('repcount', s.name, 'repcount', s.id, s.label, appResult(s.lift, { worldLandmarks: s.wl, timestamps: s.ts, imageXY: s.image })));
  }
  const REAL = ['david', 'video', 'publicA', 'publicB', 'repcount'];
  const L: string[] = [];
  L.push(`One tap at most (result-choices.js, rule ${countChoices({ count: 1 }).rule}): the number the screen shows (M) and the list [M, M + 1, M - 1]. ${new Date().toISOString().slice(0, 10)}.`);
  L.push('A set with nothing shown (state ask) is a miss. Wilson 95 % intervals assume independent sets.');
  L.push('');
  L.push('group | sets | exact top-1 | label in [M, M + 1] | label in [M, M + 1, M - 1]');
  const named: [string, string][] = [['david', 'David stored, all'], ['video', 'David videos'], ['publicA', 'public build half A'], ['publicB', 'public build half B'], ['repcount', 'RepCount-A build (mapped)']];
  for (const [s, g] of named) L.push(line(g, rows.filter(r => r.suite === s)));
  const real = rows.filter(r => REAL.includes(r.suite));
  L.push(line('real-world all', real));
  // The public build holds each Countix clip twice: trimmed (countix) and whole with its window (countix-whole), same
  // id, same label (review of 9 October 2026). Counted once, the sets are independent clips.
  const once = real.filter(r => r.dataset !== 'countix-whole');
  L.push(line('real-world, each Countix clip once (countix-whole left out)', once));
  L.push('');
  L.push('By screen state (counted: the app\'s count to confirm; check: a proposal, a count the body check flagged or the sensitivity check moved; ask: nothing shown).');
  L.push('group | state | sets | exact top-1 | label in [M, M + 1] | label in [M, M + 1, M - 1]');
  for (const [g, rs] of [['real-world all', real], ['real-world, Countix once', once]] as const) {
    for (const st of ['counted', 'check', 'ask']) L.push(line(`${g} | ${st}`, rs.filter(r => r.state === st)));
  }
  L.push('');
  L.push('Refused sets: n, label in [M, M + 1, M - 1] (M is the proposal; none shown counts as a miss).');
  for (const [s, g] of [...named, ['real', 'real-world all']]) {
    const rs = (s === 'real' ? real : rows.filter(r => r.suite === s)).filter(r => r.refused);
    L.push(`${g} | ${rs.length} | ${rs.filter(r => r.in3).length}`);
  }
  const text = L.join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'choices.txt'), text);
  process.stdout.write(text);
}, 1_800_000);
