// Live counting (Film screen, "En direct"; Live.jsx, liveEngine.js), in Chromium with its fake camera: the mode
// switch, a camera refused, the real pose model reading the fake camera's picture (nobody in it: no number, R8), and
// a whole set from the tap on Start to the result, the history, the report and the skeleton replay.
//
// The fake camera films a test pattern, not a person. For the whole set, the pose worker is replaced in the test by
// one that answers each sample with the landmarks of David's real biceps curl set (test/real-phone/landmarks,
// 7 reps), sample k of the set getting the clip's sample k. Everything else runs as on the phone: the camera, the
// 15 Hz sampling and its real timestamps, the live counter, the final count and the screens after it.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

test.use({
  serviceWorkers: 'block',
  viewport: { width: 390, height: 844 },
  launchOptions: {
    ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
});

const clip = JSON.parse(gunzipSync(readFileSync(resolve('test/real-phone/landmarks/bicep_curl_7_side_mufhf3wy.json.gz'))));
const round = v => Math.round(v * 1e4) / 1e4;
const pack = frame => frame && frame.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }));
const FRAMES = clip.timestamps.map((_, k) => ({ image: pack(clip.imageLandmarks[k]), world: pack(clip.worldLandmarks[k]) }));

// A pose worker that speaks corePoseWorker.js's protocol. The set's samples carry timestamp k * 1000 / 15
// (liveEngine.js), so sample k gets the clip's sample k; past the clip's end nobody is in the picture.
const fakeWorker = frames => `
const FRAMES = ${JSON.stringify(frames)};
self.onmessage = ({ data }) => {
  if (data.type === 'init') { self.postMessage({ id: data.id }); return; }
  const k = Math.round(data.timestamp * 15 / 1000);
  const f = FRAMES[k] || { image: null, world: null };
  setTimeout(() => self.postMessage({ id: data.id, image: f.image, world: f.world }), 5);
};`;

async function open(page, { lang = 'en', mode = null, worker = FRAMES, workerBody = null, init = null } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (worker || workerBody) await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: workerBody ?? fakeWorker(worker) }));
  await page.addInitScript(([l, m]) => {
    localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); localStorage.setItem('wv_level', 'intermediate');
    if (m) localStorage.setItem('wv_film_mode', m);
    // No voice in the test: speechSynthesis stays silent, and the spoken numbers are recorded.
    window.__said = [];
    window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
  }, [lang, mode]);
  if (init) await page.addInitScript(init);
  await page.goto('/workout-vision/');
  await page.locator('.rail > .altar[aria-label="Biceps curl"], .rail > .altar[aria-label="Curl biceps"]').first().click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  return errors;
}

test('the Film screen offers live counting beside the video, and remembers the choice', async ({ page }, info) => {
  const errors = await open(page, { lang: 'fr' });
  // The video stays the default: its two file inputs, as before.
  await expect(page.getByTestId('mode-video')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.film-screen input[type=file]')).toHaveCount(2);
  await expect(page.locator('.film-screen .actions .btn-primary')).toContainText('Filmer ma série');
  await page.getByTestId('mode-live').click();
  await expect(page.getByTestId('mode-live')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.film-screen input[type=file]')).toHaveCount(0);
  await expect(page.getByTestId('film-live')).toHaveText('Compter en direct');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath('film-live.png') });
  await expect(page.locator('.film-screen .privacy')).toHaveText('L’image de la caméra reste sur votre téléphone\u00A0: elle n’est ni enregistrée ni envoyée.');
  await expect(page.locator('.film-screen .privacy')).not.toContainText('rien');
  // The choice holds on this phone.
  await page.reload();
  await page.locator('.rail > .altar[aria-label="Curl biceps"]').click();
  await expect(page.getByTestId('mode-live')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('mode-video').click();
  await expect(page.locator('.film-screen input[type=file]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a camera refused says so and leads back to recording', async ({ page }) => {
  const errors = await open(page, { lang: 'fr', mode: 'live', init: () => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  } });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-problem')).toContainText('Accès à la caméra refusé.');
  await expect(page.getByTestId('live-problem')).toContainText('Autorisez la caméra pour ce site dans les réglages de Safari, ou filmez votre série.');
  await expect(page.getByTestId('live-start')).toHaveCount(0);
  await page.getByRole('button', { name: 'Filmer ma série' }).click();
  // Back on the Film screen, on the video, whose camera input opens the phone's own camera app.
  await expect(page.locator('.film-screen')).toBeVisible();
  await expect(page.getByTestId('mode-video')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.film-screen .actions .btn-primary input[type=file]')).toHaveAttribute('capture', 'environment');
  expect(errors).toEqual([]);
});

test('a browser without camera access falls back to recording', async ({ page }) => {
  const errors = await open(page, { mode: 'live', init: () => { Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true }); } });
  // Live counting is not offered where the camera cannot open: only the video.
  await expect(page.getByTestId('mode-live')).toHaveCount(0);
  await expect(page.locator('.film-screen input[type=file]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('the real pose model reads the camera: nobody in the picture, no number (R8)', async ({ page }) => {
  test.setTimeout(120000);
  const errors = await open(page, { mode: 'live', worker: null });
  await page.getByTestId('film-live').click();
  // The fake camera films a test pattern: the framing hint, never a count.
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 60000 });
  await expect(page.getByTestId('live-hint')).toHaveText('At least head to hips in the frame, hands included.');
  // The camera is the rear one first, and switches.
  await expect(page.getByTestId('live-flip')).toHaveAttribute('aria-label', 'Switch to the front camera');
  await page.getByTestId('live-flip').click();
  await expect(page.locator('.live-screen')).toHaveClass(/is-mirrored/);
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 20000 });
  await page.getByTestId('live-start').click();
  await expect(page.locator('.live-countdown')).toBeVisible();
  await expect(page.getByTestId('live-stop')).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('live-count')).toHaveCount(0);
  await expect(page.getByTestId('live-hint')).toContainText('Step back into the frame');
  // Ended: nobody was found, so no count (the refused result, as for a video).
  await page.getByTestId('live-stop').click();
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.result-screen')).toContainText('We could not find you in the picture.');
  const out = await page.evaluate(() => ({ refused: window.__coreOutput.refused, n: window.__coreOutput.timestamps.length, method: window.__coreOutput.metadata.method }));
  expect(out.refused).toBe(true);
  expect(out.method).toBe('live');
  expect(out.n).toBeGreaterThan(20);
  // The camera is closed once the set is over.
  expect(await page.evaluate(() => document.querySelectorAll('video.live-video').length && [...document.querySelectorAll('video.live-video')].some(v => v.srcObject?.active))).toBeFalsy();
  expect(errors).toEqual([]);
});

