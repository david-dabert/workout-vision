#!/usr/bin/env node
// One video through the app's own extraction and pose code (test/real-phone/harness.html) twice: without and with the
// lifter lock (src/lib/lifterLock.js; bench hook __WV_BENCH_LOCK__: two poses asked, the lifter's kept). Prints, for
// each, the samples with a pose, the detection time, the count of the app's counter (summarizeCount) against the
// label, and how many samples with a pose in both runs differ (7 October). Writes nothing into the repository;
// LOCK_DUMP=<file> keeps both runs' world landmarks and timestamps (outside the repository).
//
//   node test/real-phone/occlusion/lock-video.mjs <video file> <lift> <label>
//
// Desktop Chrome by default; PW_CHROMIUM=<path> runs another Chromium.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const [video, lift, label] = process.argv.slice(2);
if (!video || !lift || !label) throw new Error('usage: node test/real-phone/occlusion/lock-video.mjs <video file> <lift> <label>');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.env.LOCK_PORT || 5196), BASE = `http://localhost:${PORT}/workout-vision/`;
const TYPES = { '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const bytes = readFileSync(video), type = TYPES[extname(video).toLowerCase()] || 'application/octet-stream';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: 'chrome' });
  console.log(`${basename(video)}  lift ${lift}  label ${label}`);
  const runs = [];
  for (const lock of [false, true]) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.route('**/lock-video/**', r => r.fulfill({ body: bytes, contentType: type }));
    await page.goto(`${BASE}test/real-phone/harness.html`, { timeout: 300000 });
    await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 300000 });
    const r = await page.evaluate(async ({ lock, url, lift, core }) => {
      if (lock) globalThis.__WV_BENCH_LOCK__ = true;
      const x = await window._fetchAndProcess(url);
      const { summarizeCount } = await import(core);
      const c = summarizeCount(x.worldLandmarks, x.timestamps, lift);
      return { ts: x.timestamps, m: x.metadata, count: c.refused ? 'refused' : c.count, seen: x.worldLandmarks.filter(Boolean).length, n: x.timestamps.length, world: x.worldLandmarks.map(w => (w ? JSON.stringify(w) : null)) };
    }, { lock, url: `${BASE}lock-video/${encodeURIComponent(basename(video))}`, lift, core: `${BASE}src/lib/coreAnalysis.js` });
    const perMin = (r.m.detectSeconds / (r.n / 15)) * 60;
    console.log(`  lock ${lock ? 'on ' : 'off'}: pose in ${r.seen}/${r.n} samples (${Math.round((100 * r.seen) / r.n)}%), ${r.m.cropSamples} from the crop; count ${r.count} for ${label}; detection ${r.m.detectSeconds} s (${perMin.toFixed(1)} s per minute of video)`);
    runs.push(r);
    await page.close();
  }
  const [off, on] = runs;
  const both = off.world.filter((w, i) => w && on.world[i]).length;
  const changed = off.world.filter((w, i) => w && on.world[i] && w !== on.world[i]).length;
  const gained = on.world.filter((w, i) => w && !off.world[i]).length, lost = off.world.filter((w, i) => w && !on.world[i]).length;
  console.log(`  samples with a pose in both runs: ${both}, of which changed with the lock: ${changed}; gained ${gained}, lost ${lost}`);
  if (process.env.LOCK_DUMP) writeFileSync(process.env.LOCK_DUMP, JSON.stringify(runs.map((r, k) => ({ lock: k === 1, count: r.count, timestamps: r.ts, world: r.world }))));
  await browser.close();
} finally { try { process.kill(-server.pid); } catch { /* already gone */ } }
