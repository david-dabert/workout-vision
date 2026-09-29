// node test/real-phone/swarm/harness/rest-after-save.mjs, with PW_CHROMIUM naming a Chromium binary.
// The result screen (growth-step3 harness), French, 390x664: after "Oui, c'est juste" the rest clock
// runs under the thank-you line; and when the phone cannot save (IndexedDB refused, as in some
// private windows), the screen still offers the rest (review of the design pass, 29 September).
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const H = 'test/real-phone/growth-step3/harness';
copyFileSync(`${H}/result-harness.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/result-harness.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); };
let bad = 0;
try {
  await new Promise(r => setTimeout(r, 7000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  for (const broken of [false, true]) {
    const p = await browser.newPage({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    await p.addInitScript(b => {
      localStorage.setItem('wv_lang', 'fr');
      if (!b) return;
      // No store answers: IndexedDB refused, and localforage's fallback to localStorage refused too.
      indexedDB.open = () => { throw new DOMException('refused', 'InvalidStateError'); };
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (String(k).includes('workoutVision')) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); };
    }, broken);
    await p.goto('http://localhost:5199/workout-vision/zz-harness.html');
    await p.waitForSelector('[data-testid="ask-card"]', { timeout: 30000 });
    await p.locator('[data-testid="ask-card"] .btn-primary').click();
    await p.waitForTimeout(2500);
    const clock = await p.locator('.rest-slot [role="timer"]').count();
    const note = broken ? await p.locator('.save-error').textContent().catch(() => '') : await p.locator('.saved-msg').textContent();
    const ok = clock === 1;
    if (!ok) bad++;
    console.log(`${broken ? 'save refused' : 'saved'}: ${ok ? 'PASS' : 'FAIL'} clock running=${clock} note="${note}"`);
    await p.close();
  }
  await browser.close();
} finally { clean(); }
process.exit(bad ? 1 : 0);
