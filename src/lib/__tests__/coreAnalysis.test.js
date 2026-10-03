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
    // 183 exercises (the two barbell curls added on 2 October) less the four floor exercises withdrawn on 3 October
    // (offer.js, WITHDRAWN, third audit C21), with the three added the same day (behind-the-neck press, barbell jump
    // squat, wall ball), and the two fitness tests (fitness-tests.js).
    expect(APPROVED_LIFTS).toHaveLength(183);
    for (const lift of ['dead_bug', 'banded_dead_bug', 'bird_dog', 'glute_bridge_march']) expect(APPROVED_LIFTS, lift).not.toContain(lift);
    for (const test of ['chair_stand_test', 'arm_curl_test']) expect(APPROVED_LIFTS, test).toContain(test);
    for (const lift of ['bench_press', 'bicep_curl', 'hip_thrust', 'lat_pulldown', 'lateral_raise', 'leg_press', 'overhead_press', 'romanian_deadlift', 'squat']) expect(APPROVED_LIFTS, lift).toContain(lift);
    for (const lift of ['__auto__', 'triceps_pushdown', 'pec_deck', 'bicep_curl_alternating', 'walking_lunge', 'sandbag_lunge']) {
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
    // Each pass starts again at sample 0, as the extractor's fallback does (frameExtractor.js).
    for (const n of globalThis.__passes || [181]) for (let i = 0; i < n; i++) await onFrame(canvas, i, globalThis.__time ? globalThis.__time(i) : i / 15);
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

describe('a failed first pass and its fallback (audit FINDING-002)', () => {
  it('the first pass is dropped: 30 then 409 of 439 is a partial read of 409, not a whole one', async () => {
    const frame = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    globalThis.Worker = class {
      constructor() { this.onmessage = null; }
      postMessage(m) { setTimeout(() => this.onmessage?.({ data: m.type === 'init' ? { id: m.id, ok: true } : { id: m.id, image: frame, world: frame } }), 0); }
      terminate() {}
      addEventListener(t, f) { if (t === 'message') this.onmessage = f; }
    };
    globalThis.__passes = [30, 409];
    try {
      await expect(analyzeCoreVideo(new Blob(['x']), 'lateral_raise')).rejects.toMatchObject({ name: 'PartialReadError', read: 409, expected: 439 });
    } finally { delete globalThis.__passes; }
  });
});

// Third audit, C08: a read whose samples went back in time carried read = NaN, and the screen said "Only NaN%".
describe('a read whose samples go back in time', () => {
  it('rejects with the real number of samples and the flag, never NaN', async () => {
    const frame = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    globalThis.Worker = class {
      constructor() { this.onmessage = null; }
      postMessage(m) { setTimeout(() => this.onmessage?.({ data: m.type === 'init' ? { id: m.id, ok: true } : { id: m.id, image: frame, world: frame } }), 0); }
      terminate() {}
      addEventListener(t, f) { if (t === 'message') this.onmessage = f; }
    };
    globalThis.__passes = [439];
    globalThis.__time = i => (i === 200 ? 199 / 15 : i / 15);
    try {
      await expect(analyzeCoreVideo(new Blob(['x']), 'lateral_raise')).rejects.toMatchObject({ name: 'PartialReadError', read: 439, expected: 439, disordered: true });
    } finally { delete globalThis.__passes; delete globalThis.__time; }
  });
});
