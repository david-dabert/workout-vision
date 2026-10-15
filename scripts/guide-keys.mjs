// Writes src/lib/guide-keys.json: the keys of the guide's catalogue (src/lib/guide-catalog.json), sorted. The
// programme (programme.js) is in the first screen's code and must know which exercises a coach's sheet may name, but
// the catalogue itself (124 kB) stays out of that code; the key list is 1.7 kB gzipped. Run after any change to the
// catalogue: node scripts/guide-keys.mjs. src/lib/__tests__/guide-keys.test.js fails while the two differ.
import { readFile, writeFile } from 'node:fs/promises';

const catalogue = JSON.parse(await readFile(new URL('../src/lib/guide-catalog.json', import.meta.url), 'utf8'));
const keys = [...new Set(catalogue.map(e => e.key))].sort();
await writeFile(new URL('../src/lib/guide-keys.json', import.meta.url), `${JSON.stringify(keys, null, 1)}\n`);
console.log(JSON.stringify({ keys: keys.length }));
