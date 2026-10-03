// Helping improve the count, in the history (ContributeHistory.jsx, contribute.js): the sets waiting are
// counted, sent through the share sheet and then forgotten; stopping erases them; a person who has not
// started can start from here.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const put = (page, store, items) => page.evaluate(([store, items]) => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => { const tx = r.result.transaction(store, 'readwrite'); for (const w of items) tx.objectStore(store).put(w, w.id ?? w.setId); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => ko(tx.error); };
}), [store, items]);
const count = (page, store) => page.evaluate(store => new Promise(ok => {
  const r = indexedDB.open('workoutVision');
  r.onsuccess = () => { const q = r.result.transaction(store).objectStore(store).count(); q.onsuccess = () => { r.result.close(); ok(q.result); }; };
}), store);

async function open(page, choice, shareOk) {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(([choice, shareOk]) => {
    if (!location.protocol.startsWith('http')) return;
    localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr');
    if (choice) localStorage.setItem('wv_contribute', choice);
    window.__shared = 0; window.__inTap = [];
    navigator.canShare = () => true;
    navigator.share = () => {
      window.__shared++;
      // Safari opens the sheet only inside the tap: the call must come while the click is being handled.
      window.__inTap.push(window.event?.type === 'click');
      if (shareOk === 'pending') return new Promise((ok, ko) => { window.__settleShare = ok; window.__failShare = ko; });
      if (shareOk === 'second-fails' && window.__shared > 1) return Promise.reject(Object.assign(new Error('x'), { name: 'InvalidStateError' }));
      if (shareOk === 'second-fails') return new Promise(() => {});
      return shareOk ? Promise.resolve() : Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    };
  }, [choice, shareOk]);
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  // The app creates its stores on first use: a set saved and the history opened once, as a person would.
  await put(page, 'workouts', [{ id: 'w1', exercise: 'bicep_curl', reps: 7, source: 'counter-core', createdAt: Date.now() }]);
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  await expect(page.getByTestId('contribute-history')).toBeVisible();
  await page.goto('/workout-vision/');
}

