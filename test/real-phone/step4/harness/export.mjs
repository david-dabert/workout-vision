// node test/real-phone/step4/harness/export.mjs, with PW_CHROMIUM naming a Chromium binary.
// Prepares the video of a synthetic set on the replay, in French, at 390x664, and checks the file that
// comes out plays back with the set's length and carries the lit joint (gold pixels) in a frame.
// Chromium's recording proves the pipeline; Safari on iPhone is proved only on David's iPhone. Leaves only the shots.
import { chromium } from 'playwright';
import { copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const H = 'test/real-phone/step4/harness', OUT = 'test/real-phone/step4/shots';
copyFileSync(`${H}/replay-harness.jsx`, 'src/zz-harness.jsx');
copyFileSync(`${H}/replay-harness.html`, 'zz-harness.html');
const vite = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: true });
const clean = () => { try { process.kill(-vite.pid); } catch {} rmSync('src/zz-harness.jsx', { force: true }); rmSync('zz-harness.html', { force: true }); };
let code = 1;
try {
  await new Promise(r => setTimeout(r, 6000));
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const p = await browser.newPage({ viewport: { width: 390, height: 664 } });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
  await p.goto('http://localhost:5199/workout-vision/zz-harness.html');
  const prepare = p.getByRole('button', { name: 'Préparer la vidéo à partager' });
  await prepare.waitFor({ timeout: 30000 });
  await p.screenshot({ path: `${OUT}/1-replay.png` });
  await prepare.click();
  await p.getByText(/Préparation de la vidéo… [1-9]/).waitFor({ timeout: 10000 });
  await p.screenshot({ path: `${OUT}/2-preparing.png` });
  const ready = p.locator('.rp-export a, .rp-export button:not([disabled])');
  await ready.waitFor({ timeout: 30000 });
  await p.screenshot({ path: `${OUT}/3-ready.png` });
  const out = await p.evaluate(async () => {
    const a = document.querySelector('.rp-export a');
    if (!a) return { label: document.querySelector('.rp-export button').textContent };
    const blob = await (await fetch(a.href)).blob();
    const v = Object.assign(document.createElement('video'), { src: a.href, muted: true });
    await new Promise(r => { v.onloadedmetadata = r; v.onerror = r; });
    // WebM from MediaRecorder reports no duration until the end is sought.
    if (!Number.isFinite(v.duration)) { v.currentTime = 1e9; await new Promise(r => { v.ontimeupdate = r; setTimeout(r, 3000); }); }
    v.currentTime = 1; await new Promise(r => { v.onseeked = r; setTimeout(r, 3000); });
    const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight }), g = c.getContext('2d');
    g.drawImage(v, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let gold = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 220 && px[i + 1] > 190 && px[i + 1] < 235 && px[i + 2] > 140 && px[i + 2] < 200) gold++;
    return { gold, label: a.textContent, name: a.download, type: blob.type, bytes: blob.size, width: v.videoWidth, height: v.videoHeight, duration: Math.round(v.duration * 10) / 10 };
  });
  const lines = [`input: synthetic WebM, 360x640, 3 s (${await p.evaluate(() => window.__made)} bytes)`, `output: ${JSON.stringify(out)}`, `page errors: ${JSON.stringify(errors)}`];
  console.log(lines.join('\n'));
  writeFileSync(`${OUT}/output.txt`, lines.join('\n') + '\n');
  code = out.bytes > 0 && out.width === 360 && out.height === 640 && out.duration >= 2.5 && out.gold > 50 && !errors.length ? 0 : 1;
  await browser.close();
} finally { clean(); }
process.exit(code);
