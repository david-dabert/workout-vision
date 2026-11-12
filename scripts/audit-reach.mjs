// Card 006 (cards/006-audit-hidden-features.md): which files under src/ does the production build reach by import?
// It reads the five pages vite.config.js builds (index, collect, collect-batch, check, pack), follows every static
// import, dynamic import(), re-export and `new URL('./x', import.meta.url)` from their scripts, and prints the files
// under src/components and src/lib that nothing reaches. It reads only; it changes no file.
//
// Limits, stated so the output is not read for more than it is:
// - "Reached by import" is not "reachable by a user": a file imported behind a switch that is off (measures.js,
//   buildFlags.js) is reached here. docs/AUDIT-2026-11.md states the switch by hand, row by row.
// - Imports are found by pattern, not by parsing. A path built at run time is not followed.
//
// Usage: node scripts/audit-reach.mjs            the summary and the unreached files
//        node scripts/audit-reach.mjs --json     the same as JSON (reached, unreached, testOnly)
//        node scripts/audit-reach.mjs --check docs/AUDIT-2026-11.md
//                                                 also checks that every `src/...` path the document names exists,
//                                                 and lists unreached files the document does not name
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.relative(root, p).split(path.sep).join('/');
const PAGES = ['index.html', 'collect.html', 'collect-batch.html', 'check.html', 'pack.html'];
const EXT = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.json', '.css'];
const CODE = /\.(js|jsx|ts|tsx|mjs)$/;
const isTest = f => /(^|\/)__tests__\//.test(f) || /\.(test|spec)\.[jt]sx?$/.test(f);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function resolveFrom(file, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // a package
  const clean = spec.replace(/[?#].*$/, '');
  const base = clean.startsWith('/') ? path.join(root, clean) : path.resolve(path.dirname(file), clean);
  for (const e of EXT) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  for (const e of EXT.slice(1)) {
    const p = path.join(base, 'index' + e);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

function importsOf(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const specs = new Set();
  if (file.endsWith('.html')) {
    for (const m of raw.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) specs.add(m[1]);
    return specs;
  }
  if (file.endsWith('.css')) {
    for (const m of raw.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) specs.add(m[1]);
    return specs;
  }
  if (!CODE.test(file)) return specs;
  const src = strip(raw);
  const patterns = [
    /\bimport\s+(?:[^'"()]*?\sfrom\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]*?\sfrom\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*(?:\/\*[^*]*\*\/\s*)?["'`]([^"'`]+)["'`]\s*\)/g,
    /new\s+URL\(\s*["'`]([^"'`]+)["'`]\s*,\s*import\.meta\.url/g,
  ];
  for (const re of patterns) for (const m of src.matchAll(re)) specs.add(m[1]);
  return specs;
}

function reach(entries) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const s of importsOf(f)) {
      const r = resolveFrom(f, s);
      if (r && !seen.has(r)) stack.push(r);
    }
  }
  return seen;
}

const all = walk(path.join(root, 'src')).filter(f => CODE.test(f));
const scoped = all.filter(f => /^src\/(components|lib)\//.test(rel(f)));
const prod = reach(PAGES.map(p => path.join(root, p)));
// What only the tooling holds: the tests under src/, and the code under test/, benchmark/, scripts/ and e2e/.
const TOOL_DIRS = ['test', 'benchmark', 'scripts', 'e2e'];
const tooling = TOOL_DIRS.filter(d => fs.existsSync(path.join(root, d)))
  .flatMap(d => walk(path.join(root, d))).filter(f => CODE.test(f) && !f.includes('node_modules'));
const fromTests = reach([...all.filter(f => isTest(rel(f))), ...tooling]);

const subjects = scoped.filter(f => !isTest(rel(f)));
const reached = subjects.filter(f => prod.has(f)).map(rel).sort();
const unreached = subjects.filter(f => !prod.has(f)).map(rel).sort();
const testOnly = unreached.filter(f => fromTests.has(path.join(root, f)));
const dead = unreached.filter(f => !fromTests.has(path.join(root, f)));

const args = process.argv.slice(2);
if (args.includes('--json')) {
  console.log(JSON.stringify({ reached, unreached, testOnly, dead }, null, 2));
  process.exit(0);
}

console.log(`Files under src/components and src/lib, tests excluded: ${subjects.length}`);
console.log(`Reached by import from the five built pages: ${reached.length}`);
console.log(`Not reached: ${unreached.length} (imported by a test or a script only: ${testOnly.length}; by nothing: ${dead.length})`);
const byDir = {};
for (const f of unreached) { const d = path.posix.dirname(f); (byDir[d] ??= []).push(path.posix.basename(f)); }
console.log('\nNot reached, by folder (* = a test or a script imports it):');
for (const d of Object.keys(byDir).sort()) {
  console.log(`  ${d}/`);
  for (const b of byDir[d]) console.log(`    ${testOnly.includes(`${d}/${b}`) ? '*' : ' '} ${b}`);
}

const i = args.indexOf('--check');
if (i >= 0) {
  const doc = fs.readFileSync(path.resolve(root, args[i + 1]), 'utf8');
  const named = [...new Set([...doc.matchAll(/`(src\/[^`\s]+)`/g)].map(m => m[1]))];
  const missing = named.filter(p => !fs.existsSync(path.join(root, p.replace(/\/\*?$/, ''))));
  // A row covers an unreached file when it names the file or a folder above it.
  const covered = f => named.some(n => { const k = n.replace(/\/\*?$/, ''); return f === k || f.startsWith(k + '/'); });
  const unnamed = unreached.filter(f => !covered(f));
  console.log(`\nCheck of ${args[i + 1]}: ${named.length} paths named.`);
  console.log(`Named paths that do not exist: ${missing.length}`);
  for (const m of missing) console.log(`    ${m}`);
  console.log(`Unreached files no row covers: ${unnamed.length}`);
  for (const u of unnamed) console.log(`    ${u}`);
  if (missing.length || unnamed.length) process.exit(1);
}
