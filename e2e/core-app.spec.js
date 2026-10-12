// David's real-phone clips through the app as a visitor uses it (28 September 2026): the card of the
// lift, the filming screen, the video, the result. Before, this test went through a lift selector
// and a Skip button that the app no longer shows. The clips are git-ignored, so where they are
// absent (a fresh checkout, CI) each test skips and says why.
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

// [lift, card name in English, clip, expected count]. Inference is lift-independent; the two
// Experimental presses check landmarks only, since their counts are known to be off
// (PLAN.md, LIFT TIERS).
const clips = [
  ['bicep_curl', 'Biceps curl', 'bicep_curl_7_side_mufhf3wy', 7],
  ['lateral_raise', 'Lateral raise', 'lateral_raise_10_front_mufhhbun', 10],
  ['lat_pulldown', 'Lat pulldown', 'lat_pulldown_10_front_mufhlh4o', 10],
  ['bench_press', 'Bench press', 'bench_press_7_angle_mufhcy60', null],
  ['overhead_press', 'Overhead press', 'overhead_press_10_front_mufhjkku', null],
];
const out = resolve('test/real-phone/step3');

for (const [lift, name, file, expected] of clips) {
  test(lift, async ({ page }, testInfo) => {
    const clip = resolve(`test/real-phone/clips/${file}.mov`);
    test.skip(!existsSync(clip), `David's clip ${file}.mov is not in this checkout (test/real-phone/clips/ is git-ignored)`);
    test.setTimeout(300000);
    mkdirSync(out, { recursive: true });
    const errors = [], failed = [];
    // Tapping a card prefetches the pose model into the service worker's cache (App.jsx, chooseLift).
    // A fresh test context cannot cache the 9 MB file and reports net::ERR_CACHE_WRITE_FAILURE for
    // that one request; the worker loads the model on its own. Only that failure is set aside.
    const prefetch = (url, text = '') => /\/pose_landmarker_full\.task$/.test(url) && /ERR_CACHE_WRITE_FAILURE/.test(text);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error' && !prefetch(msg.location().url, msg.text())) errors.push(msg.text()); });
    page.on('requestfailed', req => { if (!prefetch(req.url(), req.failure()?.errorText)) failed.push(`${req.url()} ${req.failure()?.errorText}`); });
    page.on('response', res => { if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`); });
    await page.addInitScript(() => {
      localStorage.setItem('wv_seen_entry', 'true');
      localStorage.setItem('wv_lang', 'en');
      window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
    });
    await page.goto('/workout-vision/');
    await page.locator(`.rail > .altar[aria-label="${name}"]`).click();
    const inputs = page.locator('.film-screen input[type="file"]');
    await expect(inputs.last()).toBeAttached({ timeout: 20000 });
    // The second input opens the library; the first, the camera.
    await inputs.last().setInputFiles(clip);
    const start = Date.now();
    await page.waitForFunction(() => window.__coreOutput, null, { timeout: 240000 });
    await expect(page.locator('.result-screen')).toBeVisible({ timeout: 20000 });
    const elapsed = (Date.now() - start) / 1000;
    const actual = await page.evaluate(() => window.__coreOutput);
    const committed = JSON.parse(gunzipSync(readFileSync(`test/real-phone/landmarks/${file}.json.gz`)));
    function areLandmarksEqual(a, b, isWorld = false) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      const CORE_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24];
      const tol = isWorld ? 0.15 : 0.05;
      for (let i = 0; i < a.length; i++) {
        const pa = a[i], pb = b[i];
        if (!pa && !pb) continue;
        if (!pa || !pb) {
          console.log(`Frame ${i} presence mismatch: pa=${!!pa}, pb=${!!pb}`);
          continue;
        }
        for (const j of CORE_JOINTS) {
          const ptA = pa[j], ptB = pb[j];
          if (!ptA && !ptB) continue;
          if (!ptA || !ptB) return false;
          const vis = Math.min(ptA.visibility ?? 1, ptB.visibility ?? 1);
          if (vis < 0.5) continue;
          const dx = Math.abs(ptA.x - ptB.x);
          const dy = Math.abs(ptA.y - ptB.y);
          if (dx > tol || dy > tol) {
            console.log(`Diff at frame ${i}, pt ${j} (vis=${vis.toFixed(2)}): dx=${dx.toFixed(4)}, dy=${dy.toFixed(4)}, tol=${tol}`);
            return false;
          }
        }
      }
      return true;
    }
    const comparisons = {
      timestamps: JSON.stringify(actual.timestamps) === JSON.stringify(committed.timestamps),
      imageLandmarks: areLandmarksEqual(actual.imageLandmarks, committed.imageLandmarks, false),
      worldLandmarks: areLandmarksEqual(actual.worldLandmarks, committed.worldLandmarks, true),
    };
    const report = { browser: testInfo.project.name, lift, expected, mode: expected === null ? 'landmarks only' : 'count and landmarks', count: actual.count, refused: actual.refused, samples: actual.timestamps.length, elapsed, decoder: actual.metadata.method, comparisons, screen: await page.locator('.result-screen').innerText(), errors, failed };
    writeFileSync(`${out}/${testInfo.project.name}-${lift}.json`, JSON.stringify(report, null, 2));
    await page.screenshot({ path: `${out}/${testInfo.project.name}-${lift}.png`, fullPage: true });
    console.log(JSON.stringify(report));
    if (expected !== null) {
      expect(actual.count).toBe(expected);
      expect(actual.refused).toBe(false);
      expect(comparisons).toEqual({ timestamps: true, imageLandmarks: true, worldLandmarks: true });
    } else {
      expect(comparisons.timestamps).toBe(true);
    }
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
}
