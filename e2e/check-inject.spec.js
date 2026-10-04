// The check page (check.html; WP0.2 of docs/SPEC-production.md): rows keyed by clip id, the lateral raise of
// 29 September (the video of the 3 October incident) among them, and a test hook, check.html?inject=frozen, that feeds a synthetic frozen stream
// on the playback path (frameExtractor.js, frozenStream). The guard must refuse it as a frozen read.
// The pose worker is replaced by one that answers each sample with the landmarks of David's real biceps curl set,
// as e2e/build-flags.spec.js does: the refusal tested here is the extractor's, on the pictures, not the pose model's.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { drawnWebm } from './shared/drawn-video.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'en-US' });

const baseline = JSON.parse(readFileSync(resolve('src/lib/check-baseline.json'), 'utf8'));
const clip = JSON.parse(gunzipSync(readFileSync(resolve('test/real-phone/landmarks/bicep_curl_7_side_mufhf3wy.json.gz'))));
const round = v => Math.round(v * 1e4) / 1e4;
const pack = frame => frame && frame.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }));
const FRAMES = clip.timestamps.map((_, k) => ({ image: pack(clip.imageLandmarks[k]), world: pack(clip.worldLandmarks[k]) }));
const fakeWorker = `
const FRAMES = ${JSON.stringify(FRAMES)};
self.onmessage = ({ data }) => {
  if (data.type === 'init') { self.postMessage({ id: data.id }); return; }
  const k = Math.round(data.timestamp * 15 / 1000);
  const f = FRAMES[k] || { image: null, world: null };
  setTimeout(() => self.postMessage({ id: data.id, image: f.image, world: f.world }), 1);
};`;

test('one row per clip id, and no injection row without the hook', async ({ page }) => {
  await page.goto('/workout-vision/check.html');
  for (const c of baseline.clips) await expect(page.getByTestId(`row-${c.id}`)).toHaveCount(1);
  await expect(page.getByTestId('row-lateral_raise_9_front_43e71b40').locator('h2')).toHaveText('Lateral raise');
  await expect(page.getByTestId('row-inject-frozen')).toHaveCount(0);
  await expect(page.locator('#verdict')).toContainText(`Normal path: 0 of ${baseline.clips.length} checked`);
});

// The control: the same kind of video on the same forced playback path, without the hook, is read moving. The row
// shows the repeat share, the decoder and why the playback path ran.
test('without the hook, the playback path reads the drawn video moving, and the row says so', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fakeWorker }));
  await page.goto('/workout-vision/check.html');
  await page.locator('#force-rvfc').check();
  const row = page.getByTestId('row-bicep_curl_5_side_f5e5bdf2');
  const video = Buffer.from(await drawnWebm(page, 4000), 'base64');
  await row.locator('input[type=file]').setInputFiles({ name: 'set.webm', mimeType: 'video/webm', buffer: video });
  await expect(row.locator('.out')).toContainText('Decoder: rvfc · fallback: WebCodecs: skipped, playback path forced', { timeout: 90_000 });
  const out = await row.locator('.out').textContent();
  const m = out.match(/Repeats: pictures (\d+) of (\d+) \(([\d.]+) %\) · skeletons (\d+) of (\d+)/);
  expect(m, out).not.toBeNull();
  expect(Number(m[2])).toBeGreaterThanOrEqual(29);
  expect(Number(m[3])).toBeLessThan(50);
  // Another video than the set, so the row is not as before; it is a count, not a refusal.
  expect(out).not.toContain('frozen');
});

test('check.html?inject=frozen: a frozen stream on the playback path is refused', async ({ page }) => {
  test.setTimeout(120_000);
  await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fakeWorker }));
  await page.goto('/workout-vision/check.html?inject=frozen');
  const row = page.getByTestId('row-inject-frozen');
  await expect(row).toBeVisible();
  await expect(page.locator('#verdict')).toContainText('Frozen injection: not run yet.');
  const video = Buffer.from(await drawnWebm(page, 4000), 'base64');
  await row.locator('input[type=file]').setInputFiles({ name: 'set.webm', mimeType: 'video/webm', buffer: video });
  await expect(row.locator('.out')).toContainText('Refused as a frozen read (pictures), as it must be.', { timeout: 90_000 });
  await expect(row).toHaveClass(/\bok\b/);
  // The repeat share: every sample after the first repeats it; the read was the playback path, forced.
  const out = await row.locator('.out').textContent();
  const m = out.match(/Repeats: pictures (\d+) of (\d+) \(100 %\)/);
  expect(m, out).not.toBeNull();
  expect(Number(m[1])).toBe(Number(m[2]));
  expect(Number(m[2])).toBeGreaterThanOrEqual(29);
  expect(out).toContain('Decoder: rvfc');
  await expect(page.locator('#verdict')).toContainText('Frozen injection: refused, as it must be.');
});
