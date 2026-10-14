/**
 * The exercise sheet's drawings, made ready before the coach's tap (sheet-drawings.js, 14 October 2026): each frame
 * loaded once, an exercise without a drawing ready at once, a frame that fails or hangs left out without holding the
 * PDF back, a borrowed drawing named by its own drawing, and a programme's frames never pushed out by its own warm.
 * The loader is the test's own: the tests never decode an image nor read public/guide.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
// exercise-info.js reaches the drawing code, which reads the screen when it loads (as in exercise-list.test.js).
vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
});
import { DRAWING_PX, JPEG_QUALITY, LOAD_TIMEOUT_MS, MAX_KEPT, drawingCache, sheetFrames } from '../sheet-drawings';
import { LIMITS } from '../programme';
import catalogue from '../../../lib/guide-catalog.json';
import { DRAWING_8PX } from './fixtures/drawing-8px';

const FAKE = { data: DRAWING_8PX, format: 'JPEG' };
const programmeOf = keys => ({ title: 'A', who: '', note: '', items: keys.map(key => ({ key, sets: 3, reps: 10, rest: 60, note: '' })) });

afterEach(() => { vi.useRealTimers(); });

describe('the sheet’s drawings', () => {
  it('sets its sizes as the plan measured them', () => {
    expect([DRAWING_PX, JPEG_QUALITY, LOAD_TIMEOUT_MS, MAX_KEPT]).toEqual([240, 0.88, 6000, 96]);
    expect(MAX_KEPT).toBeGreaterThan(2 * LIMITS.items);
  });

  it('loads the first and last pose of each exercise once, however often it is asked', async () => {
    const load = vi.fn(async () => FAKE);
    const cache = drawingCache({ load });
    expect(sheetFrames('squat').urls).toEqual(['/guide/squat/frame-1.webp', '/guide/squat/frame-3.webp']);
    expect(cache.ready(['squat'])).toBe(false);
    await Promise.all([cache.warm(['squat', 'plank']), cache.warm(['squat']), cache.warm(['plank', 'squat'])]);
    await cache.warm(['squat']);
    expect(load.mock.calls.map(c => c[0]).sort()).toEqual(['/guide/plank/frame-1.webp', '/guide/plank/frame-3.webp', '/guide/squat/frame-1.webp', '/guide/squat/frame-3.webp']);
    expect(cache.ready(['squat', 'plank'])).toBe(true);
    const of = cache.of(programmeOf(['squat', 'plank', 'squat']));
    expect([...of.keys()]).toEqual(['squat', 'plank']);
    expect(of.get('squat')).toEqual({ start: { ...FAKE, alias: 'g-squat-1' }, end: { ...FAKE, alias: 'g-squat-3' }, similar: false });
  });

  it('needs nothing for an exercise with no drawing, and gives it none', async () => {
    const load = vi.fn(async () => FAKE);
    const cache = drawingCache({ load });
    expect(sheetFrames('machine_seated_back_extension')).toBeNull();
    expect(sheetFrames('no_such_lift')).toBeNull();
    expect(cache.ready(['machine_seated_back_extension'])).toBe(true);
    await cache.warm(['machine_seated_back_extension']);
    expect(load).not.toHaveBeenCalled();
    expect(cache.of(programmeOf(['machine_seated_back_extension'])).get('machine_seated_back_extension')).toBeNull();
  });

  it('leaves out a frame that fails or comes back empty, and is ready all the same', async () => {
    const load = vi.fn(async url => {
      if (url.endsWith('squat/frame-1.webp')) throw new Error('decode');
      if (url.endsWith('squat/frame-3.webp')) return null;
      if (url.endsWith('plank/frame-1.webp')) return { data: 42 };
      return FAKE;
    });
    const cache = drawingCache({ load });
    await expect(cache.warm(['squat', 'plank'])).resolves.toBeUndefined();
    expect(cache.ready(['squat', 'plank'])).toBe(true);
    const of = cache.of(programmeOf(['squat', 'plank']));
    expect(of.get('squat')).toBeNull();
    expect(of.get('plank')).toEqual({ start: null, end: { ...FAKE, alias: 'g-plank-3' }, similar: false });
    // Kept as missing for the visit: not asked again.
    await cache.warm(['squat']);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('gives up on a frame that hangs after LOAD_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    const cache = drawingCache({ load: () => new Promise(() => {}) });
    let settled = false;
    cache.warm(['squat']).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS - 1);
    expect([settled, cache.ready(['squat'])]).toEqual([false, false]);
    await vi.advanceTimersByTimeAsync(1);
    expect([settled, cache.ready(['squat'])]).toEqual([true, true]);
    expect(cache.of(programmeOf(['squat'])).get('squat')).toBeNull();
  });

  it('names a borrowed drawing by its own drawing, and says it shows a similar movement', async () => {
    const load = vi.fn(async () => FAKE);
    const cache = drawingCache({ load });
    expect(sheetFrames('wall_ball')).toEqual({ urls: ['/guide/squat/frame-1.webp', '/guide/squat/frame-3.webp'], slug: 'squat', similar: true });
    await cache.warm(['wall_ball', 'squat']);
    // The wall ball borrows the squat's drawing: two frames in all.
    expect(load).toHaveBeenCalledTimes(2);
    const of = cache.of(programmeOf(['wall_ball', 'squat']));
    expect(of.get('wall_ball')).toEqual({ start: { ...FAKE, alias: 'g-squat-1' }, end: { ...FAKE, alias: 'g-squat-3' }, similar: true });
    expect(of.get('squat').similar).toBe(false);
  });

  it('never pushes a programme’s own frames out while warming it', async () => {
    const keys = catalogue.filter(e => !e.noDrawing && !e.drawing).map(e => e.key);
    const cache = drawingCache({ load: async () => FAKE });
    // Other programmes first, more than the cache keeps.
    await cache.warm(keys.slice(100, 160));
    const mine = keys.slice(0, LIMITS.items);
    await cache.warm(mine);
    expect(cache.ready(mine)).toBe(true);
    expect([...cache.of(programmeOf(mine)).values()].every(Boolean)).toBe(true);
    // Warmed again after others, they are kept: the frames asked for last are the newest.
    await cache.warm(keys.slice(200, 230));
    await cache.warm(mine);
    expect(cache.ready(mine)).toBe(true);
  });
});
