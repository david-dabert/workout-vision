/**
 * inject-sw-precache.js — Post-build script that injects hashed asset paths
 * into the service worker's precache list.
 *
 * Phase 5 of David's order of 6 November 2026 (PLAN.md):
 * Precache list strictly limited to the app shell: critical JS chunks,
 * the page's stylesheet, Latin font subsets, and boot scripts.
 * The remaining assets are injected as DEFERRED_ASSETS and warmed on lift selection.
 *
 * Run: node scripts/inject-sw-precache.js
 * Or automatically via postbuild npm script.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const SW_PATH = join(DIST, 'sw.js');
const ASSETS_DIR = join(DIST, 'assets');
const BASE = process.env.VERCEL ? '/' : (process.env.VITE_BASE || '/workout-vision/');

function staticImports(code) {
  const out = new Set();
  for (const m of code.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+?\.js)["']/g)) out.add(m[1]);
  for (const m of code.matchAll(/\bimport\s*["'](\.{1,2}\/[^"']+?\.js)["']/g)) out.add(m[1]);
  return [...out];
}

function getCriticalAssets(dist, base) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const entryMatch = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/i);
  if (!entryMatch) throw new Error('index.html names no module script');
  const entryHref = entryMatch[1];

  const fileOf = href => join(dist, href.startsWith(base) ? href.slice(base.length) : href.replace(/^\//, ''));
  const hrefOf = file => `${base}${file.slice(dist.length).replace(/^[/\\]+/, '').replace(/\\/g, '/')}`;

  const criticalHrefs = [];
  const seenFiles = new Set();

  function walk(file) {
    if (seenFiles.has(file)) return;
    seenFiles.add(file);
    criticalHrefs.push(hrefOf(file));
    const code = readFileSync(file, 'utf8');
    for (const rel of staticImports(code)) {
      walk(resolve(file, '..', rel));
    }
  }

  walk(fileOf(entryHref));

  for (const m of html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi)) {
    criticalHrefs.push(m[1]);
  }

  return criticalHrefs;
}

// Critical assets (entry module + its static imports + main stylesheet)
const criticalAssets = getCriticalAssets(DIST, BASE);

// The fonts, latin subset only, as woff2: Geist, Instrument Serif, etc.
const fontFiles = readdirSync(ASSETS_DIR)
  .filter(f => /-latin-(?:wght|\d{3})-(?:normal|italic)-[A-Za-z0-9_-]{8}\.woff2$/.test(f))
  .map(f => `${BASE}assets/${f}`);

// Also include boot.js and cache-bust.js if present
const rootScripts = ['boot.js', 'cache-bust.js']
  .filter(f => {
    try { statSync(join(DIST, f)); return true; } catch { return false; }
  })
  .map(f => `${BASE}${f}`);

const precacheEntries = [...criticalAssets, ...fontFiles, ...rootScripts];

// Deferred assets: all other built JS/CSS chunks not in the critical shell
const precacheSet = new Set(precacheEntries);
const deferredEntries = readdirSync(ASSETS_DIR)
  .filter(f => /\.(js|css)$/.test(f) && !/^(collect|pack|batchCollect)/i.test(f))
  .map(f => `${BASE}assets/${f}`)
  .filter(href => !precacheSet.has(href));

// Generate a cache version based on precache entries
const assetsHash = createHash('md5')
  .update(precacheEntries.sort().join('\n'))
  .digest('hex')
  .slice(0, 8);

const cacheName = `wv-v${assetsHash}`;

// Read the SW template
let sw = readFileSync(SW_PATH, 'utf-8');

// Inject PRECACHE_ASSETS and DEFERRED_ASSETS
const precacheBlock = `\n// ── Auto-injected by inject-sw-precache.js ──\nconst PRECACHE_ASSETS = ${JSON.stringify(precacheEntries, null, 2)};\nconst DEFERRED_ASSETS = ${JSON.stringify(deferredEntries, null, 2)};\n`;

// Replace the base path placeholder with the actual deployment base
sw = sw.replaceAll('__SW_BASE__', BASE);
const modelHash = createHash('sha256').update(readFileSync(join(DIST, 'mediapipe/pose_landmarker_full.task'))).digest('hex');
sw = sw.replaceAll('__MODEL_SHA256__', modelHash);
const wasmHash = createHash('sha256');
for (const f of readdirSync(join(DIST, 'mediapipe')).filter(f => !f.endsWith('.task')).sort()) wasmHash.update(f).update(readFileSync(join(DIST, 'mediapipe', f)));
wasmHash.update('web-demuxer.wasm').update(readFileSync(join(DIST, 'web-demuxer.wasm')));
sw = sw.replaceAll('__WASM_HASH__', wasmHash.digest('hex').slice(0, 16));

// Replace the static CACHE_NAME with the hashed version
sw = sw.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${cacheName}';`);

// Insert PRECACHE_ASSETS after the APP_SHELL closing bracket
sw = sw.replace(
  /^(const APP_SHELL = \[[\s\S]*?\];)/m,
  `$1${precacheBlock}`
);

// Modify the install handler to precache both APP_SHELL and PRECACHE_ASSETS
sw = sw.replace(
  /cache\.addAll\(fresh\(APP_SHELL\)\)/,
  'cache.addAll(fresh([...APP_SHELL, ...PRECACHE_ASSETS]))'
);

writeFileSync(SW_PATH, sw);

// ─── Build-time assertions ───
const written = readFileSync(SW_PATH, 'utf-8');

if (written.includes('__SW_BASE__')) {
  console.error('[inject-sw-precache] FATAL: __SW_BASE__ placeholder was not replaced');
  process.exit(1);
}
if (written.includes('__WASM_HASH__') || written.includes('__MODEL_SHA256__')) {
  console.error('[inject-sw-precache] FAIL: a fingerprint placeholder survived in the output');
  process.exit(1);
}
if (!written.includes(cacheName)) {
  console.error(`[inject-sw-precache] FATAL: CACHE_NAME '${cacheName}' not found in output SW`);
  process.exit(1);
}
if (!written.includes('PRECACHE_ASSETS')) {
  console.error('[inject-sw-precache] FATAL: PRECACHE_ASSETS block not found in output SW');
  process.exit(1);
}
if (!written.includes('fresh([...APP_SHELL, ...PRECACHE_ASSETS])')) {
  console.error('[inject-sw-precache] FATAL: cache.addAll() was not patched to include PRECACHE_ASSETS');
  process.exit(1);
}

// Verify each asset file referenced in the precache list actually exists in dist/
for (const entry of precacheEntries) {
  const relativePath = entry.replace(BASE, '');
  const fullPath = join(DIST, relativePath);
  try {
    statSync(fullPath);
  } catch {
    console.error(`[inject-sw-precache] FATAL: Precache entry '${entry}' references missing file: ${fullPath}`);
    process.exit(1);
  }
}

if (!fontFiles.length) {
  console.error('[inject-sw-precache] FATAL: no latin woff2 font found in dist/assets to precache');
  process.exit(1);
}

console.log(`[inject-sw-precache] Fonts precached (latin woff2): ${fontFiles.map(f => f.split('/').pop()).join(', ')}`);
console.log(`[inject-sw-precache] Injected ${precacheEntries.length} shell assets into SW precache, ${deferredEntries.length} deferred assets (cache: ${cacheName}) — all assertions passed`);
