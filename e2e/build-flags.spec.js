// The build flags (src/lib/buildFlags.js; WP0.3, WP0.4 of docs/SPEC-production.md). Production is built with
// VITE_LIVE and VITE_CONTRIBUTE unset (deploy.yml): the Film screen offers no live counting, the saved card never
// asks to help, nothing new is kept as a contribution, and the history offers neither "Aider" nor "Envoyer"; what
// already waits stays on the phone and can still be stopped and erased. The production build is served on port 4176
// (playwright.config.js); the build the other specs test, with both flags on, on port 4173.
//
// A set is reached on the video path, as a person films one: a video drawn in the page (MediaRecorder, its duration
// written in, as the phone's camera does), and a pose worker that answers each sample with the landmarks of David's
// real biceps curl set (test/real-phone/landmarks, as contribute-ask.spec.js does for live counting).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

const PROD = 'http://localhost:4176/workout-vision/';
const FLAGS_ON = 'http://localhost:4173/workout-vision/';

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

async function start(page, { choice = null, filmMode = null } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fakeWorker }));
  // Set once, on the first load only: what the screens store afterwards is left as they stored it.
  await page.addInitScript(([choice, filmMode]) => {
    if (sessionStorage.getItem('wv_test_init')) return;
    sessionStorage.setItem('wv_test_init', '1');
    localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate');
    if (choice) localStorage.setItem('wv_contribute', choice);
    if (filmMode) localStorage.setItem('wv_film_mode', filmMode);
  }, [choice, filmMode]);
  return errors;
}

async function openFilm(page, base) {
  await page.goto(base);
  await page.locator('.rail > .altar[aria-label="Curl biceps"]').first().click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.film-screen .actions .btn-primary')).toContainText('Filmer ma série');
}

// A 12-second video drawn in the page, a different picture at every frame, chosen in the library input. Chromium's
// MediaRecorder writes no duration: it is written into the file's Info element (EBML Duration, in milliseconds at the
// default timecode scale), as a phone's camera file holds one.
async function chooseDrawnVideo(page) {
  await page.evaluate(async () => {
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
    await new Promise(r => setTimeout(r, 12000));
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
  });
}

// One set filmed, analysed and kept as counted; the saved card is returned once the question could have shown.
async function saveSet(page, base) {
  await openFilm(page, base);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Oui, c’est juste' }).click();
  const card = page.getByTestId('saved-card');
  await expect(card).toBeVisible();
  // The question is decided once the sets on the phone are read: give it the time to show, if it is to.
  await page.waitForTimeout(800);
  return card;
}

const idb = (page, f, arg) => page.evaluate(([f, arg]) => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    // eslint-disable-next-line no-new-func
    new Function('db', 'arg', 'ok', 'ko', f)(db, arg, v => { db.close(); ok(v); }, e => { db.close(); ko(e); });
  };
}), [f.toString().replace(/^[^{]*{|}$/g, ''), arg]);
const contributions = page => idb(page, () => {
  if (!db.objectStoreNames.contains('contributions')) { ok(0); return; }
  const q = db.transaction('contributions').objectStore('contributions').count();
  q.onsuccess = () => ok(q.result);
  q.onerror = () => ko(q.error);
});
const putContribution = page => idb(page, () => {
  const tx = db.transaction('contributions', 'readwrite');
  tx.objectStore('contributions').put({ setId: 'w0', kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 7, appCount: 7, worldLandmarks: [], timestamps: [] }, 'w0');
  tx.oncomplete = () => ok();
  tx.onerror = () => ko(tx.error);
});
const seedSet = page => idb(page, () => {
  const tx = db.transaction('workouts', 'readwrite');
  tx.objectStore('workouts').put({ id: 'w1', exercise: 'bicep_curl', reps: 7, source: 'counter-core', createdAt: Date.now() }, 'w1');
  tx.oncomplete = () => ok();
  tx.onerror = () => ko(tx.error);
});
const openHistory = async page => {
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  await expect(page.locator('.hist-btn').first()).toBeVisible({ timeout: 20000 });
};

