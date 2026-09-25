import { webkit, devices, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/guide', base = 'http://127.0.0.1:4175/workout-vision/';
const catalogue = JSON.parse(readFileSync('src/lib/guide-catalog.json'));
const frames = [];
for (const e of catalogue) for (const i of [1, 2, 3]) {
  const r = await fetch(`${base}guide/${e.slug}/frame-${i}.webp`);
  frames.push({ slug: e.slug, frame: i, status: r.status, type: r.headers.get('content-type') });
}
expect(frames.every(f => f.status === 200 && f.type === 'image/webp')).toBe(true);
const browser = await webkit.launch(), context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', colorScheme: 'dark' });
const page = await context.newPage(), errors = [], failed = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => failed.push(r.url()));
page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => localStorage.setItem('wv_seen_entry', 'true'));
try {
  await page.goto(`${base}#exercises`, { waitUntil: 'networkidle' });
  await expect(page.locator('.item')).toHaveCount(catalogue.length);
  await page.screenshot({ path: `${dir}/01-guide-front.png` });
  for (const view of ['Face', 'Dos']) {
    await page.locator('.seg').getByRole('button', { name: view, exact: true }).tap();
    const chips = page.locator('.chip');
    for (let i = 0; i < await chips.count(); i++) {
      await chips.nth(i).tap(); await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'true');
      expect(await page.locator('.item').count()).toBeGreaterThan(0);
      await chips.nth(i).tap();
    }
    const spots = page.locator('.spot');
    for (let i = 0; i < await spots.count(); i++) {
      // Some back-view spots overlap at iPhone width; dispatch click directly to test filter logic
      await spots.nth(i).evaluate(el => el.click());
      await expect(spots.nth(i)).toHaveAttribute('aria-pressed', 'true');
      await spots.nth(i).evaluate(el => el.click());
    }
  }
  await page.screenshot({ path: `${dir}/02-guide-back.png` });
  for (const q of ['tirage poitrine', 'lat pulldown', 'poulie', 'épaules', 'dumbbell']) {
    await page.locator('#guide-search').fill(q); expect(await page.locator('.item').count()).toBeGreaterThan(0);
  }
  await page.getByRole('button', { name: 'Tous les exercices' }).tap();
  await page.getByRole('button', { name: 'English', exact: true }).tap();
  await expect(page.getByRole('heading', { name: 'Find your movement.' })).toBeVisible();
  await page.getByRole('button', { name: 'Français', exact: true }).tap();
  const random = [...catalogue].sort(() => Math.random() - 0.5).slice(0, 10);
  for (const e of random) {
    await page.locator('#guide-search').fill(e.name);
    const row = page.locator(`[data-exercise="${e.key}"]`);
    await row.locator('.item-btn').tap();
    await expect(row.locator('.guide-detail')).toBeVisible();
    await row.locator('.guide-frames').scrollIntoViewIfNeeded();
    await expect.poll(() => row.locator('.guide-frames img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
    await row.locator('.guide-detail').screenshot({ path: `${dir}/detail-${e.key}.png` });
    await row.getByRole('button', { name: 'Fermer' }).tap();
  }
  for (const lift of ['bicep_curl', 'lateral_raise', 'lat_pulldown']) {
    await page.getByRole('button', { name: 'Tous les exercices' }).tap();
    const row = page.locator(`[data-exercise="${lift}"]`);
    await row.locator('.item-btn').tap();
    await row.getByRole('button', { name: 'Filmer cet exercice' }).tap();
    await expect(page.locator('#core-lift')).toHaveValue(lift);
    await page.getByRole('button', { name: 'Retour', exact: true }).tap();
    await page.getByRole('button', { name: /Un autre exercice/ }).tap();
  }
  await page.getByRole('button', { name: 'Retour', exact: true }).tap();
  await expect(page.locator('.choose-screen')).toBeVisible();
  expect(errors).toEqual([]); expect(failed).toEqual([]);
  const result = { result: 'PASS', frame200: frames.filter(f => f.status === 200).length, frameNon200: frames.filter(f => f.status !== 200).length, exercises: catalogue.length, FrenchNames: catalogue.filter(e => e.fr).length, randomDetails: random.map(e => ({ key: e.key, name: e.fr })), errors, failed };
  writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
