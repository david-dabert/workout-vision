/**
 * An update, as a visitor meets it. Build A is open on the phone; build B is
 * deployed. B's service worker must store B's page, never the browser's cached
 * copy of A's, and once the browser has let A's files go, the app must still
 * open offline, as B.
 *
 *   npm run build && node test/real-phone/wave2/sw-update/update.mjs
 *
 * A and B are made from dist/: B renames the entry script, as a deploy of new
 * code does, and gets its worker injected afresh from public/sw.js. A stand-in
 * server keeps every file ten minutes, as GitHub Pages does. Offline means the
 * server is stopped: the browser's offline switch does not reach the worker.
 */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve } from 'node:path';

const dir = 'test/real-phone/wave2/sw-update';
if (!existsSync('dist/sw.js')) throw new Error('No dist/: run npm run build first.');
const work = mkdtempSync(join(tmpdir(), 'wv-update-'));
const BASE = '/workout-vision/';

// Build A is dist/ as it stands; build B is a later deploy.
for (const label of ['A', 'B']) {
  const root = join(work, label);
  cpSync('dist', join(root, 'dist'), { recursive: true });
  let html = readFileSync(join(root, 'dist/index.html'), 'utf8').replace('<head>', `<head><!-- build ${label} -->`);
  if (label === 'B') {
    const entry = html.match(/src="\/workout-vision\/assets\/([^"]+\.js)"/)[1];
    const next = entry.replace(/-[A-Za-z0-9_-]{8}\.js$/, '-Bdeploy2.js');
    renameSync(join(root, 'dist/assets', entry), join(root, 'dist/assets', next));
    html = html.replace(entry, next);
    cpSync('public/sw.js', join(root, 'dist/sw.js'));
    mkdirSync(join(root, 'scripts'), { recursive: true });
    cpSync('scripts/inject-sw-precache.js', join(root, 'scripts/inject-sw-precache.js'));
    writeFileSync(join(root, 'dist/index.html'), html);
    execFileSync('node', ['scripts/inject-sw-precache.js'], { cwd: root, stdio: 'ignore' });
  } else {
    writeFileSync(join(root, 'dist/index.html'), html);
  }
}

let live = 'A';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.webp': 'image/webp' };
function handler(req, res) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith(BASE)) { res.writeHead(404); res.end(); return; }
  let file = join(work, live, 'dist', path.slice(BASE.length));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
  const body = readFileSync(file), etag = '"' + createHash('sha1').update(body).digest('hex') + '"';
  const headers = { 'Cache-Control': 'max-age=600', ETag: etag, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); res.end(); return; }
  res.writeHead(200, headers); res.end(body);
}
let server = null;
const up = () => new Promise(r => { server = createServer(handler); server.listen(4190, '127.0.0.1', r); });
const down = () => new Promise(r => { server.closeAllConnections(); server.close(r); });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 664 }, serviceWorkers: 'allow' });
await context.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });
const page = await context.newPage();
const url = `http://127.0.0.1:4190${BASE}`;
const build = () => page.evaluate(() => (document.documentElement.outerHTML.match(/<!-- build (\w) -->/) || [])[1] || 'none').catch(() => 'none');
const mounted = () => page.locator('.altar').first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
// Which build's page each of the worker's caches holds (caches.match never creates a cache).
const stored = () => page.evaluate(async () => {
  const out = {};
  for (const name of await caches.keys()) {
    const hit = await caches.match('/workout-vision/', { cacheName: name });
    if (hit) out[name] = ((await hit.text()).match(/<!-- build (\w) -->/) || [])[1] || '?';
  }
  return out;
});
const report = {};
try {
  await up();
  await page.goto(url);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20_000 });
  await page.waitForTimeout(2000);
  report.first = { page: await build(), mounted: await mounted(), stored: await stored() };

  live = 'B'; // the deploy
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await page.waitForTimeout(4000);
  report.afterDeploy = { stored: await stored() };

  await page.goto('about:blank');
  await page.goto(url);
  report.reopenedOnline = { page: await build(), mounted: await mounted() };

  // Later, offline, once the browser's own cache has let the old files go.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.clearBrowserCache');
  await down();
  await page.goto('about:blank');
  await page.goto(url).catch(() => {});
  report.reopenedOffline = { page: await build(), mounted: await mounted() };
} finally {
  await browser.close();
  if (server?.listening) await down();
}

const pages = Object.values(report.afterDeploy?.stored || {});
report.result = pages.includes('B') && !pages.includes('A')
  && report.reopenedOnline?.page === 'B' && report.reopenedOnline.mounted
  && report.reopenedOffline?.page === 'B' && report.reopenedOffline.mounted ? 'PASS' : 'FAIL';
report.swSha256 = createHash('sha256').update(readFileSync('public/sw.js')).digest('hex');
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.result === 'PASS' ? 0 : 1;
