/**
 * Step 3c, second part: the three approved clips through the app, in WebKit
 * (iPhone profile) and in Chromium. Counts must not change, and for every rep,
 * start, end and range must agree between the two browsers within 0.2 s and 5°.
 *
 *   npm run build && npx vite preview --host 127.0.0.1 --port 4175 --strictPort &
 *   node test/real-phone/rep-parity.mjs
 *
 * "Counts must not change": each count is compared with the count the app showed
 * for the same clip and browser at Step 3 (test/real-phone/step3/<browser>-<lift>.json).
 * Chrome is Google Chrome, as at Step 3 (scripts/diagnose-core-parity.mjs), not
 * Playwright's own Chromium. An analysis that fails ends that run at once, with the
 * app's message and the console's errors.
 * Writes test/real-phone/round5/parity.json and prints the table. Exit code 1 on FAIL.
 */
import { webkit, chromium, devices } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const base = process.env.WV_BASE || 'http://127.0.0.1:4175/workout-vision/';
const out = resolve('test/real-phone/round5');
mkdirSync(out, { recursive: true });

// lift, clip, the name on its card, the Step 3 result file's browser names
const CLIPS = [
  ['bicep_curl', 'bicep_curl_7_side_mufhf3wy', 'Curl biceps'],
  ['lateral_raise', 'lateral_raise_10_front_mufhhbun', 'Élévations latérales'],
  ['lat_pulldown', 'lat_pulldown_10_front_mufhlh4o', 'Tirage vertical'],
];
// label, engine, launch options, context options
const BROWSERS = [
  ['webkit-iphone', webkit, {}, devices['iPhone 14']],
  ['chrome', chromium, { channel: 'chrome' }, { viewport: { width: 390, height: 844 } }],
];
const STEP = { start: 0.2, end: 0.2, rom: 5 };

async function run(engine, launch, device, [lift, clip, name]) {
  const browser = await engine.launch(launch);
  try {
    const context = await browser.newContext({ ...device, locale: 'fr-FR', serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [], logged = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') logged.push(m.text()); });
    await page.addInitScript(() => {
      localStorage.setItem('wv_seen_entry', 'true');
      localStorage.setItem('wv_lang', 'fr');
      window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.altar', { hasText: name }).first().click();
    const input = page.locator('.film-screen input[type="file"]').last();
    await input.waitFor({ state: 'attached', timeout: 15000 });
    await input.setInputFiles(resolve(`test/real-phone/clips/${clip}.mov`));
    // The result, or the screen that says the analysis failed.
    await page.waitForFunction(() => window.__coreOutput || document.querySelector('.refused-title'), null, { timeout: 300000 });
    const failed = await page.evaluate(() => (window.__coreOutput ? null : document.querySelector('.refused-title').textContent));
    if (failed) return { count: null, refused: false, reps: [], errors: [...errors, `analysis failed: ${failed}`, ...logged.map(t => `console: ${t}`)] };
    const result = await page.evaluate(() => {
      const r = window.__coreOutput;
      return { count: r.count, refused: !!r.refused, reps: r.reps.map(x => ({ start: x.startTime, end: x.endTime, rom: x.romDegrees, up: x.concentricSec, down: x.eccentricSec })) };
    });
    return { ...result, errors };
  } finally {
    await browser.close();
  }
}

const rows = [], report = { srcHash: execFileSync('node', ['scripts/src-hash.mjs'], { encoding: 'utf8' }).trim(), clips: {} };
let pass = true;
for (const c of CLIPS) {
  const [lift] = c;
  const results = {};
  for (const [label, engine, launch, device] of BROWSERS) {
    results[label] = await run(engine, launch, device, c);
    const before = JSON.parse(readFileSync(`test/real-phone/step3/${label}-${lift}.json`, 'utf8')).count;
    results[label].step3Count = before;
    if (results[label].count !== before || results[label].errors.length) pass = false;
  }
  const a = results['webkit-iphone'], b = results.chrome;
  const worst = { start: 0, end: 0, rom: 0 };
  if (a.reps.length !== b.reps.length) pass = false;
  a.reps.forEach((r, i) => {
    const s = b.reps[i];
    if (!s) return;
    const d = { start: Math.abs(r.start - s.start), end: Math.abs(r.end - s.end), rom: Math.abs(r.rom - s.rom) };
    for (const k of Object.keys(worst)) worst[k] = Math.max(worst[k], d[k]);
    rows.push(`${lift} rep ${i + 1}: webkit ${r.start.toFixed(2)}–${r.end.toFixed(2)} s ${r.rom.toFixed(1)}° | chrome ${s.start.toFixed(2)}–${s.end.toFixed(2)} s ${s.rom.toFixed(1)}° | Δ ${d.start.toFixed(2)} s, ${d.end.toFixed(2)} s, ${d.rom.toFixed(1)}°`);
  });
  if (worst.start > STEP.start || worst.end > STEP.end || worst.rom > STEP.rom) pass = false;
  report.clips[lift] = { ...results, worst };
  rows.push(`${lift}: count webkit ${a.count} (Step 3: ${a.step3Count}), chrome ${b.count} (Step 3: ${b.step3Count}); worst Δ start ${worst.start.toFixed(2)} s, end ${worst.end.toFixed(2)} s, range ${worst.rom.toFixed(1)}°`);
  for (const [label] of BROWSERS) if (results[label].errors.length) rows.push(`${lift} ${label}: ${results[label].errors.join(' | ')}`);
}
report.result = pass ? 'PASS' : 'FAIL';
writeFileSync(`${out}/parity.json`, JSON.stringify(report, null, 2));
console.log(rows.join('\n'));
console.log(report.result);
process.exit(pass ? 0 : 1);
