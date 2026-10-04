/**
 * Third audit, 3 October 2026. The app's pose path (corePoseWorker.js → poseAnalysis.js):
 * - C48: the worker's image smoothing forgets an abandoned decoding pass when sample 0 comes again, and a CPU-only
 *   landmarker does not run the WebGPU/WebNN probe whose answer it never reads.
 * - C49: the model is kept once on the phone: no IndexedDB copy when the service worker's store holds it, and a copy
 *   kept under an older key is dropped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  store: new Map(),
  detectCapabilities: vi.fn(async () => ({ recommendedDelegate: 'GPU', webgl2: true })),
  createFromOptions: vi.fn(async () => ({ detect: () => ({ landmarks: [], worldLandmarks: [] }) })),
}));

vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      getItem: async k => h.store.get(k) ?? null,
      setItem: async (k, v) => { h.store.set(k, v); },
      removeItem: async k => { h.store.delete(k); },
      keys: async () => [...h.store.keys()],
    }),
  },
}));
vi.mock('../gpuBenchmark', () => ({ detectCapabilities: h.detectCapabilities, isSimdSupported: () => true }));
vi.mock('../model-hash', () => ({ MODEL_SHA256: 'abc', isTheModel: async () => true }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  PoseLandmarker: { createFromOptions: h.createFromOptions },
}));

const KEY = 'pose-landmarker-full-v2-0.10.35';
const BIG = () => new ArrayBuffer(6 * 1024 * 1024);
const flush = () => new Promise(r => setTimeout(r, 0));

/** A Cache Storage that holds the model in the service worker's store, or nothing. */
function stubCaches(held) {
  vi.stubGlobal('caches', {
    has: async name => held && name === 'wv-model-abc',
    open: async () => ({ match: async () => (held ? new Response('m') : undefined) }),
  });
}

beforeEach(() => {
  h.store.clear();
  vi.resetModules();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(16), { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the pose model kept on the phone (C49)', () => {
  it('is not copied to IndexedDB when the service worker keeps it', async () => {
    stubCaches(true);
    const { fetchModelBuffer } = await import('../poseAnalysis');
    await fetchModelBuffer();
    await flush();
    expect(h.store.has(KEY)).toBe(false);
  });
  it('is copied to IndexedDB when no service worker keeps it', async () => {
    stubCaches(false);
    const { fetchModelBuffer } = await import('../poseAnalysis');
    await fetchModelBuffer();
    await flush();
    expect(h.store.has(KEY)).toBe(true);
  });
  it('drops a copy kept under an older key, and the IndexedDB copy once the service worker keeps it', async () => {
    stubCaches(true);
    h.store.set('pose-landmarker-full-v1-0.10.8', BIG());
    h.store.set(KEY, BIG());
    const { fetchModelBuffer } = await import('../poseAnalysis');
    expect((await fetchModelBuffer()).byteLength).toBe(6 * 1024 * 1024);
    await flush();
    expect([...h.store.keys()]).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the IndexedDB copy as the offline fallback without a service worker', async () => {
    stubCaches(false);
    h.store.set(KEY, BIG());
    const { fetchModelBuffer } = await import('../poseAnalysis');
    await fetchModelBuffer();
    await flush();
    expect([...h.store.keys()]).toEqual([KEY]);
  });
});

describe('the CPU-only landmarker (C48)', () => {
  it('skips the device probe', async () => {
    stubCaches(true);
    const { getImageLandmarker } = await import('../poseAnalysis');
    await getImageLandmarker();
    expect(h.detectCapabilities).not.toHaveBeenCalled();
    expect(h.createFromOptions.mock.calls[0][1].baseOptions.delegate).toBe('CPU');
  });
});

describe('the app pose worker (C48)', () => {
  it('resets the image smoothing whenever sample 0 arrives', async () => {
    const reset = vi.fn();
    vi.doMock('../poseAnalysis', () => ({
      getImageLandmarker: async () => ({}),
      detectPoseImage: () => ({ landmarks: [[]], worldLandmarks: [[]] }),
      resetKalmanFilters: reset,
    }));
    const posted = [];
    vi.stubGlobal('self', { postMessage: m => posted.push(m) });
    vi.stubGlobal('OffscreenCanvas', class { constructor(w, hh) { this.width = w; this.height = hh; } getContext() { return { putImageData() {} }; } });
    vi.stubGlobal('ImageData', class { constructor(d, w, hh) { Object.assign(this, { d, w, hh }); } });
    await import('../corePoseWorker');
    const frame = (id, timestamp) => self.onmessage({ data: { id, width: 2, height: 2, pixels: new Uint8ClampedArray(16).buffer, timestamp } });
    await self.onmessage({ data: { type: 'init', id: 0 } });
    await frame(1, 0); await frame(2, 1000 / 15); await frame(3, 2000 / 15);
    await frame(4, 0); await frame(5, 1000 / 15);
    expect(reset).toHaveBeenCalledTimes(2);
    expect(posted.filter(m => m.error)).toEqual([]);
    vi.doUnmock('../poseAnalysis');
  });
});
