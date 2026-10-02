// Serves build A, loads it with its service worker, swaps the site to build B (as a deploy does), lets the new
// worker take over, then asks the open page for build A's report-pdf chunk.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
const [A, B] = process.argv.slice(2);
let root = A;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.task': 'application/octet-stream' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/workout-vision/, '');
  if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p);
  if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(f));
}).listen(4190);
const oldChunk = readdirSync(join(A, 'assets')).find(f => f.startsWith('report-pdf-'));
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
const p = await (await b.newContext()).newPage();
await p.goto('http://127.0.0.1:4190/workout-vision/');
await p.evaluate(() => navigator.serviceWorker.ready);
await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30000 });
await p.waitForTimeout(3000); // precache done
root = B;  // the deploy
const changed = p.evaluate(() => new Promise(ok => navigator.serviceWorker.addEventListener('controllerchange', () => ok(true))));
await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
console.log('controller changed:', await Promise.race([changed, new Promise(r => setTimeout(() => r(false), 30000))]));
await p.waitForTimeout(1500);
const status = await p.evaluate(u => fetch(u).then(r => r.status, () => 'network error'), `/workout-vision/assets/${oldChunk}`);
console.log(`old ${oldChunk} from the open page: ${status}`);
await b.close(); server.close();
