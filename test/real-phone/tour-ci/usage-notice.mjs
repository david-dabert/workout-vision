/**
 * The notice of the anonymous usage counts (UsageNotice.jsx; WP2.3), shot at the tour's three sizes, in WebKit with
 * the iPhone profile, on a build that names an events server (VITE_EVENTS_URL=https://events.invalid/event; requests
 * to it are answered here and never leave). French and English: the line under the choice of lift, the notice reached
 * from it, its steps unfolded, and the notice reached from the Choice footer. Each settled shot is checked for a blank
 * frame and for its layout (checks.mjs); any fault, console error or failed request fails the run.
 *
 * WV_BASE: the build served (http://127.0.0.1:4177/workout-vision/ by default); WV_SIZES: 390x664,390x745,375x548 by
 * default; WV_DIR: where the shots and results.json go; WV_BROWSER=chromium with PW_CHROMIUM, for a local check only.
 */
import { webkit, chromium, devices, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { frameFault, layoutFaults } from '../checks.mjs';

const base = process.env.WV_BASE || 'http://127.0.0.1:4177/workout-vision/';
const sizes = (process.env.WV_SIZES || '390x664,390x745,375x548').split(',').map(s => s.split('x').map(Number));
const root = process.env.WV_DIR || 'test/real-phone/tour-ci/usage-notice';
const inChromium = process.env.WV_BROWSER === 'chromium';
const browser = inChromium ? await chromium.launch({ executablePath: process.env.PW_CHROMIUM }) : await webkit.launch();
const probe = await (await browser.newContext()).newPage();
const { defaultBrowserType, ...iphone } = devices['iPhone 14'];
void defaultBrowserType;
const all = [];

for (const [W, H] of sizes) for (const lang of ['fr', 'en']) {
  const dir = `${root}/${W}x${H}-${lang}`;
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ ...iphone, viewport: { width: W, height: H }, locale: lang === 'fr' ? 'fr-FR' : 'en-GB', colorScheme: 'dark', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [], failed = [], faults = [], notes = [], shots = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.route('https://events.invalid/**', r => r.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
  const shot = async name => {
    const jpeg = await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 82 });
    shots.push(name);
    const fault = await frameFault(probe, jpeg);
    if (fault) faults.push(`${name}: ${fault}`);
    for (const f of await page.evaluate(layoutFaults)) (f.startsWith('note: ') ? notes : faults).push(`${name}: ${f.replace(/^note: /, '')}`);
  };
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    const note = page.getByTestId('usage-note');
    await note.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('[data-testid="usage-note"]').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    await shot('01-choice-line');
    await page.getByTestId('usage-more').click();
    await expect(page.getByTestId('usage-notice')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await shot('02-notice');
    await page.locator('.un-events summary').click();
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.un-events').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await shot('03-notice-steps');
    await page.evaluate(() => { const sc = document.querySelector('.usage-notice-screen'); sc.scrollTo(0, sc.scrollHeight); window.scrollTo(0, document.body.scrollHeight); });
    await page.waitForTimeout(300);
    await shot('04-notice-end');
    // Whether the notice fits one screen with its steps folded (the task's "one screen"), recorded, not gated.
    await page.locator('.un-events summary').click();
    // The screen scrolls inside itself: the last line's place in its content, from its top.
    const tall = await page.evaluate(() => {
      const sc = document.querySelector('.usage-notice-screen'), note = document.querySelector('.un-body > .un-p:last-of-type');
      return Math.round(note.getBoundingClientRect().bottom - sc.getBoundingClientRect().top + sc.scrollTop);
    });
    notes.push(`notice's last line ends at ${tall} px, steps folded, for a ${H} px screen`);
    await page.getByRole('button', { name: lang === 'fr' ? 'Retour' : 'Back' }).first().click();
    await page.waitForTimeout(1200);
    await page.getByTestId('usage-link').scrollIntoViewIfNeeded();
    await page.getByTestId('usage-link').click();
    await expect(page.getByTestId('usage-notice')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('usage-notice-host')).toContainText('events.invalid');
  } catch (e) {
    faults.push(`stopped: ${e.message.split('\n')[0]}`);
  }
  const result = { browser: inChromium ? 'chromium' : 'webkit', profile: 'iPhone 14', viewport: `${W}x${H}`, lang, shots, faults, notes, errors, failed, pass: !faults.length && !errors.length && !failed.length };
  writeFileSync(`${dir}/results.json`, JSON.stringify(result, null, 2) + '\n');
  all.push(result);
  await context.close();
}
console.log(JSON.stringify(all, null, 2));
await browser.close();
process.exit(all.every(r => r.pass) ? 0 : 1);
