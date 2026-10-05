/**
 * The tour in CI (PLAN.md, GROWTH, after step 1; David's order of 29 September 2026): every screen
 * the app reaches without a video, on the production build, in WebKit with the iPhone profile, in
 * French. Entry → choice → the list under the cards → filming a card lift → back → filming an
 * exercise without a card, from the list → back → the guide → back → the history, with a saved set →
 * its report. The analysis, result and replay screens need David's clips and stay on the Mac
 * (test/real-phone/step3b/tour/tour.mjs).
 *
 * Every change of screen is shot 150 ms after the tap (t*.jpg) and every settled screen once
 * more. Each shot is checked for a blank or white frame, each settled one for its layout
 * (checks.mjs: rules 7 and 8 of PLAN.md), and at 390×664 and 390×745 the screen's main action must
 * be in view without scrolling. Any console error, page error or failed request, any fault, fails
 * the run. results.json holds the srcHash of the code shot (scripts/src-hash.mjs).
 *
 * WV_W, WV_H: the viewport (390×664 by default); WV_REDUCED=1: Reduce Motion; WV_SCHEME=light:
 * the light system appearance; WV_DIR: where the shots and results.json go; WV_BASE: the build
 * served (http://127.0.0.1:4175/workout-vision/ by default); WV_BROWSER=chromium with PW_CHROMIUM
 * runs it in Chromium, for a local check only.
 */
import { webkit, chromium, devices, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { frameFault, layoutFaults } from '../checks.mjs';

const W = Number(process.env.WV_W) || 390, H = Number(process.env.WV_H) || 664;
const reduced = process.env.WV_REDUCED === '1', light = process.env.WV_SCHEME === 'light';
const dir = process.env.WV_DIR || `test/real-phone/tour-ci/${W}x${H}${reduced ? '-reduce' : ''}${light ? '-light' : ''}`;
const base = process.env.WV_BASE || 'http://127.0.0.1:4175/workout-vision/';
const inChromium = process.env.WV_BROWSER === 'chromium';
mkdirSync(dir, { recursive: true });

const browser = inChromium
  ? await chromium.launch({ executablePath: process.env.PW_CHROMIUM })
  : await webkit.launch();
const { defaultBrowserType, ...iphone } = devices['iPhone 14'];
void defaultBrowserType;
const context = await browser.newContext({
  ...iphone,
  viewport: { width: W, height: H },
  locale: 'fr-FR',
  colorScheme: light ? 'light' : 'dark',
  reducedMotion: reduced ? 'reduce' : 'no-preference',
  serviceWorkers: 'block',
});
const page = await context.newPage();
const probe = await (await browser.newContext()).newPage();
const errors = [], failed = [], shots = [], faults = [], notes = [];

page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
// A reload by the tour cancels the requests still in flight; those are the tour's, not the app's.
// A request the browser cancels and then serves (a duplicate load of the same script) lost nothing:
// a cancelled request counts as failed only if its address never loaded.
let reloading = false;
const loaded = new Set(), cancelled = [];
page.on('response', r => { if (r.status() < 400) loaded.add(r.url()); if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', r => {
  if (reloading) return;
  const text = r.failure()?.errorText || 'failed';
  if (/ABORTED|cancelled/i.test(text)) cancelled.push({ text, url: r.url() }); else failed.push(`${text} ${r.url()}`);
});

async function shot(name, settled = true) {
  const jpeg = await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 80 });
  shots.push(name);
  const fault = await frameFault(probe, jpeg);
  if (fault) faults.push(`${name}: ${fault}`);
  if (settled) {
    for (const f of await page.evaluate(layoutFaults)) {
      if (f.startsWith('note: ')) notes.push(`${name}: ${f.slice(6)}`); else faults.push(`${name}: ${f}`);
    }
  }
}
const between = async name => { await page.waitForTimeout(150); await shot(name, false); };
// The screen's main action, in view without scrolling at the two taller heights (rule 6).
async function inView(name, locator) {
  if (H < 664) return;
  const box = await locator.first().boundingBox();
  if (!box || box.y < 0 || box.y + box.height > H) faults.push(`${name}: its main action is not in view without scrolling`);
}
const settle = () => page.waitForTimeout(reduced ? 600 : 1800);

