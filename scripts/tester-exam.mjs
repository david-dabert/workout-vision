#!/usr/bin/env node
// One-shot exam runner for testers' blind-count sets (HANDOFF.md T1; CLAUDE.md R1, 25 October 2026).
// Reads each unexposed set in test/real-phone/testers/<tester>/ once, scores the live core against blind.count,
// and with --record marks the read sets in test/real-phone/testers/exposed.json so no set is scored twice as an
// unseen exam.
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

const { summarizeCount, withBodyCheck, withProposal } = await import('../src/lib/coreAnalysis.js');

const ROOT = process.env.WV_SETS_ROOT
  ? resolve(process.env.WV_SETS_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'real-phone');
const TESTERS_DIR = join(ROOT, 'testers');
const EXPOSED_PATH = join(TESTERS_DIR, 'exposed.json');
const recordFlag = process.argv.includes('--record');

const PRESS = new Set(['bench_press', 'overhead_press']);
const decides = (lift) => !PRESS.has(lift);

const exposedData = existsSync(EXPOSED_PATH)
  ? JSON.parse(readFileSync(EXPOSED_PATH, 'utf8'))
  : { note: 'Sets in test/real-phone/testers/<tester>/ already read by scripts/tester-exam.mjs --record.', sets: {} };
const exposedSets = exposedData.sets ?? (exposedData.sets = {});

const today = new Date().toISOString().slice(0, 10);
const testers = existsSync(TESTERS_DIR)
  ? readdirSync(TESTERS_DIR).filter(d => !d.startsWith('.') && statSync(join(TESTERS_DIR, d)).isDirectory()).sort()
  : [];

const unseen = [];
const alreadyExposed = [];
const unsure = [];

for (const tester of testers) {
  const dir = join(TESTERS_DIR, tester);
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json.gz')).sort()) {
    const key = `testers/${tester}/${f}`;
    if (exposedSets[key]) {
      alreadyExposed.push(`${key} (exposed ${exposedSets[key]})`);
      continue;
    }
    const d = JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString());
    if (!d?.blind || d.blind.count === null) {
      unsure.push(key);
      continue;
    }
    unseen.push({ key, tester, lift: d.lift, label: d.blind.count, kept: d.count, wl: d.worldLandmarks, ts: d.timestamps, il: d.imageLandmarks ?? null, appRefused: d.appRefused === true });
  }
}

let exact = 0, decCount = 0, cat = 0;
const lines = [];
for (const s of unseen) {
  const c = summarizeCount(s.wl, s.ts, s.lift);
  const full = withBodyCheck(withProposal({ ...c, refused: c.refused || s.appRefused, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il }, s.lift), s.lift);
  const now = full.refused ? 'refused' : full.count;
  const v = now === 'refused' ? 'refused' : now === s.label ? 'exact' : Math.abs(now - s.label) >= 3 ? 'catastrophic' : `off ${now > s.label ? '+' : ''}${now - s.label}`;
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

console.log(`Testers' unseen exam ${today}: ${unseen.length} unseen set${unseen.length === 1 ? '' : 's'} (${exact} exact of ${decCount} that decide, ${cat} catastrophic/refused); ${alreadyExposed.length} already exposed; ${unsure.length} answered "Je ne sais pas".`);
for (const l of lines) console.log(l);
for (const e of alreadyExposed) console.log(`   EXPOSED ${e}`);
for (const u of unsure) console.log(`   UNSURE ${u}`);
