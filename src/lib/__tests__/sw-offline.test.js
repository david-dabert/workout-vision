/**
 * Offline, the worker answers from the current version first (audit of 3 October): the previous version's cache,
 * kept one deploy longer (sw-versions.test.js), holds the same page address, and a lookup across every cache
 * found the older one first, so an offline phone opened the previous version. A network that hangs falls back to
 * the page kept, rather than a blank screen.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const SRC = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8');
const PAGE = 'https://app.test/workout-vision/';

function worker(caches_, net) {
  const store = new Map(caches_.map(([n, e]) => [n, new Map(e)])); // insertion order = creation order
  const cacheOf = name => { if (!store.has(name)) store.set(name, new Map()); const m = store.get(name); const key = k => String(k.url ?? k).replace(/^\/workout-vision\//, 'https://app.test/workout-vision/'); return { match: async k => (m.has(key(k)) ? new Response(m.get(key(k))) : undefined), put: async (k, r) => { m.set(key(k), await r.text()); }, addAll: async () => {} }; };
  const caches = { open: async n => cacheOf(n), keys: async () => [...store.keys()], delete: async n => store.delete(n), match: async k => { for (const n of store.keys()) { const r = await cacheOf(n).match(k); if (r) return r; } return undefined; } };
  const listeners = {};
  const scope = { location: { origin: 'https://app.test' }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting() {}, clients: { claim() {} }, registration: {} };
  const code = SRC.replace("const CACHE_NAME = 'wv-v1';", "const CACHE_NAME = 'wv-vNEW';").replaceAll('__MODEL_SHA256__', 'abc').replaceAll('__WASM_HASH__', 'w').replaceAll('__SW_BASE__', '/workout-vision/');
  new Function('self', 'caches', 'fetch', 'crypto', 'Response', 'Request', 'setTimeout', code)(scope, caches, net, webcrypto, Response, Request, (f, ms) => setTimeout(f, Math.min(ms, 50)));
  return url => new Promise((ok, ko) => { const req = new Request(url); Object.defineProperty(req, 'mode', { value: 'navigate' }); listeners.fetch({ request: req, respondWith: p => Promise.resolve(p).then(r => r.text()).then(ok, ko) }); });
}

describe('the page offline', () => {
  it('is the current version\'s, not the previous one still kept', async () => {
    const get = worker([['wv-vOLD', [[PAGE, 'old page']]], ['wv-vNEW', [[PAGE, 'new page']]]], async () => { throw new TypeError('offline'); });
    expect(await get(PAGE)).toBe('new page');
  });
  it('comes from the cache when the network hangs, not after it', async () => {
    const get = worker([['wv-vNEW', [[PAGE, 'kept page']]]], () => new Promise(() => {}));
    expect(await get(PAGE)).toBe('kept page');
  });
  it('is the network\'s when the network answers', async () => {
    const get = worker([['wv-vNEW', [[PAGE, 'kept page']]]], async () => new Response('fresh page'));
    expect(await get(PAGE)).toBe('fresh page');
  });
});
