// The video packer (pack.html): videos picked, made small one at a time, labelled by David beside each, then one file
// holding the packed videos and labels.json. Read back here with an independent ZIP reader (fflate): every video is
// in it with the label typed beside it, and each packed video holds the app's samples, 15 a second.
import { test, expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { drawnWebm } from './shared/drawn-video.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block', acceptDownloads: true });

const PAGE = '/workout-vision/pack.html';
const rowOf = (page, name) => page.locator('.set', { has: page.locator('.set-head span', { hasText: name }) });

test('two videos packed and labelled become one file with both videos and their counts', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(PAGE);
  const a = Buffer.from(await drawnWebm(page, 3000), 'base64'), b = Buffer.from(await drawnWebm(page, 2000), 'base64');
  await page.locator('#videos').setInputFiles([
    { name: 'a.webm', mimeType: 'video/webm', buffer: a },
    { name: 'b.webm', mimeType: 'video/webm', buffer: b },
  ]);
  await expect(page.locator('.set')).toHaveCount(2);
  // Labelled against the file each row shows, whatever order the rows take.
  const ra = rowOf(page, 'a.webm'), rb = rowOf(page, 'b.webm');
  await ra.locator('select[id^=lift]').selectOption('squat');
  await ra.locator('input').fill('9');
  await rb.locator('select[id^=lift]').selectOption('overhead_press');
  await rb.locator('input').fill('');
  await expect(page.locator('.set.done')).toHaveCount(2, { timeout: 120000 });
  await expect(page.locator('#summary')).toContainText('2 of 2 packed');
  page.once('dialog', d => d.accept()); // one video has no reps: it goes in unlabelled, once confirmed
  await page.click('#make');
  const download = page.locator('#files button', { hasText: 'Download' });
  await expect(download).toHaveCount(1);
  const [dl] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(dl.suggestedFilename()).toMatch(/^workoutvision-pack-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.zip$/);
  const zip = unzipSync(new Uint8Array(readFileSync(await dl.path())));
  const labels = JSON.parse(new TextDecoder().decode(zip['labels.json']));
  const byName = Object.fromEntries(labels.sets.map(s => [s.original.name, s]));
  expect(byName['a.webm']).toMatchObject({ lift: 'squat', count: 9, labelKind: 'blind-pack' });
  expect(byName['b.webm']).toMatchObject({ lift: 'overhead_press', count: null });
  for (const s of labels.sets) {
    const mp4 = zip[s.video];
    expect(mp4, s.video).toBeTruthy();
    expect(new TextDecoder().decode(mp4.subarray(4, 8))).toBe('ftyp');
    expect(s.original.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(s.packed).toMatchObject({ fps: 15, width: 360, height: 640 });
    // The app's samples: 15 a second over the video's length (the drawn clip's frames are 33 ms apart).
    expect(Math.abs(s.packed.frames - s.packed.sourceDuration * 15)).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test('a video picked again is not added twice, and a count that is not a whole number stops the file', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(PAGE);
  const a = Buffer.from(await drawnWebm(page, 1500), 'base64');
  await page.locator('#videos').setInputFiles([{ name: 'a.webm', mimeType: 'video/webm', buffer: a }]);
  await page.locator('#videos').setInputFiles([{ name: 'a.webm', mimeType: 'video/webm', buffer: a }]);
  await expect(page.locator('.set')).toHaveCount(1);
  await page.locator('#lift0').selectOption('squat');
  await page.locator('#count0').fill('7.5');
  await expect(page.locator('.set .state')).toContainText('whole number from 0 to 99');
  await expect(page.locator('.set.done, .set.failed')).toHaveCount(1, { timeout: 60000 });
  await page.click('#make');
  await expect(page.locator('#summary')).toHaveText('Video 1: the reps must be a whole number from 0 to 99, or empty.');
  await expect(page.locator('#files button')).toHaveCount(0);
});

test('after a reload the packed videos and their labels are still there, ready for the file', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(PAGE);
  const a = Buffer.from(await drawnWebm(page, 1500), 'base64');
  await page.locator('#videos').setInputFiles([{ name: 'kept.webm', mimeType: 'video/webm', buffer: a }]);
  await page.locator('#lift0').selectOption('squat');
  await page.locator('#count0').fill('6');
  await expect(page.locator('.set.done')).toHaveCount(1, { timeout: 60000 });
  await page.reload();
  await expect(page.locator('.set.done')).toHaveCount(1);
  await expect(page.locator('#lift0')).toHaveValue('squat');
  await expect(page.locator('#count0')).toHaveValue('6');
  await page.click('#make');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#files button', { hasText: 'Download' }).click()]);
  const labels = JSON.parse(new TextDecoder().decode(unzipSync(new Uint8Array(readFileSync(await dl.path())))['labels.json']));
  expect(labels.sets).toHaveLength(1);
  expect(labels.sets[0]).toMatchObject({ lift: 'squat', count: 6 });
  page.once('dialog', d => d.accept());
  await page.click('#clear');
  await expect(page.locator('.set')).toHaveCount(0);
});
