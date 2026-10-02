/**
 * Opens the filming screen of every offered exercise from the list, at the three sizes, and writes where
 * "Filmer ma série" ends: test/real-phone/tour-ci/film-button-after.txt (or WV_OUT). Exits 1 when the
 * button is below the fold for any exercise at 664 px or taller (review 05 of step 2, 29 September).
 * WebKit with the iPhone profile, or Chromium with WV_BROWSER=chromium (PW_CHROMIUM for its path).
 * Serve the build first: npx vite preview --port 4175 --strictPort.
 */
import { chromium, webkit, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const base = process.env.WV_BASE || 'http://127.0.0.1:4175/workout-vision/';
const out = process.env.WV_OUT || 'test/real-phone/tour-ci/film-button-after.txt';
const sizes = (process.env.WV_SIZES || '390x664,390x745,375x548').split(',').map(s => s.split('x').map(Number));
const browser = process.env.WV_BROWSER === 'chromium'
  ? await chromium.launch({ executablePath: process.env.PW_CHROMIUM })
  : await webkit.launch();
const { defaultBrowserType, ...iphone } = devices['iPhone 14'];
void defaultBrowserType;

async function sweep([W, H]) {
  const context = await browser.newContext({ ...iphone, viewport: { width: W, height: H }, locale: 'fr-FR', serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.enter').click();
  await page.locator('.all-exercises [data-exercise]').first().waitFor();
  const keys = await page.$$eval('.all-exercises [data-exercise]', els => els.map(e => e.dataset.exercise));
  const lines = [];
  for (const key of keys) {
    await page.evaluate(k => document.querySelector(`.all-exercises [data-exercise="${k}"] .item-btn`).scrollIntoView({ block: 'center' }), key);
    await page.locator(`.all-exercises [data-exercise="${key}"] .item-btn`).click();
    const button = page.locator('.film-screen .actions .btn-primary');
    await button.waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const box = await button.boundingBox();
    const titleH = await page.locator('.film-screen .title').evaluate(el => el.offsetHeight);
    lines.push({ key, W, H, top: Math.round(box.y), bottom: Math.round(box.y + box.height), titleH });
    await page.locator('.film-screen .icon-btn').click();
    await page.locator('.all-exercises').waitFor();
    await page.waitForTimeout(300);
  }
  await context.close();
  return lines;
}

const all = (await Promise.all(sizes.map(sweep))).flat();
await browser.close();
const browserName = process.env.WV_BROWSER === 'chromium' ? 'Chromium' : 'WebKit';
const text = `# ${browserName}, iPhone 14 profile, fr-FR, Reduce Motion\n` + all.map(l => `${l.key} ${l.W}x${l.H} title ${l.titleH} button bottom ${l.bottom} of ${l.H}`).join('\n') + '\n';
writeFileSync(out, text);
// Out of view above the top as well as below the bottom (review 06).
const below = all.filter(l => l.top < 0 || l.bottom > l.H);
const gate = below.filter(l => l.H >= 664);
const summary = sizes.map(([W, H]) => `${W}x${H}: ${all.filter(l => l.W === W && l.H === H).length} exercises, ${below.filter(l => l.W === W && l.H === H).length} below the fold`);
console.log(summary.join('\n'));
// Every offered exercise was opened at every size: the list holds 183: 181 since the walking lunge left it, and the two barbell curls of 2 October.
const EXPECTED = 183;
const short = sizes.filter(([W, H]) => all.filter(l => l.W === W && l.H === H).length !== EXPECTED);
if (short.length) { console.log(`not ${EXPECTED} exercises at:`, short.map(s => s.join('x')).join(', ')); process.exit(1); }
if (gate.length) { console.log('below the fold at 664 px or taller:', gate.map(l => `${l.key} ${l.W}x${l.H} ${l.bottom}`).join(', ')); process.exit(1); }
