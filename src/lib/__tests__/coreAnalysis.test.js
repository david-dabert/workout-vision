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
    // squat, wall ball), the machine seated back extension added on 5 October, and the two fitness tests (fitness-tests.js).
    expect(APPROVED_LIFTS).toHaveLength(184);
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

// Frozen-read incident, 3 October: a whole read whose skeletons all repeat is a picture that did not move. It ends as
// a read error (the "could not read this video" screen), never as a count of 0 nor as a refusal blaming the person.
describe('a whole read whose skeletons repeat, and one whose do not', () => {
  it('rejects with FrozenSkeletonsError, no count', async () => {
    const frame = Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: 0, z: 0, visibility: 1 }));
    globalThis.Worker = class {
      constructor() { this.onmessage = null; }
      postMessage(m) { setTimeout(() => this.onmessage?.({ data: m.type === 'init' ? { id: m.id, ok: true } : { id: m.id, image: frame, world: frame } }), 0); }
      terminate() {}
      addEventListener(t, f) { if (t === 'message') this.onmessage = f; }
    };
    globalThis.__passes = [439];
    try {
      await expect(analyzeCoreVideo(new Blob(['x']), 'lateral_raise')).rejects.toMatchObject({ name: 'FrozenSkeletonsError', samples: 439, repeats: 438 });
    } finally { delete globalThis.__passes; }
  });
  it('counts a healthy read: the first 439 samples of the incident video read through WebCodecs, no skeleton repeated', async () => {
    const { readFileSync } = await import('node:fs'), { gunzipSync } = await import('node:zlib'), { resolve } = await import('node:path');
    const set = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../test/real-phone/sets-29sep/lateral_raise_9_front_43e71b40.json.gz'))).toString());
    let k = 0;
    globalThis.Worker = class {
      constructor() { this.onmessage = null; }
      postMessage(m) { const world = m.type === 'init' ? null : set.worldLandmarks[k++]; setTimeout(() => this.onmessage?.({ data: m.type === 'init' ? { id: m.id, ok: true } : { id: m.id, image: world, world } }), 0); }
      terminate() {}
      addEventListener(t, f) { if (t === 'message') this.onmessage = f; }
    };
    globalThis.window = globalThis.window ?? { dispatchEvent() {} };
    globalThis.CustomEvent = globalThis.CustomEvent ?? class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
    globalThis.__passes = [439];
    globalThis.__time = i => set.timestamps[i];
    try {
      const r = await analyzeCoreVideo(new Blob(['x']), 'lateral_raise');
      expect(r.refused).toBe(false);
      expect(r.count).toBeGreaterThan(0);
    } finally { delete globalThis.__passes; delete globalThis.__time; }
  });
});

// Crash investigation, 7 October (cause 3): every analysis creates its pose worker, and one started right after
// another could hold two pose models at once. The next worker is created only once the previous one has closed its
// model and been terminated; a cancel terminates at once.
describe('one pose worker at a time', () => {
  const frame = Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: 0, z: 0, visibility: 1 }));
  const workers = (closeAfter = 5) => {
    const log = { live: 0, peak: 0, created: 0, closes: 0 };
    globalThis.Worker = class {
      constructor() { this.onmessage = null; log.created++; log.live++; log.peak = Math.max(log.peak, log.live); this.k = 0; }
      postMessage(m) {
        if (m.type === 'close') { log.closes++; setTimeout(() => this.onmessage?.({ data: { id: m.id } }), closeAfter); return; }
        const k = this.k++;
        const world = m.type === 'init' ? null : frame.map(p => ({ ...p, x: p.x + k / 1000 }));
        setTimeout(() => this.onmessage?.({ data: m.type === 'init' ? { id: m.id } : { id: m.id, image: world, world } }), 0);
      }
      terminate() { if (!this.gone) { this.gone = true; log.live--; } }
    };
    return log;
  };
  it('two analyses started back to back never hold two workers, and each worker closes its model first', async () => {
    const log = workers(30);
    globalThis.window = globalThis.window ?? { dispatchEvent() {} };
    globalThis.CustomEvent = globalThis.CustomEvent ?? class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
    globalThis.__passes = [439];
    try {
      const [a, b] = await Promise.allSettled([analyzeCoreVideo(new Blob(['x']), 'lateral_raise'), analyzeCoreVideo(new Blob(['x']), 'lateral_raise')]);
      expect(a.status).toBe('fulfilled');
      expect(b.status).toBe('fulfilled');
      await new Promise(r => setTimeout(r, 60));
      expect(log).toMatchObject({ created: 2, peak: 1, live: 0, closes: 2 });
    } finally { delete globalThis.__passes; }
  });
  it('a cancelled analysis lets the next one start without waiting for a close', async () => {
    const log = workers(5000);
    globalThis.__passes = [439];
    const ac = new AbortController();
    try {
      const first = analyzeCoreVideo(new Blob(['x']), 'lateral_raise', { signal: ac.signal });
      ac.abort();
      await expect(first).rejects.toMatchObject({ name: 'AbortError' });
      const began = Date.now();
      const next = analyzeCoreVideo(new Blob(['x']), 'lateral_raise');
      await expect(next).resolves.toBeTruthy();
      expect(Date.now() - began).toBeLessThan(900);
      expect(log.peak).toBe(1);
    } finally { delete globalThis.__passes; }
  });
});

// Speed investigation, 7 October: the next sample is read while the worker reads the one before (pipelining). The
// worker answers in the order it was sent (one thread, one queue), so each sample keeps its own landmarks; at most two
// samples are sent and not yet placed.
describe('pipelined samples', () => {
  it('keep their order and their own landmarks, two in flight at most', async () => {
    const log = { outstanding: 0, peak: 0 };
    globalThis.Worker = class {
      constructor() { this.onmessage = null; this.queue = []; this.busy = false; }
      // One message at a time, first in first out, with a varying delay, as a worker thread reads them.
      pump() {
        if (this.busy || !this.queue.length) return;
        this.busy = true;
        const m = this.queue.shift();
        setTimeout(() => {
          this.busy = false;
          if (m.pixels) log.outstanding--;
          const k = m.timestamp == null ? 0 : Math.round(m.timestamp * 15 / 1000);
          const world = Array.from({ length: 33 }, (_, i) => ({ x: i / 33 + k / 1000, y: k, z: 0, visibility: 1 }));
          this.onmessage?.({ data: m.type ? { id: m.id } : { id: m.id, image: world, world } });
          this.pump();
        }, m.pixels ? (m.timestamp * 7) % 3 : 0);
      }
      postMessage(m) { if (m.pixels) { log.outstanding++; log.peak = Math.max(log.peak, log.outstanding); } this.queue.push(m); this.pump(); }
      terminate() {}
    };
    globalThis.window = globalThis.window ?? { dispatchEvent() {} };
    globalThis.CustomEvent = globalThis.CustomEvent ?? class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
    globalThis.__passes = [30, 439];
    try {
      const r = await analyzeCoreVideo(new Blob(['x']), 'lateral_raise');
      expect(r.timestamps.length).toBe(439);
      expect(r.worldLandmarks.every((w, i) => w[0].y === i)).toBe(true);
      expect(r.timestamps.every((t, i) => t === i / 15)).toBe(true);
      expect(log.peak).toBe(2);
    } finally { delete globalThis.__passes; }
  });
});
