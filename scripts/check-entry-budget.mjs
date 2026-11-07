#!/usr/bin/env node
// The first paint's budget, read from a production build (Phase 5 of David's order of 6 November 2026, PLAN.md):
// - the critical entry chunk, the page's module script and every chunk it imports statically, under 150 kB gzipped;
// - the page's stylesheet bundled whole: no @import left to block the paint;
// - public/boot.js named in <head> before any stylesheet, so the language is set before the first paint;
// - the Latin subsets of Geist and Instrument Serif italic preloaded in <head>, with crossorigin;
// - the service worker's install list (PRECACHE_ASSETS, scripts/inject-sw-precache.js) holding only the shell: the
//   critical chunks, the page's stylesheet, the Latin font subsets and the boot fallback (boot.js, cache-bust.js);
//   never a pose model, a WASM file or a file under mediapipe/.
// Gzip at zlib's default level (6), the level a static host commonly serves; kB are 1000 bytes.
// Run: node scripts/check-entry-budget.mjs [dist]. Prints a table, and exits 1 with the rules broken.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export const ENTRY_BUDGET_BYTES = 150_000;

/** The relative chunks a built chunk imports statically: `import … from "./x.js"`, `export … from "./x.js"`,
 *  `import "./x.js"`. A dynamic import("./x.js") is not one of them. */
export function staticImports(code) {
  const out = new Set();
  for (const m of code.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+?\.js)["']/g)) out.add(m[1]);
  for (const m of code.matchAll(/\bimport\s*["'](\.{1,2}\/[^"']+?\.js)["']/g)) out.add(m[1]);
  return [...out];
}

/** The attributes of the tags named `tag` in `html`, in document order, each with its offset. */
function tags(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))].map(m => {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    return { attrs, at: m.index };
  });
}

