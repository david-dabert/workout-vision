#!/usr/bin/env node
// node scripts/import-sets.mjs <folder of .json.gz files> --exam             (plan only)
// node scripts/import-sets.mjs <folder of .json.gz files> --build sets-01oct (plan only)
// node scripts/import-sets.mjs <folder of .json.gz files> --tester <name>    (plan only)
// Add --write to copy. Places set files by their names (scripts/import-plan.mjs): exam sets into
// test/real-phone/exam/<lift>/, unopened; build sets into test/real-phone/<sets-date>/; tester blind sets
// into test/real-phone/testers/<name>/ (verifying each carries blind: { count, p }, R1 25 October 2026).
// Never overwrites a file, and imports nothing if one name cannot be read or one video comes twice.
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { planImport } from './import-plan.mjs';

// WV_SETS_ROOT points the script at a scratch tree, for its own test.
const ROOT = process.env.WV_SETS_ROOT ? resolve(process.env.WV_SETS_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'real-phone');
const [source, ...flags] = process.argv.slice(2);
const modes = ['--exam', '--build', '--tester'].filter(f => flags.includes(f));
const mode = modes.length === 1 ? modes[0].slice(2) : null;
const folder = mode === 'build' ? flags[flags.indexOf('--build') + 1] : undefined;
const tester = mode === 'tester' ? flags[flags.indexOf('--tester') + 1] : undefined;
if (!source || !mode || !existsSync(source)) {
  console.error('usage: node scripts/import-sets.mjs <folder> (--exam | --build sets-<date> | --tester <name>) [--write]');
  process.exit(2);
}

// The names already in the repository, never their contents. The five build clips in landmarks/ carry no
// fingerprint in their names or their files, so a video among them cannot be caught here.
const subDirs = (parent) => existsSync(join(ROOT, parent))
  ? readdirSync(join(ROOT, parent)).filter(d => statSync(join(ROOT, parent, d)).isDirectory()).map(d => `${parent}/${d}`)
  : [];
const dirs = [
  ...readdirSync(ROOT).filter(d => /^sets-/.test(d) && statSync(join(ROOT, d)).isDirectory()),
  ...subDirs('exam'),
  ...subDirs('testers'),
];
const existing = dirs.flatMap(d => readdirSync(join(ROOT, d)).filter(f => f.endsWith('.json.gz')).map(f => `${d}/${f}`));
const names = readdirSync(source).filter(f => !f.startsWith('.')).sort();

const { moves, problems } = planImport(names, { mode, folder, tester, existing });
if (mode === 'tester' && !problems.length) {
  for (const name of names) {
    try {
      const d = JSON.parse(gunzipSync(readFileSync(join(source, name))).toString());
      const okBlind = d?.blind && typeof d.blind === 'object' && (d.blind.count === null || (Number.isInteger(d.blind.count) && d.blind.count >= 1));
      if (!okBlind || !d?.lift || !Array.isArray(d?.worldLandmarks) || !Array.isArray(d?.timestamps)) {
        problems.push(`not a blind-collected set file: ${name}`);
      }
    } catch {
      problems.push(`unreadable gzip JSON: ${name}`);
    }
  }
}
if (problems.length) {
  console.error(`Nothing imported. ${problems.length} problem${problems.length > 1 ? 's' : ''}:`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
const copied = [];
for (const { from, to } of moves) {
  console.log(`${from} -> test/real-phone/${to}`);
  if (!flags.includes('--write')) continue;
  try {
    mkdirSync(dirname(join(ROOT, to)), { recursive: true });
    copyFileSync(join(source, from), join(ROOT, to), constants.COPYFILE_EXCL);
    copied.push(join(ROOT, to));
  } catch (err) {
    // All or nothing: the files this run copied are taken back out.
    for (const path of copied) unlinkSync(path);
    console.error(`Nothing imported: ${from} could not be copied (${err.code || err.message}).`);
    process.exit(1);
  }
}
const files = `${moves.length} file${moves.length === 1 ? '' : 's'}`;
console.log(flags.includes('--write') ? `${files} copied.` : `${files} planned; add --write to copy.`);
