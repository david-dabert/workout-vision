// A set filmed as a person films one, for the specs that need a real analysis: a video drawn in the page
// (MediaRecorder, its duration written in, as the phone's camera does), and a pose worker that answers each sample with
// the landmarks of David's real biceps curl set (test/real-phone/landmarks), or with no body at all (`nobody`), which
// the app refuses. Moved here from build-flags.spec.js (WP1.3-WP1.6 of docs/SPEC-production.md).
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const clip = JSON.parse(gunzipSync(readFileSync(resolve('test/real-phone/landmarks/bicep_curl_7_side_mufhf3wy.json.gz'))));
const round = v => Math.round(v * 1e4) / 1e4;
const pack = frame => frame && frame.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }));
const FRAMES = clip.timestamps.map((_, k) => ({ image: pack(clip.imageLandmarks[k]), world: pack(clip.worldLandmarks[k]) }));
// A pose worker answering sample k (at 15 a second) with frames[k] ({ image, world }), and no body past the last.
export const workerOf = frames => `
const FRAMES = ${JSON.stringify(frames.map(f => ({ image: pack(f.image), world: pack(f.world) })))};
self.onmessage = ({ data }) => {
  if (data.type === 'init') { self.postMessage({ id: data.id }); return; }
  const k = Math.round(data.timestamp * 15 / 1000);
  const f = FRAMES[k] || { image: null, world: null };
  setTimeout(() => self.postMessage({ id: data.id, image: f.image, world: f.world }), 1);
};`;
export const fakeWorker = workerOf(FRAMES);

// A worker that finds nobody in any sample: the app refuses the set ("Personne n'apparaît dans la vidéo").
export const emptyWorker = `
self.onmessage = ({ data }) => {
  if (data.type === 'init') { self.postMessage({ id: data.id }); return; }
  setTimeout(() => self.postMessage({ id: data.id, image: null, world: null }), 1);
};`;

export async function start(page, { choice = null, filmMode = null, nobody = false, init = null, worker = null } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: worker ?? (nobody ? emptyWorker : fakeWorker) }));
  // Set once, on the first load only: what the screens store afterwards is left as they stored it.
  await page.addInitScript(([choice, filmMode]) => {
    if (sessionStorage.getItem('wv_test_init')) return;
    sessionStorage.setItem('wv_test_init', '1');
    localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate');
    if (choice) localStorage.setItem('wv_contribute', choice);
    if (filmMode) localStorage.setItem('wv_film_mode', filmMode);
  }, [choice, filmMode]);
  if (init) await page.addInitScript(init);
  return errors;
}

export async function openFilm(page, base) {
  await page.goto(base);
  await page.locator('.rail > .altar[aria-label="Curl biceps"]').first().click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.film-screen .actions .btn-primary')).toContainText('Filmer ma série');
}

// A 12-second video (or `seconds`) drawn in the page, a different picture at every frame, chosen in the library input. Chromium's
// MediaRecorder writes no duration: it is written into the file's Info element (EBML Duration, in milliseconds at the
// default timecode scale), as a phone's camera file holds one.
export async function chooseDrawnVideo(page, seconds = 12) {
  await page.evaluate(async seconds => {
    const c = Object.assign(document.createElement('canvas'), { width: 360, height: 640 });
    const g = c.getContext('2d');
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm;codecs=vp8' });
    const parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    let n = 0;
    const draw = () => { g.fillStyle = `hsl(${(n * 7) % 360} 60% 50%)`; g.fillRect(0, 0, 360, 640); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText(String(n++), 40, 320 + (n % 50)); };
    const timer = setInterval(draw, 33);
    draw();
    const began = performance.now();
    rec.start(500);
    await new Promise(r => setTimeout(r, seconds * 1000));
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.stop();
    const ms = performance.now() - began;
    clearInterval(timer);
    await stopped;
    const bytes = new Uint8Array(await new Blob(parts).arrayBuffer());
    const vint = (b, at) => { let len = 1; while (len <= 8 && !(b[at] & (0x80 >> (len - 1)))) len++; let v = b[at] & (0xff >> len); for (let k = 1; k < len; k++) v = v * 256 + b[at + k]; return { len, v }; };
    const idLen = b => (b >= 0x80 ? 1 : b >= 0x40 ? 2 : b >= 0x20 ? 3 : 4);
    let at = 4; const head = vint(bytes, at); at += head.len + head.v; // the EBML header
    at += 4; at += vint(bytes, at).len; // the Segment, of unknown size: its children follow
    let file = null;
    while (at < bytes.length && !file) {
      const il = idLen(bytes[at]);
      const id = [...bytes.slice(at, at + il)].map(x => x.toString(16).padStart(2, '0')).join('');
      const size = vint(bytes, at + il), body = at + il + size.len;
      if (id === '1549a966') { // Info: Duration (0x4489, an 8-byte float) appended, its size rewritten on 8 bytes
        const dur = new Uint8Array(11); dur.set([0x44, 0x89, 0x88]); new DataView(dur.buffer).setFloat64(3, ms);
        const sv = new Uint8Array(8); sv[0] = 0x01; let x = size.v + 11; for (let k = 7; k >= 1; k--) { sv[k] = x & 0xff; x = Math.floor(x / 256); }
        file = new File([bytes.slice(0, at + il), sv, bytes.slice(body, body + size.v), dur, bytes.slice(body + size.v)], 'set.webm', { type: 'video/webm' });
      }
      at = body + size.v;
    }
    if (!file) throw new Error('no Info element in the recorded video');
    const input = document.querySelectorAll('.film-screen input[type=file]')[1];
    const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, seconds);
}

// One set filmed, analysed and kept as counted; the saved card is returned once the question could have shown.
export async function saveSet(page, base) {
  await openFilm(page, base);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click();
  const card = page.getByTestId('saved-card');
  await expect(card).toBeVisible();
  // The question is decided once the sets on the phone are read: give it the time to show, if it is to.
  await page.waitForTimeout(800);
  return card;
}

export const openHistory = async page => {
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  await expect(page.locator('.hist-btn').first()).toBeVisible({ timeout: 20000 });
};