/** Everything the budget is measured on, from a built dist folder. */
export function readBuild(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const head = html.slice(0, html.search(/<\/head>/i));
  const scripts = tags(html, 'script');
  const links = tags(html, 'link');
  const entry = scripts.find(s => s.attrs.type === 'module' && s.attrs.src);
  if (!entry) throw new Error('index.html names no module script');
  // A built path (/workout-vision/assets/x.js) to its file in dist.
  const base = entry.attrs.src.slice(0, entry.attrs.src.indexOf('assets/'));
  const fileOf = href => join(dist, href.startsWith(base) ? href.slice(base.length) : href.replace(/^\//, ''));
  const chunks = [];
  const seen = new Set();
  const walk = file => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    chunks.push({ file, bytes: Buffer.byteLength(code), gzip: gzipSync(code).length });
    for (const rel of staticImports(code)) walk(resolve(file, '..', rel));
  };
  walk(fileOf(entry.attrs.src));
  const sheets = links.filter(l => l.attrs.rel === 'stylesheet').map(l => ({ ...l, file: fileOf(l.attrs.href) }));
  const preloads = links.filter(l => l.attrs.rel === 'preload' && l.attrs.as === 'font').map(l => ({ ...l, file: fileOf(l.attrs.href) }));
  const boot = scripts.find(s => /(?:^|\/)boot\.js$/.test(s.attrs.src || ''));
  const sw = existsSync(join(dist, 'sw.js')) ? readFileSync(join(dist, 'sw.js'), 'utf8') : '';
  const listed = sw.match(/const PRECACHE_ASSETS = (\[[\s\S]*?\]);/);
  return { html, head, base, entry, chunks, sheets, preloads, boot, precache: listed ? JSON.parse(listed[1]) : null, fileOf };
}

/** The rules the build breaks, as sentences; none when it keeps them all. */
export function check(build) {
  const broken = [];
  const total = build.chunks.reduce((n, c) => n + c.gzip, 0);
  if (total >= ENTRY_BUDGET_BYTES) broken.push(`the critical entry chunk is ${total} bytes gzipped, over ${ENTRY_BUDGET_BYTES}`);
  for (const s of build.sheets) {
    if (!existsSync(s.file)) {
      if (s.content && /@import\b/i.test(s.content)) broken.push(`${s.attrs.href} still holds an @import, which blocks the paint`);
      continue;
    }
    const css = readFileSync(s.file, 'utf8');
    if (/@import\b/i.test(css)) broken.push(`${s.attrs.href} still holds an @import, which blocks the paint`);
  }
  const firstSheet = build.sheets.length ? Math.min(...build.sheets.map(s => s.at)) : Infinity;
  if (!build.boot) broken.push('index.html does not name boot.js');
  else if (build.boot.at > build.head.length) broken.push('boot.js is not in <head>');
  else if (build.boot.at > firstSheet) broken.push('boot.js comes after a stylesheet in <head>');
  else if ('async' in build.boot.attrs || 'defer' in build.boot.attrs || build.boot.attrs.type === 'module') broken.push('boot.js does not run synchronously');
  for (const want of [/geist-latin-[\w-]+\.woff2$/, /instrument-serif-latin-400-italic-[\w-]+\.woff2$/]) {
    const p = build.preloads.find(l => want.test(l.attrs.href.split('/').pop()));
    if (!p) { broken.push(`no preload in <head> for ${want}`); continue; }
    if (p.at > build.head.length) broken.push(`${p.attrs.href} is preloaded outside <head>`);
    if (!('crossorigin' in p.attrs)) broken.push(`${p.attrs.href} is preloaded without crossorigin`);
    if (!existsSync(p.file)) broken.push(`${p.attrs.href} is preloaded but missing from the build`);
  }
  if (!build.precache) broken.push('sw.js holds no PRECACHE_ASSETS list');
  else {
    const allowed = new Set([
      ...build.chunks.map(c => c.file),
      ...build.sheets.map(s => s.file),
    ]);
    for (const url of build.precache) {
      const file = build.fileOf(url);
      const name = url.split('/').pop();
      if (/\.(task|wasm)$/.test(name) || url.includes('/mediapipe/')) { broken.push(`the install list holds a pose file: ${url}`); continue; }
      if (allowed.has(file)) continue;
      if (/-latin-(?:wght|\d{3})-(?:normal|italic)-[A-Za-z0-9_-]{8}\.woff2$/.test(name)) continue;
      if (name === 'boot.js' || name === 'cache-bust.js') continue;
      broken.push(`the install list holds a file outside the shell: ${url}`);
    }
    for (const c of build.chunks) if (!build.precache.some(u => build.fileOf(u) === c.file)) broken.push(`the install list misses a critical chunk: ${c.file}`);
  }
  return broken;
}

function report(build) {
  const kb = n => (n / 1000).toFixed(1).padStart(7);
  const rows = [...build.chunks].sort((a, b) => b.gzip - a.gzip);
  console.log('Critical entry chunk (page module script and its static imports):');
  for (const c of rows) console.log(`${kb(c.gzip)} kB gz ${kb(c.bytes)} kB  ${c.file.split('/').pop()}`);
  const total = rows.reduce((n, c) => n + c.gzip, 0);
  console.log(`${kb(total)} kB gz in all, budget ${ENTRY_BUDGET_BYTES / 1000} kB`);
  for (const s of build.sheets) {
    const css = readFileSync(s.file);
    console.log(`Stylesheet: ${kb(gzipSync(css).length)} kB gz ${kb(css.length)} kB  ${s.attrs.href}`);
  }
  for (const p of build.preloads) console.log(`Preloaded font: ${existsSync(p.file) ? kb(statSync(p.file).size) : '   missing'} kB  ${p.attrs.href}`);
  if (build.precache) {
    let bytes = 0;
    for (const u of build.precache) { const f = build.fileOf(u); if (existsSync(f)) bytes += statSync(f).size; }
    console.log(`Service worker install list: ${build.precache.length} files, ${kb(bytes)} kB on disk (before compression)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const dist = resolve(process.argv[2] || 'dist');
  const build = readBuild(dist);
  report(build);
  const broken = check(build);
  for (const b of broken) console.log(process.env.GITHUB_ACTIONS ? `::error title=First paint budget::${b}` : `BROKEN: ${b}`);
  if (broken.length) process.exit(1);
  console.log('First paint budget: every rule holds.');
}
