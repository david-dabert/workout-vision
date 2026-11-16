#!/usr/bin/env node
// node scripts/stock/import-labels.mjs <comptes-*.json> [...] [--names David,Azélie]
// Brings the counts sent from label.html into test/real-phone/stock/labels.json. A count is a label only when given by
// a person David names (R1, amended 25 October 2026): --names lists them, and a file from anyone else is refused with
// its name printed. Labels are appended, never changed: a clip already labelled by the same person keeps its first
// label; two people's counts of one clip are both kept, and their disagreement is printed (a clip they disagree on
// decides nothing until David rules on it).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { disagreements, mergeLabels } from './labels.mjs';

const args = process.argv.slice(2);
const namesAt = args.indexOf('--names');
const names = namesAt >= 0 ? args[namesAt + 1].split(',').map(s => s.trim()).filter(Boolean) : [];
const files = args.filter((a, i) => !a.startsWith('--') && (namesAt < 0 || i !== namesAt + 1));
if (!files.length || !names.length) { console.error('usage: import-labels.mjs <file.json> [...] --names David[,Other]'); process.exit(2); }
const OUT = resolve('test/real-phone/stock/labels.json');
let book = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { note: '', labels: [] };
for (const f of files) {
  const r = mergeLabels(book, JSON.parse(readFileSync(f, 'utf8')), names);
  book = r.book;
  console.log(`${f}: ${r.added} added, ${r.kept} already there${r.refused ? `, refused: ${r.refused}` : ''}`);
}
book.note = 'Counts given on label.html by people David names (R1). Appended only, never changed (scripts/stock/import-labels.mjs).';
writeFileSync(OUT, `${JSON.stringify(book, null, 1)}\n`);
const split = disagreements(book);
console.log(`\n${book.labels.length} labels in ${OUT}.`);
if (split.length) console.log(`Clips counted differently by two people (decide nothing until David rules):\n${split.map(d => `- ${d.id}: ${d.counts.map(c => `${c.who} ${c.count ?? c.verdict}`).join(', ')}`).join('\n')}`);
