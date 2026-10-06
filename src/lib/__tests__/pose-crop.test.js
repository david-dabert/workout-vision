/**
 * Second look on a lost frame (audit of 6 October, action 3; poseCrop.js, poseAnalysis.js detectPoseImage).
 * A frame the whole-frame pass reads is unchanged; a lost frame within CROP_SEED_MS of the last pose is read again
 * on a square crop around it, and its landmarks come back in whole-frame coordinates, marked source 'crop'.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cropAround, mapFromCrop, CROP_PX, CROP_SCALE, CROP_MIN_SIDE_PX } from '../poseCrop';

const h = vi.hoisted(() => ({ script: [] }));
vi.mock('localforage', () => ({ default: { createInstance: () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, keys: async () => [] }) } }));
vi.mock('../gpuBenchmark', () => ({ detectCapabilities: async () => ({ recommendedDelegate: 'CPU' }), isSimdSupported: () => true }));
vi.mock('../model-hash', () => ({ MODEL_SHA256: 'abc', isTheModel: async () => true }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  // detect() answers from h.script: the frame's own answer, or the crop's when the crop canvas is read.
  PoseLandmarker: { createFromOptions: async () => ({ detect: src => (src.isCrop ? h.cropAnswer() : h.script.shift()) }) },
}));

// A pose whose 33 points span the box [x0, x1] x [y0, y1] (normalised), with world landmarks tagged.
const pose = (x0, x1, y0, y1, tag = 'w') => ({
  landmarks: [Array.from({ length: 33 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 32, y: y0 + ((y1 - y0) * i) / 32, z: 0.01 * i, visibility: 0.9 }))],
  worldLandmarks: [Array.from({ length: 33 }, (_, i) => ({ x: i, y: -i, z: 0, visibility: 0.9, tag }))],
});
const none = () => ({ landmarks: [], worldLandmarks: [] });
const frame = { width: 360, height: 640 };

let drawn;
beforeEach(() => {
  vi.resetModules();
  drawn = [];
  h.script = [];
  h.cropAnswer = () => pose(0.25, 0.75, 0.1, 0.9, 'crop');
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.stubGlobal('caches', { has: async () => false, open: async () => ({ match: async () => undefined }) });
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(6 * 1024 * 1024), { status: 200 })));
  vi.stubGlobal('OffscreenCanvas', class { constructor(w, hh) { this.width = w; this.height = hh; this.isCrop = true; } getContext() { return { clearRect() {}, drawImage: (...a) => drawn.push(a.slice(1)) }; } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete globalThis.__WV_BENCH_NO_CROP__; });

async function run(answers, times, { noCrop = false } = {}) {
  if (noCrop) globalThis.__WV_BENCH_NO_CROP__ = true;
  const pa = await import('../poseAnalysis');
  const lm = await pa.getImageLandmarker();
  h.script = answers.map(a => a());
  return times.map(t => pa.detectPoseImage(lm, frame, t));
}

describe('crop geometry (poseCrop.js)', () => {
  it('a square of CROP_SCALE x the box, centred on it, inside the frame', () => {
    const box = cropAround(pose(0.4, 0.6, 0.5, 0.55).landmarks[0], 360, 640);
    const side = CROP_SCALE * Math.max(0.2 * 360, 0.05 * 640);
    expect(box.side).toBeCloseTo(side);
    expect(box.sx + box.side / 2).toBeCloseTo(180);
    expect(box.sy + box.side / 2).toBeCloseTo(0.525 * 640);
  });
  it('clamped to the frame, and never below CROP_MIN_SIDE_PX', () => {
    const edge = cropAround(pose(0.9, 1.2, 0.0, 0.4).landmarks[0], 360, 640);
    expect(edge.side).toBeLessThanOrEqual(360);
    expect(edge.sx + edge.side).toBeLessThanOrEqual(360);
    expect(edge.sy).toBeGreaterThanOrEqual(0);
    expect(cropAround(pose(0.5, 0.501, 0.5, 0.501).landmarks[0], 360, 640).side).toBe(CROP_MIN_SIDE_PX);
  });
  it('maps crop coordinates back to the frame', () => {
    const [p] = mapFromCrop([{ x: 0.5, y: 0.25, z: 0.1, visibility: 0.7 }], { sx: 100, sy: 200, side: 80 }, 360, 640);
    expect(p).toEqual({ x: 140 / 360, y: 220 / 640, z: 8 / 360, visibility: 0.7 });
  });
});

describe('the crop pass in detectPoseImage', () => {
  it('reads a lost frame on the crop around the last pose, in whole-frame coordinates, marked crop', async () => {
    const [first, lost] = await run([() => pose(0.4, 0.6, 0.5, 0.55), none], [0, 66.7]);
    expect(first.source).toBeUndefined();
    expect(lost.source).toBe('crop');
    const side = CROP_SCALE * Math.max(0.2 * 360, 0.05 * 640), sx = 180 - side / 2, sy = 0.525 * 640 - side / 2;
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toEqual([sx, sy, side, side, 0, 0, CROP_PX, CROP_PX]);
    expect(lost.landmarks[0][0].x).toBeCloseTo((sx + 0.25 * side) / 360);
    expect(lost.landmarks[0][32].y).toBeCloseTo((sy + 0.9 * side) / 640);
    expect(lost.worldLandmarks[0][0].tag).toBe('crop');
  });
  it('leaves every frame the whole-frame pass reads unchanged', async () => {
    const answers = [() => pose(0.4, 0.6, 0.5, 0.55), none, none, () => pose(0.41, 0.61, 0.5, 0.56), () => pose(0.42, 0.62, 0.5, 0.56)];
    const times = [0, 66.7, 133.3, 200, 266.7];
    const off = await run(answers, times, { noCrop: true });
    vi.resetModules();
    delete globalThis.__WV_BENCH_NO_CROP__;
    const on = await run(answers, times);
    expect(off[1].landmarks).toEqual([]);
    expect(on[1].source).toBe('crop');
    for (const i of [0, 3, 4]) expect(JSON.stringify(on[i])).toBe(JSON.stringify(off[i]));
  });
  it('no crop once the seed is older than 1 s, nor after a reset', async () => {
    const late = await run([() => pose(0.4, 0.6, 0.5, 0.55), none], [0, 1066.7]);
    expect(late[1].landmarks).toEqual([]);
    vi.resetModules();
    const pa = await import('../poseAnalysis');
    const lm = await pa.getImageLandmarker();
    h.script = [pose(0.4, 0.6, 0.5, 0.55), none()];
    pa.detectPoseImage(lm, frame, 0);
    pa.resetKalmanFilters();
    expect(pa.detectPoseImage(lm, frame, 66.7).landmarks).toEqual([]);
  });
  it('a pose found on the crop seeds the next crop; a crop that finds nothing gives no pose', async () => {
    const r = await run([() => pose(0.4, 0.6, 0.5, 0.55), none, none], [0, 900, 1800]);
    expect(r[1].source).toBe('crop');
    expect(r[2].source).toBe('crop');
    h.cropAnswer = none;
    vi.resetModules();
    const r2 = await run([() => pose(0.4, 0.6, 0.5, 0.55), none], [0, 66.7]);
    expect(r2[1].landmarks).toEqual([]);
  });
});
