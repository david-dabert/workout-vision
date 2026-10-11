import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { LIFTS } from '../src/lib/counting/core.ts';
const source = process.env.MMFIT_SAVED || 'test/real-phone/mmfit';
const dest = 'test/real-phone/mmfit';
const cases = [
  ['w00-squats-4040-4500', 'squat'],
  ['w01-dumbbell_rows-37940-38553', 'dumbbell_row'],
  ['w00-tricep_extensions-46229-46625', 'triceps_pushdown'],
];
const { chromium } = await import('@playwright/test');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5188/workout-vision/test/real-phone/harness.html');
await page.waitForFunction(() => window._harnessReady);
const output = [];
for (const [id, lift] of cases) {
  const raw = path.join(source, id + '.json');
  const bytes = fs.existsSync(raw) ? fs.readFileSync(raw) : gunzipSync(fs.readFileSync(raw + '.gz'));
  const data = JSON.parse(bytes);
  const previous = JSON.parse(fs.readFileSync(path.join(source, id + '-count.json')));
  const result = await page.evaluate(async ({ data, lift }) => { const { countReps } = await import('/workout-vision/src/lib/counting/core.ts'); return countReps(data.worldLandmarks, data.timestamps, lift); }, { data, lift });
  if (JSON.stringify(result) !== JSON.stringify(previous)) throw new Error(`Saved result differs from current core: ${id}`);
  fs.writeFileSync(path.join(dest, id + '.json.gz'), gzipSync(bytes));
  const { smoothedAngles: a, lowThreshold: low, highThreshold: high } = result;
  // Trace the unchanged detector's crossings. No alternative parameters or labels.
  const restsLow = LIFTS[lift].rest === 'low';
  let state = null;
  const cycles = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === null) continue;
    if (!state) {
      if (restsLow ? a[i] > low : a[i] < high) state = { start: data.timestamps[i], workReached: false, min: a[i], max: a[i] };
    } else {
      state.min = Math.min(state.min, a[i]); state.max = Math.max(state.max, a[i]);
      if (restsLow ? a[i] >= high : a[i] <= low) state.workReached = true;
      if (state.workReached && (restsLow ? a[i] < low : a[i] > high)) { cycles.push({ ...state, end: data.timestamps[i] }); state = null; }
    }
  }
  const valid = a.map((angle, i) => ({ time: data.timestamps[i], angle })).filter(p => p.angle !== null);
  const trace = { id, lift, count: result.count, side: result.arm, low, high, first: valid[0], last: valid.at(-1), completedThresholdCycles: cycles, unfinished: state, rawMissing: result.angles.filter(v => v === null).length, samples: a.length, savedLandmarksSHA256: crypto.createHash('sha256').update(bytes).digest('hex') };
  if (lift === 'triceps_pushdown') {
    // Windows identify the three missed excursions in the saved trace, not settings for the counter.
    trace.missedExcursions = [[2.8, 4.4, 'max'], [5.4, 6, 'min'], [9.1, 9.7, 'min']].map(([start, end, mode]) => {
      const points = valid.filter(p => p.time >= start && p.time <= end);
      return { window: [start, end], mode, extreme: points.reduce((best, p) => (mode === 'max' ? p.angle > best.angle : p.angle < best.angle) ? p : best) };
    });
  }
  output.push(trace);
}
await browser.close();
fs.writeFileSync(path.join(dest, 'diagnosis.json'), JSON.stringify(output, null, 2));
const f = n => n.toFixed(3);
const lines = ['# Saved-landmark diagnoses', '', 'Current core replay equals the saved count result exactly for each case. No video was opened and no parameter or label was changed.', ''];
for (const d of output) {
  lines.push(`## ${d.id}`, '', `Count ${d.count}; side ${d.side}; low ${f(d.low)}°; high ${f(d.high)}°. Missing raw angles: ${d.rawMissing}/${d.samples}.`, '');
  if (d.unfinished?.workReached) {
    lines.push(`**Label-boundary / counting-convention mismatch.** The saved trace contains ${d.completedThresholdCycles.length} completed threshold cycles and a final working excursion beginning at ${f(d.unfinished.start)} s that reaches the working threshold but does not return through the resting threshold before the segment ends. The final angle is ${f(d.last.angle)}° at ${f(d.last.time)} s, below the high return threshold ${f(d.high)}°. The unchanged counter requires that return. This explains the one-count gap without a lost complete threshold cycle. The dataset label apparently includes this terminal excursion; the annotator's intent cannot be proved from landmarks alone.`, '');
  } else {
    lines.push('**Counter / landmark-signal miss, not evidence of a label convention difference.** Internal excursions fail the unchanged threshold rules: one extension does not reach the high threshold, and two intervening returns stay above the low threshold, joining adjacent excursions. The visibility rule excludes this set from supplementary build use. Landmarks alone cannot separate shallow physical motion from pose-estimation error.', '', '| Miss | Time (s) | Angle (°) | Required threshold (°) |', '|---|---:|---:|---:|');
    for (const [i, e] of d.missedExcursions.entries()) lines.push(`| ${i + 1}: ${e.mode === 'max' ? 'extension peak too low' : 'return trough too high'} | ${f(e.extreme.time)} | ${f(e.extreme.angle)} | ${f(e.mode === 'max' ? d.high : d.low)} |`);
    lines.push('');
  }
}
fs.writeFileSync(path.join(dest, 'diagnosis.md'), lines.join('\n'));
console.log(lines.join('\n'));