test.describe('the build with both flags on (port 4173, as ci.yml builds it for these tests)', () => {
  test('offers live counting, and asks to help after the first set filmed', async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page);
    await openFilm(page, FLAGS_ON);
    // A dist built without the flags (a plain npm run build) fails here, not in live.spec.js and contribute*.spec.js.
    await expect(page.getByTestId('mode-live'), 'dist was built without VITE_LIVE=1: run npm run build:e2e').toBeVisible();
    // The same video set as below, so the production test's "no question" is not a set that would never be asked.
    const card = await saveSet(page, FLAGS_ON);
    await expect(card.getByTestId('contribute-ask'), 'dist was built without VITE_CONTRIBUTE=1: run npm run build:e2e').toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('the production build (port 4176: VITE_LIVE, VITE_CONTRIBUTE and VITE_EVENTS_URL unset, as deploy.yml)', () => {
  test('the Film screen offers no live counting, even to a phone that chose it before', async ({ page }) => {
    const errors = await start(page, { filmMode: 'live' });
    await openFilm(page, PROD);
    await expect(page.locator('.film-mode')).toHaveCount(0);
    await expect(page.getByTestId('mode-live')).toHaveCount(0);
    await expect(page.getByTestId('film-live')).toHaveCount(0);
    await expect(page.getByText('En direct')).toHaveCount(0);
    // The video, its two inputs (the camera and the library), and its own line on privacy.
    await expect(page.locator('.film-screen input[type=file]')).toHaveCount(2);
    await expect(page.locator('.film-screen .privacy')).toHaveText('La vidéo reste sur votre téléphone.');
    expect(errors).toEqual([]);
  });

  test('a first set filmed is saved with no question on helping, and nothing is kept to send', async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page);
    const card = await saveSet(page, PROD);
    await expect(card.getByTestId('contribute-ask')).toHaveCount(0);
    await expect(page.getByText('Aider à améliorer le comptage')).toHaveCount(0);
    expect(await page.evaluate(() => [localStorage.getItem('wv_contribute'), localStorage.getItem('wv_contribute_asked')])).toEqual([null, null]);
    expect(await contributions(page)).toBe(0);
    // The history: a saved set, and no section on helping, so no "Aider" and no "Envoyer".
    await page.locator('.result-screen .icon-btn').first().click();
    await openHistory(page);
    await expect(page.getByTestId('contribute-history')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Aider', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Envoyer', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a phone that said yes keeps nothing new; what waits can be stopped and erased, never sent', async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page, { choice: 'yes' });
    await page.goto(PROD);
    await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
    // The app creates its stores on first use: a set saved and the history opened once, as a person would.
    await seedSet(page);
    await page.reload();
    await openHistory(page);
    // One contribution kept before the pause: it stays on the phone.
    await putContribution(page);
    // A set filmed now is kept as a set, not as a contribution, and the saved card asks nothing.
    const card = await saveSet(page, PROD);
    await expect(card.getByTestId('contribute-ask')).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await contributions(page)).toBe(1);
    await page.locator('.result-screen .icon-btn').first().click();
    await openHistory(page);
    const box = page.getByTestId('contribute-history');
    await expect(box.getByTestId('contribute-paused')).toHaveText('Les envois sont en pause pour l’instant : l’app ne garde plus rien de nouveau. Les séries déjà gardées restent sur ce téléphone, et vous pouvez les effacer.');
    await expect(box.getByRole('button')).toHaveText(['Arrêter et effacer']);
    await expect(box).not.toContainText('prête à envoyer');
    await box.getByRole('button', { name: 'Arrêter et effacer' }).click();
    await expect(box.locator('[role="status"]')).toHaveText('C’est arrêté. Les séries en attente sont effacées.');
    expect(await contributions(page)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('wv_contribute'))).toBe('no');
    // Stopped, nothing is left to offer: no "Aider" to start again in this build.
    await expect(box.getByRole('button')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('sets left waiting after a no can still be erased', async ({ page }) => {
    const errors = await start(page, { choice: 'no' });
    await page.goto(PROD);
    await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
    await seedSet(page);
    await page.reload();
    await openHistory(page);
    await putContribution(page);
    // The history read again, as a person coming back to it.
    await page.getByRole('button', { name: 'Retour' }).first().click();
    await openHistory(page);
    const box = page.getByTestId('contribute-history');
    await expect(box.getByRole('button')).toHaveText(['Arrêter et effacer']);
    await box.getByRole('button', { name: 'Arrêter et effacer' }).click();
    await expect(box.locator('[role="status"]')).toHaveText('C’est arrêté. Les séries en attente sont effacées.');
    expect(await contributions(page)).toBe(0);
    expect(errors).toEqual([]);
  });
});
