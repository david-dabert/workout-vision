#!/usr/bin/env node
// node scripts/import-sets.mjs <folder of .json.gz files> --exam             (plan only)
// node scripts/import-sets.mjs <folder of .json.gz files> --build sets-01oct (plan only)
// node scripts/import-sets.mjs <folder of .json.gz files> --tester <name>    (plan only)
// Add --write to copy. Places set files by their names (scripts/import-plan.mjs): exam sets into
// test/real-phone/exam/<lift>/, unopened; build sets into test/real-phone/<sets-date>/; tester blind sets
// into test/real-phone/blind/<name>/ (R1, 25 October 2026). Every file opened is read by the blind-count schema's one
// reader (test/real-phone/blind/parse.mjs): a tester's file must carry a blind count or "Je ne sais pas", and a build
// file that carries one must keep the schema, so a file the scoreboards would refuse is refused here.
// Never overwrites a file, and imports nothing if one name cannot be read or one video comes twice.
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { planImport } from './import-plan.mjs';
import { parseBlindFile } from '../test/real-phone/blind/parse.mjs';

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
  ...subDirs('blind'),
];
const existing = dirs.flatMap(d => readdirSync(join(ROOT, d)).filter(f => f.endsWith('.json.gz')).map(f => `${d}/${f}`));
const names = readdirSync(source).filter(f => !f.startsWith('.')).sort();

const { moves, problems } = planImport(names, { mode, folder, tester, existing });
// Exam sets stay unopened (PLAN.md: only the exam script opens them).
if ((mode === 'tester' || mode === 'build') && !problems.length) {
  for (const name of names) {
    let d;
    try { d = JSON.parse(gunzipSync(readFileSync(join(source, name))).toString()); }
    catch {
      if (mode === 'tester') problems.push(`unreadable gzip JSON: ${name}`);
      continue; // a build file the scoreboard cannot read is named there (labelledSets)
    }
    const r = parseBlindFile(d, name);
    if (mode === 'tester' && r.status === 'none') problems.push(`not a blind-collected set file: ${name} (no blind count)`);
    if (r.status === 'unreadable') problems.push(`not a blind-collected set file: ${name} (${r.reason})`);
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
