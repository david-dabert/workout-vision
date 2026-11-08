#!/usr/bin/env node
// One-shot exam runner for testers' blind-count sets (HANDOFF.md T1; CLAUDE.md R1, 25 October 2026).
// Reads each unexposed set in test/real-phone/blind/<tester>/ once, scores the live core against blind.count,
// and with --record marks the read sets in test/real-phone/testers/exposed.json so no set is scored twice as an
// unseen exam. Since 8 November 2026 (Phase 6 of David's order of 6 November) a file is read by the schema's one reader
// (test/real-phone/blind/parse.mjs) and scored by the scoreboards' own outcome (test/real-phone/accuracy/outcome.mjs,
// blindOutcome): the live core's count on the stored landmarks. Until then the exam also counted as refused every set the
// phone had refused when it was kept, so one set could be refused here and exact in npm run scoreboard.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.')) {
        for (const ext of ['.js', '.ts', '.mjs', '.jsx', '.tsx']) {
          try { return nextResolve(specifier + ext, context); } catch { /* try next */ }
        }
      }
      throw err;
    }
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return { format: 'module', shortCircuit: true, source: `export default ${readFileSync(fileURLToPath(url), 'utf8')};` };
    }
    return nextLoad(url, context);
  },
});

const { blindOutcome } = await import('../test/real-phone/accuracy/outcome.mjs');
const { parseBlindFile, SET_FILE, TESTER_NAME } = await import('../test/real-phone/blind/parse.mjs');
const { verdict } = await import('../test/real-phone/blind/compare.mjs');

const ROOT = process.env.WV_SETS_ROOT
  ? resolve(process.env.WV_SETS_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'real-phone');
const TESTERS_DIR = join(ROOT, 'blind');
// The exposed list stays where it was (test/real-phone/testers/exposed.json, README.md there): nothing under test/ moves.
const EXPOSED_PATH = join(ROOT, 'testers', 'exposed.json');
const recordFlag = process.argv.includes('--record');

const PRESS = new Set(['bench_press', 'overhead_press']);
const decides = (lift) => !PRESS.has(lift);

const exposedData = existsSync(EXPOSED_PATH)
  ? JSON.parse(readFileSync(EXPOSED_PATH, 'utf8'))
  : { note: 'Sets in test/real-phone/blind/<tester>/ already read by scripts/tester-exam.mjs --record: listed as exposed and never scored twice as an unseen exam.', sets: {} };
const exposedSets = exposedData.sets ?? (exposedData.sets = {});

const today = new Date().toISOString().slice(0, 10);
const testers = existsSync(TESTERS_DIR)
  ? readdirSync(TESTERS_DIR).filter(d => TESTER_NAME.test(d) && statSync(join(TESTERS_DIR, d)).isDirectory()).sort()
  : [];

const unseen = [];
const alreadyExposed = [];
const unsure = [];
const unreadable = [];
// A set file outside a tester's folder is unreadable, never skipped unseen (review of 8 November 2026).
if (existsSync(TESTERS_DIR)) {
  for (const f of readdirSync(TESTERS_DIR).filter(x => SET_FILE.test(x) && statSync(join(TESTERS_DIR, x)).isFile()).sort()) {
    unreadable.push(`blind/${f} (a set file outside a tester's folder)`);
  }
}

for (const tester of testers) {
  const dir = join(TESTERS_DIR, tester);
  for (const f of readdirSync(dir).filter(x => SET_FILE.test(x)).sort()) {
    const key = `blind/${tester}/${f}`;
    if (!f.endsWith('.json.gz')) { unreadable.push(`${key} (not gzip JSON)`); continue; }
    if (exposedSets[key]) {
      alreadyExposed.push(`${key} (exposed ${exposedSets[key]})`);
      continue;
    }
    let d;
    try { d = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString()); }
    catch { unreadable.push(`${key} (not gzip JSON)`); continue; }
    const r = parseBlindFile(d, f);
    if (r.status === 'unsure') { unsure.push(key); continue; }
    if (r.status !== 'set') { unreadable.push(`${key} (${r.status === 'none' ? 'no blind count' : r.reason})`); continue; }
    unseen.push({ key, tester, ...r.set });
  }
}

let exact = 0, decCount = 0, cat = 0;
const lines = [];
for (const s of unseen) {
  const now = blindOutcome(s).now;
  const v = verdict(now, s.label);
  if (decides(s.lift)) {
    decCount++;
    if (v === 'exact') exact++;
    if (v === 'catastrophic' || v === 'refused') cat++;
  }
  lines.push(`   ${s.key}  tester ${s.tester}  blind ${s.label}  now ${now} (${v})  kept ${s.kept}`);
  if (recordFlag) exposedSets[s.key] = today;
}

if (recordFlag && unseen.length > 0) {
  writeFileSync(EXPOSED_PATH, JSON.stringify(exposedData, null, 2) + '\n');
}

console.log(`Testers' unseen exam ${today}: ${unseen.length} unseen set${unseen.length === 1 ? '' : 's'} (${exact} exact of ${decCount} that decide, ${cat} catastrophic/refused); ${alreadyExposed.length} already exposed; ${unsure.length} answered "Je ne sais pas"; ${unreadable.length} unreadable.`);
for (const l of lines) console.log(l);
for (const e of alreadyExposed) console.log(`   EXPOSED ${e}`);
for (const u of unsure) console.log(`   UNSURE ${u}`);
for (const u of unreadable) console.log(`   UNREADABLE ${u}`);
// A file the schema refuses is never scored as an exam: the run fails, so it is fixed or reported to David (R1, R12).
if (unreadable.length) process.exitCode = 1;
