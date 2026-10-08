import { test, expect, devices, webkit } from '@playwright/test';
import { existsSync } from 'node:fs';
import { PRO } from '../src/components/experience/pro-copy.js';

// Espace pro in WebKit, the iPhone's engine, with the iPhone profile (8 October 2026: on David's iPhone the programme's
// link said "The link could not be prepared" and its PDF could be neither shared nor downloaded, while e2e/pro.spec.js
// passed in Chromium). The link must be ready within the moment the coach takes to reach its button, and the PDF must
// come out. Each step's facts are printed (the engine's stream APIs, how long the link took, what the PDF tap did), so
// a run reads as a diagnosis. Where Playwright's WebKit is not installed these tests skip, except in CI.
const hasWebKit = (() => { try { return existsSync(webkit.executablePath()); } catch { return false; } })();
test.skip(!hasWebKit && !process.env.CI, 'WebKit is not installed here (npx playwright install webkit)');
test.use({ ...devices['iPhone 14'], browserName: 'webkit', launchOptions: {}, serviceWorkers: 'block' });

const c = PRO.en;

async function prepare(page, { mockShare }) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(mock => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'en');
    if (mock) {
      navigator.share = data => { window.__shared = data; return Promise.resolve(); };
      navigator.canShare = () => false;
    }
  }, mockShare);
  return errors;
}

async function buildProgramme(page) {
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  const row = page.getByTestId('choice-pro');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByTestId('pro-screen')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('pro-new').click();
  await expect(page.getByTestId('pro-editor')).toBeVisible();
  await page.locator('#pTitle').fill('Lower body, week 1');
  await page.getByTestId('pro-add').click();
  await expect(page.getByTestId('pro-picker')).toBeVisible();
  await page.locator('#all-search').fill('squat');
  await page.locator('[data-exercise="squat"] button').click();
  await expect(page.getByTestId('pro-item')).toHaveCount(1);
}

test.describe('Espace pro, WebKit, iPhone profile', () => {
  test('the engine packs a link as programme.js does', async ({ page }) => {
    await prepare(page, { mockShare: false });
    await page.goto('/workout-vision/');
    const facts = await page.evaluate(async () => {
      const out = { ua: navigator.userAgent, CompressionStream: typeof CompressionStream, DecompressionStream: typeof DecompressionStream, blobStream: typeof Blob.prototype.stream, share: typeof navigator.share, canShare: typeof navigator.canShare };
      const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, t: 'Lower body, week 1', x: [['squat', 3, 10, 90]] }));
      const t0 = performance.now();
      try {
        const packed = (async () => {
          const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
          return new Uint8Array(await new Response(stream).arrayBuffer()).length;
        })();
        out.gzipBytes = await Promise.race([packed, new Promise(r => setTimeout(() => r('no answer in 5 s'), 5000))]);
      } catch (e) { out.gzipError = `${e.name}: ${e.message}`; }
      out.gzipMs = Math.round(performance.now() - t0);
      return out;
    });
    console.log('[pro webkit] engine', JSON.stringify(facts));
    expect(typeof facts.gzipBytes, JSON.stringify(facts)).toBe('number');
  });

  test('the link is ready at once and the PDF comes out (share sheet without files)', async ({ page }) => {
    const errors = await prepare(page, { mockShare: true });
    await buildProgramme(page);
    const t0 = Date.now();
    await expect(page.getByTestId('pro-link')).not.toHaveAttribute('aria-disabled', 'true', { timeout: 3000 });
    console.log('[pro webkit] link ready after', Date.now() - t0, 'ms');
    await page.getByTestId('pro-link').click();
    const shared = await page.waitForFunction(() => window.__shared, null, { timeout: 3000 }).then(h => h.jsonValue());
    console.log('[pro webkit] link', shared.url.length, 'characters,', shared.url.split('#programme=')[1]?.[0] === 'z' ? 'packed' : 'plain');
    expect(shared.url).toMatch(/#programme=[zj][A-Za-z0-9_-]+$/);

    await expect(page.getByTestId('pro-pdf')).toContainText(c.sharePdf, { timeout: 15000 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId('pro-pdf').click()]);
    console.log('[pro webkit] pdf download', download.suggestedFilename());
    expect(download.suggestedFilename()).toMatch(/^programme-.*\.pdf$/);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the PDF tap with the engine\'s own share sheet', async ({ page }) => {
    const errors = await prepare(page, { mockShare: false });
    await buildProgramme(page);
    await expect(page.getByTestId('pro-pdf')).toContainText(c.sharePdf, { timeout: 15000 });
    const downloads = [];
    page.on('download', d => downloads.push(d.suggestedFilename()));
    await page.getByTestId('pro-pdf').click();
    await page.waitForTimeout(3000);
    const status = await page.locator('.pro-status').textContent();
    console.log('[pro webkit] own share sheet:', JSON.stringify({ status, downloads, errors }));
    expect(status === c.pdfDownloaded || downloads.length > 0 || status === '', status).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
