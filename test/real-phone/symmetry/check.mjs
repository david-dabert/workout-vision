#!/usr/bin/env node
// node test/real-phone/symmetry/check.mjs
// The result screen (mount.jsx) in Chromium on David's own sets: a set filmed from the front shows the
// left/right line once the count is asked, under the experimental label; a set filmed from the side shows
// none. After saving, the stored set carries the comparison the report reads. Writes check.txt.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const PORT = 5181, URL = `http://localhost:${PORT}/workout-vision/test/real-phone/symmetry/mount.html`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
const out = [], fails = [];
const check = (ok, what) => { out.push(`${ok ? 'pass' : 'FAIL'}  ${what}`); if (!ok) fails.push(what); };
const SETS = [
  { file: 'landmarks/lateral_raise_10_front_mufhhbun.json.gz', lift: 'lateral_raise', front: true },
  { file: 'sets-29sep/lateral_raise_9_front_43e71b40.json.gz', lift: 'lateral_raise', front: true },
  // Filmed from the front, but presses are not compared (symmetry.ts, SIDES_LIFTS): no line, no strip.
  { file: 'sets-29sep/overhead_press_4_front_f75638cc.json.gz', lift: 'overhead_press', front: false },
  { file: 'sets-29sep/squat_7_side_21fd7ccf.json.gz', lift: 'squat', front: false },
  { file: 'landmarks/bicep_curl_7_side_mufhf3wy.json.gz', lift: 'bicep_curl', front: false },
];

