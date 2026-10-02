// node test/real-phone/swarm/harness/levels.mjs, with PW_CHROMIUM naming a Chromium binary and SHOTS a folder
// for the screenshots (default: none). Vite on port 5302 only.
// The result screen at each level (beginner, intermediate, expert, and none stored), French and English,
// at 390x664 and 375x548:
// 1. "Oui, c'est juste" fully in view at 390x664, and in view and uncovered at 375x548 once scrolled to;
// 2. no two blocks of the screen overlap, and nothing is wider than the screen;
// 3. what each level shows: the beginner's words before the number and the notes open; the expert's
//    speed line under the bars and table under the question; the intermediate as today.
// Then: the question on the level after the save, once; the history's control; the beginner's guide page.
import { chromium } from 'playwright';
import { copyFileSync, rmSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const H = 'test/real-phone/swarm/harness', PORT = 5302, SHOTS = process.env.SHOTS || '';
copyFileSync(`${H}/levels.jsx`, 'src/zz-levels.jsx');
copyFileSync(`${H}/result-report.html`, 'zz-levels.html');
// The page loads src/zz-harness.jsx in result-report.html; this copy points at this harness's own entry.
import { readFileSync, writeFileSync } from 'node:fs';
writeFileSync('zz-levels.html', readFileSync('zz-levels.html', 'utf8').replace('/src/zz-harness.jsx', '/src/zz-levels.jsx'));
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-levels.jsx', { force: true }); rmSync('zz-levels.html', { force: true }); };
const url = (qs = '') => `http://localhost:${PORT}/workout-vision/zz-levels.html${qs}`;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${line}`); };

// The blocks of the screen, pairwise: none may cover another; and the page is no wider than the screen.
const layout = () => {
  const els = [...document.querySelectorAll('.result-screen .wrap > *, .result-screen .glass > *, .result-screen .set-account > p, .result-screen .res-count > *')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
  const hits = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.contains(b) || b.contains(a)) continue;
    const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
    const w = Math.min(r.right, s.right) - Math.max(r.left, s.left), h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
    if (w > 1 && h > 1) hits.push(`${a.className || a.tagName} / ${b.className || b.tagName}`);
  }
  return { hits, wide: document.documentElement.scrollWidth - innerWidth };
};

try {
  await new Promise(r => setTimeout(r, 7000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const yes = { fr: 'Oui, c’est juste', en: 'Yes, that’s right' };
  // bench_press: a lift outside the beta group, whose heading carries the experimental line on two rows
  // (review, 2 October: the button ended 8 px lower there than on bicep_curl).
  for (const lift of ['bicep_curl', 'bench_press']) for (const lang of ['fr', 'en']) for (const level of ['beginner', 'intermediate', 'expert', '']) for (const [W, Ht] of [[390, 664], [375, 548]]) {
    if (lift !== 'bicep_curl' && W !== 390) continue;
    const tag = `${lang} ${level || 'unset'} ${W}x${Ht}${lift === 'bicep_curl' ? '' : ` ${lift}`}`;
    const ctx = await browser.newContext({ viewport: { width: W, height: Ht }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(([l, lv]) => { localStorage.setItem('wv_lang', l); if (lv) localStorage.setItem('wv_level', lv); }, [lang, level]);
    await p.goto(url(lift === 'bicep_curl' ? '' : `?lift=${lift}`));
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.waitForTimeout(700); // the cards' appear animation
    const btn = p.getByRole('button', { name: yes[lang] });
    const box = await btn.boundingBox();
    if (W === 390) say(box && box.y >= 0 && box.y + box.height <= Ht, `${tag}: "${yes[lang]}" fully in view (top ${box?.y.toFixed(0)}, bottom ${(box?.y + box?.height).toFixed(0)} of ${Ht})`);
    const { hits, wide } = await p.evaluate(layout);
    say(!hits.length && wide <= 0, `${tag}: no overlap${hits.length ? ` (${hits.join('; ')})` : ''}, ${wide > 0 ? `${wide} px too wide` : 'no side scroll'}`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/result-${lang}-${level || 'unset'}-${W}x${Ht}-${lift}.png` });
    if (SHOTS && W === 390) { // the rest of the screen, below the question
      await p.locator('.result-screen .wrap > :last-child').evaluate(e => e.scrollIntoView({ block: 'end' }));
      await p.screenshot({ path: `${SHOTS}/result-${lang}-${level || 'unset'}-${W}x${Ht}-below.png` });
      await p.evaluate(() => { document.scrollingElement.scrollTop = 0; document.querySelector('.wv-experience').scrollTop = 0; });
    }
    if (W === 375) {
      await btn.evaluate(e => e.scrollIntoView({ block: 'center' }));
      const b2 = await btn.boundingBox();
      const top = await p.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.btn-primary'), [b2.x + b2.width / 2, b2.y + b2.height / 2]);
      say(b2.y >= 0 && b2.y + b2.height <= Ht && top, `${tag}: "${yes[lang]}" in view and uncovered once scrolled to`);
    }
    // What the level shows.
    const shows = await p.evaluate(() => {
      const y = s => document.querySelector(s)?.getBoundingClientRect().top ?? null;
      return { acc: y('[data-testid="set-account"]'), num: y('.numeral'), card: y('[data-testid="ask-card"]'), bars: y('.bars'),
        speed: document.querySelector('[data-testid="level-speed"]')?.textContent || '', speedY: y('[data-testid="level-speed"]'),
        rows: document.querySelectorAll('[data-testid="level-table"] tbody tr').length, tableY: y('[data-testid="level-table"]'),
        open: !!document.querySelector('.acc-notes')?.open, level: document.querySelector('.result-screen')?.dataset.level };
    });
    if (W === 390) {
      const l = level || 'intermediate';
      say(shows.level === l, `${tag}: screen at level ${shows.level}`);
      if (l === 'beginner') say(shows.acc < shows.num && shows.num < shows.card && shows.card < shows.bars && shows.open && !shows.rows && !shows.speed,
        `${tag}: account and tip first, then the number, the question, the bars; notes open`);
      if (l === 'intermediate') say(shows.num < shows.bars && shows.bars < shows.card && shows.card < shows.acc && !shows.open && !shows.rows && !shows.speed,
        `${tag}: today's order, notes closed, no table`);
      if (l === 'expert') say(shows.bars < shows.speedY && shows.speedY < shows.card && shows.card < shows.tableY && shows.rows === 8 && /(Vitesse concentrique|Concentric speed)/.test(shows.speed) && !shows.open,
        `${tag}: speed "${shows.speed}" under the bars, ${shows.rows} rows under the question`);
    }
    await ctx.close();
  }

  for (const lang of ['fr', 'en']) { // The beginner's longest account: a set saved before adds a fourth line.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(l => { localStorage.setItem('wv_lang', l); localStorage.setItem('wv_level', 'beginner'); }, lang);
    await p.goto(url());
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('workoutVision');
      r.onsuccess = () => { const db = r.result, tx = db.transaction('workouts', 'readwrite');
        tx.objectStore('workouts').put({ id: 'before', exercise: 'bicep_curl', reps: 6, source: 'counter-core', corrected: false, createdAt: Date.now() - 86400000 }, 'before');
        tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    }));
    await p.reload();
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.waitForTimeout(700);
    const lines = await p.locator('[data-testid="set-account"] .acc-line').count();
    const box = await p.getByRole('button', { name: yes[lang] }).boundingBox();
    const { hits } = await p.evaluate(layout);
    say(lines === 4 && box.y + box.height <= 664 && !hits.length, `${lang} beginner, ${lines} account lines, 390x664: "${yes[lang]}" bottom ${(box.y + box.height).toFixed(0)} of 664, ${hits.length ? hits.join('; ') : 'no overlap'}`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/result-${lang}-beginner-4lines-390x664.png` });
    await ctx.close();
  }

  // Review, 30 September: the longest beginner screen, motion on and off: five short reps of ten, the
  // slowdown, a previous set of the lift, and a long French name; "Oui, c'est juste" stays in view.
  for (const reducedMotion of ['no-preference', 'reduce']) for (const lang of ['fr', 'en']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion });
    const p = await ctx.newPage();
    await p.addInitScript(l => { localStorage.setItem('wv_lang', l); localStorage.setItem('wv_level', 'beginner'); }, lang);
    const long = url().replace('zz-harness.html', 'zz-harness.html') + (url().includes('?') ? '&' : '?') + 'n=10&short=2,3,5,7,9&lift=lateral_raise';
    await p.goto(long);
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('workoutVision');
      r.onsuccess = () => { const db = r.result, tx = db.transaction('workouts', 'readwrite');
        tx.objectStore('workouts').put({ id: 'before', exercise: 'lateral_raise', reps: 6, source: 'counter-core', corrected: false, createdAt: Date.now() - 86400000 }, 'before');
        tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    }));
    await p.reload();
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.waitForTimeout(reducedMotion === 'reduce' ? 700 : 4000);
    const lines = await p.locator('[data-testid="set-account"] .acc-line').count();
    const box = await p.getByRole('button', { name: yes[lang] }).boundingBox();
    const { hits } = await p.evaluate(layout);
    say(box.y + box.height <= 664 && !hits.length, `${lang} beginner, longest (${lines} lines, motion ${reducedMotion}), 390x664: "${yes[lang]}" bottom ${(box.y + box.height).toFixed(0)} of 664, ${hits.length ? hits.join('; ') : 'no overlap'}`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/result-${lang}-beginner-longest-${reducedMotion}-390x664.png` });
    await ctx.close();
  }

  { // The question on the level: after the save, once; the answer is stored.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
    await p.goto(url());
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    say(await p.locator('[data-testid="level-ask"]').count() === 0, 'no level question before the save');
    await p.getByRole('button', { name: 'Oui, c’est juste' }).click();
    await p.waitForSelector('[data-testid="level-ask"]', { timeout: 10000 });
    await p.locator('[data-testid="level-ask"]').scrollIntoViewIfNeeded();
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/level-ask-fr-390x664.png` });
    await p.locator('[data-testid="level-ask"]').getByRole('button', { name: 'Confirmé' }).click();
    const stored = await p.evaluate(() => localStorage.getItem('wv_level'));
    const note = await p.locator('[data-testid="level-ask"] .level-note').innerText();
    say(stored === 'expert' && /noté/.test(note), `level chosen after the save: stored ${stored}; "${note}"`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/level-ask-answered-fr-390x664.png` });
    await p.evaluate(() => localStorage.removeItem('wv_level'));
    await p.reload();
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.getByRole('button', { name: 'Oui, c’est juste' }).click();
    await p.waitForSelector('[data-testid="saved-card"]');
    say(await p.locator('[data-testid="level-ask"]').count() === 0, 'the question is not offered a second time');
    await ctx.close();
  }

  { // The history's control.
    const ctx = await browser.newContext({ viewport: { width: 375, height: 548 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(() => { localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'beginner'); });
    await p.goto(url('?view=history'));
    await p.waitForSelector('[data-testid="history-level"]', { timeout: 30000 });
    const pressed = await p.locator('[data-testid="history-level"] [aria-pressed="true"]').innerText();
    await p.locator('[data-testid="history-level"]').getByRole('button', { name: 'Intermédiaire' }).click();
    const stored = await p.evaluate(() => localStorage.getItem('wv_level'));
    say(pressed === 'Débutant' && stored === 'intermediate', `history: level shown ${pressed}, changed to ${stored}`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/history-fr-375x548.png` });
    await ctx.close();
  }

  { // The beginner's guide page before filming, and the way on to the filming screen.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
    await p.goto(url('?view=guide'));
    await p.waitForSelector('[data-testid="guide-focus"]', { timeout: 30000 });
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/guide-focus-fr-390x664.png` });
    const gb = await p.getByRole('button', { name: 'Filmer cet exercice' }).boundingBox();
    say(gb.y + gb.height <= 664, `guide page: "Filmer cet exercice" in view (bottom ${(gb.y + gb.height).toFixed(0)} of 664)`);
    await p.getByRole('button', { name: 'Filmer cet exercice' }).click();
    say(await p.evaluate(() => document.body.dataset.chosen) === 'bicep_curl', 'guide page: "Filmer cet exercice" goes on with the exercise');
    await ctx.close();
  }
  await browser.close();
} finally { clean(); }
console.log(bad ? `${bad} FAILED` : 'ALL PASS');
process.exit(bad ? 1 : 0);
