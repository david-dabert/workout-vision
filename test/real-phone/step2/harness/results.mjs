// node test/real-phone/step2/harness/results.mjs, with PW_CHROMIUM naming a Chromium binary.
// Prints what the result screen says for exercises without a card: counted, and refused with one or
// both legs hidden. Leaves no file behind.
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const H = 'test/real-phone/step2/harness';
copyFileSync(`${H}/result-harness.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/result-harness.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); };
const CASES = [
  ['fr', '?lift=hammer_curl&arm=left'],
  ['en', '?lift=forward_lunge&arm=right'],
  ['fr', '?lift=dead_bug&arm=both'],
  ['fr', '?lift=bird_dog&arm=both&refused&hide=left'],
  ['en', '?lift=walking_lunge&arm=both&refused&hide=right'],
  ['fr', '?lift=forward_lunge&arm=left&refused&hide=left'],
];
try {
  await new Promise(r => setTimeout(r, 6000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  for (const [lang, query] of CASES) {
    const p = await browser.newPage({ viewport: { width: 390, height: 664 } });
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(l => localStorage.setItem('wv_lang', l), lang);
    await p.goto(`http://localhost:5199/workout-vision/zz-harness.html${query}`);
    await p.waitForSelector('.result-screen', { timeout: 20000 });
    await p.waitForTimeout(800);
    const read = sel => p.$$eval(sel, els => els.map(e => e.textContent.trim()).join(' | '));
    console.log(`${lang} ${query}`);
    console.log(`  eyebrow: ${await read('.result-screen .eyebrow')}`);
    console.log(`  tier: ${await read('.result-screen .tier')}`);
    console.log(`  meta: ${await read('.res-meta')}`);
    console.log(`  body: ${await read('.body-text')}`);
    console.log(`  page errors: ${errors.length ? errors.join('; ') : 'none'}`);
    await p.close();
  }
  await browser.close();
} finally { clean(); }
