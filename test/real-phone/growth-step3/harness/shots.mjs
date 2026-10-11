// node test/real-phone/growth-step3/harness/shots.mjs, with PW_CHROMIUM naming a Chromium binary.
// Shoots the result screen at 390x664 in French and English, Reduce Motion: as counted, after "Oui",
// and with "En savoir plus" open; prints the account's lines and any layout fault. Leaves only the shots.
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { layoutFaults } from '../../checks.mjs';

const H = 'test/real-phone/growth-step3/harness', OUT = 'test/real-phone/growth-step3/shots';
copyFileSync(`${H}/result-harness.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/result-harness.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); };
let bad = 0;
try {
  await new Promise(r => setTimeout(r, 6000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  for (const [lang, query] of [['fr', ''], ['en', ''], ['fr', '?clipped']]) {
    const tag = `${lang}${query ? '-clipped' : ''}`;
    const p = await browser.newPage({ viewport: { width: 390, height: 664 }, reducedMotion: 'reduce' });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(l => localStorage.setItem('wv_lang', l), lang);
    await p.goto(`http://localhost:5199/workout-vision/zz-harness.html${query}`);
    await p.waitForSelector('[data-testid="set-account"]', { timeout: 20000 });
    await p.evaluate(() => document.fonts.ready);
    const faults = async name => { const f = await p.evaluate(layoutFaults); if (f.length) { bad++; console.log(`${tag} ${name} faults:`, f); } };
    await p.screenshot({ path: `${OUT}/${tag}-1-counted.png` }); await faults('counted');
    const ask = await p.locator('[data-testid="ask-card"]').boundingBox();
    console.log(`${tag}: ask card bottom ${Math.round(ask.y + ask.height)} of 664`);
    await p.locator('[data-testid="ask-card"] .btn-primary').click();
    await p.waitForSelector('.acc-cheer');
    await p.locator('.set-account').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/${tag}-2-saved.png` }); await faults('saved');
    await p.locator('.acc-notes summary').click();
    await p.locator('.acc-notes section').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/${tag}-3-notes.png` }); await faults('notes');
    console.log(`${tag}:`, await p.$$eval('.set-account > p', ps => ps.map(x => x.textContent)));
    console.log(`${tag}: short marks`, await p.locator('.short-mark').count(), 'errors', errors);
    if (errors.length) bad++;
    await p.close();
  }
  await browser.close();
} finally { clean(); }
process.exit(bad ? 1 : 0);
