import { webkit, devices, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/choice', base = 'http://127.0.0.1:4175/workout-vision/';
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR' });
const page = await context.newPage(), errors = [], failed = [], model = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure() }));
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
page.on('request', r => { if (r.url().endsWith('.task')) model.push(r.url()); });
await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('.altar')).toHaveCount(3);
  expect(model).toEqual([]);
  const options = [['lateral_raise', 'Élévations latérales'], ['bicep_curl', 'Curl biceps'], ['lat_pulldown', 'Tirage vertical']];
  for (const [lift, label] of options) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
    await page.screenshot({ path: `${dir}/${lift}.png` });
    await button.tap();
    await expect(page.locator('#core-lift')).toHaveValue(lift);
    await expect(page.locator('#core-file')).toBeVisible();
    await page.getByRole('button', { name: 'Retour', exact: true }).tap();
    await expect(page.locator('.choose-screen')).toBeVisible();
  }
  expect(model.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Un autre exercice/ }).tap();
  await expect(page.locator('[class*="libraryTitle"]')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${dir}/guide-destination.png` });
  const images = await page.locator('img').evaluateAll(imgs => imgs.filter(i => i.getBoundingClientRect().top < innerHeight).map(i => ({ src: i.src, loaded: i.complete && i.naturalWidth > 0 })));
  expect(images.every(i => i.loaded && i.src.startsWith(locationOrigin()))).toBe(true);
  await page.locator('[class*="backBtn"]').tap();
  await expect(page.locator('.choose-screen')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]); expect(failed).toEqual([]);
  const report = { result: 'PASS', buttons: options.map(o => o[1]).concat('Un autre exercice'), errors, failed, images, modelRequestedAfterChoice: model.length > 0 };
  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
function locationOrigin() { return new URL(base).origin; }
