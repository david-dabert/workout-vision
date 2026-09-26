import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 14'], browserName: 'webkit' });

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
  test(`manual set report identifies manual entry in ${lang}`, async ({ page }) => {
    await savedSet(page, lang);
    await page.reload();
    await page.getByRole('button', { name: lang === 'fr' ? /Vos séries/ : /Your sets/ }).click();
    await page.locator('.hist-btn').click();
    await page.locator('.hist-detail .btn-line').click();
    await expect(page.locator('.sh-foot')).toContainText(lang === 'fr' ? 'Saisie manuelle' : 'Entered manually');
    await expect(page.locator('.sh-foot')).not.toContainText(lang === 'fr' ? 'Comptage automatique' : 'Counted automatically');
  });
}
