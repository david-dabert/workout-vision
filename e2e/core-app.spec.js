import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const clips = [
  ['bicep_curl', 'bicep_curl_7_side_mufhf3wy', 7],
  ['lateral_raise', 'lateral_raise_10_front_mufhhbun', 10],
  ['lat_pulldown', 'lat_pulldown_10_front_mufhlh4o', 10],
  // Inference is lift-independent. These parked clips check landmarks only,
  // through the curl selection; no press count is presented as an app result.
  ['bench_press', 'bench_press_7_angle_mufhcy60', null],
  ['overhead_press', 'overhead_press_10_front_mufhjkku', null],
];
const out = resolve('test/real-phone/step3');
mkdirSync(out, { recursive: true });

for (const [lift, file, expected] of clips) {
  test(lift, async ({ page }, testInfo) => {
    const errors = [], failed = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', req => failed.push(`${req.url()} ${req.failure()?.errorText}`));
    page.on('response', res => { if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`); });
    await page.addInitScript(() => {
      localStorage.setItem('wv_seen_landing', '1');
      localStorage.setItem('wv_lang', 'en');
      window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
    });
    await page.goto('/workout-vision/');
    // Let the app create its real storage before completing the profile fixture.
    await expect(page.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('workoutVision');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('profile', 'readwrite');
          tx.objectStore('profile').put({ name: '', profileComplete: true }, 'userProfile');
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await page.goto('/workout-vision/#analyze');
    await page.reload();
    const selector = page.locator('#core-lift');
    await expect(selector).toBeVisible();
    errors.length = 0; failed.length = 0;
    expect(await selector.locator('option').evaluateAll(options => options.map(o => o.value))).toEqual(['', 'bicep_curl', 'lateral_raise', 'lat_pulldown']);
    await selector.selectOption(expected === null ? 'bicep_curl' : lift);
    if (lift === 'bicep_curl') await page.screenshot({ path: `${out}/${testInfo.project.name}-selector.png`, fullPage: true });
    await page.locator('#core-file').setInputFiles(resolve(`test/real-phone/clips/${file}.mov`));
    const start = Date.now();
    await page.getByRole('button', { name: 'Analyze', exact: true }).click();
    await expect(page.getByTestId('core-result').or(page.getByRole('alert'))).toBeVisible({ timeout: 240000 });
    await expect(page.getByTestId('core-result'), await page.locator('body').innerText()).toBeVisible();
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
    const report = { browser: testInfo.project.name, lift, expected, mode: expected === null ? 'landmarks-only; curl selected' : 'approved app result', count: expected === null ? null : actual.count, refused: actual.refused, samples: actual.timestamps.length, elapsed, decoder: actual.metadata.method, comparisons, screen: expected === null ? 'Not offered; landmark check only' : await page.getByTestId('core-result').innerText(), errors, failed };
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
