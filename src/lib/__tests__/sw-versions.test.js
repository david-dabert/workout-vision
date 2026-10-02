/**
 * The service worker keeps the previous version's files (public/sw.js, activate). On 2 October David's report
 * said "The PDF could not be prepared": the page open since before the deploy asked for its own report-pdf
 * chunk, which the new worker had deleted with the old cache and the site no longer served. The previous
 * version's cache now stays until the next deploy, so a page open across one deploy can finish its work.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const SRC = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8');

/** Runs the worker's activate (its install has already created the cache of `version`) with cache `version` over the given caches; returns the names left. */
async function activate(version, names, meta = null) {
  const store = new Map(names.map(n => [n, new Map()]));
  if (meta) store.set('wv-meta', new Map([['list', JSON.stringify(meta)]]));
  const cacheOf = name => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name);
    return {
      match: async k => (m.has(String(k)) ? new Response(m.get(String(k))) : undefined),
      put: async (k, r) => { m.set(String(k), await r.text()); },
      addAll: async () => {},
    };
  };
  const caches = { open: async n => cacheOf(n), keys: async () => [...store.keys()], delete: async n => store.delete(n), match: async () => undefined };
  const listeners = {};
  const scope = { location: { origin: 'https://app.test' }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting() {}, clients: { claim() {} }, registration: {} };
  const code = SRC.replace("const CACHE_NAME = 'wv-v1';", `const CACHE_NAME = '${version}';`).replaceAll('__MODEL_SHA256__', 'abc').replaceAll('__SW_BASE__', '/workout-vision/');
  new Function('self', 'caches', 'fetch', 'crypto', 'Response', 'Request', code)(scope, caches, async () => new Response(''), webcrypto, Response, Request);
  let done = null;
  listeners.activate({ waitUntil: p => { done = p; } });
  await done;
  return [...store.keys()].filter(k => k !== 'wv-meta').sort();
}

describe('the service worker across deploys', () => {
  it('keeps the version before it and drops the older ones', async () => {
    expect(await activate('wv-vC', ['wv-vA', 'wv-vB', 'wv-vC', 'wv-model-abc'], ['wv-vA', 'wv-vB'])).toEqual(['wv-model-abc', 'wv-vB', 'wv-vC']);
  });
  it('the first time, with no list yet, keeps only itself', async () => {
    expect(await activate('wv-vB', ['wv-vA', 'wv-vB', 'wv-model-abc'])).toEqual(['wv-model-abc', 'wv-vB']);
  });
  it('drops a model cache of another fingerprint', async () => {
    expect(await activate('wv-vB', ['wv-vB', 'wv-model-old', 'wv-model-abc'], ['wv-vB'])).toEqual(['wv-model-abc', 'wv-vB']);
  });
  it('a second activation of the same version changes nothing', async () => {
    expect(await activate('wv-vC', ['wv-vB', 'wv-vC', 'wv-model-abc'], ['wv-vB', 'wv-vC'])).toEqual(['wv-model-abc', 'wv-vB', 'wv-vC']);
  });
});
