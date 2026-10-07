/**
 * Lifter lock (7 October; lifterLock.js, poseAnalysis.js detectPoseImage): with two poses asked, the one whose torso is
 * nearest the lifter's last torso is kept; a frame with one pose is returned as the model gave it; a bystander found
 * alone does not move the reference. Off in the app (LIFTER_LOCK); the bench hook __WV_BENCH_LOCK__ turns it on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { torsoOf, pickLifter, nextReference, LIFTER_LOCK, LOCK_STALE_MS } from '../lifterLock';

const h = vi.hoisted(() => ({ script: [], opts: null }));
vi.mock('localforage', () => ({ default: { createInstance: () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, keys: async () => [] }) } }));
vi.mock('../gpuBenchmark', () => ({ detectCapabilities: async () => ({ recommendedDelegate: 'CPU' }), isSimdSupported: () => true }));
vi.mock('../model-hash', () => ({ MODEL_SHA256: 'abc', isTheModel: async () => true }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  PoseLandmarker: { createFromOptions: async (_v, opts) => { h.opts = opts; return { detect: () => h.script.shift() }; } },
}));

// A body standing with its torso centred at (cx, cy) (normalised), 33 points; world landmarks tagged.
const body = (cx, cy, tag) => Array.from({ length: 33 }, (_, i) => ({ x: cx + (i % 2 ? 0.02 : -0.02), y: cy + (i >= 23 ? 0.08 : i >= 11 ? -0.08 : -0.15), z: 0, visibility: 0.9, tag }));
const world = tag => Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9, tag }));
const answer = (...people) => ({ landmarks: people.map(([cx, cy, tag]) => body(cx, cy, tag)), worldLandmarks: people.map(([, , tag]) => world(tag)) });
const frame = { width: 360, height: 640 };

describe('lifter geometry (lifterLock.js)', () => {
  it('the torso centre is the mean of shoulders and hips, in pixels', () => {
    const t = torsoOf(body(0.5, 0.5), 360, 640);
    expect(t.x).toBeCloseTo(180);
    expect(t.y).toBeCloseTo(320);
    expect(t.len).toBeCloseTo(0.16 * 640);
  });
  it('picks the pose nearest the reference, else the larger and more central one', () => {
    const near = body(0.3, 0.5), far = body(0.7, 0.5);
    expect(pickLifter([far, near], { x: 0.32 * 360, y: 320 }, 360, 640)).toBe(1);
    expect(pickLifter([far, near], { x: 0.68 * 360, y: 320 }, 360, 640)).toBe(0);
  });
  it('a single pose far from the reference does not move it, unless the reference is stale', () => {
    const ref = nextReference(null, body(0.3, 0.5), 360, 640, 0);
    expect(nextReference(ref, body(0.8, 0.5), 360, 640, 100)).toBe(ref);
    expect(nextReference(ref, body(0.31, 0.5), 360, 640, 100).x).toBeCloseTo(0.31 * 360);
    expect(nextReference(ref, body(0.8, 0.5), 360, 640, LOCK_STALE_MS + 1).x).toBeCloseTo(0.8 * 360);
  });
});

describe('the lock in detectPoseImage', () => {
  beforeEach(() => {
    vi.resetModules();
    h.script = [];
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('caches', { has: async () => false, open: async () => ({ match: async () => undefined }) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(6 * 1024 * 1024), { status: 200 })));
    vi.stubGlobal('OffscreenCanvas', class { constructor(w, hh) { this.width = w; this.height = hh; } getContext() { return { clearRect() {}, drawImage() {} }; } });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete globalThis.__WV_BENCH_LOCK__; });

  async function run(answers, lock) {
    if (lock) globalThis.__WV_BENCH_LOCK__ = true;
    const pa = await import('../poseAnalysis');
    const lm = await pa.getImageLandmarker();
    h.script = [...answers];
    return answers.map((_, i) => pa.detectPoseImage(lm, frame, i * 66.7));
  }

  it('is off in the app, and asks one pose', async () => {
    expect(LIFTER_LOCK).toBe(false);
    await run([answer([0.5, 0.5, 'a'])], false);
    expect(h.opts.numPoses).toBe(1);
  });
  it('asks two poses and keeps the lifter when the bystander is ranked first', async () => {
    const out = await run([
      answer([0.45, 0.5, 'lifter'], [0.8, 0.45, 'bystander']), // the first frame: the larger, more central body
      answer([0.8, 0.45, 'bystander'], [0.46, 0.52, 'lifter']),
      answer([0.47, 0.54, 'lifter']),
      answer([0.8, 0.45, 'bystander'], [0.47, 0.55, 'lifter']),
    ], true);
    expect(h.opts.numPoses).toBe(2);
    expect(out.map(r => r.worldLandmarks[0][0].tag)).toEqual(['lifter', 'lifter', 'lifter', 'lifter']);
    expect(out.every(r => r.landmarks.length === 1 && r.worldLandmarks.length === 1)).toBe(true);
  });
  it('returns a single pose as the model gave it, and a bystander alone does not become the lifter', async () => {
    const out = await run([
      answer([0.45, 0.5, 'lifter']),
      answer([0.8, 0.45, 'bystander']), // the lifter missed: the frame keeps what the model found
      answer([0.8, 0.45, 'bystander'], [0.46, 0.5, 'lifter']), // the reference stayed on the lifter
    ], true);
    expect(out.map(r => r.worldLandmarks[0][0].tag)).toEqual(['lifter', 'bystander', 'lifter']);
  });
});