test('the sets waiting are sent, then forgotten; stopping erases them', async ({ page }) => {
  await open(page, 'yes', true);
  await put(page, 'contributions', [{ setId: 'w1', kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 7, appCount: 7, worldLandmarks: [], timestamps: [] }, { setId: 'w0', kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 8, appCount: 7, worldLandmarks: [], timestamps: [] }]);
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  const box = page.getByTestId('contribute-history');
  await expect(box).toContainText('2 séries prêtes à envoyer, à pr.dabertdavid@gmail.com.');
  await box.getByRole('button', { name: 'Envoyer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('2 séries partagées. Merci.');
  expect(await page.evaluate(() => window.__shared)).toBe(1);
  expect(await page.evaluate(() => window.__inTap)).toEqual([true]);
  expect(await count(page, 'contributions')).toBe(0);
  await expect(box).toContainText('Aucune série à envoyer pour l’instant.');
  await put(page, 'contributions', [{ setId: 'w2', kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 7, appCount: 7, worldLandmarks: [], timestamps: [] }]);
  await box.getByRole('button', { name: 'Arrêter et effacer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('C’est arrêté. Les séries en attente sont effacées.');
  expect(await count(page, 'contributions')).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('wv_contribute'))).toBe('no');
  await expect(box.getByRole('button', { name: 'Aider' })).toBeVisible();
});

test('a share that fails keeps the sets waiting', async ({ page }) => {
  await open(page, 'yes', false);
  await put(page, 'contributions', [{ setId: 'w1', kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 7, appCount: 7, worldLandmarks: [], timestamps: [] }]);
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  const box = page.getByTestId('contribute-history');
  await box.getByRole('button', { name: 'Envoyer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('Le partage n’a pas abouti. Touchez à nouveau pour télécharger.');
  expect(await count(page, 'contributions')).toBe(1);
});

const c = id => ({ setId: id, kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 7, appCount: 7, worldLandmarks: [], timestamps: [] });
async function history(page) {
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  return page.getByTestId('contribute-history');
}

test('a double tap opens one sheet and says nothing failed', async ({ page }) => {
  await open(page, 'yes', 'second-fails');
  await put(page, 'contributions', [c('w1')]);
  const box = await history(page);
  await expect(box.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
  await box.getByRole('button', { name: 'Envoyer' }).dblclick();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__shared)).toBe(1);
  await expect(box.locator('[role="status"]')).toHaveText('');
});

test('stopping while a sheet is open erases the sets, and the late share says nothing', async ({ page }) => {
  await open(page, 'yes', 'pending');
  await put(page, 'contributions', [c('w1')]);
  const box = await history(page);
  await expect(box.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
  await box.getByRole('button', { name: 'Envoyer' }).click();
  await box.getByRole('button', { name: 'Arrêter et effacer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('C’est arrêté. Les séries en attente sont effacées.');
  await page.evaluate(() => window.__settleShare());
  await page.waitForTimeout(300);
  await expect(box.locator('[role="status"]')).toHaveText('C’est arrêté. Les séries en attente sont effacées.');
  expect(await count(page, 'contributions')).toBe(0);
});

test('deleting a set deletes its contribution, and stopping stays possible with no set left', async ({ page }) => {
  await open(page, 'yes', true);
  await put(page, 'contributions', [c('w1')]);
  await history(page);
  await page.locator('.hist-btn').first().click();
  await page.getByRole('button', { name: 'Supprimer cette série' }).click();
  await page.getByRole('button', { name: 'Touchez encore pour supprimer' }).click();
  await expect(page.locator('.hist-btn')).toHaveCount(0);
  expect(await count(page, 'contributions')).toBe(0);
  await expect(page.getByTestId('contribute-history').getByRole('button', { name: 'Arrêter et effacer' })).toBeVisible();
});

test('a stop the phone cannot save says so, and contributing goes on (audit FINDING-016)', async ({ page }) => {
  await open(page, 'yes', true);
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  const box = page.getByTestId('contribute-history');
  await page.evaluate(() => {
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) { if (k === 'wv_contribute') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); };
    Storage.prototype.removeItem = function (k) { if (k === 'wv_contribute') throw new Error('refused'); return remove.call(this, k); };
  });
  await box.getByRole('button', { name: 'Arrêter et effacer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('L’arrêt n’a pas pu être enregistré sur ce téléphone. Réessayez.');
  expect(await page.evaluate(() => localStorage.getItem('wv_contribute'))).toBe('yes');
  await expect(box.getByRole('button', { name: 'Arrêter et effacer' })).toBeVisible();
});

test('a set deleted in the history leaves the file sent: the count and the file follow (audit of 2 October)', async ({ page }) => {
  await open(page, 'yes', true);
  await put(page, 'workouts', [{ id: 'w2', exercise: 'bicep_curl', reps: 8, source: 'counter-core', createdAt: Date.now() + 1000 }]);
  // The file leaves out each set's key: the two are told apart by their count.
  await put(page, 'contributions', [c('w1'), { ...c('w2'), count: 8 }]);
  const box = await history(page);
  await expect(box).toContainText('2 séries prêtes');
  // The newest set, w2 (count 8), comes first and is deleted: only w1's contribution (count 7) is left.
  await page.locator('.hist-btn').first().click();
  await page.getByRole('button', { name: 'Supprimer cette série' }).click();
  await page.getByRole('button', { name: 'Touchez encore pour supprimer' }).click();
  await expect(page.locator('.hist-btn')).toHaveCount(1);
  await expect(box).toContainText('1 série prête');
  await page.evaluate(() => { window.__files = []; const s = navigator.share; navigator.share = d => { window.__files.push(d.files[0]); return s(d); }; });
  await box.getByRole('button', { name: 'Envoyer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('1 série partagée. Merci.');
  const ids = await page.evaluate(async () => { const f = window.__files[0]; const t = f.name.endsWith('.gz') ? await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text() : await f.text(); return JSON.parse(t).sets.map(x => x.count); });
  expect(ids).toEqual([7]);
});
