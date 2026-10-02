/**
 * The service worker's pose-model route (public/sw.js): keeping the model offline is a convenience, so a phone
 * that refuses to open, read or fill the store (little space left, private browsing) still hands the verified
 * download to the analysis; a download whose fingerprint differs is still refused (review of 2 October).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';

const SRC = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8');
const MODEL = new TextEncoder().encode('pose model bytes');
const MODEL_URL = 'https://app.test/workout-vision/mediapipe/pose_landmarker_full.task';

async function sha256(bytes) {
  return [...new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** The worker run in a fake scope; returns what its fetch handler answers for the model. */
async function modelResponse({ open = 'ok', match = 'ok', put = 'ok', body = MODEL } = {}) {
  const hash = await sha256(MODEL);
  const listeners = {};
  const store = {
    match: async () => { if (match === 'throw') throw new Error('read refused'); return undefined; },
    put: async () => { if (put === 'throw') throw new DOMException('full', 'QuotaExceededError'); },
  };
  const scope = {
    location: { origin: 'https://app.test' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting() {}, clients: { claim() {} },
    registration: {},
  };
  const caches = { open: async () => { if (open === 'throw') throw new DOMException('denied', 'SecurityError'); return store; }, match: async () => undefined, keys: async () => [] };
  const fetch = async () => new Response(body, { status: 200 });
  const code = SRC.replaceAll('__MODEL_SHA256__', hash).replaceAll('__SW_BASE__', '/workout-vision/');
  new Function('self', 'caches', 'fetch', 'crypto', 'Response', 'Request', code)(scope, caches, fetch, webcrypto, Response, Request);
  let answer = null;
  listeners.fetch({ request: new Request(MODEL_URL), respondWith: p => { answer = p; } });
  return answer;
}

describe('the pose model through the service worker', () => {
  it('is handed over when the store accepts it', async () => {
    const r = await modelResponse();
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(MODEL);
  });
  it('is handed over when the store refuses to keep it', async () => {
    const r = await modelResponse({ put: 'throw' });
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(MODEL);
  });
  it('is handed over when the store cannot be opened', async () => {
    const r = await modelResponse({ open: 'throw' });
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(MODEL);
  });
  it('is handed over when the store cannot be read', async () => {
    const r = await modelResponse({ match: 'throw' });
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(MODEL);
  });
  it('is refused when its fingerprint differs', async () => {
    await expect(modelResponse({ body: new TextEncoder().encode('another file') })).rejects.toThrow(/integrity/);
  });
});
