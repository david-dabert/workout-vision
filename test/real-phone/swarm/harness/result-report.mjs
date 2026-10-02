// node test/real-phone/swarm/harness/result-report.mjs, with PW_CHROMIUM naming a Chromium binary.
// Three checks of 30 September (critic and review), French:
// 1. at 375x548 the short-rep mark sits on its bar;
// 2. after "Arrêter le repos" the saved card still has one gold outline, the report's;
// 3. the report opened after saving compares the set with yesterday's, never with itself.
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const H = 'test/real-phone/swarm/harness', PORT = 5233;
copyFileSync(`${H}/result-report.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/result-report.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); };
const url = `http://localhost:${PORT}/workout-vision/zz-harness.html`;
let bad = 0;
const say = (ok, line) => { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'} ${line}`); };
try {
  await new Promise(r => setTimeout(r, 7000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });

  { // 1. The mark on its bar at 375x548.
    const p = await browser.newPage({ viewport: { width: 375, height: 548 }, reducedMotion: 'reduce' });
    await p.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
    await p.goto(url);
    await p.waitForSelector('.short-mark', { timeout: 30000 });
    const gap = await p.evaluate(() => { const m = document.querySelector('.short-mark'), bar = m.parentElement.querySelector('i'); return bar.getBoundingClientRect().top - m.getBoundingClientRect().bottom; });
    say(gap >= 2 && gap <= 7, `short-rep mark ${gap.toFixed(1)} px above its bar at 375x548`);
    await p.close();
  }

  { // 2 and 3. Yesterday's curl stored first; the set saved; the rest stopped; the report opened.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
    await p.goto(url);
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('workoutVision');
      r.onsuccess = () => { const db = r.result, tx = db.transaction('workouts', 'readwrite'), day = 86400000;
        const reps = Array.from({ length: 6 }, (_, k) => ({ index: k + 1, startTime: k * 4, endTime: k * 4 + 3, romDegrees: 95, concentricSec: 1, eccentricSec: 2, peakSpeed: 100, meanSpeed: 50 }));
        tx.objectStore('workouts').put({ id: 'yesterday', exercise: 'bicep_curl', reps: 6, repDetails: reps, repDetailsVersion: 2, source: 'counter-core', corrected: false, createdAt: Date.now() - day }, 'yesterday');
        tx.oncomplete = () => { db.close(); res(); }; tx.onerror = () => rej(tx.error); };
      r.onerror = () => rej(r.error);
    }));
    await p.reload();
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.locator('[data-testid="ask-card"] .btn-primary').click();
    await p.waitForSelector('[data-testid="saved-card"]');
    await p.getByRole('button', { name: 'Arrêter le repos' }).click();
    // One gold outline after a stop, and it is the next set's (design review of 1 October).
    const gold = p.locator('[data-testid="saved-card"] .btn-line:not(.is-quiet)');
    const goldN = await gold.count(), goldText = goldN === 1 ? (await gold.textContent()).trim() : '';
    say(goldN === 1 && goldText === 'Nouvelle série', `gold outlines on the saved card after a stop: ${goldN} ("${goldText}")`);
    await p.getByRole('button', { name: 'Rapport de séance' }).click();
    await p.waitForSelector('.sheet', { timeout: 20000 });
    const text = await p.locator('.sheet').innerText();
    const line = (text.match(/Série du [^\n]*/) || [''])[0];
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const flat = x => x.replace(/[\u00a0\u202f]/g, ' ');
    say(flat(line).includes(flat(yesterday)) && /\b6 rép/.test(flat(line)), `report compares with: "${line}" (expected ${yesterday}, 6 rép.)`);
    await ctx.close();
  }
  await browser.close();
} finally { clean(); }
process.exit(bad ? 1 : 0);
