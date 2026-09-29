// The set collector (collect.html) makes a labelled file: landmarks and the count David typed.
// A file must never carry a count its landmarks do not support (CLAUDE.md R1). The collector
// therefore treats an interruption as the app does (src/lib/interruption.js): it waits for the
// page to be visible, keeps the screen awake, stops when the page is hidden, and offers no file
// after an interruption. Its fields are locked while a set is processed, and a count that is not
// a whole number is refused rather than cut (28 September 2026).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const hide = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
const show = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});
const pagehide = page => page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
const video = { name: 'set.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a real video') };

async function open(page) {
  // Hold the pose model back, so the set is still being processed when the page is hidden.
  await page.route('**/pose_landmarker_full.task', () => {});
  await page.addInitScript(() => {
    window.__wake = [];
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async t => { window.__wake.push(t); return { released: false, release: async () => {} }; } } });
  });
  await page.goto('/workout-vision/collect.html');
  await expect(page.locator('#lift option')).not.toHaveCount(0);
}

for (const [how, trigger] of [['hidden', hide], ['pagehide', pagehide]]) {
  test(`a set interrupted by ${how} offers no file, even once the page is back`, async ({ page }) => {
    await open(page);
    await page.fill('#count', '7');
    await page.locator('#video-input').setInputFiles(video);
    await expect(page.locator('#status')).toContainText('Loading pose model', { timeout: 20000 });
    expect(await page.evaluate(() => window.__wake)).toEqual(['screen']);
    await trigger(page);
    await expect(page.locator('#status')).toContainText('interrupted');
    await show(page);
    await page.waitForTimeout(1000);
    await expect(page.locator('#result')).toBeHidden();
    await expect(page.locator('#save-link')).not.toHaveAttribute('href', /.+/);
  });
}

test('the exercise, the count and the view are locked while a set is processed', async ({ page }) => {
  await open(page);
  await page.fill('#count', '7');
  await page.locator('#video-input').setInputFiles(video);
  await expect(page.locator('#status')).toContainText('Loading pose model', { timeout: 20000 });
  for (const id of ['#lift', '#count', '#view']) await expect(page.locator(id)).toBeDisabled();
  await hide(page);
  await expect(page.locator('#status')).toContainText('interrupted');
  for (const id of ['#lift', '#count', '#view']) await expect(page.locator(id)).toBeEnabled();
});

for (const typed of ['7.5', '100']) {
  test(`a count of ${typed} is refused, not cut to a whole number of reps`, async ({ page }) => {
    await open(page);
    await page.fill('#count', typed);
    await page.locator('#video-input').setInputFiles(video);
    await expect(page.locator('#status')).toContainText('whole number');
    await page.waitForTimeout(500);
    await expect(page.locator('#status')).not.toContainText('Hashing');
    await expect(page.locator('#status')).not.toContainText('Loading pose model');
  });
}

test('the page says it is for David\'s own sets, and where a set of anyone else goes', async ({ page }) => {
  await open(page);
  const note = page.locator('#own-sets');
  await expect(note).toBeVisible();
  await expect(note).toContainText("For David's own sets only.");
  // Whose set it is, not who filmed it: a set of anyone else, even filmed by David, stays on the Mac.
  await expect(note).toContainText('A set of anyone else, whoever films it,');
  await expect(note).toContainText('scripts/collect-clips.mjs');
  expect(await note.textContent()).not.toContain('—');
});

// Step 2 (PLAN.md, GROWTH): the collector offers the same exercises as the app, so that a set of any
// of them can be collected.
test('the collector offers the 181 exercises the app counts, by their names in both languages', async ({ page }) => {
  await open(page);
  await expect(page.locator('#lift option')).toHaveCount(181);
  await expect(page.locator('#lift option[value="forward_lunge"]')).toHaveText('Forward Lunge / Fente avant');
  await expect(page.locator('#lift option[value="walking_lunge"]')).toHaveCount(0);
  await expect(page.locator('#lift option[value="lateral_raise"]')).toHaveCount(1);
  await expect(page.locator('#lift option[value="pec_deck"]')).toHaveCount(0);
});
