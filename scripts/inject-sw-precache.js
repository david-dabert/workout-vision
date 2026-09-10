/**
 * inject-sw-precache.js — Post-build script that injects hashed asset paths
 * into the service worker's precache list.
 *
 * Problem: The SW installs and precaches only the APP_SHELL (HTML, icons).
 * Hashed JS/CSS chunks are loaded by the browser BEFORE the SW activates,
 * so the SW never intercepts those fetches. Going offline after first load
 * means those chunks 404 → black screen.
 *
 * Solution: After Vite builds to dist/, read the hashed filenames from
 * dist/assets/, inject them into dist/sw.js's precache array, and bump
 * the cache version so returning users get the new SW.
 *
 * Run: node scripts/inject-sw-precache.js
 * Or automatically via postbuild npm script.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const SW_PATH = join(DIST, 'sw.js');
const ASSETS_DIR = join(DIST, 'assets');
const BASE = process.env.VITE_BASE || '/workout-vision/';

// Read all built assets
const assetFiles = readdirSync(ASSETS_DIR)
  .filter(f => /\.(js|css)$/.test(f))
  .map(f => `${BASE}assets/${f}`);

// Also include boot.js and cache-bust.js if present
const rootScripts = ['boot.js', 'cache-bust.js']
  .filter(f => {
    try { statSync(join(DIST, f)); return true; } catch { return false; }
  })
  .map(f => `${BASE}${f}`);

const precacheEntries = [...assetFiles, ...rootScripts];

// Generate a cache version based on asset hashes
const assetsHash = createHash('md5')
  .update(precacheEntries.sort().join('\n'))
  .digest('hex')
  .slice(0, 8);

const cacheName = `wv-v${assetsHash}`;

// Read the SW template
let sw = readFileSync(SW_PATH, 'utf-8');

// Inject the asset precache list after the APP_SHELL array
const precacheBlock = `\n// ── Auto-injected by inject-sw-precache.js ──\nconst PRECACHE_ASSETS = ${JSON.stringify(precacheEntries, null, 2)};\n`;

// Replace the base path placeholder with the actual deployment base
sw = sw.replaceAll('__SW_BASE__', BASE);

// Replace the static CACHE_NAME with the hashed version
sw = sw.replace(/const CACHE_NAME = '[^']+';/, `const CACHE_NAME = '${cacheName}';`);

// Insert PRECACHE_ASSETS after the APP_SHELL closing bracket
sw = sw.replace(
  /^(const APP_SHELL = \[[\s\S]*?\];)/m,
  `$1${precacheBlock}`
);

// Modify the install handler to precache both APP_SHELL and PRECACHE_ASSETS
sw = sw.replace(
  /cache\.addAll\(APP_SHELL\)/,
  'cache.addAll([...APP_SHELL, ...PRECACHE_ASSETS])'
);

writeFileSync(SW_PATH, sw);

// ─── Build-time assertions ───
// Verify the injection actually worked. A silent failure here would deploy
// an SW without precache, breaking offline mode.
const written = readFileSync(SW_PATH, 'utf-8');

if (written.includes('__SW_BASE__')) {
  console.error('[inject-sw-precache] FATAL: __SW_BASE__ placeholder was not replaced');
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
if (!written.includes('...APP_SHELL, ...PRECACHE_ASSETS')) {
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

console.log(`[inject-sw-precache] Injected ${precacheEntries.length} assets into SW (cache: ${cacheName}) — all assertions passed`);
