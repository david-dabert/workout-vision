/**
 * Continuity gate (7 October; jumpGate.js, poseAnalysis.js detectPoseImage): a pose that jumps more than a torso length
 * from the last accepted one within half a second is held back and the crop retry looks again around the lifter; a
 * jump that holds more than a second is accepted. Off in the app (JUMP_GATE); the bench hook __WV_BENCH_GATE__ turns it on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGate, holdsBack, accept, heldBack, JUMP_GATE, JUMP_WINDOW_MS, JUMP_PERSIST_MS } from '../jumpGate';

const h = vi.hoisted(() => ({ script: [] }));
vi.mock('localforage', () => ({ default: { createInstance: () => ({ getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, keys: async () => [] }) } }));
vi.mock('../gpuBenchmark', () => ({ detectCapabilities: async () => ({ recommendedDelegate: 'CPU' }), isSimdSupported: () => true }));
vi.mock('../model-hash', () => ({ MODEL_SHA256: 'abc', isTheModel: async () => true }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: async () => ({}) },
  PoseLandmarker: { createFromOptions: async () => ({ detect: () => h.script.shift() }) },
}));

// A pose whose torso (shoulders 11, 12; hips 23, 24) is centred at (cx, cy), normalised, 0.2 high.
const pose = (cx, cy) => {
  const lm = Array.from({ length: 33 }, () => ({ x: cx, y: cy, z: 0 }));
  lm[11] = { x: cx - 0.05, y: cy - 0.1, z: 0 }; lm[12] = { x: cx + 0.05, y: cy - 0.1, z: 0 };
  lm[23] = { x: cx - 0.05, y: cy + 0.1, z: 0 }; lm[24] = { x: cx + 0.05, y: cy + 0.1, z: 0 };
  return lm;
};
const W = 360, H = 640; // torso length 0.2 x 640 = 128 px

describe('continuity gate (jumpGate.js)', () => {
  it('never holds back the first pose, nor one near the last', () => {
    let g = newGate();
    expect(holdsBack(g, pose(0.5, 0.5), W, H, 0)).toBe(false);
    g = accept(g, pose(0.5, 0.5), W, H, 0);
    // 0.15 of the height = 96 px < 128 px
    expect(holdsBack(g, pose(0.5, 0.65), W, H, 67)).toBe(false);
  });
  it('holds back a jump of more than one torso length within the window, and lets it through after the persistence', () => {
    let g = accept(newGate(), pose(0.3, 0.5), W, H, 0);
    // 0.5 of the width = 180 px > 128 px
    expect(holdsBack(g, pose(0.8, 0.5), W, H, 67)).toBe(true);
    g = heldBack(g, 67);
    // The jump under way is checked past the window too, until it has held JUMP_PERSIST_MS.
    expect(holdsBack(g, pose(0.8, 0.5), W, H, 67 + JUMP_WINDOW_MS + 100)).toBe(true);
    expect(holdsBack(g, pose(0.8, 0.5), W, H, 67 + JUMP_PERSIST_MS + 1)).toBe(false);
  });
  it('a pose near the lifter ends the jump under way', () => {
    let g = accept(newGate(), pose(0.3, 0.5), W, H, 0);
    g = heldBack(g, 67);
    g = accept(g, pose(0.31, 0.5), W, H, 133);
    expect(g.since).toBe(null);
    expect(holdsBack(g, pose(0.8, 0.5), W, H, 200)).toBe(true);
  });
  it('does not check a pose after a gap longer than the window with no jump under way, nor across passes or sizes', () => {
    const g = accept(newGate(), pose(0.3, 0.5), W, H, 1000);
    expect(holdsBack(g, pose(0.8, 0.5), W, H, 1000 + JUMP_WINDOW_MS + 1)).toBe(false);
    expect(holdsBack(g, pose(0.8, 0.5), W, H, 0)).toBe(false);
    expect(holdsBack(g, pose(0.8, 0.5), 640, 360, 1067)).toBe(false);
  });
  it('a pose without a torso is never held back and leaves the reference', () => {
    const g = accept(newGate(), pose(0.3, 0.5), W, H, 0);
    const none = pose(0.8, 0.5); none[11] = undefined;
    expect(holdsBack(g, none, W, H, 67)).toBe(false);
    expect(accept(g, none, W, H, 67).ref).toEqual(g.ref);
  });
});

// A body with its torso centred at (cx, cy) (normalised), 33 points; world landmarks tagged.
const body = (cx, cy, tag) => Array.from({ length: 33 }, (_, i) => ({ x: cx + (i % 2 ? 0.02 : -0.02), y: cy + (i >= 23 ? 0.08 : i >= 11 ? -0.08 : -0.15), z: 0, visibility: 0.9, tag }));
const world = tag => Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9, tag }));
const answer = (cx, cy, tag) => ({ landmarks: [body(cx, cy, tag)], worldLandmarks: [world(tag)] });
const none = () => ({ landmarks: [], worldLandmarks: [] });
const frame = { width: 360, height: 640 };
const tagOf = r => r?.worldLandmarks?.[0]?.[0]?.tag ?? null;

describe('the gate in detectPoseImage', () => {
  beforeEach(() => {
    vi.resetModules();
    h.script = [];
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('caches', { has: async () => false, open: async () => ({ match: async () => undefined }) });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(6 * 1024 * 1024), { status: 200 })));
    vi.stubGlobal('OffscreenCanvas', class { constructor(w, hh) { this.width = w; this.height = hh; } getContext() { return { clearRect() {}, drawImage() {} }; } });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete globalThis.__WV_BENCH_GATE__; });

  async function run(answers, frames, gate) {
    if (gate) globalThis.__WV_BENCH_GATE__ = true;
    const pa = await import('../poseAnalysis');
    const lm = await pa.getImageLandmarker();
    h.script = [...answers];
    const out = Array.from({ length: frames }, (_, i) => pa.detectPoseImage(lm, frame, i * 66.7));
    return { out, left: h.script.length, gated: pa.gatedFrames() };
  }

  it('is off in the app: a jump is returned as the model gave it', async () => {
    expect(JUMP_GATE).toBe(false);
    const { out, left } = await run([answer(0.3, 0.5, 'lifter'), answer(0.8, 0.45, 'bystander')], 2, false);
    expect(out.map(tagOf)).toEqual(['lifter', 'bystander']);
    expect(left).toBe(0);
  });
  it('holds back a jump to a bystander and reads the crop around the lifter instead', async () => {
    const { out, left, gated } = await run([
      answer(0.3, 0.5, 'lifter'),
      answer(0.8, 0.45, 'bystander'), answer(0.5, 0.5, 'lifter'), // whole frame, then the crop around the lifter
      answer(0.8, 0.45, 'bystander'), none(),                      // the crop finds nobody: the frame is lost
      answer(0.31, 0.5, 'lifter'),
    ], 4, true);
    expect(out.map(tagOf)).toEqual(['lifter', 'lifter', null, 'lifter']);
    expect(out[1].source).toBe('crop');
    expect(gated).toBe(2);
    expect(left).toBe(0);
  });
  it('accepts a jump that holds more than a second with nobody near the lifter', async () => {
    // Frames 1-14: the bystander, and the crop around the lifter (seed under 1 s old) finds nobody; frame 15: the seed
    // is too old for a crop; frame 16 (1067 ms, 1000.5 ms after the jump began): the jump is accepted.
    const script = [answer(0.3, 0.5, 'lifter')];
    for (let i = 1; i <= 14; i++) script.push(answer(0.8, 0.45, 'bystander'), none());
    script.push(answer(0.8, 0.45, 'bystander'), answer(0.8, 0.45, 'bystander'), answer(0.81, 0.45, 'bystander'));
    const { out, left } = await run(script, 18, true);
    expect(out.map(tagOf)).toEqual(['lifter', ...Array(15).fill(null), 'bystander', 'bystander']);
    expect(left).toBe(0);
  });
  it('leaves a single pose that stays near the last one untouched', async () => {
    const answers = [answer(0.3, 0.5, 'a'), answer(0.32, 0.52, 'b'), answer(0.34, 0.55, 'c')];
    const on = await run(answers.map(a => structuredClone(a)), 3, true);
    vi.resetModules();
    delete globalThis.__WV_BENCH_GATE__;
    const off = await run(answers.map(a => structuredClone(a)), 3, false);
    expect(JSON.stringify(on.out)).toBe(JSON.stringify(off.out));
    expect(on.gated).toBe(0);
  });
});
