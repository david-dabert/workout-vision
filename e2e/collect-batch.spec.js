// The batch collector (collect-batch.html): many videos picked at once, one numbered set each. What the
// page says about a set must match the set: a note on a missing exercise or count goes once it is given,
// and a video picked again is not added twice (seventh review, 30 September 2026).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const video = name => ({ name, mimeType: 'video/quicktime', buffer: Buffer.from(`not a real video ${name}`) });

async function open(page) {
  await page.goto('/workout-vision/collect-batch.html');
  await expect(page.locator('#collect')).toBeHidden();
}

test('a set marked for a missing exercise and count is cleared once both are given', async ({ page }) => {
  await open(page);
  await page.locator('#videos').setInputFiles([video('a.mov')]);
  await expect(page.locator('.set')).toHaveCount(1);
  await page.click('#collect');
  const state = page.locator('.set .state');
  await expect(state).toHaveText('Set 1: choose the exercise and enter the reps you counted (0 to 99).');
  await page.selectOption('#lift0', { index: 1 });
  await expect(state).toHaveText('Set 1: enter the reps you counted (0 to 99).');
  await page.fill('#count0', '8');
  await expect(state).toHaveText('');
  await expect(page.locator('.set')).not.toHaveClass(/failed/);
});

test('a video picked again is not added twice', async ({ page }) => {
  await open(page);
  await page.locator('#videos').setInputFiles([video('a.mov'), video('b.mov')]);
  await expect(page.locator('.set')).toHaveCount(2);
  await page.locator('#videos').setInputFiles([video('b.mov'), video('c.mov')]);
  await expect(page.locator('.set-head')).toHaveText([/Set 1\s*a\.mov/, /Set 2\s*b\.mov/, /Set 3\s*c\.mov/]);
});

test('after a reload, numbering goes on from the files already shared, until David starts again', async ({ page }) => {
  // Sets 1 to 12 shared before the tab was reloaded: what the page remembers of them.
  await page.goto('/workout-vision/collect-batch.html');
  await page.evaluate(() => localStorage.setItem('wv-batch-collector', JSON.stringify({ gen: 0, next: 13 })));
  await page.reload();
  await expect(page.locator('#summary')).toContainText('The next set is set 13.');
  await page.locator('#videos').setInputFiles([video('m.mov'), video('n.mov')]);
  await expect(page.locator('.set-head b')).toHaveText(['Set 13', 'Set 14']);
  page.once('dialog', d => d.accept());
  await page.click('#restart');
  await expect(page.locator('.set')).toHaveCount(0);
  await page.locator('#videos').setInputFiles([video('m.mov')]);
  await expect(page.locator('.set-head b')).toHaveText(['Set 1']);
});

test('a restart from set 1 is not undone by another open tab holding the old numbers', async ({ context }) => {
  const a = await context.newPage(), b = await context.newPage();
  await a.goto('/workout-vision/collect-batch.html');
  await a.evaluate(() => localStorage.setItem('wv-batch-collector', JSON.stringify({ gen: 0, next: 13 })));
  await a.reload(); await b.goto('/workout-vision/collect-batch.html');
  await b.locator('#videos').setInputFiles([video('x.mov')]);
  await expect(b.locator('.set-head b')).toHaveText(['Set 13']);
  a.once('dialog', d => d.accept());
  await a.locator('#videos').setInputFiles([video('m.mov')]);
  await a.click('#restart');
  // Tab B, still holding next 13, writes what it remembers (as a Share or Download tap does).
  await b.evaluate(() => document.getElementById('download').click());
  await a.locator('#videos').setInputFiles([video('n.mov')]);
  await expect(a.locator('.set-head b')).toHaveText(['Set 1']);
});
