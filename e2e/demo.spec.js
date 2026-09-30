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
  await expect(page.locator('.demo-screen')).toHaveCount(1); // mounted, so Escape is what closes it
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

// Review, 29 September: once "Entrer" is tapped, the example no longer opens (a double tap
// landing low, or a tap on Enter while the example's code loads, must not flash it up).
test('the example does not open once the entry is leaving', async ({ browser }) => {
  test.setTimeout(60_000);
  const { context, page } = await first(browser, { width: 390, height: 664 }, 'fr');
  await page.getByRole('button', { name: 'Entrer' }).click();
  await page.locator('.entry-demo').click({ force: true });
  await page.waitForTimeout(300);
  expect(await page.locator('.demo-screen').count()).toBe(0);
  await context.close();
});

// Review, 29 September: time spent away (the phone locked, another app) does not play the set:
// on return the count goes on from where it was, one rep at a time.
test('the example does not skip the set after a pause of the page', async ({ browser }) => {
  test.setTimeout(90_000);
  const { context, page } = await first(browser, { width: 390, height: 664 }, 'fr');
  await page.clock.install();
  await page.getByRole('button', { name: WORDS.fr.open }).click();
  await expect(page.locator('.demo-screen')).toHaveCount(1);
  await page.clock.runFor(4000);
  const before = Number(await page.locator('.demo-count').getAttribute('data-count'));
  await page.clock.fastForward(10000);
  await page.clock.runFor(200);
  const after = Number(await page.locator('.demo-count').getAttribute('data-count'));
  expect(after - before).toBeLessThanOrEqual(1);
  await context.close();
});

// Review, 30 September: under the example the entry's figure is not drawn (its canvas holds still),
// and once the example closes it moves again.
test('the entry figure holds still under the example and moves again after it', async ({ browser }) => {
  test.setTimeout(60_000);
  const { context, page } = await first(browser, { width: 390, height: 664 }, 'fr');
  const shot = () => page.evaluate(() => document.querySelector('.entry-stage').toDataURL());
  await page.getByRole('button', { name: WORDS.fr.open }).click();
  await expect(page.locator('.demo-screen')).toHaveCount(1);
  await page.waitForTimeout(200);
  const a = await shot(); await page.waitForTimeout(600); const b = await shot();
  expect(a === b).toBe(true);
  await page.getByRole('button', { name: WORDS.fr.close }).click();
  await expect(page.locator('.demo-screen')).toHaveCount(0);
  const c = await shot(); await page.waitForTimeout(600); const d = await shot();
  expect(c === d).toBe(false);
  await context.close();
});
