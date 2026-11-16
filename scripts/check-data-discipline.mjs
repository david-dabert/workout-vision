// The data rules of PLAN.md's amendment of 15 November 2026 (THE DATA; David: "adopt"), checked in CI.
// 1. A pull request that changes src/lib/counting/ adds to TRIED.md a line "Chosen on:" naming the data its choice was
//    made on and a line "Confirmed on:" naming other data, not used in that choice, it was confirmed on.
// 2. No code file outside the allowlist names the sealed folder test/real-phone/sealed/: a sealed set is read once, by
//    its exam script, for a gate. The exam script, once written, joins SEALED_READERS in the pull request that runs it.
//
// Usage: node scripts/check-data-discipline.mjs --base <ref>   both checks, the first against the diff from <ref>
//        node scripts/check-data-discipline.mjs                the second check only
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const SEALED = 'real-phone/sealed';
export const SEALED_READERS = ['scripts/check-data-discipline.mjs', 'scripts/__tests__/check-data-discipline.test.js'];
const CODE = /\.(js|jsx|mjs|cjs|ts|tsx|json|ya?ml|sh|py)$/;
const SCANNED = /^(src|scripts|test|e2e|\.github)\//;

const norm = s => s.trim().replace(/[.;,]+$/, '').toLowerCase();

/**
 * Errors for check 1, empty when the change is clean.
 * @param {string[]} changed paths changed by the pull request
 * @param {string} triedAdded the lines the pull request adds to TRIED.md
 */
export function countingDataErrors(changed, triedAdded) {
  if (!changed.some(f => f.startsWith('src/lib/counting/'))) return [];
  const chosen = triedAdded.match(/Chosen on:\s*(.*\S)/)?.[1];
  const confirmed = triedAdded.match(/Confirmed on:\s*(.*\S)/)?.[1];
  const errors = [];
  if (!chosen) errors.push('TRIED.md gains no line "Chosen on:" naming the data the choice was made on.');
  if (!confirmed) errors.push('TRIED.md gains no line "Confirmed on:" naming other data the change was confirmed on.');
  if (chosen && confirmed && norm(chosen) === norm(confirmed)) errors.push('"Chosen on:" and "Confirmed on:" name the same data; the confirmation must use data the choice did not.');
  return errors;
}

/**
 * Code files, outside the allowlist, that name the sealed folder.
 * @param {{ path: string, text: string }[]} files
 */
export function sealedReaders(files) {
  return files
    .filter(f => SCANNED.test(f.path) && CODE.test(f.path) && !SEALED_READERS.includes(f.path))
    .filter(f => f.text.includes(SEALED))
    .map(f => f.path);
}

const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--base');
  let failed = false;
  if (i >= 0) {
    const base = args[i + 1];
    const changed = git(['diff', '--name-only', base, 'HEAD']).split('\n').filter(Boolean);
    const added = git(['diff', base, 'HEAD', '--', 'TRIED.md']).split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
    for (const e of countingDataErrors(changed, added)) { console.log(`::error::${e} (PLAN.md, amendment of 15 November 2026, THE DATA)`); failed = true; }
  }
  const files = git(['ls-files']).split('\n').filter(p => SCANNED.test(p) && CODE.test(p))
    .map(path => { try { return { path, text: readFileSync(path, 'utf8') }; } catch { return { path, text: '' }; } });
  for (const p of sealedReaders(files)) { console.log(`::error file=${p}::${p} names ${SEALED}/, which only its exam script reads (PLAN.md, amendment of 15 November 2026, THE DATA)`); failed = true; }
  if (!failed) console.log('Data discipline: clean.');
  process.exit(failed ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
