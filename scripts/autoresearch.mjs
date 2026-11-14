#!/usr/bin/env node
// The overnight lab (David, 13 November 2026, after Karpathy's autoresearch: "the agent edits, trains for 5 minutes,
// and keeps the change only if validation improved"). Greedy coordinate search over the counter's numeric constants
// (src/lib/counting/core.ts, read through WV_CORE_PARAMS; the app never sees it). Each experiment is one run of
// test/real-phone/accuracy/variant-eval.test.ts (about 12 s) with one constant moved.
//
// Kept only when, against the current best:
//   public half A: more exact counts, and no more sets off by 3 or more;
//   David's labelled sets and the 96 synthetic sets: no exact count lost.
// Half B is never read during the search. At the end (or with --confirm), the kept values are read once on half B,
// David's real videos, RepCount-A and the occlusion sets, and printed beside the baseline. The held-out half is never
// read. The script changes no default in the code: a kept value ships only through its own commit, run through R2,
// with TRIED.md written.
//
// Usage: node scripts/autoresearch.mjs [--minutes 60] [--only NAME,NAME] [--confirm]
// Writes test/real-phone/autoresearch/log.jsonl (one line per experiment) and best.json (the kept values).
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test/real-phone/autoresearch');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const minutes = Number(opt('--minutes', '60'));
const confirmOnly = args.includes('--confirm');
const tmp = mkdtempSync(join(tmpdir(), 'autoresearch-'));

// The constants and their written values, read from core.ts itself.
const core = readFileSync(join(root, 'src/lib/counting/core.ts'), 'utf8');
const written = Object.fromEntries([...core.matchAll(/^const ([A-Z_0-9]+) = param\('\1', (-?[0-9.]+)\);/gm)].map(m => [m[1], Number(m[2])]));
const only = opt('--only', null)?.split(',');
const names = Object.keys(written).filter(n => !only || only.includes(n));

let runs = 0;
function evaluate(params) {
  const file = join(tmp, `run-${runs++}.json`);
  execFileSync('npx', ['vitest', 'run', '--no-cache', 'test/real-phone/accuracy/variant-eval.test.ts'], {
    cwd: root, stdio: 'ignore', env: { ...process.env, VARIANT_EVAL: file, WV_CORE_PARAMS: JSON.stringify(params) },
  });
  const by = {};
  for (const e of Object.values(JSON.parse(readFileSync(file, 'utf8')).sets)) {
    const s = by[e.suite] ??= { n: 0, exact: 0, bad: 0 };
    s.n++;
    if (e.count === 'refused') { s.bad++; continue; }
    const d = Math.abs(e.count - e.label);
    if (d === 0) s.exact++;
    if (d >= 3) s.bad++;
  }
  return by;
}
const z = { n: 0, exact: 0, bad: 0 };
const better = (c, b) => (c.publicA ?? z).exact > (b.publicA ?? z).exact && (c.publicA ?? z).bad <= (b.publicA ?? z).bad
  && (c.david ?? z).exact >= (b.david ?? z).exact && (c.synthetic ?? z).exact >= (b.synthetic ?? z).exact;
const line = (by, suites = null) => Object.entries(by).filter(([k]) => !suites || suites.includes(k)).map(([k, v]) => `${k} ${v.exact}/${v.n} (3+ or refused ${v.bad})`).join('  ');
// The suites the search may look at: half B and the real videos are printed only in the confirmation at the end.
const SEARCH = ['publicA', 'david', 'synthetic'];
// Candidate values: the written value moved by these factors; whole numbers stay whole. Status: convention of the lab.
const FACTORS = [0.7, 0.85, 0.93, 1.07, 1.15, 1.3];
const candidates = (name, v) => [...new Set(FACTORS.map(f => {
  const x = v * f;
  return Number.isInteger(v) ? Math.max(v > 0 ? 1 : 0, Math.round(x)) : Number(x.toPrecision(3));
}).filter(x => x !== v))];

const bestFile = join(out, 'best.json');
let best = existsSync(bestFile) ? JSON.parse(readFileSync(bestFile, 'utf8')).params ?? {} : {};
const t0 = Date.now();
const baseline = evaluate({});
let bestScore = Object.keys(best).length ? evaluate(best) : baseline;
console.log(`baseline     ${line(baseline, SEARCH)}`);
if (Object.keys(best).length) console.log(`resumed best ${line(bestScore, SEARCH)} ${JSON.stringify(best)}`);

if (!confirmOnly) {
  let improved = true;
  while (improved && (Date.now() - t0) / 60000 < minutes) {
    improved = false;
    for (const name of names) {
      for (const v of candidates(name, best[name] ?? written[name])) {
        if ((Date.now() - t0) / 60000 >= minutes) break;
        const trial = { ...best, [name]: v };
        const score = evaluate(trial);
        const kept = better(score, bestScore);
        appendFileSync(join(out, 'log.jsonl'), JSON.stringify({ at: new Date().toISOString(), name, value: v, kept, publicA: score.publicA, david: score.david, synthetic: score.synthetic }) + '\n');
        if (kept) {
          best = trial; bestScore = score; improved = true;
          writeFileSync(bestFile, JSON.stringify({ params: best, publicA: score.publicA, david: score.david, synthetic: score.synthetic, at: new Date().toISOString() }, null, 2) + '\n');
          console.log(`KEPT ${name}=${v}  ${line(score, SEARCH)}`);
        }
      }
    }
  }
  console.log(`${runs} runs in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

// The confirmation: every suite, half B included, read once for the kept values, beside the baseline.
console.log('\nconfirmation (half B and the real videos are read here only)');
console.log(`baseline ${line(baseline)}`);
console.log(`kept     ${line(Object.keys(best).length ? evaluate(best) : baseline)}  ${JSON.stringify(best)}`);
