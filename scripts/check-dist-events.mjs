// Whether a build sends the anonymous usage counts anywhere (src/lib/events.js; WP0.3 of docs/SPEC-production.md).
// deploy.yml pins VITE_EVENTS_URL to '' until David decides D6 (and WP2.3 gives the counts their notice): this check
// runs on the built site before it is published and fails when dist/ holds any events URL, so neither a forgotten
// repository variable nor a stray build setting can switch the counts on in production.
//
// Usage: VITE_EVENTS_URL=<the value the build was given> EVENTS_URL_VAR=<the repository variable, even unused>
//        node scripts/check-dist-events.mjs [dist]
// Prints the length of VITE_EVENTS_URL (never the value). Pinned empty, any events URL in dist/ fails. Once D6 sets
// it, only that URL's origin may appear, in the code and in the pages' connect-src.
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const TEXT = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.json', '.webmanifest', '.txt', '.svg', '.map', '.xml']);
// An events URL as the worker's README names it (https://<name>.<account>.workers.dev/event), or any URL whose path
// ends in /event, or the test build's address (playwright.config.js, events.invalid).
const PATTERNS = [/https?:\/\/[^\s"'`<>);]*\.workers\.dev[^\s"'`<>);]*/g, /https?:\/\/[^\s"'`<>);]+\/event(?![\w-])/g, /https?:\/\/events\.invalid[^\s"'`<>);]*/g];
// The pages' Content-Security-Policy as written in index.html: anything more in connect-src is a server the page may reach.
const CONNECT_SRC = "connect-src 'self' blob:";

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
    for (const m of text.matchAll(/connect-src [^;"]*/g)) if (m[0].trim() !== CONNECT_SRC) hits.add(m[0].trim());
    for (const found of hits) {
      if (allowed && (found === url || found.startsWith(allowed) || found === `${CONNECT_SRC} ${allowed}`)) continue;
      out.push({ file: rel, found });
    }
  }
  return out;
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
  console.log(`${dir}/: no events URL${url ? ' but the one this build was given' : ''}.`);
}
