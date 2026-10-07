#!/usr/bin/env node
// One real video through the app's own extraction and pose code (test/real-phone/harness.html), three times: without
// the crop pass on lost frames (bench hook __WV_BENCH_NO_CROP__), with it (src/lib/poseCrop.js) but without the
// backward pass (__WV_BENCH_NO_BACK__), and with both (7 October). Prints, for each, the samples with a pose, how many
// came from the crop and from the backward pass, the detection time, and the count of the app's counter
// (summarizeCount) against the label; and checks that every sample with a pose without the backward pass is the same
// with it. Writes nothing into the repository.
//
//   node test/real-phone/far-camera/run-video.mjs <video file> <lift> <label>
//
// Desktop Chrome by default (it decodes the iPhone's H.264 and HEVC); PW_CHROMIUM=<path> runs another Chromium.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const [video, lift, label] = process.argv.slice(2);
if (!video || !lift || !label) throw new Error('usage: node test/real-phone/far-camera/run-video.mjs <video file> <lift> <label>');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.env.FAR_PORT || 5194), BASE = `http://localhost:${PORT}/workout-vision/`;
const TYPES = { '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const bytes = readFileSync(video), type = TYPES[extname(video).toLowerCase()] || 'application/octet-stream';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: 'chrome' });
  console.log(`${basename(video)}  lift ${lift}  label ${label}`);
  const MODES = [{ name: 'crop off            ', noCrop: true, noBack: true }, { name: 'crop on, back off   ', noBack: true }, { name: 'crop on, back on    ', back: true }, { name: 'back on, 3 s kept   ', back: true, backKeepMs: 3000 }];
  const worlds = [], dump = [];
  for (const { name, noCrop = false, noBack = false, back = false, backKeepMs = 0 } of MODES) {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.route('**/far-video/**', r => r.fulfill({ body: bytes, contentType: type }));
    await page.goto(`${BASE}test/real-phone/harness.html`, { timeout: 300000 });
    await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 300000 });
    const r = await page.evaluate(async ({ noCrop, noBack, back, backKeepMs, url, lift, core }) => {
      if (back) globalThis.__WV_BENCH_BACK__ = true;
      if (noCrop) globalThis.__WV_BENCH_NO_CROP__ = true;
      if (noBack) globalThis.__WV_BENCH_NO_BACK__ = true;
      if (backKeepMs) globalThis.__WV_BENCH_BACK_KEEP_MS__ = backKeepMs;
      const x = await window._fetchAndProcess(url);
      const { summarizeCount } = await import(core);
      const c = summarizeCount(x.worldLandmarks, x.timestamps, lift);
      return { ts: x.timestamps, m: x.metadata, count: c.refused ? 'refused' : c.count, seen: x.worldLandmarks.filter(Boolean).length, n: x.timestamps.length, world: x.worldLandmarks.map(w => (w ? JSON.stringify(w) : null)) };
    }, { noCrop, noBack, back, backKeepMs, url: `${BASE}far-video/${encodeURIComponent(basename(video))}`, lift, core: `${BASE}src/lib/coreAnalysis.js` });
    const perMin = (r.m.detectSeconds / (r.n / 15)) * 60;
    console.log(`  ${name}: pose in ${r.seen}/${r.n} samples (${Math.round((100 * r.seen) / r.n)}%), ${r.m.cropSamples} from the crop, ${r.m.backSamples ?? 0} from the backward pass; count ${r.count} for ${label}; detection ${r.m.detectSeconds} s (${perMin.toFixed(1)} s per minute of video); ${r.m.extractedWidth}x${r.m.extractedHeight}, ${r.m.extractionMethod}`);
    worlds.push(r.world);
    dump.push({ name: name.trim(), count: r.count, timestamps: r.ts, world: r.world });
    await page.close();
  }
  // Every sample with a pose before the backward pass is byte-identical with it.
  const [, before, ...afters] = worlds;
  const changed = afters.map(after => before.filter((w, i) => w && w !== after[i]).length);
  console.log(`  samples with a pose before the backward pass that changed with it: ${changed.join(', ')}`);
  // FAR_DUMP=<file>: every run's world landmarks and timestamps, to look at what changed (written outside the repo).
  if (process.env.FAR_DUMP) writeFileSync(process.env.FAR_DUMP, JSON.stringify(dump));
  await browser.close();
} finally { try { process.kill(-server.pid); } catch { /* already gone */ } }