test('a whole live set: the count as it goes, then the same result, history, report and replay', async ({ page }, info) => {
  test.setTimeout(150000);
  const shot = name => page.screenshot({ path: info.outputPath(`${name}.png`) });
  const errors = await open(page, { lang: 'fr', mode: 'live', init: () => {
    // The spoken numbers, recorded: the page sees one local French voice.
    const voice = { lang: 'fr-FR', localService: true, default: true, name: 'Test' };
    const synth = { getVoices: () => [voice], speak: u => { if (u.text) window.__said.push(u.text); }, cancel() {}, addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    // A real utterance takes only a real voice; this one takes the test's.
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  } });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 30000 });
  // The worker sees a body from the first preview sample.
  await expect(page.getByTestId('live-hint')).toHaveText('On vous voit. Touchez Démarrer, puis mettez-vous en place.');
  await shot('1-ready');
  await expect(page.getByTestId('live-voice')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('live-start').click();
  await expect(page.locator('.live-countdown')).toBeVisible();
  // No number before the first rep (R8), then the count as it grows.
  await expect(page.getByTestId('live-stop')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('live-count')).toContainText('1', { timeout: 20000 });
  await expect(page.getByTestId('live-count')).toContainText('Compte provisoire');
  await shot('2-counting');
  await expect(page.getByTestId('live-count').locator('.numeral')).toHaveText('7', { timeout: 40000 });
  // The clip is over: nobody in the picture for a second, so no number any more.
  await expect(page.getByTestId('live-hint')).toContainText('Revenez dans le cadre', { timeout: 15000 });
  const said = await page.evaluate(() => window.__said);
  expect(said[0]).toBe('C’est parti !');
  expect(said.slice(1)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  await page.getByTestId('live-stop').click();

  // The result: the core on the whole set, in the recorded path's shape.
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 20000 });
  const out = await page.evaluate(() => {
    const r = window.__coreOutput;
    return { count: r.count, refused: r.refused, method: r.metadata.method, n: r.timestamps.length, w: r.metadata.width, h: r.metadata.height,
      shape: ['reps', 'arm', 'angles', 'smoothedAngles', 'imageLandmarks', 'worldLandmarks', 'timestamps', 'exercise'].every(k => k in r),
      ordered: r.timestamps.every((t, i) => i === 0 || t > r.timestamps[i - 1]),
      rate: (r.timestamps.length - 1) / (r.timestamps.at(-1) - r.timestamps[0]) };
  });
  expect(out).toMatchObject({ count: 7, refused: false, method: 'live', shape: true, ordered: true });
  expect(out.n).toBeGreaterThanOrEqual(FRAMES.length);
  // The sampling rate the core is built for, measured on the set's own timestamps.
  expect(out.rate).toBeGreaterThan(13.5);
  expect(out.rate).toBeLessThan(16.5);
  await expect(page.getByTestId('res-numeral')).toHaveText('7', { timeout: 10000 });
  // The live count was 7 too: no line about a difference.
  await expect(page.getByTestId('res-live')).toHaveCount(0);
  await shot('3-result');

  // Replay: the skeleton alone, no video to share.
  await page.locator('.rp-open').click();
  await expect(page.getByTestId('rp-still')).toBeVisible();
  await expect(page.locator('.rp-export')).toHaveCount(0);
  await expect(page.locator('.rp-note')).toContainText('aucune vidéo n’a été enregistrée');
  await page.locator('.rp-play').click();
  await expect(page.locator('.rp-play')).toContainText('Pause');
  await page.waitForTimeout(600);
  await shot('4-replay');
  await page.locator('.replay-screen .icon-btn').first().click();
  await expect(page.locator('.replay-screen')).toHaveCount(0, { timeout: 5000 });

  // Saved as any set: in the history, with its report.
  await page.getByRole('button', { name: 'Oui, c’est juste' }).click();
  await expect(page.locator('.result-screen')).toContainText('7');
  await page.locator('.result-screen .icon-btn').first().click();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await expect(page.locator('.hist-btn')).toHaveCount(1);
  await expect(page.locator('.hist-btn')).toContainText('7');
  await page.locator('.hist-btn').click();
  await page.locator('.hist-detail .btn-line').click();
  await expect(page.locator('.sheet')).toBeVisible();
  await expect(page.locator('.sh-opener')).toContainText('7');
  expect(errors).toEqual([]);
});

