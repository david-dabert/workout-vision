import { test, expect, devices, webkit } from '@playwright/test';
import { existsSync } from 'node:fs';
import { layoutFaults } from '../test/real-phone/checks.mjs';

// These tests run in WebKit, the iPhone's engine. Where Playwright's WebKit is not installed they
// skip and say why, except in CI, which installs it.
const hasWebKit = (() => { try { return existsSync(webkit.executablePath()); } catch { return false; } })();
// In CI WebKit must be there: a missing browser fails the job instead of skipping these tests.
test.skip(!hasWebKit && !process.env.CI, 'WebKit is not installed here (npx playwright install webkit)');
// launchOptions are reset: a PW_CHROMIUM path from the environment names a Chromium binary.
test.use({ ...devices['iPhone 14'], browserName: 'webkit', launchOptions: {} });

async function savedSet(page, lang = 'fr') {
  await page.addInitScript(lang => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', lang);
  }, lang);
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible();
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('workoutVision');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({ id: 'manual-test', exercise: 'bicep_curl', reps: 7, source: 'manual', createdAt: Date.now() }, 'manual-test');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
}

test('saved history remains reachable after a slow IndexedDB open', async ({ page }) => {
  await savedSet(page);
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      const request = open(...args);
      request.addEventListener('success', event => {
        event.stopImmediatePropagation();
        setTimeout(() => request.dispatchEvent(new Event('success')), 800);
      }, { once: true });
      return request;
    };
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /Vos séries/ })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await expect(page.locator('.hist-btn')).toContainText('7');
});

for (const lang of ['fr', 'en']) {
  test(`manual set report names no app and keeps its date on the right in ${lang}`, async ({ page }) => {
    await savedSet(page, lang);
    await page.reload();
    await page.getByRole('button', { name: lang === 'fr' ? /Vos séries/ : /Your sets/ }).click();
    await page.locator('.hist-btn').click();
    await page.locator('.hist-detail .btn-line').click();
    // The report names no app (David, 29 September).
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('.sheet')).not.toContainText('Workout Vision');
    // The date stays on the right, as on the PDF (review of the one-line report).
    const top = await page.locator('.sh-top').boundingBox(), date = await page.locator('.sh-top span').last().boundingBox();
    expect(Math.abs((top.x + top.width) - (date.x + date.width))).toBeLessThan(2);
  });
}

// Rule 8: a tap never leaves the bare stage while the next screen's code loads.
// The history's code is held back 1.5 s, as on a slow phone before the app has
// warmed it; from the tap until the history shows, no frame may show the loading
// placeholder. With the service worker blocked, the request reaches the route.
test.describe('the next screen still loading', () => {
  test.use({ serviceWorkers: 'block' });
  for (const reducedMotion of ['reduce', 'no-preference']) {
    test(`keeps the current screen until it is ready (${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      await savedSet(page);
      await page.route(/\/assets\/History-[^/]+\.js$/, async route => {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await route.continue();
      });
      await page.reload();
      const row = page.getByRole('button', { name: /Vos séries/ });
      await expect(row).toBeVisible();
      await page.evaluate(() => {
        window.__placeholderFrames = 0;
        const frame = () => {
          if (document.querySelector('[aria-busy="true"]')) window.__placeholderFrames += 1;
          if (!document.querySelector('.hist-btn')) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      await row.click();
      await expect(page.locator('.hist-btn')).toBeVisible({ timeout: 10000 });
      expect(await page.evaluate(() => window.__placeholderFrames)).toBe(0);
    });
  }
});

// Rule 7 at 375 px: a corrected set's line of time, length and arm, next to its
// tag, must not leave one word alone on a line.
test.describe('the history at 375 px', () => {
  test.use({ viewport: { width: 375, height: 548 } });
  test('leaves no word alone and nothing overlapping', async ({ page }) => {
    await savedSet(page);
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('workoutVision');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('workouts', 'readwrite');
        tx.objectStore('workouts').put({
          id: 'corrected-left', exercise: 'bicep_curl', reps: 12, arm: 'left', duration: 31, createdAt: Date.now() - 60000,
          source: 'counter-core', machineResult: { reps: 11, confidence: 0.8 }, correctedResult: { reps: 12 },
        }, 'corrected-left');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }));
    await page.reload();
    await page.getByRole('button', { name: /Vos séries/ }).click();
    await expect(page.locator('.hist-btn')).toHaveCount(2);
    await page.waitForTimeout(1600); // the rows' reveal animation has settled
    expect((await page.evaluate(layoutFaults)).filter(f => !f.startsWith('note: '))).toEqual([]);
  });
});

// A screen whose code cannot load: the tap leads to the error screen and its
// Reload, never to a tap that does nothing.
test.describe('the next screen failing to load', () => {
  test.use({ serviceWorkers: 'block' });
  test('leads to the error screen', async ({ page }) => {
    await savedSet(page);
    await page.route(/\/assets\/History-[^/]+\.js$/, route => route.abort());
    await page.reload();
    await page.getByRole('button', { name: /Vos séries/ }).click();
    await expect(page.getByRole('button', { name: 'Recharger' })).toBeVisible({ timeout: 10000 });
  });
});
