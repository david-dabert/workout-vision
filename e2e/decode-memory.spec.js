// How many decoded pictures the app holds at once while it reads a video from the library (crash at the demo of
// 7 October: the app was killed on David's iPhone while it analysed a gallery video). Every VideoFrame the decoder
// hands on is a full-size picture (about 25 MB at 4K HDR 10-bit); the extractor held 10 to 12 at once before the
// back-pressure fix (frameExtractor.js, extractFramesWebCodecs), 5 after. The page's VideoDecoder is wrapped to count
// the frames open at any moment; the pose worker answers each sample after 40 ms, so the decoder runs ahead of the
// main loop as it does on a phone, where the pose model is the slow step.
import { test, expect } from '@playwright/test';
import { start, openFilm, fakeWorker } from './shared/filmed-set.js';
import { drawnWebm } from './shared/drawn-video.js';

const BASE = '/workout-vision/';
// The bound: 5 measured after the fix on a 360p30 and a 4K60 clip (12 and 10 before). Status: validated (Chromium).
const MAX_OPEN_FRAMES = 5;

const countFrames = () => {
  const live = { frames: 0, peak: 0, reads: 0 };
  window.__frames = live;
  // Pixel reads of a canvas: one per sample, shared by the frozen-read fingerprint and the pose model (two before).
  const read = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function (...args) { live.reads++; return read.apply(this, args); };
  const VD = window.VideoDecoder;
  if (!VD) return;
  window.VideoDecoder = class extends VD {
    constructor(init) {
      const out = init.output;
      super({
        ...init,
        output: frame => {
          live.frames++; live.peak = Math.max(live.peak, live.frames);
          const close = frame.close.bind(frame);
          let closed = false;
          frame.close = () => { if (!closed) { closed = true; live.frames--; } close(); };
          out(frame);
        },
      });
    }
  };
};

test('reading a library video holds at most 5 decoded frames at once and reads each sample once', async ({ page }) => {
  test.setTimeout(120000);
  const errors = await start(page, { init: countFrames });
  await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fakeWorker.replace('}), 1);', '}), 40);') }));
  let result = null;
  await page.exposeFunction('__keep', r => { result = r; });
  await page.addInitScript(() => addEventListener('wv:core-result', e => window.__keep({ method: e.detail.metadata.method, samples: e.detail.timestamps.length, peakOpenFrames: e.detail.metadata.peakOpenFrames })));
  await openFilm(page, BASE);
  const video = Buffer.from(await drawnWebm(page, 6000), 'base64');
  await page.locator('.film-screen input[type="file"]').last().setInputFiles({ name: 'set.webm', mimeType: 'video/webm', buffer: video });
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 90000 });
  await expect.poll(() => result).not.toBeNull();
  const frames = await page.evaluate(() => window.__frames);
  console.log(JSON.stringify({ ...result, open: frames }));
  expect(result.method).toBe('webcodecs');
  expect(result.samples).toBeGreaterThan(60);
  expect(frames.peak, 'decoded frames open at once').toBeLessThanOrEqual(MAX_OPEN_FRAMES);
  expect(frames.frames, 'decoded frames left open after the read').toBe(0);
  expect(frames.reads, 'pixel reads, one per sample').toBe(result.samples);
  expect(errors).toEqual([]);
});
