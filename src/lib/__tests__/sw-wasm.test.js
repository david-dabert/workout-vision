/**
 * MediaPipe's WASM files sit at unversioned addresses (/mediapipe/vision_wasm_internal.wasm). The worker keeps the
 * previous version's cache one deploy longer (sw-versions.test.js), so a lookup across every cache could hand a
 * new app the old library's WASM after a @mediapipe/tasks-vision upgrade (audit of 2 October). The files are
 * kept in a cache named by their own fingerprint, looked up there only, and older ones are dropped. The decoder's
 * WASM (/web-demuxer.wasm) is kept the same way since the third audit (C20).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const SRC = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8');
const WASM = 'https://app.test/workout-vision/mediapipe/vision_wasm_internal.wasm';
const DEMUXER = 'https://app.test/workout-vision/web-demuxer.wasm';

function worker(names, wasmHash) {
  const store = new Map(names.map(([n, entries]) => [n, new Map(entries)]));
  const cacheOf = name => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return { match: async k => (m.has(String(k.url ?? k)) ? new Response(m.get(String(k.url ?? k))) : undefined), put: async (k, r) => { m.set(String(k.url ?? k), await r.text()); }, addAll: async () => {} };
  };
  const caches = {
    open: async n => cacheOf(n), keys: async () => [...store.keys()], delete: async n => store.delete(n),
    match: async k => { for (const n of store.keys()) { const r = await cacheOf(n).match(k); if (r) return r; } return undefined; },
  };
  const listeners = {};
  const scope = { location: { origin: 'https://app.test' }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting() {}, clients: { claim() {} }, registration: {} };
  const code = SRC.replace("const CACHE_NAME = 'wv-v1';", "const CACHE_NAME = 'wv-vNEW';").replaceAll('__MODEL_SHA256__', 'abc').replaceAll('__WASM_HASH__', wasmHash).replaceAll('__SW_BASE__', '/workout-vision/');
  new Function('self', 'caches', 'fetch', 'crypto', 'Response', 'Request', code)(scope, caches, async () => new Response('new wasm'), webcrypto, Response, Request);
  const get = async url => { let p; listeners.fetch({ request: new Request(url), respondWith: r => { p = r; } }); return p ? (await p).text() : null; };
  const activate = async () => { let p; listeners.activate({ waitUntil: x => { p = x; } }); await p; return [...store.keys()].filter(k => k !== 'wv-meta').sort(); };
  return { get, activate, store };
}

describe('MediaPipe WASM across a library upgrade', () => {
  it('never hands the new app the old WASM still held in the previous version\'s cache', async () => {
    const w = worker([['wv-vOLD', [[WASM, 'old wasm']]], ['wv-wasm-old', [[WASM, 'old wasm']]]], 'new');
    expect(await w.get(WASM)).toBe('new wasm');
  });
  it('keeps the current WASM and serves it from its own cache, dropping older ones', async () => {
    const w = worker([['wv-wasm-old', [[WASM, 'old wasm']]], ['wv-wasm-new', [[WASM, 'kept wasm']]]], 'new');
    expect(await w.get(WASM)).toBe('kept wasm');
    expect(await w.activate()).toEqual(['wv-wasm-new']);
  });
});

describe('the decoder WASM across a web-demuxer upgrade', () => {
  it('never hands the new app the old decoder WASM still held in the previous version\'s cache', async () => {
    const w = worker([['wv-vOLD', [[DEMUXER, 'old wasm']]]], 'new');
    expect(await w.get(DEMUXER)).toBe('new wasm');
  });
  it('is kept in the fingerprinted cache once fetched, and served from it', async () => {
    const w = worker([['wv-wasm-new', [[DEMUXER, 'kept wasm']]]], 'new');
    expect(await w.get(DEMUXER)).toBe('kept wasm');
  });
});
