#!/usr/bin/env node
// node scripts/import-sets.mjs <folder of .json.gz files> --exam            (plan only)
// node scripts/import-sets.mjs <folder of .json.gz files> --build sets-01oct (plan only)
// Add --write to copy. Places David's set files by their names alone (scripts/import-plan.mjs): exam sets
// into test/real-phone/exam/<lift>/, unopened; build sets into test/real-phone/<sets-date>/. Never
// overwrites a file, and imports nothing if one name cannot be read or one video comes twice.
import { constants, copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planImport } from './import-plan.mjs';

// WV_SETS_ROOT points the script at a scratch tree, for its own test.
const ROOT = process.env.WV_SETS_ROOT ? resolve(process.env.WV_SETS_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'real-phone');
const [source, ...flags] = process.argv.slice(2);
const mode = flags.includes('--exam') ? 'exam' : flags.includes('--build') ? 'build' : null;
const folder = mode === 'build' ? flags[flags.indexOf('--build') + 1] : undefined;
if (!source || !mode || (flags.includes('--exam') && flags.includes('--build')) || !existsSync(source)) {
  console.error('usage: node scripts/import-sets.mjs <folder> (--exam | --build sets-<date>) [--write]');
  process.exit(2);
}

// The names already in the repository, never their contents. The five build clips in landmarks/ carry no
// fingerprint in their names or their files, so a video among them cannot be caught here.
const dirs = [
  ...readdirSync(ROOT).filter(d => /^sets-/.test(d) && statSync(join(ROOT, d)).isDirectory()),
  ...(existsSync(join(ROOT, 'exam')) ? readdirSync(join(ROOT, 'exam')).filter(d => statSync(join(ROOT, 'exam', d)).isDirectory()).map(d => `exam/${d}`) : []),
];
const existing = dirs.flatMap(d => readdirSync(join(ROOT, d)).filter(f => f.endsWith('.json.gz')).map(f => `${d}/${f}`));
const names = readdirSync(source).filter(f => !f.startsWith('.')).sort();

const { moves, problems } = planImport(names, { mode, folder, existing });
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
