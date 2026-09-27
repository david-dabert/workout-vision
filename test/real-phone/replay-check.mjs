/**
 * Round 7: the replay of the three approved clips, in WebKit (iPhone profile).
 *
 *   npm run build && npx vite preview --host 127.0.0.1 --port 4175 --strictPort &
 *   node test/real-phone/replay-check.mjs
 *
 * For each clip, the count is the one the app showed at Step 3 in WebKit
 * (test/real-phone/step3/webkit-iphone-<lift>.json); the result's Revoir opens the
 * replay, and:
 * - the video loads, in the shape of the frames the count used (aspect within 2 %,
 *   so the same orientation);
 * - in the middle of each rep's first phase, the measured joint is lit exactly when
 *   the tracked landmarks there saw its three points (replay-track.js), and the
 *   counter reads the rep's number. The replay draws the frame on screen, which can
 *   stand a frame before the time asked for; where the tracking changes its mind
 *   within that frame, the rep is listed as at an edge and not judged;
 * - no page error.
 * Writes test/real-phone/round7/replay.json and one frame per rep in
 * test/real-phone/round7/frames/, which git ignores: they show the person filmed.
 * Exit code 1 on FAIL.
 */
import { webkit, devices } from '@playwright/test';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { poseAt, SEEN } from '../../src/components/experience/replay-track.js';

const base = process.env.WV_BASE || 'http://127.0.0.1:4175/workout-vision/';
const out = resolve('test/real-phone/round7');
mkdirSync(`${out}/frames`, { recursive: true });

// lift, clip, the name on its card, the measured joint's points by side (core.ts JOINT_POINTS)
const ELBOW = { left: [11, 13, 15], right: [12, 14, 16] }, SHOULDER = { left: [23, 11, 13], right: [24, 12, 14] };
const CLIPS = [
  ['bicep_curl', 'bicep_curl_7_side_mufhf3wy', 'Curl biceps', ELBOW, 'concentric'],
  ['lateral_raise', 'lateral_raise_10_front_mufhhbun', 'Élévations latérales', SHOULDER, 'concentric'],
  ['lat_pulldown', 'lat_pulldown_10_front_mufhlh4o', 'Tirage vertical', ELBOW, 'concentric'],
];

async function check([lift, clip, name, points, first]) {
  const browser = await webkit.launch();
  const failures = [], reps = [];
  try {
    const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('wv_seen_entry', 'true');
      localStorage.setItem('wv_lang', 'fr');
      window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
    });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.altar', { hasText: name }).first().click();
    const input = page.locator('.film-screen input[type="file"]').last();
    await input.waitFor({ state: 'attached', timeout: 15000 });
    await input.setInputFiles(resolve(`test/real-phone/clips/${clip}.mov`));
    await page.waitForFunction(() => window.__coreOutput, null, { timeout: 300000 });
    const result = await page.evaluate(() => {
      const r = window.__coreOutput;
      return { count: r.count, arm: r.arm, metadata: r.metadata, timestamps: r.timestamps, imageLandmarks: r.imageLandmarks, reps: r.reps };
    });
    const step3 = JSON.parse(readFileSync(`test/real-phone/step3/webkit-iphone-${lift}.json`, 'utf8')).count;
    if (result.count !== step3) failures.push(`count ${result.count}, Step 3 counted ${step3}`);
    await page.locator('.rp-open').click();
    const video = page.locator('.replay-screen video');
    await video.waitFor({ state: 'attached', timeout: 10000 });
    const loaded = await page.waitForFunction(() => document.querySelector('.replay-screen video')?.readyState >= 2, null, { timeout: 20000 }).then(() => true, () => false);
    if (!loaded) { failures.push('the video did not load'); return { lift, count: result.count, step3, failures, errors, reps }; }
    const shape = await video.evaluate(v => ({ w: v.videoWidth, h: v.videoHeight }));
    const aspect = shape.w / shape.h, expected = result.metadata.width / result.metadata.height;
    if (Math.abs(aspect / expected - 1) > 0.02) failures.push(`video ${shape.w}×${shape.h} is not the shape of the frames counted, ${result.metadata.width}×${result.metadata.height}`);

    const sides = result.arm === 'both' ? ['left', 'right'] : [result.arm === 'right' ? 'right' : 'left'];
    for (const [k, r] of result.reps.entries()) {
      const target = r.startTime + (first === 'concentric' ? r.concentricSec : r.eccentricSec) / 2;
      const t = await video.evaluate((v, at) => new Promise(done => {
        const settle = () => requestAnimationFrame(() => requestAnimationFrame(() => done(v.currentTime)));
        v.pause();
        v.addEventListener('seeked', settle, { once: true });
        setTimeout(settle, 3000); // no seek event when the video already stands there
        v.currentTime = at;
      }), target);
      const lamp = await page.locator('.rp-canvas').evaluate(c => {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - 247) < 12 && Math.abs(d[i + 1] - 220) < 14 && Math.abs(d[i + 2] - 174) < 18) n++;
        return n;
      });
      const seenAt = at => { const pose = poseAt(result.imageLandmarks, result.timestamps, at); return !!pose && sides.some(s => points[s].every(i => pose[i].visibility >= SEEN)); };
      const seen = seenAt(t), edge = seen !== seenAt(t - 1 / 30);
      const counter = Number(await page.locator('.rp-n').textContent());
      const begun = result.reps.filter(x => x.startTime <= t).length;
      await page.locator('.rp-frame').screenshot({ path: `${out}/frames/${lift}-rep${k + 1}.png` });
      reps.push({ rep: k + 1, time: +t.toFixed(3), jointSeen: seen, edge, litPixels: lamp, counter, expectedCounter: begun });
      if (!edge && seen !== lamp > 20) failures.push(`rep ${k + 1}: joint ${seen ? 'seen' : 'not seen'} by the tracking, ${lamp} lit pixels`);
      if (counter !== begun) failures.push(`rep ${k + 1}: counter ${counter}, expected ${begun}`);
    }
    if (errors.length) failures.push(...errors.map(e => `page error: ${e}`));
    return { lift, count: result.count, step3, shape, frames: `${result.metadata.width}×${result.metadata.height}`, reps, failures };
  } finally {
    await browser.close();
  }
}

const report = { clips: [] };
for (const c of CLIPS) {
  const r = await check(c);
  report.clips.push(r);
  const lit = r.reps.filter(x => x.jointSeen).length, edges = r.reps.filter(x => x.edge).length;
  console.log(`${r.lift}: count ${r.count} (Step 3: ${r.step3}), joint lit in ${lit} of ${r.reps.length} reps${edges ? `, ${edges} at an edge` : ''}, ${r.failures.length ? r.failures.join('; ') : 'no fault'}`);
}
report.result = report.clips.every(c => !c.failures.length) ? 'PASS' : 'FAIL';
writeFileSync(`${out}/replay.json`, JSON.stringify(report, null, 2));
console.log(report.result);
process.exit(report.result === 'PASS' ? 0 : 1);
