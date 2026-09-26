/**
 * Print the hex SHA-256 of every file under src/, sorted by path.
 * Each file contributes: its path relative to the repo root, a newline, and its bytes.
 * Usage: node scripts/src-hash.mjs
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'node:fs';
import { promisify } from 'node:util';

const globP = promisify(glob);
const root = resolve(import.meta.dirname, '..');
const all = (await globP('src/**/*', { cwd: root })).sort();

const hash = createHash('sha256');
for (const f of all) {
  const full = resolve(root, f);
  const s = await stat(full);
  if (!s.isFile()) continue;
  hash.update(f + '\n');
  hash.update(await readFile(full));
}
console.log(hash.digest('hex'));
