import { webkit, devices, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/entry';
mkdirSync(dir, { recursive: true });
const base = 'http://127.0.0.1:4175/workout-vision/';
const browser = await webkit.launch();
const report = [];
async function run(name, options, test) {
  const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', ...options });
  const page = await context.newPage();
  const errors = [], failed = [], requests = [], consoleLines = [];
  page.on('console', m => { consoleLines.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure() }));
  page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
  try {
    await test(page, requests);
    expect(errors).toEqual([]); expect(failed).toEqual([]);
    report.push({ name, result: 'PASS', errors, failed, consoleLines });
  } catch (error) {
    report.push({ name, result: 'FAIL', message: error.message, errors, failed, consoleLines });
    throw error;
  } finally { writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2)); await context.close(); }
}
try {
  await run('first visit, skip, Enter, preserved link, return and replay', {}, async (page, requests) => {
    await page.goto(`${base}#analyze`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Votre corps est un temple.' })).toBeVisible();
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${dir}/01-entry-fr.png` });
    expect(requests.filter(u => /\.task(?:\?|$)/.test(u))).toEqual([]);
    expect(requests.filter(u => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
    for (const font of ['Instrument Serif', 'Geist', 'Geist Mono']) {
      expect(await page.evaluate(f => document.fonts.check(`16px "${f}"`), font)).toBe(true);
    }
    await page.getByRole('button', { name: 'Afficher l’entrée sans attendre' }).tap({ position: { x: 15, y: 100 } });
    await page.getByRole('button', { name: 'Entrer', exact: true }).tap();
    await expect(page.locator('#core-lift')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#analyze');
    await page.screenshot({ path: `${dir}/02-after-enter.png` });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.entry-experience')).toHaveCount(0);
    await expect(page.locator('#core-lift')).toBeVisible();
    await page.goto(`${base}?entry#analyze`, { waitUntil: 'networkidle' });
    await expect(page.locator('.entry-experience')).toBeVisible();
    await page.getByRole('button', { name: 'Afficher l’entrée sans attendre' }).tap({ position: { x: 15, y: 100 } });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/03-replay-skipped.png` });
    await page.getByRole('button', { name: 'Entrer', exact: true }).tap();
    await expect(page.locator('#core-lift')).toBeVisible();
    expect(new URL(page.url()).searchParams.has('entry')).toBe(false);
  });
  await run('reduced motion stays still; English Enter works', { reducedMotion: 'reduce', locale: 'en-GB' }, async page => {
    await page.goto(`${base}#analyze`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Your body is a temple.' })).toBeVisible();
    const before = await page.locator('canvas').evaluate(c => c.toDataURL());
    await page.waitForTimeout(1000);
    expect(await page.locator('canvas').evaluate(c => c.toDataURL())).toBe(before);
    await page.screenshot({ path: `${dir}/04-reduced-en.png` });
    await page.getByRole('button', { name: 'Enter', exact: true }).tap();
    await expect(page.locator('#core-lift')).toBeVisible();
  });
  const response = await fetch(`${base}mediapipe/vision_wasm_internal.wasm`);
  expect(response.headers.get('content-type')).toBe('application/wasm');
  console.log(JSON.stringify(report, null, 2));
  console.log('WASM Content-Type:', response.headers.get('content-type'));
} finally { await browser.close(); }
