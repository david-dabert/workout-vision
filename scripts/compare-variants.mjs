// node scripts/compare-variants.mjs <before.json> <after.json> [--lift <key>]
// Two runs of test/real-phone/accuracy/variant-eval.test.ts, compared set by set, per suite: exact counts, sets off
// by 3 or more (a refusal counts as off by 3 or more), the sets each run gets exact that the other does not, and
// McNemar's chi-square on those (continuity-corrected; 3.84 is p = 0.05). The net rule David set on 3 October
// ("progress and improvement are the goalposts"): a change ships when, on the public halves and the synthetic sets,
// exact counts do not fall, sets off by 3 or more do not rise, and the paired test does not favour the old run;
// David's own sets keep CLAUDE.md R2 (no fewer exact, none newly off by 3). Prints a table and a verdict.
// Since 8 October, when the runs hold them: David's real videos (video, R2 as his sets), the RepCount-A build half
// (repcount) and the occlusion sets (occlusion), the last two under the net rule as the public halves.
import { readFileSync } from 'node:fs';

const [, , a, b, ...rest] = process.argv;
if (!a || !b) { console.error('usage: compare-variants.mjs <before.json> <after.json> [--lift <key>]'); process.exit(2); }
const lift = rest[0] === '--lift' ? rest[1] : null;
const before = JSON.parse(readFileSync(a, 'utf8')).sets, after = JSON.parse(readFileSync(b, 'utf8')).sets;
// The public build half holds each Countix clip twice (countix and countix-whole read the same video): a gain or loss
// is also counted by distinct clip, the video id before the first underscore (review of 3 October).
const clip = n => n.split('/').pop().split('_')[0];
const off = e => (e.count === 'refused' ? Infinity : Math.abs(e.count - e.label));
const suites = ['david', 'video', 'publicA', 'publicB', 'synthetic', 'repcount', 'occlusion'].filter(s => Object.values(before).some(e => e.suite === s));
const rows = {}, verdict = [];
for (const s of suites) {
  const names = Object.keys(before).filter(n => before[n].suite === s && n in after && (!lift || before[n].lift === lift));
  const r = { n: names.length, exactB: 0, exactA: 0, badB: 0, badA: 0, onlyA: 0, onlyB: 0, newlyBad: 0, moved: 0, clipsGained: new Set(), clipsLost: new Set() };
  for (const n of names) {
    const x = before[n], y = after[n], ex = off(x) === 0, ey = off(y) === 0;
    if (ex) r.exactB++; if (ey) r.exactA++;
    if (off(x) >= 3) r.badB++; if (off(y) >= 3) r.badA++;
    if (ey && !ex) { r.onlyA++; r.clipsGained.add(clip(n)); } if (ex && !ey) { r.onlyB++; r.clipsLost.add(clip(n)); }
    if (off(y) >= 3 && off(x) < 3) r.newlyBad++;
    if (x.count !== y.count) r.moved++;
  }
  r.chi = r.onlyA + r.onlyB ? (Math.abs(r.onlyA - r.onlyB) - 1) ** 2 / (r.onlyA + r.onlyB) : 0;
  rows[s] = r;
}
console.log(`suite       n     exact before -> after   off3+ before -> after   only after  only before  chi2   newly off3  moved${lift ? `   (lift ${lift})` : ''}`);
for (const s of suites) {
  const r = rows[s];
  console.log(`${s.padEnd(10)} ${String(r.n).padStart(4)}   ${String(r.exactB).padStart(5)} -> ${String(r.exactA).padEnd(5)}         ${String(r.badB).padStart(5)} -> ${String(r.badA).padEnd(5)}        ${String(r.onlyA).padStart(5)}      ${String(r.onlyB).padStart(5)}    ${r.chi.toFixed(2).padStart(5)}   ${String(r.newlyBad).padStart(5)}    ${String(r.moved).padStart(5)}`);
}
for (const s of suites) {
  const r = rows[s];
  if (r.clipsGained.size || r.clipsLost.size) console.log(`${s.padEnd(10)} distinct clips: ${r.clipsGained.size} gained, ${r.clipsLost.size} lost`);
}
for (const s of ['david', 'video'].filter(s => rows[s])) {
  const d = rows[s];
  if (d.exactA < d.exactB || d.newlyBad > 0) verdict.push(`${s === 'david' ? "David's sets" : "David's videos"}: fewer exact or a set newly off by 3 (R2)`);
}
for (const s of ['publicA', 'publicB', 'synthetic', 'repcount', 'occlusion'].filter(s => rows[s])) {
  const r = rows[s];
  if (r.exactA < r.exactB) verdict.push(`${s}: exact ${r.exactB} -> ${r.exactA}`);
  if (r.badA > r.badB) verdict.push(`${s}: off by 3 or more ${r.badB} -> ${r.badA}`);
  if (r.onlyB > r.onlyA && r.chi >= 3.84) verdict.push(`${s}: the paired test favours the old run`);
}
console.log(verdict.length ? `VERDICT: does not ship\n- ${verdict.join('\n- ')}` : 'VERDICT: ships under the net rule');
process.exitCode = verdict.length ? 1 : 0;
