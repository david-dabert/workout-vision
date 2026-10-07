// The crash log kept on the phone (src/lib/crashLog.js; crash at the demo of 7 October): after a session that did not
// end cleanly, the choice of lift says where the app was, offers the detail to copy, and the note goes once dismissed.
// A page left or reloaded (the service worker's reload after a deploy, main.jsx) ended cleanly: no note.
import { test, expect } from '@playwright/test';
import { start } from './shared/filmed-set.js';

const BASE = '/workout-vision/';

test('after a session that did not end cleanly, the choice says so; the detail copies; the note dismisses', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = await start(page);
  // The previous session, a minute ago, stopped while the video was read: its log was never marked clean.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('wv_test_crash')) return;
    sessionStorage.setItem('wv_test_crash', '1');
    localStorage.setItem('wv_crash_log', JSON.stringify({ v: 1, started: Date.now() - 90000, at: Date.now() - 60000, clean: false, screen: 'analyze', lift: 'bicep_curl', phase: 'extracting', sample: 212, frame: [360, 640], decoder: null, file: { type: 'video/quicktime', size: 412000000 }, error: null }));
  });
  await page.goto(BASE);
  const note = page.getByTestId('crash-note');
  await expect(note).toContainText('L’appli a redémarré pendant la lecture de la vidéo (analyse). Le détail est gardé sur ce téléphone.');
  await page.getByTestId('crash-copy').click();
  await expect(note).toContainText('Détail copié.');
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied).toMatchObject({ screen: 'analyze', lift: 'bicep_curl', phase: 'extracting', sample: 212, frame: [360, 640], clean: false });
  await page.getByRole('button', { name: 'Masquer cette note' }).click();
  await expect(note).toHaveCount(0);
  // A reload is a clean end of the session: no note comes back, and none is made.
  await page.reload();
  await expect(page.locator('.choose-screen')).toBeVisible();
  await expect(page.getByTestId('crash-note')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a page killed by the system leaves a note at the next launch; a reload does not', async ({ page, context }) => {
  await start(page);
  await page.goto(BASE);
  await expect(page.locator('.choose-screen')).toBeVisible();
  await expect(page.getByTestId('crash-note')).toHaveCount(0);
  // A reload, as the service worker's after a deploy: a clean navigation, no note.
  await page.reload();
  await expect(page.locator('.choose-screen')).toBeVisible();
  await expect(page.getByTestId('crash-note')).toHaveCount(0);
  // The renderer is killed while the page is on screen, as an iPhone kills a page out of memory: no pagehide.
  const crashed = page.waitForEvent('crash', { timeout: 10000 });
  await page.goto('chrome://crash', { timeout: 5000 }).catch(() => {});
  await crashed;
  const next = await context.newPage();
  await next.goto(BASE);
  await expect(next.getByTestId('crash-note')).toContainText('L’appli a redémarré (choix de l’exercice). Le détail est gardé sur ce téléphone.');
});
