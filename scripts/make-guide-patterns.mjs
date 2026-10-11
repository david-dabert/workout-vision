// Writes src/lib/counting/guide-patterns.json from guide-families.json: for each countable exercise,
// its pattern as "joint/rest/first" with "/both" when both sides count, and nothing else. The core
// imports this table, which loads with the first screen; the families' reasons stay out of it.
// Run after any change to guide-families.json: node scripts/make-guide-patterns.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const families = JSON.parse(readFileSync(new URL('../src/lib/counting/guide-families.json', import.meta.url), 'utf8'));
const out = {};
for (const [key, f] of Object.entries(families)) {
  if (f.joint) out[key] = [f.joint, f.rest, f.first, ...(f.bothSides ? ['both'] : [])].join('/');
}
writeFileSync(new URL('../src/lib/counting/guide-patterns.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`guide-patterns.json: ${Object.keys(out).length} exercises`);
