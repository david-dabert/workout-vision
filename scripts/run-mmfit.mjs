import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const run = promisify(execFile);
const root = process.env.MMFIT_ROOT || path.join(os.homedir(), 'Datasets/MM-Fit');
const local = path.join(root, 'all-sets-final');
const evidence = path.resolve('test/real-phone/mmfit');
for (const dir of [local, evidence, path.join(local, 'clips'), path.join(local, 'landmarks'), path.join(local, 'console')]) fs.mkdirSync(dir, { recursive: true });
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const srcHash = execFileSync('node', ['scripts/src-hash.mjs'], { encoding: 'utf8' }).trim();
const harnessHash = hash('test/real-phone/harness.js');
const coreHash = hash('src/lib/counting/core.ts');
const liftMap = { squats: 'squat', pushups: 'bench_press', dumbbell_shoulder_press: 'overhead_press', lunges: 'lunge', dumbbell_rows: 'dumbbell_row', situps: null, tricep_extensions: 'triceps_pushdown', bicep_curls: 'bicep_curl_alternating', lateral_shoulder_raises: 'lateral_raise', jumping_jacks: null };
const probe = async file => JSON.parse((await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])).stdout).streams.find(s => s.codec_type === 'video');
const sets = [];
for (const workout of fs.readdirSync(path.join(root, 'labels/mm-fit')).sort()) {
  const labels = path.join(root, 'labels/mm-fit', workout, `${workout}_labels.csv`);
  if (!fs.existsSync(labels)) continue;
  const source = path.join(root, `${workout}_rgb.mp4`);
  const stream = await probe(source);
  const [num, den] = stream.avg_frame_rate.split('/').map(Number);
  for (const line of fs.readFileSync(labels, 'utf8').trim().split(/\r?\n/)) {
    const [startText, endText, expectedText, activity] = line.split(',');
    const start = Number(startText), end = Number(endText), expected = Number(expectedText);
    if (![start, end, expected].every(Number.isInteger) || end <= start || !(activity in liftMap)) throw new Error(`Invalid label: ${labels}: ${line}`);
    sets.push({ id: `${workout}-${activity}-${start}-${end}`, workout, activity, start, end, expected, lift: liftMap[activity], source, sourceStream: stream, fps: num / den, labelFile: labels, labelHash: hash(labels) });
  }
}
if (new Set(sets.map(s => s.id)).size !== sets.length) throw new Error('Duplicate set IDs');
fs.writeFileSync(path.join(evidence, 'inventory.json'), JSON.stringify(sets, null, 2));
const results = { srcHash, harnessHash, coreHash, selection: 'Every row of every local MM-Fit label CSV; no sampling or accuracy filtering.', visibilityRule: 'All wrists (15,16) and ankles (27,28) simultaneously have visibility >= 0.5 and image x,y within [0,1], in >= 90% of all samples. Null poses remain in denominator.', rows: [] };
const checkpoint = path.join(evidence, 'results.json');
if (fs.existsSync(checkpoint)) {
  const previous = JSON.parse(fs.readFileSync(checkpoint));
  for (const key of ['srcHash', 'harnessHash', 'coreHash']) if (previous[key] !== results[key]) throw new Error('Checkpoint code differs: ' + key);
  results.rows = previous.rows;
  console.log('RESUME ' + results.rows.length + ' completed rows');
}
const completed = new Set(results.rows.filter(r => r.landmarks).map(r => r.id));
const pending = sets.filter(s => !completed.has(s.id));
const visible = p => p && p.visibility >= 0.5 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
function save() {
  results.rows.sort((a, b) => sets.findIndex(s => s.id === a.id) - sets.findIndex(s => s.id === b.id));
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2));
  const table = ['| Set | Label | Count | Result | Visible / samples | % | Build use |', '|---|---:|---:|---|---:|---:|---|', ...results.rows.map(r => `| ${r.id} | ${r.expected} | ${r.count ?? '—'} | ${r.score} | ${r.visibleSamples ?? '—'}/${r.sampleCount ?? '—'} | ${r.visibleShare == null ? '—' : (r.visibleShare * 100).toFixed(2)} | ${r.admitted ? 'Admitted' : 'Excluded'} |`)];
  fs.writeFileSync(path.join(evidence, 'table.md'), table.join('\n') + '\n');
}
let next = 0;
async function worker() {
  while (next < pending.length) {
    const set = pending[next++];
    const row = { id: set.id, expected: set.expected, lift: set.lift, count: null, score: 'FAIL', admitted: false, consoleErrors: [], failedRequests: [] };
    const previous = results.rows.find(r => r.id === set.id);
    row.attemptFailures = previous ? [...(previous.attemptFailures || []), { reason: previous.reason, consoleErrors: previous.consoleErrors, failedRequests: previous.failedRequests }] : [];
    let browser, timeout;
    const logs = [];
    console.log('START ' + set.id);
    try {
      const clip = path.join(local, 'clips', set.id + '.mp4');
      const conversion = ['-v', 'error', '-nostdin', '-n', '-noautorotate', '-ss', String(set.start / set.fps), '-i', set.source, '-map', '0:v:0', '-frames:v', String(set.end - set.start), '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '18', '-pix_fmt', set.sourceStream.pix_fmt, '-fps_mode', 'passthrough', '-map_metadata', '0', '-movflags', '+faststart', clip];
      if (!fs.existsSync(clip)) await run('ffmpeg', conversion, { timeout: 180000 });
      const output = await probe(clip);
      for (const key of ['width', 'height', 'pix_fmt', 'avg_frame_rate', 'sample_aspect_ratio']) if (output[key] !== set.sourceStream[key]) throw new Error(`Conversion changed ${key}`);
      if (output.codec_name !== 'h264' || Number(output.nb_frames) !== set.end - set.start) throw new Error('Conversion codec/frame mismatch');
      row.conversion = { command: ['ffmpeg', ...conversion], outputStream: output, sha256: hash(clip) };
      browser = await chromium.launch({ channel: 'chrome' });
      row.browser = browser.version();
      const page = await browser.newPage();
      page.on('console', m => { logs.push(m.type() + ': ' + m.text()); if (m.type() === 'error') row.consoleErrors.push(m.text()); });
      page.on('pageerror', e => row.consoleErrors.push(e.message));
      page.on('requestfailed', r => row.failedRequests.push(r.url() + ': ' + r.failure()?.errorText));
      page.on('response', r => { if (r.status() >= 400) row.failedRequests.push(`${r.status()} ${r.url()}`); });
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/mmfit-sample.mp4')) return route.fulfill({ path: clip, contentType: 'video/mp4' });
        if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
        row.failedRequests.push('Blocked external request: ' + url.origin); return route.abort();
      });
      timeout = setTimeout(() => { row.reason = 'Harness timeout'; void browser.close(); }, 180000);
      await page.goto('http://127.0.0.1:5188/workout-vision/test/real-phone/harness.html');
      await page.waitForFunction(() => window._harnessReady);
      const data = await page.evaluate(() => window._fetchAndProcess('/workout-vision/mmfit-sample.mp4'));
      delete data.midFrameDataURL;
      const landmarkFile = path.join(local, 'landmarks', set.id + '.json.gz');
      fs.writeFileSync(landmarkFile, gzipSync(JSON.stringify(data)));
      row.landmarks = { path: landmarkFile, sha256: hash(landmarkFile) };
      row.metadata = data.metadata;
      row.sampleCount = data.imageLandmarks.length;
      row.visibleSamples = data.imageLandmarks.filter(lm => lm && [15, 16, 27, 28].every(i => visible(lm[i]))).length;
      row.visibleShare = row.sampleCount ? row.visibleSamples / row.sampleCount : null;
      row.admitted = row.sampleCount > 0 && row.visibleSamples * 10 >= row.sampleCount * 9;
      if (set.lift) {
        const counted = await page.evaluate(async ({ data, lift }) => { const { countReps } = await import('/workout-vision/src/lib/counting/core.ts'); return countReps(data.worldLandmarks, data.timestamps, lift); }, { data, lift: set.lift });
        row.count = counted.count;
        fs.writeFileSync(path.join(local, 'landmarks', set.id + '-count.json'), JSON.stringify(counted));
        row.reason = row.count === row.expected ? null : 'Count differs from unchanged dataset label';
      } else row.reason = 'Unsupported lift; no fallback counter';
      row.score = row.count !== null && row.count === row.expected && !row.consoleErrors.length && !row.failedRequests.length && !row.attemptFailures.length ? 'PASS' : 'FAIL';
    } catch (error) { row.reason ||= error.message; }
    finally { clearTimeout(timeout); await browser?.close(); }
    fs.writeFileSync(path.join(local, 'console', set.id + '.txt'), logs.join('\n') + '\n');
    row.xnnpackInfo = logs.filter(s => s === 'info: INFO: Created TensorFlow Lite XNNPACK delegate for CPU.').length;
    if (row.attemptFailures.length && !row.reason) row.reason = 'Execution recovered; initial failed attempt retained as FAIL';
    const existing = results.rows.findIndex(r => r.id === row.id);
    if (existing >= 0) results.rows[existing] = row; else results.rows.push(row);
    save();
    console.log(JSON.stringify({ completed: results.rows.length, total: sets.length, id: row.id, count: row.count, expected: row.expected, score: row.score, admitted: row.admitted, reason: row.reason }));
  }
}
await Promise.all(Array.from({ length: 4 }, () => worker()));
if (results.rows.length !== sets.length || hash('src/lib/counting/core.ts') !== coreHash || hash('test/real-phone/harness.js') !== harnessHash) throw new Error('Incomplete run or code changed during run');
console.log(JSON.stringify({ sets: sets.length, pass: results.rows.filter(r => r.score === 'PASS').length, fail: results.rows.filter(r => r.score === 'FAIL').length, admitted: results.rows.filter(r => r.admitted).length, excluded: results.rows.filter(r => !r.admitted).length }));
