// The question on helping improve the count, on the saved card (ContributeAsk.jsx, contribute.js
// shouldAskContribute; build brief "contribute-ask", 3 October 2026): asked after the first saved set, kept or
// corrected; a yes stores the choice as the history's "Aider" does and keeps the set just saved; "Pas maintenant"
// asks once more, from the fifth saved set, then never; never after a yes or a no, nor when the choice was made.
//
// A set is reached as in live.spec.js: Chromium's fake camera, and a pose worker that answers each sample with the
// landmarks of David's real biceps curl set (test/real-phone/landmarks, 7 reps). The set is stopped after two reps.
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
const fakeWorker = `
const FRAMES = ${JSON.stringify(FRAMES)};
self.onmessage = ({ data }) => {
  if (data.type === 'init') { self.postMessage({ id: data.id }); return; }
  const k = Math.round(data.timestamp * 15 / 1000);
  const f = FRAMES[k] || { image: null, world: null };
  setTimeout(() => self.postMessage({ id: data.id, image: f.image, world: f.world }), 5);
};`;

async function start(page, { choice = null } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/assets/corePoseWorker-*.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: fakeWorker }));
  // Set once, on the first load only: what the screens store afterwards is left as they stored it.
  await page.addInitScript(choice => {
    if (sessionStorage.getItem('wv_test_init')) return;
    sessionStorage.setItem('wv_test_init', '1');
    localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr');
    localStorage.setItem('wv_level', 'intermediate'); localStorage.setItem('wv_film_mode', 'live');
    localStorage.setItem('wv_live_voice', 'off');
    if (choice) localStorage.setItem('wv_contribute', choice);
  }, choice);
  return errors;
}

// One live set, saved as counted (keep) or corrected to one more (correct); the saved card is returned.
async function saveSet(page, how = 'keep') {
  await page.goto('/workout-vision/');
  await page.locator('.rail > .altar[aria-label="Curl biceps"]').first().click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('film-live').click();
  await expect(page.getByTestId('live-start')).toBeEnabled({ timeout: 30000 });
  await page.getByTestId('live-start').click();
  await expect(page.getByTestId('live-stop')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('live-count').locator('.numeral')).toHaveText('2', { timeout: 20000 });
  await page.getByTestId('live-stop').click();
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 20000 });
  if (how === 'keep') await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click();
  else {
    // The count is corrected in place, with + (C4, 7 October 2026: no "Non" first), then saved as the person's.
    await page.getByRole('button', { name: 'Une de plus' }).click();
    await page.getByTestId('res-save').click();
  }
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
  if (!db.objectStoreNames.contains('contributions')) { ok([]); return; }
  const q = db.transaction('contributions').objectStore('contributions').getAll();
  q.onsuccess = () => ok(q.result.map(c => ({ setId: c.setId, count: c.count, appCount: c.appCount })));
  q.onerror = () => ko(q.error);
});
const workouts = page => idb(page, () => {
  const q = db.transaction('workouts').objectStore('workouts').getAll();
  q.onsuccess = () => ok(q.result.map(w => ({ id: w.id, reps: w.reps })));
  q.onerror = () => ko(q.error);
});
const seedSets = (page, n) => idb(page, () => {
  const tx = db.transaction('workouts', 'readwrite');
  for (let i = 0; i < arg; i++) tx.objectStore('workouts').put({ id: `seed-${i}`, exercise: 'bicep_curl', reps: 8, source: 'counter-core', createdAt: Date.now() - 86400000 * (i + 1) }, `seed-${i}`);
  tx.oncomplete = () => ok();
  tx.onerror = () => ko(tx.error);
}, n);
const stored = (page, k) => page.evaluate(k => localStorage.getItem(k), k);

