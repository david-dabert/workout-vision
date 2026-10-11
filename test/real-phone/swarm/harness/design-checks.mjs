// node test/real-phone/swarm/harness/design-checks.mjs, with PW_CHROMIUM naming a Chromium binary.
// The review of the design pass (30 September), as checks on the screens themselves:
// D1 the correction stepper's live region reads the whole number (aria-atomic);
// D2 the refused screen's "out of frame" label stays in its box and off the dashed edge, FR and EN;
// D3 a title never runs under a top bar that is not yet condensed (text under Back or the pill);
// D4 a row reached by the keyboard is not left under the sticky bar.
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { layoutFaults } from '../../checks.mjs';

const H = 'test/real-phone/swarm/harness', PORT = 5236;
copyFileSync(`${H}/screens.jsx`, 'src/zz-screens.jsx');
const html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/src/zz-screens.jsx"></script></body></html>';
await import('node:fs').then(fs => fs.writeFileSync('zz-screens.html', html));
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-screens.jsx', { force: true }); rmSync('zz-screens.html', { force: true }); };
const url = s => `http://localhost:${PORT}/workout-vision/zz-screens.html?s=${s}`;
let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${line}`); };
const hit = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
try {
  await new Promise(r => setTimeout(r, 7000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const open = async (s, lang, [w, h], init) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(([l, extra]) => { localStorage.setItem('wv_lang', l); for (const [k, v] of Object.entries(extra || {})) localStorage.setItem(k, v); }, [lang, init]);
    await p.goto(url(s)); await p.waitForTimeout(2500);
    return { p, ctx };
  };

  { // D1
    const { p, ctx } = await open('counted', 'fr', [390, 664]);
    await p.waitForSelector('[data-testid="ask-card"]');
    await p.locator('[data-testid="ask-card"] .btn-ghost').click();
    const atomic = await p.locator('.stepper-n').getAttribute('aria-atomic');
    say(atomic === 'true', `D1 stepper live region aria-atomic=${atomic}`);
    await ctx.close();
  }
  for (const lang of ['fr', 'en']) for (const size of [[390, 664], [375, 548], [390, 745]]) { // D2
    const { p, ctx } = await open('refused', lang, size);
    const r = await p.evaluate(() => {
      const label = document.querySelector('.edge-label'), edge = document.querySelector('.edge'), frame = document.querySelector('.result-screen .frame');
      if (!label) return null;
      const range = document.createRange(); range.selectNodeContents(label);
      const t = range.getBoundingClientRect(), e = edge.getBoundingClientRect(), f = frame.getBoundingClientRect();
      return { out: t.left < f.left + 1 || t.right > f.right - 1, onEdge: t.left < e.right && t.right > e.left && t.top < e.bottom && t.bottom > e.top, text: label.textContent };
    });
    const faults = (await p.evaluate(layoutFaults)).filter(f => !f.startsWith('note: '));
    say(r && !r.out && !r.onEdge && !faults.length, `D2 refused ${lang} ${size.join('x')}: "${r?.text}" in its box=${r && !r.out}, off the edge=${r && !r.onEdge}, faults=${faults.length ? faults.join('; ') : 'none'}`);
    await ctx.close();
  }
  for (const s of ['guide', 'history']) { // D3
    const { p, ctx } = await open(s, 'fr', [390, 664]);
    const worst = await p.evaluate(async () => {
      const scroller = [...document.querySelectorAll('.wv-experience')].find(el => el.scrollHeight > el.clientHeight + 10) || document.scrollingElement;
      const bar = document.querySelector('.topbar'), title = document.querySelector('.title');
      let over = [];
      for (let y = 0; y <= 260; y += 4) {
        scroller.scrollTop = y; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const condensed = bar.classList.contains('is-condensed');
        const range = document.createRange(); range.selectNodeContents(title);
        const t = [...range.getClientRects()];
        for (const el of bar.querySelectorAll('button, .pill, a')) {
          const b = el.getBoundingClientRect();
          if (!condensed && t.some(r => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top)) over.push(y);
        }
      }
      return over;
    });
    say(!worst.length, `D3 ${s}: title under an uncondensed bar at scroll ${worst.length ? worst.slice(0, 5).join(', ') + '…' : 'never'}`);
    await ctx.close();
  }
  { // D4
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
    await p.goto(url('history')); await p.waitForTimeout(1500);
    await p.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('workoutVision'); r.onsuccess = () => { const db = r.result, tx = db.transaction('workouts', 'readwrite'), s = tx.objectStore('workouts');
      for (let i = 0; i < 14; i++) s.put({ id: 'h' + i, exercise: 'bicep_curl', reps: 8 + (i % 4), source: 'manual', createdAt: Date.now() - i * 5 * 3600000 }, 'h' + i);
      tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); }; r.onerror = () => rej(r.error); }));
    await p.reload(); await p.waitForTimeout(2500);
    await p.evaluate(() => { const sc = [...document.querySelectorAll('.wv-experience')].find(el => el.scrollHeight > el.clientHeight + 10); if (sc) sc.scrollTop = sc.scrollHeight; });
    await p.locator('.hist-btn').last().focus();
    let under = null;
    for (let k = 0; k < 10; k++) {
      await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(80);
      const r = await p.evaluate(() => { const a = document.activeElement, bar = document.querySelector('.topbar'); if (!a?.classList.contains('hist-btn')) return null; return { top: a.getBoundingClientRect().top, bar: bar.getBoundingClientRect().bottom }; });
      if (r && r.top < r.bar - 1) { under = r; break; }
    }
    say(!under, `D4 history: a focused row under the sticky bar ${under ? `(row top ${under.top.toFixed(0)} < bar bottom ${under.bar.toFixed(0)})` : 'never'}`);
    await ctx.close();
  }
  await browser.close();
} finally { clean(); }
process.exit(bad ? 1 : 0);
