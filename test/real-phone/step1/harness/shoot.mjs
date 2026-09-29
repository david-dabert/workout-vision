// node test/real-phone/step1/harness/shoot.mjs, with PW_CHROMIUM naming a Chromium binary.
// Shoots, in Chromium at 390×664 (2x): the saved result card (fr, en) and the refused screen (fr).
// Prints what each shot's links carry. (The report sheet is shot by report-shot.pw.js.) Leaves no file behind outside test/real-phone/step1/screens/.
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const H = 'test/real-phone/step1/harness', OUT = 'test/real-phone/step1/screens';
copyFileSync(`${H}/result-harness.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/result-harness.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); };
try {
  await new Promise(r => setTimeout(r, 6000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const open = async (lang, query = '') => {
    const p = await browser.newPage({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 2 });
    await p.addInitScript(l => localStorage.setItem('wv_lang', l), lang);
    p.on('pageerror', e => console.log('page error:', e.message));
    await p.goto(`http://localhost:5199/workout-vision/zz-harness.html${query}`);
    return p;
  };
  for (const lang of ['fr', 'en']) {
    const p = await open(lang);
    await p.locator('[data-testid="ask-card"] .btn-primary').click({ timeout: 20000 });
    await p.locator('[data-testid="report-count"]').scrollIntoViewIfNeeded();
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${OUT}/result-saved-${lang}-390x664-bottom.png` });
    console.log(`saved ${lang}:`, (await p.$$eval('[data-testid="report-count"] a', as => as.map(a => decodeURIComponent(a.href)))).join('\n  '));
    await p.close();
  }
  const r = await open('fr', '?refused');
  await r.locator('[data-testid="report-count"]').scrollIntoViewIfNeeded({ timeout: 20000 });
  await r.waitForTimeout(3000);
  await r.screenshot({ path: `${OUT}/result-refused-fr-390x664.png` });
  console.log('refused fr:', (await r.$$eval('[data-testid="report-count"] a', as => as.map(a => decodeURIComponent(a.href)))).join('\n  '));
  await browser.close();
} finally { clean(); }
