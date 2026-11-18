#!/usr/bin/env node
// One video through the app's own extraction and pose code (test/real-phone/harness.html) twice (18 November 2026):
// as the app runs today (one pose per frame), and with every pose recorded (bench hook __WV_BENCH_ALL_POSES__), linked
// into per-person tracks over the whole set and the lifter's track chosen by motion (lifterTrack.js). Prints each
// track, the count of the app's counter (summarizeCount) on the app's poses and on the chosen track, against the
// label. Writes nothing into the repository; TRACK_DUMP=<file> keeps the poses (outside the repository).
//
//   node test/real-phone/occlusion/track-video.mjs <video file> <lift> <label>
//
// Desktop Chrome by default; PW_CHROMIUM=<path> runs another Chromium.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { linkTracks, scoreTracks, pickLifterTrack } from './lifterTrack.js';

const [video, lift, label] = process.argv.slice(2);
if (!video || !lift || !label) throw new Error('usage: node test/real-phone/occlusion/track-video.mjs <video file> <lift> <label>');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.env.TRACK_PORT || 5197), BASE = `http://localhost:${PORT}/workout-vision/`;
const TYPES = { '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const bytes = readFileSync(video), type = TYPES[extname(video).toLowerCase()] || 'application/octet-stream';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: 'chrome' });
  console.log(`${basename(video)}  lift ${lift}  label ${label}`);
  const run = async all => {
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('pageerror', e.message));
    await page.route('**/track-video/**', r => r.fulfill({ body: bytes, contentType: type }));
    await page.goto(`${BASE}test/real-phone/harness.html`, { timeout: 300000 });
    await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 300000 });
    const r = await page.evaluate(async ({ all, url, lift, core }) => {
      if (all) globalThis.__WV_BENCH_ALL_POSES__ = true;
      const x = await window._fetchAndProcess(url);
      const { summarizeCount } = await import(core);
      const c = summarizeCount(x.worldLandmarks, x.timestamps, lift);
      return { ts: x.timestamps, count: c.refused ? 'refused' : c.count, seen: x.worldLandmarks.filter(Boolean).length, poses: globalThis.__WV_BENCH_POSES__ || null };
    }, { all, url: `${BASE}track-video/${encodeURIComponent(basename(video))}`, lift, core: `${BASE}src/lib/coreAnalysis.js` });
    await page.close();
    return r;
  };
  const app = await run(false);
  console.log(`  app today: pose in ${app.seen}/${app.ts.length} samples; count ${app.count} for ${label}`);
  const all = await run(true);
  const frames = all.poses;
  const multi = frames.filter(f => f.image.length > 1).length;
  console.log(`  every pose: ${frames.length} frames, ${multi} with two or more people`);
  const tracks = linkTracks(frames), scores = scoreTracks(frames, tracks), lifter = pickLifterTrack(scores);
  for (const s of scores.filter(s => s.cover >= 0.05)) {
    const at = [...tracks[s.id].at.keys()];
    console.log(`  track ${s.id}: frames ${at[0]}-${at.at(-1)}, cover ${(100 * s.cover).toFixed(0)}%, motion ${s.motion.toFixed(1)} deg${s.id === lifter?.id ? '  <- lifter' : ''}`);
  }
  // The chosen track's world landmarks on the harness's own timeline (nearest recorded frame, same timestamps).
  // The hook records one frame per whole-frame detect, in sample order (its t is the worker's clock, not video time).
  if (frames.length !== all.ts.length) throw new Error(`frames ${frames.length} != samples ${all.ts.length}`);
  const world = all.ts.map((_, i) => { const k = tracks[lifter.id].at.get(i); return k == null ? null : frames[i].world[k]; });
  const matched = frames.length;
  const page = await browser.newPage();
  await page.goto(`${BASE}test/real-phone/harness.html`, { timeout: 300000 });
  const c = await page.evaluate(async ({ world, ts, lift, core }) => { const { summarizeCount } = await import(core); const c = summarizeCount(world, ts, lift); return c.refused ? 'refused' : c.count; }, { world, ts: all.ts, lift, core: `${BASE}src/lib/coreAnalysis.js` });
  console.log(`  first pose with three asked: count ${all.count}; lifter track: pose in ${world.filter(Boolean).length}/${all.ts.length} samples (${matched} frames); count ${c} for ${label}`);
  if (process.env.TRACK_DUMP) writeFileSync(process.env.TRACK_DUMP, JSON.stringify({ ts: all.ts, frames }));
  await browser.close();
} finally { try { process.kill(-server.pid); } catch { /* already gone */ } }
