// Far-camera synthetic sets (audit of 6 October, action 3): the crop pass on lost frames (src/lib/poseCrop.js)
// measured against its absence. Each set was rendered twice by test/real-phone/synth/run.mjs with dist 9 m (the
// body about 17 % of the frame's height), once with the bench hook that turns the crop pass off (noCrop) and once
// with it, through the app's own pose path in Chromium (README.md here). The files hold landmarks only.
// FAR_DIR=<folder> reads another folder (to show the test failing on a render made before the crop pass).
import { expect, test } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const DIR = process.env.FAR_DIR || resolve(__dirname, 'sets');
const read = (f: string) => JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
const count = (r: any) => { const c = summarizeCount(r.worldLandmarks, r.timestamps, r.params.exercise); return c.refused ? 'refused' : c.count; };
const err = (c: number | string, truth: number) => (c === 'refused' ? Infinity : Math.abs((c as number) - truth));
const pct = (x: number) => `${Math.round(100 * x)}%`;

test('the crop pass on far-camera synthetic sets', () => {
  const files = readdirSync(DIR).filter(f => f.endsWith('-crop.json.gz')).sort();
  expect(files.length).toBeGreaterThan(0);
  const rows: string[] = [], checks: { name: string; before: number; after: number; errBefore: number; errAfter: number }[] = [];
  let seenBefore = 0, seenAfter = 0, samples = 0, exactBefore = 0, exactAfter = 0, msBefore = 0, msAfter = 0, seconds = 0;
  for (const f of files) {
    const on = read(f), off = read(f.replace(/-crop\.json\.gz$/, '-nocrop.json.gz'));
    const n = on.timestamps.length, truth = on.reps.length;
    const before = off.worldLandmarks.filter(Boolean).length, after = on.worldLandmarks.filter(Boolean).length;
    const sources: (string | null)[] = on.poseSources ?? [];
    const crops = sources.filter((s: string | null) => s === 'crop').length;
    // Every frame the whole-frame pass reads is the same with and without the crop pass.
    on.worldLandmarks.forEach((w: any, i: number) => { if (off.worldLandmarks[i]) expect(JSON.stringify(w)).toBe(JSON.stringify(off.worldLandmarks[i])); });
    if (on.poseSources) expect(sources.filter(s => s === 'full').length).toBe(before);
    const cb = count(off), ca = count(on);
    checks.push({ name: f, before: before / n, after: after / n, errBefore: err(cb, truth), errAfter: err(ca, truth) });
    seenBefore += before; seenAfter += after; samples += n;
    if (err(cb, truth) === 0) exactBefore++;
    if (err(ca, truth) === 0) exactAfter++;
    msBefore += off.detectMs ?? NaN; msAfter += on.detectMs ?? NaN; seconds += n / 15;
    rows.push(`${f.replace(/-crop\.json\.gz$/, '')}  truth ${truth}  pose ${before}/${n} (${pct(before / n)}) -> ${after}/${n} (${pct(after / n)}, ${crops} from the crop)  count ${cb} -> ${ca}  detect ${(off.detectMs / 1000).toFixed(1)} s -> ${(on.detectMs / 1000).toFixed(1)} s`);
  }
  const perMin = (ms: number) => (ms / 1000 / seconds) * 60;
  const head = `Far-camera synthetic sets (dist 9 m), crop pass off -> on: pose in ${pct(seenBefore / samples)} -> ${pct(seenAfter / samples)} of ${samples} samples; ${exactBefore} -> ${exactAfter} of ${files.length} counts exact; detection ${perMin(msBefore).toFixed(0)} -> ${perMin(msAfter).toFixed(0)} s per minute of video (headless Chromium, SwiftShader, this machine's CPU).`;
  const text = [head, ...rows].join('\n') + '\n';
  if (!process.env.FAR_DIR) writeFileSync(resolve(__dirname, 'far-camera.txt'), text);
  process.stdout.write(text);
  // Failing first: under 90 % of the samples seen without the pass, 90 % or more with it, over the sets together; and
  // no set seen less. (Set by set, soldier-overhead_press reaches 89 %: the 90 % bar is held over the whole.)
  expect(seenBefore / samples).toBeLessThan(0.9);
  expect(seenAfter / samples).toBeGreaterThanOrEqual(0.9);
  for (const c of checks) expect(c.after, c.name).toBeGreaterThan(c.before < 1 ? c.before : 0.999);
  // R2: no count newly off by 3 or more, and no fewer counts exact.
  for (const c of checks) if (c.errBefore < 3) expect(c.errAfter, c.name).toBeLessThan(3);
  expect(exactAfter).toBeGreaterThanOrEqual(exactBefore);
});
