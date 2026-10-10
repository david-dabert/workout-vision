// node scripts/unreachable.mjs: the source files no page of the app loads (Astra's audit, FINDING-035).
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { execSync } from 'node:child_process';
const root = process.cwd();
const files = execSync("git ls-files 'src/**'", { encoding: 'utf8' }).trim().split('\n').filter(f => /\.(jsx?|tsx?|mjs)$/.test(f));
const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '/index.js', '/index.jsx', '/index.ts'];
const res = (from, spec) => { if (!spec.startsWith('.')) return null; const b = resolve(dirname(from), spec); for (const e of exts) { const p = b + e; if (existsSync(p) && statSync(p).isFile()) return p; } return null; };
const seen = new Set(), stack = [];
for (const h of ['index.html', 'collect.html', 'collect-batch.html', 'check.html', 'pack.html']) for (const m of readFileSync(h, 'utf8').matchAll(/src="\/?(src\/[^"]+)"/g)) stack.push(resolve(m[1]));
while (stack.length) { const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); if (!/\.(jsx?|tsx?|mjs)$/.test(f)) continue;
  const s = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
  for (const m of s.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|new URL\(\s*['"]([^'"]+)['"]/g)) { const p = res(f, m[1] || m[2] || m[3] || m[4]); if (p) stack.push(p); } }
const live = files.filter(f => seen.has(resolve(f))), dead = files.filter(f => !seen.has(resolve(f)) && !f.includes('__tests__'));
console.log('reachable', live.length, 'unreachable (non-test)', dead.length);
console.log(dead.join('\n'));
