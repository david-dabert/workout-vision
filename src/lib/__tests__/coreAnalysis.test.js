import { describe, it, expect } from 'vitest';
import { APPROVED_LIFTS, analyzeCoreVideo, summarizeCount } from '../coreAnalysis';

function visibleFrame() {
  return Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: 0, z: 0, visibility: 1 }));
}
describe('Step 3 analysis boundary', () => {
  // 28 September: David moved bench press, then overhead press, to Experimental. See PLAN.md, "Lift tiers".
  // Step 2 (David's decisions, 29 September 2026): the countable exercises of the guide but the walking lunge, 181, are offered,
  // the nine lifts of LIFT TIERS among them; Automatic, an exercise without a joint and a core-only
  // lift still are not.
  it('does not allow Automatic, an exercise the guide cannot count, or a lift the guide does not hold', async () => {
    expect(APPROVED_LIFTS).toHaveLength(181);
    for (const lift of ['bench_press', 'bicep_curl', 'hip_thrust', 'lat_pulldown', 'lateral_raise', 'leg_press', 'overhead_press', 'romanian_deadlift', 'squat']) expect(APPROVED_LIFTS, lift).toContain(lift);
    for (const lift of ['__auto__', 'triceps_pushdown', 'pec_deck', 'bicep_curl_alternating', 'walking_lunge']) {
      await expect(analyzeCoreVideo(null, lift)).rejects.toThrow('Choose an approved lift');
    }
  });
  it('refuses when joints are hidden for a strict majority, not exactly half', () => {
    expect(summarizeCount([null, null, visibleFrame()], [0, 1, 2], 'bicep_curl').refused).toBe(true);
    expect(summarizeCount([null, visibleFrame()], [0, 1], 'bicep_curl').refused).toBe(false);
  });
  it('shows zero rather than refusing a visible motionless set', () => {
    const frames = Array.from({ length: 30 }, visibleFrame);
    const result = summarizeCount(frames, frames.map((_, i) => i / 15), 'bicep_curl');
    expect(result.count).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.refused).toBe(false);
  });
});

// 29 September: David's iPhone read 181 of the 439 samples of his lateral raise clip and the app
// counted 2 of 10 (the collector refused the same read). A set read in part shows no count.
import { unreadSamples } from '../coreAnalysis';
describe('a video read in part', () => {
  it('names what was read when samples are missing: 181 of 439', () => {
    expect(unreadSamples({ samples: 181, duration: 29.3, fps: 15, maxFrames: 1800 })).toEqual({ read: 181, expected: 439 });
  });
  it('passes a whole read only', () => {
    expect(unreadSamples({ samples: 439, duration: 29.328333, fps: 15, maxFrames: Infinity })).toBeNull();
  });
  it('refuses a read with samples read twice (a failed first pass left behind): 481 where 439', () => {
    expect(unreadSamples({ samples: 481, duration: 29.328333, fps: 15, maxFrames: Infinity })).toEqual({ read: 481, expected: 439 });
  });
  it('refuses a read whose video length is unknown, as the collector does', () => {
    expect(unreadSamples({ samples: 10, duration: NaN, fps: 15, maxFrames: Infinity })).toEqual({ read: 10, expected: null });
  });
});

// The wiring: analyzeCoreVideo itself throws, so the result screen never gets a partial count (review 01).
import { vi } from 'vitest';
vi.mock('../frameExtractor', () => ({
  extractFramesStreaming: async (_file, _fps, _max, _side, onFrame) => {
    const canvas = { width: 2, height: 2, getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(16) }) }) };
    for (let i = 0; i < 181; i++) await onFrame(canvas, i, i / 15);
    return { duration: 29.328333 };
  },
}));
describe('analyzeCoreVideo on a partial read', () => {
  it('rejects with PartialReadError, 181 of 439, and no count', async () => {
    const frame = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    globalThis.Worker = class {
      constructor() { this.onmessage = null; }
      postMessage(m) { setTimeout(() => this.onmessage?.({ data: m.type === 'init' ? { id: m.id, ok: true } : { id: m.id, image: frame, world: frame } }), 0); }
      terminate() {}
      addEventListener(t, f) { if (t === 'message') this.onmessage = f; }
    };
    await expect(analyzeCoreVideo(new Blob(['x']), 'lateral_raise')).rejects.toMatchObject({ name: 'PartialReadError', read: 181, expected: 439 });
  });
});
