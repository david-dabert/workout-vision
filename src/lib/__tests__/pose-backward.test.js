/**
 * Backward pass (7 October; poseCrop.js keepLost, fillBackward; poseAnalysis.js detectPoseImage { backfill }).
 * A frame still without a pose after the forward pass is read again on a crop around the NEXT accepted pose; a frame
 * that has a pose never changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepLost, fillBackward, CROP_SEED_MS, BACK_KEEP_MS, BACK_MAX_FRAMES, BACK_PASS } from '../poseCrop';

const h = vi.hoisted(() => ({ script: [] }));
vi.mock('localforage', () => ({ default: { createInstance: () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, keys: async () => [] }) } }));
vi.mock('../gpuBenchmark', () => ({ detectCapabilities: async () => ({ recommendedDelegate: 'CPU' }), isSimdSupported: () => true }));
vi.mock('../model-hash', () => ({ MODEL_SHA256: 'abc', isTheModel: async () => true }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  // The crop canvas answers h.cropAnswer(source of the last drawImage); any other source answers from h.script.
  PoseLandmarker: { createFromOptions: async () => ({ detect: src => (src.isCrop ? h.cropAnswer(h.lastDrawn) : h.script.shift()) }) },
}));

const pose = (x0, x1, y0, y1, tag = 'w') => ({
  landmarks: [Array.from({ length: 33 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 32, y: y0 + ((y1 - y0) * i) / 32, z: 0.01 * i, visibility: 0.9 }))],
  worldLandmarks: [Array.from({ length: 33 }, (_, i) => ({ x: i, y: -i, z: 0, visibility: 0.9, tag }))],
});
const none = () => ({ landmarks: [], worldLandmarks: [] });

describe('backward seed selection (poseCrop.js)', () => {
  const f = t => ({ t });
  it('keeps the lost frames of the last BACK_KEEP_MS, at most BACK_MAX_FRAMES, in time order', () => {
    const lost = [0, 100, 900, 1000, 1500].map(f);
    const { kept, dropped } = keepLost(lost, 1600);
    expect(kept.map(x => x.t)).toEqual([900, 1000, 1500]);
    expect(dropped.map(x => x.t)).toEqual([0, 100]);
    expect(BACK_KEEP_MS).toBe(CROP_SEED_MS);
    const many = Array.from({ length: 40 }, (_, i) => f(i * 10));
    expect(keepLost(many, 400).kept).toHaveLength(BACK_MAX_FRAMES);
    expect(keepLost(many, 400).kept.at(-1).t).toBe(390);
    expect(keepLost([f(500)], 400).kept).toEqual([]);
  });
  it('reads nearest first, each found pose seeding the frame before it', () => {
    const seeds = [];
    const out = fillBackward([0, 100, 200].map(f), { landmarks: 'S', t: 300 }, (fr, seed) => { seeds.push([fr.t, seed]); return { landmarks: `L${fr.t}` }; });
    expect(seeds).toEqual([[200, 'S'], [100, 'L200'], [0, 'L100']]);
    expect(out.map(o => o.frame.t)).toEqual([200, 100, 0]);
  });
  it('a frame it cannot read keeps the seed; frames more than 1 s before the seed are not tried', () => {
    const tried = [];
    const out = fillBackward([0, 200, 500, 900].map(f), { landmarks: 'S', t: 1300 }, (fr, seed) => { tried.push([fr.t, seed]); return fr.t === 900 ? null : { landmarks: `L${fr.t}` }; });
    // 900 fails (seed stays S at 1300), 500 found (seed L500), 200 tried from L500 and found, 0 from L200.
    expect(tried).toEqual([[900, 'S'], [500, 'S'], [200, 'L500'], [0, 'L200']]);
    expect(out.map(o => o.frame.t)).toEqual([500, 200, 0]);
    const far = [];
    fillBackward([0, 100].map(f), { landmarks: 'S', t: 1200 }, fr => { far.push(fr.t); return null; });
    expect(far).toEqual([]);
  });
  it('never reads a frame at or after the seed', () => {
    const tried = [];
    fillBackward([100, 300, 400].map(f), { landmarks: 'S', t: 300 }, fr => { tried.push(fr.t); return null; });
    expect(tried).toEqual([100]);
  });
});

describe('the backward pass in detectPoseImage', () => {
  const frame = (k) => ({ width: 360, height: 640, k });
  beforeEach(() => {
    vi.resetModules();
    h.script = [];
    h.lastDrawn = null;
    h.cropAnswer = () => pose(0.25, 0.75, 0.1, 0.9, 'crop');
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('caches', { has: async () => false, open: async () => ({ match: async () => undefined }) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(6 * 1024 * 1024), { status: 200 })));
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(w, hh) { this.width = w; this.height = hh; this.isCrop = w === 256 && hh === 256; this.copyOf = null; }
      getContext() { return { clearRect() {}, drawImage: (src) => { if (this.isCrop) h.lastDrawn = src.copyOf ?? src.k; else this.copyOf = src.k; } }; }
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete globalThis.__WV_BENCH_BACK__; delete globalThis.__WV_BENCH_NO_BACK__; delete globalThis.__WV_BENCH_NO_CROP__; });

  // BACK_PASS is off in the app; the bench hook turns it on, as the benches do.
  async function run(answers, times, { backfill = true, noBack = false, benchOn = true } = {}) {
    if (benchOn) globalThis.__WV_BENCH_BACK__ = true;
    if (noBack) globalThis.__WV_BENCH_NO_BACK__ = true;
    globalThis.__WV_BENCH_NO_CROP__ = true; // no forward seed before the first pose anyway; keeps the crop calls to the backward pass
    const pa = await import('../poseAnalysis');
    const lm = await pa.getImageLandmarker();
    h.script = answers.map(a => a());
    return times.map((t, k) => pa.detectPoseImage(lm, frame(k), t, { backfill }));
  }

  it('fills the frames before the first pose, from the next pose, latest frame read first', async () => {
    const drawnOrder = [];
    h.cropAnswer = (k) => { drawnOrder.push(k); return pose(0.25, 0.75, 0.1, 0.9, `back${k}`); };
    const r = await run([none, none, () => pose(0.4, 0.6, 0.5, 0.55)], [0, 66.7, 133.3]);
    expect(r[0].landmarks).toEqual([]);
    expect(r[1].landmarks).toEqual([]);
    expect(drawnOrder).toEqual([1, 0]);
    expect(r[2].backfill.map(b => b.timestamp)).toEqual([0, 66.7]);
    expect(r[2].backfill.map(b => b.source)).toEqual(['back', 'back']);
    expect(r[2].backfill[0].worldLandmarks[0][0].tag).toBe('back0');
  });
  it('leaves every frame with a pose byte-identical, and is off without { backfill } or with the bench hook', async () => {
    const answers = [none, () => pose(0.4, 0.6, 0.5, 0.55), none, none, () => pose(0.41, 0.61, 0.5, 0.56)];
    const times = [0, 66.7, 133.3, 1300, 1366.7];
    const on = await run(answers, times);
    vi.resetModules();
    const off = await run(answers, times, { backfill: false });
    vi.resetModules();
    const hook = await run(answers, times, { noBack: true });
    for (const i of [1, 4]) {
      const { backfill: _backfill, ...rest } = on[i];
      expect(JSON.stringify(rest)).toBe(JSON.stringify(off[i]));
      expect(off[i].backfill).toBeUndefined();
      expect(hook[i].backfill).toBeUndefined();
    }
    expect(on[1].backfill.map(b => b.timestamp)).toEqual([0]);
    // 133.3 is more than 1 s before the pose at 1366.7: dropped, not read; 1300 is read.
    expect(on[4].backfill.map(b => b.timestamp)).toEqual([1300]);
  });
  it('is off in the app: BACK_PASS false and no bench hook, nothing read back', async () => {
    expect(BACK_PASS).toBe(false);
    const r = await run([none, () => pose(0.4, 0.6, 0.5, 0.55)], [0, 66.7], { benchOn: false });
    expect(r[1].backfill).toBeUndefined();
  });
  it('forgets the lost frames on a reset', async () => {
    const pa = await import('../poseAnalysis');
    globalThis.__WV_BENCH_BACK__ = true;
    globalThis.__WV_BENCH_NO_CROP__ = true;
    const lm = await pa.getImageLandmarker();
    h.script = [none(), pose(0.4, 0.6, 0.5, 0.55)];
    pa.detectPoseImage(lm, frame(0), 0, { backfill: true });
    pa.resetKalmanFilters();
    expect(pa.detectPoseImage(lm, frame(1), 66.7, { backfill: true }).backfill).toBeUndefined();
  });
});
