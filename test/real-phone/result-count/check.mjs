#!/usr/bin/env node
// node test/real-phone/result-count/check.mjs
// The result screen, mounted alone (mount.jsx) in Chromium on the Vite dev server, on a known result of 7
// reps, as a user drives it: accepted, corrected to 8, and with saving failing. It checks the numeral and
// what a screen reader is told, and that no measure is shown at any level (measures.js). Writes check.txt.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const PORT = 5179, URL = `http://localhost:${PORT}/workout-vision/test/real-phone/result-count/mount.html`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
const out = [], fails = [];
const check = (ok, what) => { out.push(`${ok ? 'pass' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
// A measure on screen: degrees, a percentage, a tempo, a speed, a time under tension, a short-rep mark.
const MEASURE = /°|%|tempo|vitesse|speed|amplitude|range|sous tension|under tension|▾|conc\.|exc\.|ecc\./i;

async function open(browser, { lang, level, failSave }) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' })).newPage();
  await page.addInitScript(([lang, level, failSave]) => {
    localStorage.setItem('wv_lang', lang);
    if (level) localStorage.setItem('wv_level', level);
    if (failSave) IDBObjectStore.prototype.put = () => { throw new DOMException('full', 'QuotaExceededError'); };
  }, [lang, level, !!failSave]);
  await page.goto(URL);
  await page.locator('[data-testid="ask-card"]').waitFor({ timeout: 30000 });
  return page;
}
// The screen's words, without "En savoir plus" (.acc-notes): those notes explain tempo and effort with
// their sources and measure nothing of the user's set (set-notes.js), so they are not a measure shown.
const shownText = page => page.locator('#root').evaluate(r => { const c = r.cloneNode(true); c.querySelectorAll('.acc-notes').forEach(n => n.remove()); return c.innerText ?? c.textContent; });
const numeral = page => page.locator('[data-testid="res-numeral"]').textContent();
const status = page => page.locator('.res-count .sr').textContent();

try {
  for (let i = 0; i < 60; i++) { try { await fetch(URL); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  for (const lang of ['en', 'fr']) {
    const fr = lang === 'fr';
    // Accepted: 7 stays 7.
    let page = await open(browser, { lang });
    await page.getByRole('button', { name: fr ? 'Oui, c’est juste' : 'Yes, that’s right' }).click();
    await page.locator('[data-testid="saved-card"]').waitFor();
    check(await numeral(page) === '7', `${lang}: accepted, the numeral reads 7`);
    check(await status(page) === (fr ? '7 répétitions enregistrées.' : '7 reps saved.'), `${lang}: accepted, a screen reader is told 7 saved`);
    check(await page.locator('.saved-corr').count() === 0, `${lang}: accepted, no correction line`);
    await page.context().close();

    // Corrected to 8: 8 is the numeral and what is announced; the app's 7 stays as provenance.
    page = await open(browser, { lang });
    await page.getByRole('button', { name: fr ? 'Non' : 'No', exact: true }).click();
    await page.getByRole('button', { name: fr ? 'Une de plus' : 'One more' }).click();
    await page.getByRole('button', { name: fr ? 'Enregistrer' : 'Save', exact: true }).click();
    await page.locator('[data-testid="saved-card"]').waitFor();
    check(await numeral(page) === '8', `${lang}: corrected 7 to 8, the numeral reads 8`);
    check(await status(page) === (fr ? '8 répétitions enregistrées.' : '8 reps saved.'), `${lang}: corrected, a screen reader is told 8 saved`);
    check((await page.locator('.saved-corr').textContent()) === (fr ? 'Compté par l’app : 7. Corrigé : 8.' : 'Counted by the app: 7. Corrected: 8.'), `${lang}: corrected, the app's 7 kept as provenance`);
    check(await page.locator('.bars .bar').count() === 7, `${lang}: corrected, still the 7 marks the app found, none invented`);
    const stored = await page.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('workoutVision');
      r.onsuccess = () => { const all = r.result.transaction('workouts').objectStore('workouts').getAll(); all.onsuccess = () => res(all.result); all.onerror = () => rej(all.error); };
      r.onerror = () => rej(r.error);
    })).catch(() => null);
    const w = stored?.find(x => x.exercise === 'bicep_curl');
    check(w?.reps === 8 && w?.machineResult?.reps === 7, `${lang}: corrected, the set is stored as 8 with the app's 7 apart`);
    await page.context().close();

    // Corrected down to 5: the marks stay the app's 7 and are named as the app's, never as the saved reps.
    page = await open(browser, { lang });
    await page.getByRole('button', { name: fr ? 'Non' : 'No', exact: true }).click();
    for (let k = 0; k < 2; k++) await page.getByRole('button', { name: fr ? 'Une de moins' : 'One fewer' }).click();
    await page.getByRole('button', { name: fr ? 'Enregistrer' : 'Save', exact: true }).click();
    await page.locator('[data-testid="saved-card"]').waitFor();
    check(await numeral(page) === '5', `${lang}: corrected 7 to 5, the numeral reads 5`);
    const label = await page.locator('.bars').getAttribute('aria-label');
    check(label === (fr ? 'Répétitions repérées par l’app, une par marque' : 'Reps the app found, one per mark'), `${lang}: corrected, the marks are named as the app's`);
    await page.locator('.bars').focus();
    await page.keyboard.press('End');
    const last = (await page.locator('.res-detail').textContent()).trim();
    check(last === (fr ? 'Marque de l’app 7\u00A0· filmée en partie' : 'App mark 7\u00A0· partly filmed'), `${lang}: corrected, the last mark reads as the app's mark 7, not rep 7 ("${last}")`);
    await page.context().close();

    // Saving fails: no claim of success.
    page = await open(browser, { lang, failSave: true });
    await page.getByRole('button', { name: fr ? 'Oui, c’est juste' : 'Yes, that’s right' }).click();
    await page.locator('.save-error').waitFor();
    check(await page.locator('[data-testid="saved-card"]').count() === 0, `${lang}: save failed, no saved card`);
    check(!/enregistrée|saved\./i.test(await status(page)), `${lang}: save failed, a screen reader is not told it was saved`);
    check(await numeral(page) === '7', `${lang}: save failed, the numeral stays the app's 7`);
    await page.context().close();

    // No measure at any level, before and after saving, with a rep selected.
    for (const level of ['', 'beginner', 'intermediate', 'expert']) {
      page = await open(browser, { lang, level });
      const name = level || 'no level';
      await page.locator('.bars').click({ position: { x: 5, y: 5 } }).catch(() => {});
      const before = await shownText(page);
      check(!MEASURE.test(before), `${lang}, ${name}: no measure before saving${MEASURE.test(before) ? `: "${before.match(MEASURE)[0]}"` : ''}`);
      const heights = await page.locator('.bars .bar').evaluateAll(bs => [...new Set(bs.map(b => b.style.getPropertyValue('--r')))]);
      check(heights.length === 1, `${lang}, ${name}: every mark has one height`);
      await page.getByRole('button', { name: fr ? 'Oui, c’est juste' : 'Yes, that’s right' }).click();
      await page.locator('[data-testid="saved-card"]').waitFor();
      const after = await shownText(page);
      check(!MEASURE.test(after), `${lang}, ${name}: no measure after saving${MEASURE.test(after) ? `: "${after.match(MEASURE)[0]}"` : ''}`);
      // The notes explain; they must not describe a mark or a measure the screen no longer shows.
      const notes = await page.locator('.acc-notes').evaluateAll(ns => ns.map(n => n.textContent).join(' '));
      check(!/▾|degrés|degrees/.test(notes), `${lang}, ${name}: the notes name no ▾ mark and no degrees`);
      await page.context().close();
    }
  }
  await browser.close();
} finally {
  try { process.kill(-server.pid); } catch { /* gone */ }
}
out.push('', `${out.length - fails.length} pass, ${fails.length} fail`);
writeFileSync(resolve(HERE, 'check.txt'), out.join('\n') + '\n');
console.log(out.join('\n'));
process.exit(fails.length ? 1 : 0);