test('a set paused when the page is hidden can be counted as far as it went, or started again', async ({ page }) => {
  test.setTimeout(90000);
  const errors = await open(page, { mode: 'live' });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 30000 });
  await page.getByTestId('live-start').click();
  await expect(page.getByTestId('live-stop')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('live-count').locator('.numeral')).toHaveText('2', { timeout: 20000 });
  const hide = hidden => page.evaluate(h => {
    Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  await hide(true);
  await expect(page.locator('.live-screen')).toContainText('Set paused');
  // While hidden no sample is taken: the camera is closed.
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => [...document.querySelectorAll('video.live-video')].some(v => v.srcObject?.active))).toBeFalsy();
  await hide(false);
  await expect(page.getByRole('button', { name: 'Start the set again' })).toBeVisible();
  await page.getByTestId('live-finish').click();
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 20000 });
  const out = await page.evaluate(() => ({ count: window.__coreOutput.count, last: window.__coreOutput.timestamps.at(-1) }));
  // The count of what was filmed before the pause, at least the two reps shown.
  expect(out.count).toBeGreaterThanOrEqual(2);
  expect(out.last).toBeLessThan(20);
  expect(errors).toEqual([]);
});

// Every camera stream the page opened, kept so a test can see whether its light went off (every track ended).
const keepStreams = () => {
  window.__streams = [];
  const md = navigator.mediaDevices, gum = md.getUserMedia.bind(md);
  md.getUserMedia = async c => { const s = await gum(c); window.__streams.push(s); return s; };
};
const cameraOff = page => page.evaluate(() => window.__streams.length > 0 && window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended')));

test('a phone too slow for live counting turns the camera off', async ({ page }) => {
  test.setTimeout(90000);
  // Too slow: the worker loads, then never answers a sample, so the samples waiting pass two seconds' worth.
  await open(page, { mode: 'live', init: keepStreams, workerBody: 'self.onmessage = ({ data }) => { if (data.type === \'init\') self.postMessage({ id: data.id }); };' });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 30000 });
  await page.getByTestId('live-start').click();
  await expect(page.getByTestId('live-problem')).toContainText('This phone cannot keep up live.', { timeout: 15000 });
  await expect.poll(() => cameraOff(page), { timeout: 5000 }).toBe(true);
});

test('a pose model that fails to load turns the camera off', async ({ page }) => {
  test.setTimeout(60000);
  await open(page, { mode: 'live', init: keepStreams, workerBody: 'self.onmessage = ({ data }) => { setTimeout(() => self.postMessage({ id: data.id, error: \'no model\' }), 1500); };' });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-problem')).toContainText('Live counting could not start.', { timeout: 20000 });
  await expect.poll(() => cameraOff(page), { timeout: 5000 }).toBe(true);
});

test('a camera picture that stood still gives no count, and the camera is turned off', async ({ page }) => {
  test.setTimeout(60000);
  // Every sample answered with the same skeleton, as a frozen camera feed read in IMAGE mode gives (liveCounter.js).
  const still = Array.from({ length: 400 }, () => FRAMES[40]);
  const errors = await open(page, { mode: 'live', init: keepStreams, worker: still });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 30000 });
  await page.getByTestId('live-start').click();
  await expect(page.getByTestId('live-stop')).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(3500);
  await page.getByTestId('live-stop').click();
  await expect(page.getByTestId('live-problem')).toContainText('This phone cannot keep up live.', { timeout: 15000 });
  await expect(page.locator('.result-screen')).toHaveCount(0);
  await expect.poll(() => cameraOff(page), { timeout: 5000 }).toBe(true);
  expect(errors.filter(e => !e.includes('FrozenSkeletonsError') && !e.includes('[live] final count'))).toEqual([]);
});
