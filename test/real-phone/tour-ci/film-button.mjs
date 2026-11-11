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
const launchBrowser = () => process.env.WV_BROWSER === 'chromium'
  ? chromium.launch({ executablePath: process.env.PW_CHROMIUM })
  : webkit.launch();
const { defaultBrowserType, ...iphone } = devices['iPhone 14'];
void defaultBrowserType;

async function sweep([W, H]) {
  const browser = await launchBrowser();
  try {
    let context = await browser.newContext({ ...iphone, viewport: { width: W, height: H }, locale: 'fr-FR', serviceWorkers: 'block', reducedMotion: 'reduce' });
    let page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.enter').click();
    await page.locator('.all-exercises [data-exercise]').first().waitFor();
    const keys = await page.$$eval('.all-exercises [data-exercise]', els => els.map(e => e.dataset.exercise));
    const lines = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      // A fresh page every 20 screens (35 until 11 November 2026): on CI's WebKit the click on the 35th screen of a
      // page (sissy_squat, index 139) timed out twice that day, at "performing click action" (runs 43023858079 and
      // 43065810398). The page slows as filming screens are opened and closed; why is not yet known (STATE.md).
      if (i > 0 && i % 20 === 0) {
        await context.close();
        context = await browser.newContext({ ...iphone, viewport: { width: W, height: H }, locale: 'fr-FR', serviceWorkers: 'block', reducedMotion: 'reduce' });
        page = await context.newPage();
        await page.goto(base, { waitUntil: 'networkidle' });
        await page.locator('.enter').click();
        await page.locator('.all-exercises [data-exercise]').first().waitFor();
      }
      await page.evaluate(k => document.querySelector(`.all-exercises [data-exercise="${k}"] .item-btn`).scrollIntoView({ block: 'center' }), key);
      await page.locator(`.all-exercises [data-exercise="${key}"] .item-btn`).click();
      const button = page.locator('.film-screen .actions .btn-primary');
      await button.waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(60);
      const box = await button.boundingBox();
      const titleH = await page.locator('.film-screen .title').evaluate(el => el.offsetHeight);
      lines.push({ key, W, H, top: Math.round(box.y), bottom: Math.round(box.y + box.height), titleH });
      await page.locator('.film-screen .icon-btn').click();
      await page.locator('.film-screen').waitFor({ state: 'detached' });
      await page.locator('.all-exercises').waitFor();
      await page.waitForTimeout(40);
    }
    await context.close();
    return lines;
  } finally {
    await browser.close();
  }
}

const all = [];
for (const size of sizes) {
  all.push(...await sweep(size));
}
const browserName = process.env.WV_BROWSER === 'chromium' ? 'Chromium' : 'WebKit';
const text = `# ${browserName}, iPhone 14 profile, fr-FR, Reduce Motion\n` + all.map(l => `${l.key} ${l.W}x${l.H} title ${l.titleH} button bottom ${l.bottom} of ${l.H}`).join('\n') + '\n';
writeFileSync(out, text);
// Out of view above the top as well as below the bottom (review 06).
const below = all.filter(l => l.top < 0 || l.bottom > l.H);
const gate = below.filter(l => l.H >= 664);
const summary = sizes.map(([W, H]) => `${W}x${H}: ${all.filter(l => l.W === W && l.H === H).length} exercises, ${below.filter(l => l.W === W && l.H === H).length} below the fold`);
console.log(summary.join('\n'));
// Every offered exercise was opened at every size: the list holds 182 (the machine seated back extension added on 5 October); before it 181: 181 since the walking lunge left it, the two barbell curls of 2 October,
// less the four floor exercises withdrawn on 3 October (offer.js, WITHDRAWN), and two of the three added the same day (the barbell jump squat is not yet counted, offer.js NOT_YET_COUNTED).
const EXPECTED = 183;
const short = sizes.filter(([W, H]) => all.filter(l => l.W === W && l.H === H).length !== EXPECTED);
if (short.length) { console.log(`not ${EXPECTED} exercises at:`, short.map(s => s.join('x')).join(', ')); process.exit(1); }
if (gate.length) { console.log('below the fold at 664 px or taller:', gate.map(l => `${l.key} ${l.W}x${l.H} ${l.bottom}`).join(', ')); process.exit(1); }
