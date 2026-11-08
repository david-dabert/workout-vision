#!/usr/bin/env node
// node scripts/check-labels-lock.mjs <base labels.lock> <head labels.lock> <label-rulings.json>
// Fails when a line of the base branch's test/real-phone/labels.lock is changed or removed without a ruling of David's
// recorded in test/real-phone/label-rulings.json (Phase 6 of his order of 6 November 2026, point 3; CLAUDE.md R1).
// Run by ci.yml ("Verify labelled sets lock"); the rule and its limit are in test/real-phone/accuracy/labels-lock-diff.mjs.
import { existsSync, readFileSync } from 'node:fs';
import { dataLines, lockViolations, rulingProblems } from '../test/real-phone/accuracy/labels-lock-diff.mjs';

const [basePath, headPath, rulingsPath] = process.argv.slice(2);
if (!basePath || !headPath || !rulingsPath) {
  console.error('usage: node scripts/check-labels-lock.mjs <base labels.lock> <head labels.lock> <label-rulings.json>');
  process.exit(2);
}
let rulings;
try { rulings = JSON.parse(readFileSync(rulingsPath, 'utf8')); }
catch (err) {
  console.log(`::error file=test/real-phone/label-rulings.json::not readable JSON (${err.message})`);
  process.exit(1);
}
const problems = rulingProblems(rulings);
for (const p of problems) console.log(`::error file=test/real-phone/label-rulings.json::${p}`);
if (!existsSync(basePath)) {
  console.log('No labels.lock on the base: nothing to compare.');
  process.exit(problems.length ? 1 : 0);
}
const base = readFileSync(basePath, 'utf8');
const found = lockViolations(base, readFileSync(headPath, 'utf8'), rulings);
for (const v of found) {
  const what = v.now ? `changed to "${v.now}"` : 'removed';
  console.log(`::error file=test/real-phone/labels.lock::"${v.line}" ${what} without a ruling of David's in test/real-phone/label-rulings.json (CLAUDE.md R1)`);
}
console.log(`labels.lock: ${dataLines(base).length} lines on the base; ${found.length} changed or removed without a ruling; ${problems.length} ruling${problems.length === 1 ? '' : 's'} not whole.`);
process.exit(found.length || problems.length ? 1 : 0);
