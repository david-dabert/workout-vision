// Read-only diagnostic: production worker vs development harness on the same browser.
// Run vite preview :4173 and vite dev :5174 before this script. No fixtures are rewritten.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const preview = process.env.CORE_PREVIEW_URL || 'http://localhost:4173';
const file = 'bicep_curl_7_side_mufhf3wy';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_landing', '1');
    localStorage.setItem('wv_lang', 'en');
    window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
  });
  await page.goto(`${preview}/workout-vision/`);
  await page.getByRole('button', { name: 'Skip', exact: true }).waitFor();
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('workoutVision');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put({ profileComplete: true }, 'userProfile');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto(`${preview}/workout-vision/#analyze`);
  await page.reload();
  await page.locator('#core-lift').selectOption('bicep_curl');
  await page.locator('#core-file').setInputFiles(resolve(`test/real-phone/clips/${file}.mov`));
  await page.getByRole('button', { name: 'Analyze', exact: true }).click();
  await page.getByTestId('core-result').waitFor({ timeout: 180000 });
  const worker = await page.evaluate(() => window.__coreOutput);
  const harness = await browser.newPage();
  await harness.goto('http://localhost:5174/workout-vision/test/real-phone/harness.html');
  await harness.waitForFunction(() => window._harnessReady);
  const main = await harness.evaluate(file => window._fetchAndProcess(`/workout-vision/test/real-phone/clips/${file}.mov`), file);
  const committed = JSON.parse(gunzipSync(readFileSync(`test/real-phone/landmarks/${file}.json.gz`)));
  const compare = (a, b) => Object.fromEntries(['timestamps', 'imageLandmarks', 'worldLandmarks'].map(key => [key, JSON.stringify(a[key]) === JSON.stringify(b[key])]));
  const report = { browser: await browser.version(), clip: file, workerVsMain: compare(worker, main), mainVsCommitted: compare(main, committed), workerVsCommitted: compare(worker, committed), workerCount: worker.count, mainMetadata: main.metadata };
  writeFileSync('test/real-phone/step3/chrome-parity-diagnostic.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
