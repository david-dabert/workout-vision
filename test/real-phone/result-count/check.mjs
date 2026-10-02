#!/usr/bin/env node
// node test/real-phone/result-count/check.mjs
// The result screen, mounted alone (mount.jsx) in Chromium on the Vite dev server, on a known result of 7
// reps, as a user drives it: accepted, corrected to 8, and with saving failing. It checks the numeral and
// what a screen reader is told, and that every measure shown stands under the experimental label (measures.js). Writes check.txt.
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
    check(label === (fr ? 'Repères détectés par l’app' : 'Marks the app detected'), `${lang}: corrected, the marks are named as the app's`);
    await page.locator('.bars').focus();
    await page.keyboard.press('End');
    const last = (await page.locator('.res-detail').textContent()).trim();
    check(last.startsWith(fr ? 'Repère détecté 7 sur 7' : 'Detected mark 7 of 7') && last.endsWith(fr ? 'filmé en partie' : 'partly filmed'), `${lang}: corrected, the last mark reads as a detected mark, not rep 7 ("${last}")`);
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
      const label = fr ? 'Mesures expérimentales\u00A0: estimées par l’app, pas encore validées.' : 'Experimental measures: estimated by the app, not yet validated.';
      const exp = async () => (await page.locator('[data-testid="res-exp"]').count()) ? (await page.locator('[data-testid="res-exp"]').textContent()) : '';
      check(!MEASURE.test(before.replace(label, '')) || (await exp()) === label, `${lang}, ${name}: any measure before saving stands under the experimental label`);
      await page.getByRole('button', { name: fr ? 'Oui, c’est juste' : 'Yes, that’s right' }).click();
      await page.locator('[data-testid="saved-card"]').waitFor();
      const after = await shownText(page);
      check(!MEASURE.test(after.replace(label, '')) || (await exp()) === label, `${lang}, ${name}: any measure after saving stands under the experimental label`);

      await page.context().close();
    }
  }
  // The replay, on a drawn video and 7 fixed detections: saved as detected, then corrected to 8.
  const REPLAY = URL.replace('mount.html', 'mount-replay.html');
  for (const lang of ['en', 'fr']) {
    const fr = lang === 'fr';
    for (const saved of [7, 8]) {
      const page = await (await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' })).newPage();
      await page.addInitScript(lang => localStorage.setItem('wv_lang', lang), lang);
      await page.goto(`${REPLAY}?saved=${saved}`);
      const line = page.locator('.rp-line');
      await line.waitFor({ timeout: 30000 });
      await page.waitForFunction(() => document.querySelector('.rp-video')?.readyState >= 1, null, { timeout: 30000 });
      await page.waitForFunction(() => Number.isFinite(document.querySelector('.rp-video')?.duration), null, { timeout: 30000 });
      // A tap at the middle of mark 3 (1.0 to 1.3 s); the replay seeks a frame inside its start (Replay.jsx, into),
      // so the position names mark 3 whatever the video's frame times.
      const at = async t => {
        const box = await line.boundingBox(), length = await page.evaluate(() => document.querySelector('.rp-video').duration);
        await line.click({ position: { x: box.width * (t / length), y: box.height / 2 } });
      };
      await at(1.15);
      await page.waitForFunction(() => / 3 (of|sur) 7$/.test(document.querySelector('.rp-line')?.getAttribute('aria-valuetext') || ''), null, { timeout: 10000 }).catch(() => {});
      const where = await line.getAttribute('aria-valuetext');
      const detail = (await page.locator('.rp-detail').textContent()).trim();
      const prov = await page.locator('[data-testid="rp-prov"]').count() ? (await page.locator('[data-testid="rp-prov"]').textContent()).trim() : '';
      const phase = (await page.locator('.rp-phase').textContent()).trim();
      if (saved === 8) {
        check(where === (fr ? 'Repère détecté 3 sur 7' : 'Detected mark 3 of 7'), `${lang} replay, saved 8: position reads as a detected mark ("${where}")`);
        check(detail.startsWith(fr ? 'Repère détecté 3 sur 7' : 'Detected mark 3 of 7'), `${lang} replay, saved 8: detail reads as a detected mark ("${detail}")`);
        check(prov === (fr ? 'L’app a détecté 7 répétitions. Vous avez enregistré 8.' : 'The app detected 7 reps. You saved 8.'), `${lang} replay, saved 8: both counts stated ("${prov}")`);
        // Past the last detection, the hint speaks of marks, not reps.
        // The end of the video, by the End key: a tap near the end falls within mark 7's tap tolerance (0.3 s past
        // its end at 2.9 s, beyond the 3 s video), and selects mark 7, as it should.
        await line.focus();
        await page.keyboard.press('End');
        await page.waitForFunction(() => !/sur 7|of 7/.test(document.querySelector('.rp-line')?.getAttribute('aria-valuetext') || ''), null, { timeout: 10000 }).catch(() => {});
        const idle = (await page.locator('.rp-detail').textContent()).trim();
        check(idle === (fr ? 'Touchez un repère sur la ligne pour le revoir.' : 'Touch a mark on the line to see it again.'), `${lang} replay, saved 8: past the marks, the hint names marks ("${idle}")`);
      } else {
        check(where === (fr ? 'Répétition 3 sur 7' : 'Rep 3 of 7'), `${lang} replay, saved 7: position reads as a rep ("${where}")`);
        check(prov === '', `${lang} replay, saved 7: no provenance line`);
      }
      check((await page.locator('[data-testid="rp-exp"]').count()) === 1, `${lang} replay, saved ${saved}: the experimental label stands under the replay's measures`);
      check(await page.locator('.rp-chip .rp-of').textContent() === '/\u00A07', `${lang} replay, saved ${saved}: the chip counts the 7 detected marks, none invented`);
      await page.context().close();
    }
  }
  // The numeral is a field: a tap, then typing, replaces the 7 wherever iOS leaves the caret (WebKit drops a
  // select() made on focus; review of 2 October), so 7 to 34 is three taps, not 27. Typed then deleted, the
  // number is the 7 it opened on. The number pad is numeric and the field is named for a screen reader.
  const drawn = page => page.locator('[data-testid="fix-card"] .stepper-n [aria-live]').textContent();
  for (const lang of ['en', 'fr']) {
    const fr = lang === 'fr', page = await open(browser, { lang, level: 'intermediate' });
    await page.locator('[data-testid="ask-card"] .btn-ghost').click();
    const field = page.locator('[data-testid="fix-card"] .stepper-in');
    await field.waitFor({ timeout: 10000 });
    check(await field.getAttribute('inputmode') === 'numeric' && !!(await field.getAttribute('aria-label')), `${lang}: the correction numeral opens a number pad and is named`);
    // A caret left inside the old number, as a tap on an iPhone leaves it.
    await field.click();
    await field.evaluate(el => { try { el.setSelectionRange(el.value.length, el.value.length); } catch { /* empty field */ } });
    await page.keyboard.type('5');
    check(await drawn(page) === '5', `${lang}: typing 5 replaces the 7 (drew ${await drawn(page)})`);
    await field.blur();
    // Opened again on 5: a digit typed, then deleted, leaves the 5 it opened on.
    await field.click();
    await page.keyboard.type('3');
    await page.keyboard.press('Backspace');
    check(await drawn(page) === '5', `${lang}: a digit typed then deleted leaves the number it opened on (drew ${await drawn(page)})`);
    await field.blur();
    await field.click();
    await page.keyboard.type('34');
    check(await drawn(page) === '34', `${lang}: typing 34 draws 34`);
    await page.locator('[data-testid="fix-card"] .btn-primary').click();
    await page.locator('.saved-corr').waitFor({ timeout: 10000 });
    check((await page.locator('.saved-corr').textContent()) === (fr ? 'Compté par l’app : 7. Corrigé : 34.' : 'Counted by the app: 7. Corrected: 34.'), `${lang}: typed correction saved as 34`);
    await page.context().close();
  }
  // A saved set is worth keeping: saving asks the browser to keep the app's storage (keep-sets.js).
  {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' })).newPage();
    await page.addInitScript(() => {
      localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate');
      window.__persistAsked = 0;
      const st = navigator.storage;
      st.persisted = async () => false;
      st.persist = async () => { window.__persistAsked++; return true; };
    });
    await page.goto(URL);
    await page.locator('[data-testid="ask-card"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="ask-card"] .btn-primary').click();
    await page.locator('[data-testid="saved-card"]').waitFor({ timeout: 10000 });
    const asked = await page.waitForFunction(() => window.__persistAsked > 0, null, { timeout: 5000 }).then(() => true, () => false);
    check(asked, 'saving a set asks the browser to keep the app\'s storage');
    await page.context().close();
  }
  // A beginner without Reduce Motion: the account and the marks show during the count-up, before the
  // question; the experimental label must already be there (review of 1 October).
  for (const lang of ['en', 'fr']) {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 664 } })).newPage();
    await page.addInitScript(lang => { localStorage.setItem('wv_lang', lang); localStorage.setItem('wv_level', 'beginner'); }, lang);
    await page.goto(URL);
    await page.locator('.set-account').first().waitFor({ timeout: 30000 });
    const early = await page.locator('[data-testid="ask-card"]').count() === 0;
    const label = await page.locator('[data-testid="res-exp"]').count();
    check(early && label === 1, `${lang}, beginner with motion: the label is there before the question (${early ? 'before' : 'after'} the question, ${label} label)`);
    await page.context().close();
  }
  await browser.close();
} finally {
  try { process.kill(-server.pid); } catch { /* gone */ }
}
out.push('', `${out.length - fails.length} pass, ${fails.length} fail`);
writeFileSync(resolve(HERE, 'check.txt'), out.join('\n') + '\n');
console.log(out.join('\n'));
process.exit(fails.length ? 1 : 0);
