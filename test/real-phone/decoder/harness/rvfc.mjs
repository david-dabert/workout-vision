// node test/real-phone/decoder/harness/rvfc.mjs, with PW_CHROMIUM naming a Chromium binary.
// The playback path must read every sample however slow the analysis: 0, 150 and 400 ms a frame, each a new picture.
import { chromium } from 'playwright';
import { copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
const H = 'test/real-phone/decoder/harness';
copyFileSync(`${H}/rvfc-harness.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/rvfc-harness.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
let bad = 0;
try {
  await new Promise(r => setTimeout(r, 6000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  for (const [ms, q] of [[0, ''], [150, ''], [400, ''], [150, '&twice']]) {
    const p = await browser.newPage();
    await p.goto(`http://localhost:5199/workout-vision/zz-harness.html?ms=${ms}${q}`);
    await p.waitForFunction(() => window.__out, null, { timeout: 180000 });
    const out = await p.evaluate(() => window.__out);
    // Every sample read, and none a repeat of the one before (frozen-read incident, 3 October).
    const ok = !out.error && (out.twice ? out.identical : out.read === out.expected && out.repeats === 0);
    delete out.times;
    if (!ok) bad++;
    console.log(`analysis ${ms} ms a frame: ${JSON.stringify(out)} ${ok ? 'whole' : 'NOT WHOLE'}`);
    await p.close();
  }
  await browser.close();
} finally { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); }
process.exit(bad ? 1 : 0);