test('after the first set kept: one sentence, the full list on a tap, and a yes keeps this set', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page);
  const card = await saveSet(page, 'keep');
  const ask = card.getByTestId('contribute-ask');
  await expect(ask).toBeVisible();
  await expect(ask).toContainText('Aider à améliorer le comptage');
  await expect(ask).toContainText('jamais la vidéo, et c’est vous qui les envoyez, quand vous voulez.');
  // The full list, the same as the history's, opens on "Quoi exactement ?".
  const what = ask.getByTestId('contribute-what');
  await expect(what).toBeHidden();
  const more = ask.getByRole('button', { name: 'Quoi exactement ?' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(what).toBeVisible();
  await expect(what).toContainText('Jamais la vidéo, ni votre nom.');
  // Two answers: yes, not now; no "Non merci" on the card.
  await expect(ask.getByRole('button')).toHaveText(['Quoi exactement ?', 'Oui, aider', 'Pas maintenant']);
  expect(await stored(page, 'wv_contribute')).toBe(null);
  await ask.getByRole('button', { name: 'Oui, aider' }).click();
  await expect(ask.locator('[role="status"]')).toHaveText('Merci. Vous pourrez arrêter à tout moment dans vos séries.');
  // The choice stored as the history's start stores it, and the set just saved kept as a contribution.
  expect(await stored(page, 'wv_contribute')).toBe('yes');
  const [saved] = await workouts(page);
  await expect.poll(() => contributions(page)).toEqual([{ setId: saved.id, count: saved.reps, appCount: saved.reps }]);
  // The history counts it, ready to send.
  await page.locator('.result-screen .icon-btn').first().click();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await expect(page.getByTestId('contribute-history')).toContainText('1 série prête à envoyer');
  await expect(page.getByTestId('contribute-history').getByRole('button', { name: 'Arrêter et effacer' })).toBeVisible();

  // The next set: never asked again after a yes; the set is kept as a contribution all the same.
  const next = await saveSet(page, 'keep');
  await expect(next.getByTestId('contribute-ask')).toHaveCount(0);
  await expect.poll(async () => (await contributions(page)).length).toBe(2);
  expect(errors).toEqual([]);
});

test('after the first set corrected, "Pas maintenant" asks once more at the fifth set, then never', async ({ page }) => {
  test.setTimeout(240000);
  const errors = await start(page);
  const card = await saveSet(page, 'correct');
  await expect(card).toContainText('Corrigé');
  const ask = card.getByTestId('contribute-ask');
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Pas maintenant' }).click();
  await expect(ask.locator('[role="status"]')).toHaveText('D’accord. Vous pourrez toujours dire oui dans Vos séries.');
  await expect(ask.getByRole('button')).toHaveCount(0);
  expect(await stored(page, 'wv_contribute')).toBe(null);
  expect(await contributions(page)).toEqual([]);

  // The second set: not asked.
  const second = await saveSet(page, 'keep');
  await expect(second.getByTestId('contribute-ask')).toHaveCount(0);
  // Two more saved (seeded), then the fifth set: asked once more.
  await seedSets(page, 2);
  const fifth = await saveSet(page, 'keep');
  expect((await workouts(page)).length).toBe(5);
  const again = fifth.getByTestId('contribute-ask');
  await expect(again).toBeVisible();
  await again.getByRole('button', { name: 'Pas maintenant' }).click();
  // The sixth: never again.
  const sixth = await saveSet(page, 'keep');
  await expect(sixth.getByTestId('contribute-ask')).toHaveCount(0);
  expect(await stored(page, 'wv_contribute')).toBe(null);
  expect(await contributions(page)).toEqual([]);
  expect(errors).toEqual([]);
});

for (const choice of ['no', 'yes']) {
  test(`no question when helping was already decided in the history (${choice})`, async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page, { choice });
    const card = await saveSet(page, 'keep');
    await expect(card.getByTestId('contribute-ask')).toHaveCount(0);
    expect(await stored(page, 'wv_contribute')).toBe(choice);
    // A no keeps nothing; a yes keeps the set, as before.
    expect((await contributions(page)).length).toBe(choice === 'yes' ? 1 : 0);
    expect(errors).toEqual([]);
  });
}
