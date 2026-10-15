// Whether a build sends the anonymous usage counts anywhere (src/lib/events.js; WP0.3 of docs/SPEC-production.md).
// deploy.yml passes the repository variable VITE_EVENTS_URL (D6, 15 October 2026; WP2.3): unset, the app sends nothing,
// and this check, run on the built site before it is published, fails when dist/ holds any events URL. Set, only that
// URL's origin may appear, and the built notice of the counts (UsageNotice.jsx) must name its host (PRIV-3).
//
// Usage: VITE_EVENTS_URL=<the value the build was given> EVENTS_URL_VAR=<the repository variable, even unused>
//        node scripts/check-dist-events.mjs [dist]
// Prints the length of VITE_EVENTS_URL (never the value). Empty, any events URL in dist/ fails. Set, only that URL's
// origin may appear, in the code and in the pages' connect-src, and the notice's chunk must name its host.
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const TEXT = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.json', '.webmanifest', '.txt', '.svg', '.map', '.xml']);
// An events URL as the worker's README names it (https://<name>.<account>.workers.dev/event), or any URL whose path
// ends in /event, or the test build's address (playwright.config.js, events.invalid).
const PATTERNS = [/https?:\/\/[^\s"'`<>);]*\.workers\.dev[^\s"'`<>);]*/g, /https?:\/\/[^\s"'`<>);]+\/event(?![\w-])/g, /https?:\/\/events\.invalid[^\s"'`<>);]*/g];
// The pages' Content-Security-Policy as written: anything more in connect-src is a server the page may reach. The app's
// page (index.html) also names Open Food Facts, for the office's barcode lookup (src/lib/openFoodFacts.js, 14 October
// 2026): that origin, and only it, is taken out before the comparison; it is no events server.
const CONNECT_SRC = "connect-src 'self' blob:";
const LOOKUP_ORIGINS = ['https://world.openfoodfacts.org'];
const withoutLookups = src => LOOKUP_ORIGINS.reduce((s, o) => s.replace(` ${o}`, ''), src);

// The notice of the counts (src/components/experience/UsageNotice.jsx) carries this marker in its built chunk.
const NOTICE_MARKER = 'wv-usage-notice';

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else if (TEXT.has(extname(e.name))) yield p;
  }
}

/**
 * What in dir points at an events server: [{ file, found }], file relative to dir. url: the value the build was given
 * ('' when pinned off), whose origin is then allowed; known: other values to look for verbatim (the repository variable).
 */
export async function findEventsUrls(dir, { url = '', known = [] } = {}) {
  const allowed = url ? new URL(url).origin : null;
  const literal = [url, ...known].filter(Boolean);
  const out = [];
  for await (const file of files(dir)) {
    const text = await readFile(file, 'utf8');
    const rel = relative(dir, file);
    const hits = new Set();
    for (const re of PATTERNS) for (const m of text.matchAll(re)) hits.add(m[0]);
    for (const k of literal) if (text.includes(k)) hits.add(k);
    for (const m of text.matchAll(/connect-src [^;"]*/g)) if (withoutLookups(m[0].trim()) !== CONNECT_SRC) hits.add(withoutLookups(m[0].trim()));
    for (const found of hits) {
      if (allowed && (found === url || found.startsWith(allowed) || found === `${CONNECT_SRC} ${allowed}`)) continue;
      out.push({ file: rel, found });
    }
  }
  return out;
}

/**
 * PRIV-3: the built notice names the host the counts go to. Returns the notice's chunks that do not name it, or
 * [{ file: null }] when no chunk carries the notice at all. Nothing to check when the build names no server.
 */
export async function noticeMissingHost(dir, url = '') {
  if (!url) return [];
  const host = new URL(url).host;
  const notices = [];
  for await (const file of files(dir)) {
    if (!/\.m?js$/.test(file)) continue;
    const text = await readFile(file, 'utf8');
    if (text.includes(NOTICE_MARKER)) notices.push({ file: relative(dir, file), names: text.includes(host) });
  }
  if (!notices.length) return [{ file: null }];
  return notices.filter(n => !n.names).map(n => ({ file: n.file }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist';
  const url = process.env.VITE_EVENTS_URL || '';
  const known = [process.env.EVENTS_URL_VAR || ''];
  console.log(`VITE_EVENTS_URL length: ${url.length}`);
  const found = await findEventsUrls(dir, { url, known });
  if (found.length) {
    console.error(`${dir}/ holds ${url ? 'an events URL other than the one this build was given' : 'an events URL while VITE_EVENTS_URL is pinned empty (D6)'}:`);
    // The repository variable is not printed: its length only.
    for (const f of found) console.error(`  ${f.file}: ${known.includes(f.found) ? `the repository variable (length ${f.found.length})` : f.found}`);
    process.exit(1);
  }
  const missing = await noticeMissingHost(dir, url);
  if (missing.length) {
    console.error(`${dir}/: the notice of the counts does not name their host (PRIV-3):`);
    for (const m of missing) console.error(`  ${m.file ?? 'no built chunk carries the notice'}`);
    process.exit(1);
  }
  console.log(`${dir}/: no events URL${url ? ' but the one this build was given, and the notice names its host' : ''}.`);
}
