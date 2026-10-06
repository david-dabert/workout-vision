// After a screen change, focus is on the new screen, never left on the screen that went (inert) or on nothing:
// VoiceOver and the keyboard go on from the new screen's title (audit of 3 October).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test('the new screen takes the focus', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  const row = page.getByRole('button', { name: /Vos séries/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-screen')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => {
    const a = document.activeElement;
    return !!a && a !== document.body && !a.closest('.wv-leaving') && !!a.closest('.wv-current');
  })).toBe(true);
});

test('after a set is deleted, focus is on the next set, not on nothing', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => { const tx = r.result.transaction('workouts', 'readwrite'); for (const [id, t, reps] of [['a', 1, 5], ['b', 2, 6], ['c', 3, 7]]) tx.objectStore('workouts').put({ id, exercise: 'bicep_curl', reps, source: 'counter-core', createdAt: Date.now() - t * 60000 }, id); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => ko(tx.error); };
  }));
  await page.reload();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  // The middle set is deleted: focus goes to the set listed after it (5, 6, 7 newest first), not to the top one
  // (third audit C13, 3 October).
  await page.locator('.hist-btn').nth(1).click();
  await page.getByRole('button', { name: 'Supprimer cette série' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Touchez encore pour supprimer' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.hist-btn')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('hist-btn') ? document.activeElement.querySelector('.hist-n')?.textContent : null)).toBe('7');
});

// Audit of 6 October: the analysis screen had no heading, so its focus fell on Cancel, the first thing a
// keyboard or VoiceOver user met there. Its eyebrow is now its heading, and takes the focus. On the way,
// the filming screen's two mode buttons are full 44 px touch targets.
test('during the analysis, focus is on the screen’s heading, not on Cancel', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', () => {}); // held back: the analysis stays on screen
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await page.getByRole('button', { name: 'Curl biceps' }).first().click({ timeout: 20000 });
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  for (const h of await page.$$eval('.film-mode-opt', els => els.map(el => el.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  await page.locator('.film-screen input[type=file]').nth(1).setInputFiles({ name: 'set.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a real video') });
  await expect(page.locator('.watch-screen')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => {
    const a = document.activeElement;
    return a?.closest('.watch-screen') ? `${a.tagName} ${a.className}` : null;
  })).toBe('H1 eyebrow');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Curl biceps · /);
});

// Audit of 6 October: an eyebrow set as a heading took the old app's bold (styles/_base.css), faux bold in a mono
// face with no bold; it reads as every other eyebrow, in the weight and leading of a paragraph one.
test('an eyebrow that is a heading looks like every other eyebrow', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => { const tx = r.result.transaction('workouts', 'readwrite'); tx.objectStore('workouts').put({ id: 'a', exercise: 'bicep_curl', reps: 5, source: 'counter-core', createdAt: Date.now() - 60000 }, 'a'); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => ko(tx.error); };
  }));
  await page.reload();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  const heading = page.locator('.history-screen h2.eyebrow', { hasText: 'Vos données' });
  await expect(heading).toBeVisible({ timeout: 20000 });
  const look = await heading.evaluate(el => { const c = getComputedStyle(el); return { weight: c.fontWeight, leading: parseFloat(c.lineHeight) / parseFloat(c.fontSize) }; });
  expect(look.weight).toBe('400');
  expect(look.leading).toBeCloseTo(1.5, 2);
});
