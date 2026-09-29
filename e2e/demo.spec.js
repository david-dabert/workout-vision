// The entry's example (feature B): from the first screen, a visitor sees a drawn squat counted by
// the app, labelled as an example, without filming anything. The count ticks with each rep, the
// set ends on the core's count, and no text overlaps at the tour's three sizes, nor under Reduce Motion.
import { test, expect } from '@playwright/test';
import { layoutFaults } from '../test/real-phone/checks.mjs';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

const WORDS = {
  fr: { open: 'Voir un exemple', tag: 'Exemple', done: 'Fin de série : 5 répétitions comptées.', go: 'À vous', close: 'Fermer l’exemple' },
  en: { open: 'See an example', tag: 'Example', done: 'End of set: 5 reps counted.', go: 'Your turn', close: 'Close the example' },
};
const faults = page => page.evaluate(layoutFaults).then(list => list.filter(f => !f.startsWith('note: ')));

async function first(browser, size, lang, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport: size, reducedMotion, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(l => localStorage.setItem('wv_lang', l), lang);
  await page.goto('/workout-vision/');
  await expect(page.getByRole('button', { name: WORDS[lang].open })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(reducedMotion === 'reduce' ? 600 : 4600); // the entry has settled
  return { context, page, errors };
}

test('the example plays a set, ticking the count rep by rep, and ends on the core’s count (fr)', async ({ browser }) => {
  test.setTimeout(90_000);
  const { context, page, errors } = await first(browser, { width: 390, height: 664 }, 'fr');
  expect(await faults(page)).toEqual([]);
  await page.getByRole('button', { name: WORDS.fr.open }).click();
  await expect(page.locator('.demo-screen .demo-tag')).toHaveText(WORDS.fr.tag);
  // The counter, sampled as the set plays: from 0, one step at a time, to 5.
  const seen = [];
  await expect.poll(async () => {
    const n = Number(await page.locator('.demo-count').getAttribute('data-count'));
    if (seen.at(-1) !== n) seen.push(n);
    return n;
  }, { timeout: 30000, intervals: [100] }).toBe(5);
  expect(seen[0]).toBe(0);
  for (let i = 1; i < seen.length; i++) expect(seen[i] - seen[i - 1]).toBe(1);
  await expect(page.getByTestId('demo-result')).toContainText(WORDS.fr.done);
  await page.waitForTimeout(1000);
  expect(await faults(page)).toEqual([]);
  // Close: back to the entry. Then "À vous" leads on to the choice of lift.
  await page.getByRole('button', { name: WORDS.fr.close }).click();
  await expect(page.locator('.demo-screen')).toHaveCount(0);
  await expect(page.locator('.enter')).toBeVisible();
  await page.getByRole('button', { name: WORDS.fr.open }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.demo-screen')).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});

for (const size of [{ width: 390, height: 664 }, { width: 390, height: 745 }, { width: 375, height: 548 }]) {
  for (const lang of ['fr', 'en']) {
    test(`at ${size.width}×${size.height} under Reduce Motion the example is still, whole and clear (${lang})`, async ({ browser }) => {
      const { context, page, errors } = await first(browser, size, lang, 'reduce');
      expect(await faults(page), 'entry').toEqual([]);
      await page.getByRole('button', { name: WORDS[lang].open }).click();
      // No playback: the count and the result are there at once.
      await expect(page.getByTestId('demo-result')).toContainText(WORDS[lang].done, { timeout: 5000 });
      await expect(page.locator('.demo-count')).toHaveAttribute('data-count', '5');
      await expect(page.getByRole('button', { name: /Revoir|Watch again/ })).toHaveCount(0);
      expect(await faults(page), 'example').toEqual([]);
      // The next step is in view without scrolling on the two taller screens.
      const go = await page.getByRole('button', { name: WORDS[lang].go }).boundingBox();
      if (size.height >= 664) expect(go.y + go.height).toBeLessThanOrEqual(size.height);
      await page.getByRole('button', { name: WORDS[lang].go }).click();
      await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}

test('the example ends clear of overlaps at 375×548 with motion (en)', async ({ browser }) => {
  test.setTimeout(90_000);
  const { context, page, errors } = await first(browser, { width: 375, height: 548 }, 'en');
  expect(await faults(page), 'entry').toEqual([]);
  await page.getByRole('button', { name: WORDS.en.open }).click();
  await page.waitForTimeout(150);
  expect(await page.locator('.demo-screen').count()).toBe(1);
  await expect(page.getByTestId('demo-result')).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1000);
  expect(await faults(page), 'example').toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