try {
  // Entry, on a first visit.
  await page.goto(base, { waitUntil: 'networkidle' });
  await expect(page.locator('.enter')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(reduced ? 800 : 4600);
  await shot('01-entry');
  await inView('01-entry', page.locator('.enter'));
  await page.locator('.enter').click();
  await between('t02-to-choice');
  await settle();

  // The choice and its nine cards.
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 10000 });
  await expect(page.locator('.all-exercises .item')).toHaveCount(182, { timeout: 10000 });
  await shot('02-choice');
  await inView('02-choice', page.locator('.altar'));
  // Every card, not only the first: each is brought to the middle of the rail and the screen checked again
  // ("Soulevé de terre roumain", the seventh, ran under its card's edge unseen; David, 2 October 2026).
  for (let i = 1; i < 9; i++) {
    const card = page.locator('.altar').nth(i);
    await card.evaluate(c => c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }));
    await page.waitForTimeout(300);
    const name = (await card.locator('.altar-name').textContent()).trim();
    for (const f of await page.evaluate(layoutFaults)) if (!f.startsWith('note: ')) faults.push(`02-choice, card ${i + 1} (${name}): ${f}`);
  }
  await shot('02b-choice-last-card');
  await page.locator('.altar').first().evaluate(c => c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }));
  await page.waitForTimeout(300);

  // A card lift's filming screen, and back.
  await page.locator('.altar').first().click();
  await between('t03-to-film-card');
  await settle();
  await expect(page.locator('.film-screen .frame canvas')).toHaveCount(1, { timeout: 10000 });
  await shot('03-film-card');
  await inView('03-film-card', page.locator('.film-screen .actions .btn-primary'));
  await page.locator('.film-screen .icon-btn').click();
  await between('t04-back-to-choice');
  await settle();

  // The list under the cards, searched, and an exercise without a card.
  await page.locator('.all-exercises').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.all-exercises').scrollIntoView({ block: 'start' }));
  await settle();
  await shot('05-list');
  await page.fill('#all-search', 'fente avant');
  await page.waitForTimeout(400);
  await shot('06-list-search');
  await page.locator('.all-exercises [data-exercise="forward_lunge"] .item-btn').click();
  await between('t07-to-film-guide');
  await settle();
  await expect(page.locator('.film-screen .guide-frames img')).toHaveCount(3, { timeout: 10000 });
  await shot('07-film-guide');
  await inView('07-film-guide', page.locator('.film-screen .actions .btn-primary'));
  await page.locator('.film-screen .icon-btn').click();
  await between('t08-back-to-choice');
  await settle();

  // The list exercise with the longest name, whose title wraps the most: its filming screen, and back.
  await page.fill('#all-search', '');
  await page.waitForTimeout(400);
  const longest = await page.$$eval('.all-exercises [data-exercise]', els => els
    .map(e => ({ key: e.dataset.exercise, len: e.querySelector('.item-name').textContent.length }))
    .sort((a, b) => b.len - a.len)[0].key);
  notes.push(`longest list name: ${longest}`);
  await page.evaluate(k => document.querySelector(`.all-exercises [data-exercise="${k}"] .item-btn`).scrollIntoView({ block: 'center' }), longest);
  await page.locator(`.all-exercises [data-exercise="${longest}"] .item-btn`).click();
  await between('t08b-to-film-longest');
  await settle();
  await expect(page.locator('.film-screen .guide-frames img')).toHaveCount(3, { timeout: 10000 });
  await shot('08b-film-longest');
  await inView('08b-film-longest', page.locator('.film-screen .actions .btn-primary'));
  await page.locator('.film-screen .icon-btn').click();
  await between('t08c-back-to-choice');
  await settle();

  // The guide, and back.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.row-link').first().click();
  await between('t09-to-guide');
  await settle();
  await expect(page.locator('.guide-screen')).toBeVisible({ timeout: 10000 });
  await shot('09-guide');
  await inView('09-guide', page.locator('#guide-search'));
  await page.locator('.guide-screen .icon-btn').first().click();
  await between('t10-back-to-choice');
  await settle();

  // A saved set, the history, and its report.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const q = indexedDB.open('workoutVision');
    q.onerror = () => reject(q.error);
    q.onsuccess = () => {
      const tx = q.result.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({ id: 'tour', exercise: 'bicep_curl', reps: 7, source: 'manual', createdAt: Date.now() }, 'tour');
      tx.oncomplete = () => { q.result.close(); resolve(); };
    };
  }));
  reloading = true;
  await page.reload({ waitUntil: 'networkidle' });
  reloading = false;
  await settle();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await between('t11-to-history');
  await settle();
  await shot('11-history');
  await inView('11-history', page.locator('.hist-btn'));
  await page.locator('.hist-btn').click();
  await page.waitForTimeout(600);
  await page.locator('.hist-detail .btn-line').click();
  await between('t12-to-report');
  await settle();
  await expect(page.locator('.report-screen')).toBeVisible({ timeout: 10000 });
  await shot('12-report');
  await inView('12-report', page.locator('.report-screen .share-bar .btn-primary'));
} catch (e) {
  faults.push(`tour stopped: ${e.message.split('\n')[0]}`);
} finally {
  for (const c of cancelled) if (!loaded.has(c.url)) failed.push(`${c.text} ${c.url}`);
  const srcHash = execFileSync('node', ['scripts/src-hash.mjs']).toString().trim();
  const results = {
    srcHash, browser: inChromium ? 'chromium' : 'webkit', profile: 'iPhone 14', viewport: `${W}x${H}`,
    reducedMotion: reduced, colorScheme: light ? 'light' : 'dark', locale: 'fr-FR', shots, faults, notes, errors, failed,
    pass: !faults.length && !errors.length && !failed.length,
  };
  writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(results.pass ? 0 : 1);
}