try {
  for (let i = 0; i < 60; i++) { try { await fetch(URL); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const lang of ['fr', 'en']) for (const s of SETS) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, 'test/real-phone', s.file))).toString());
    const body = JSON.stringify({ lift: d.lift ?? s.lift, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps });
    const page = await (await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' })).newPage();
    await page.route('**/set.json', r => r.fulfill({ contentType: 'application/json', body }));
    await page.addInitScript(l => localStorage.setItem('wv_lang', l), lang);
    await page.goto(URL);
    await page.locator('[data-testid="ask-card"]').waitFor({ timeout: 60000 });
    const sides = page.locator('[data-testid="res-sides"]');
    const n = await sides.count();
    const text = n ? (await sides.innerText()).replace(/\n/g, ' | ') : '';
    check(await page.locator('[data-testid="strip-tempo"]').count() === 1, `${lang} ${s.file}: tempo strip drawn`);
    if (!s.front) check(await page.locator('[data-testid="strip-sides"]').count() === 0, `${lang} ${s.file}: no left/right strip`);
    check(s.front ? n === 1 : n === 0, `${lang} ${s.file}: ${s.front ? 'line shown' : 'no line'}${text ? `: ${text}` : ''}`);
    // The question stays on the first screen: the strips sit under it, never between the count and it.
    const ask = await page.locator('[data-testid="ask-card"]').boundingBox(), strips = await page.locator('[data-testid="rep-strips"]').boundingBox();
    check(ask && strips && strips.y >= ask.y + ask.height, `${lang} ${s.file}: strips under the question`);
    // A tap on a strip column selects that very rep in the marks and in every strip.
    const area = page.locator('.res-strips');
    // Centred, as a reader looks at them; 'if needed' leaves them flush with the bottom edge.
    await area.evaluate(e => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    if (process.env.SHOTS) { await page.waitForTimeout(1200); await area.screenshot({ path: resolve(process.env.SHOTS, `${lang}-${s.lift}.png`) }); }
    const col = page.locator('[data-testid="strip-tempo"] .strip-col').nth(2);
    const b = await col.boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(400);
    const selBar = await page.locator('.bars .bar').evaluateAll(bs => bs.findIndex(x => x.classList.contains('sel')));
    const selCols = await page.locator('[data-testid="rep-strips"] .strip').evaluateAll(ss => ss.map(st => [...st.querySelectorAll('.strip-col')].findIndex(x => x.classList.contains('sel'))));
    check(selBar === 2 && selCols.every(i => i === 2), `${lang} ${s.file}: a tap on rep 3's column selects rep 3 in the marks and every strip (${selBar}, ${selCols})`);
    // The tap answers where it was made: the caption under the strips names rep 3 and is on screen.
    const cap = page.locator('[data-testid="strip-caption"]');
    const cb = await cap.boundingBox().catch(() => null);
    const ctext = (await cap.textContent().catch(() => '')) || '';
    check(!!cb && cb.y >= 0 && cb.y + cb.height <= 664 && /3/.test(ctext), `${lang} ${s.file}: the caption is in view (top ${cb?.y.toFixed(0)}, bottom ${(cb?.y + cb?.height).toFixed(0)} of 664) and names the rep: ${ctext}`);
    if (process.env.SHOTS) await area.screenshot({ path: resolve(process.env.SHOTS, `${lang}-${s.lift}-sel.png`) });
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    if (n) {
      check(await page.locator('[data-testid="res-exp"]').count() === 1, `${lang} ${s.file}: experimental label on screen`);
      check(await page.locator('[data-testid="strip-sides"]').count() === 1, `${lang} ${s.file}: left/right strip drawn`);
      const box = await sides.boundingBox();
      check(box && box.x >= 0 && box.x + box.width <= 390, `${lang} ${s.file}: line within the 390 px width`);
      const over = await page.locator('.res-strips').evaluate(e => [e, ...e.querySelectorAll('*')].some(x => { const r = x.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > innerWidth + 0.5); }));
      check(!over, `${lang} ${s.file}: nothing in the strips overflows`);
      // Save, then read the stored set back the way the report does.
      await page.locator('[data-testid="ask-card"] .btn-primary').click();
      const stored = await page.waitForFunction(() => new Promise(res => {
        const rq = indexedDB.open('workoutVision');
        rq.onerror = () => res(null);
        rq.onsuccess = () => { try {
          const db = rq.result, names = [...db.objectStoreNames]; const all = [];
          const tx = db.transaction(names, 'readonly'); let left = names.length;
          for (const nm of names) { const g = tx.objectStore(nm).getAll(); g.onsuccess = () => { all.push(...g.result); if (--left === 0) { const w = all.find(x => x && x.sides); res(w ? w.sides : null); } }; }
        } catch { res(null); } };
      }), null, { timeout: 15000 }).then(h => h.jsonValue()).catch(() => null);
      check(!!stored && Number.isFinite(stored.si), `${lang} ${s.file}: saved set carries the comparison ${JSON.stringify(stored)}`);
    }
    await page.context().close();
  }
  // The beginner has no strips, but still sees the set's left/right line and its note under the marks.
  for (const lang of ['fr', 'en']) for (const w of [320, 390]) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, 'test/real-phone', SETS[0].file))).toString());
    const body = JSON.stringify({ lift: d.lift ?? SETS[0].lift, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps });
    for (const level of ['beginner', 'intermediate']) {
      const page = await (await browser.newContext({ viewport: { width: w, height: 568 }, reducedMotion: 'reduce' })).newPage();
      await page.route('**/set.json', r => r.fulfill({ contentType: 'application/json', body }));
      await page.addInitScript(([l, lv]) => { localStorage.setItem('wv_lang', l); localStorage.setItem('wv_level', lv); }, [lang, level]);
      await page.goto(URL);
      await page.locator('[data-testid="ask-card"]').waitFor({ timeout: 60000 });
      // The topbar: the replay on the screen's centre line, the test mark on one line (design review, 2 October).
      const bar = await page.evaluate(() => {
        const r = document.querySelector('.result-screen .rp-open')?.getBoundingClientRect(), pill = document.querySelector('.result-screen .topbar .pill')?.getBoundingClientRect();
        return { off: r ? Math.abs(r.left + r.width / 2 - innerWidth / 2) : null, pillH: pill?.height ?? null, overlap: r && pill ? r.right > pill.left : null };
      });
      check(bar.off !== null && bar.off <= 2 && bar.pillH === null, `${lang} ${level} ${w}px: replay on the centre line (${bar.off?.toFixed(1)} px off), no test mark on the result`);
      const strips = await page.locator('[data-testid="rep-strips"]').count(), line = await page.locator('[data-testid="res-sides"]').count();
      check(line === 1 && strips === (level === 'beginner' ? 0 : 1), `${lang} ${level} ${w}px: line ${line}, strips ${strips}`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      check(!wide, `${lang} ${level} ${w}px: nothing wider than the screen`);
      await page.context().close();
    }
  }
  await browser.close();
} finally {
  try { process.kill(-server.pid); } catch {}
}
writeFileSync(resolve(HERE, 'check.txt'), out.join('\n') + `\n${fails.length ? `${fails.length} FAILED` : 'all passed'}\n`);
console.log(out.join('\n')); console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
