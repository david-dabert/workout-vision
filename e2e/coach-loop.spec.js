// Card 058: A client's results carry load, effort and pain back to the coach
// Eval: an e2e: a programme 3 x 10 at 60 kg is sent; the client saves with effort 7;
// the coach's results show 60 kg and 7. The payload stays under MAX_PAYLOAD at every limit.
// Pain is the client's own words, never turned into advice (physiotherapist lens).
import { test, expect } from '@playwright/test';
import { PRO } from '../src/components/experience/pro-copy.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

const MAX_PAYLOAD = 8000;
const payloadOf = obj => 'j' + Buffer.from(JSON.stringify(obj)).toString('base64url');

async function prepare(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
    navigator.share = data => { window.__shared = data; return Promise.resolve(); };
    navigator.canShare = () => false;
  });
  return errors;
}

test('Card 058 coach loop: 3 x 10 @ 60 kg programme sent, client saves with effort 7 and pain note, coach results reflect them', async ({ page }) => {
  const errors = await prepare(page);

  // 1. Coach creates programme: 3 x 10 @ 60 kg
  // v: 2 (sheet version), x: [[key, sets, reps, rest, note]], l: [60]
  const rawProgramme = {
    v: 2,
    t: 'Force Bas du corps',
    w: 'Camille',
    x: [['squat', 3, 10, 90, '']],
    l: [60],
  };

  const progPayload = payloadOf(rawProgramme);
  expect(progPayload.length).toBeLessThan(MAX_PAYLOAD);

  // 2. Client receives programme link
  await page.goto(`/workout-vision/#programme=${progPayload}`);
  const screen = page.getByTestId('programme-screen');
  await expect(screen).toBeVisible({ timeout: 15000 });
  await expect(screen.locator('h1.title')).toHaveText('Force Bas du corps');

  // Kept on client's phone in indexedDB
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('wv_programmes')));
  expect(kept).toHaveLength(1);
  const id = kept[0].id;

  // 3. Client films and saves set with 60 kg load, effort 7 (RPE), and verbatim pain note
  await page.evaluate(([pid]) => new Promise((resolve, reject) => {
    const request = indexedDB.open('workoutVision');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('workouts', 'readwrite'), store = tx.objectStore('workouts');
      const planned = { programme: pid, item: 0, key: 'squat', sets: 3, reps: 10, rest: 90, load: 60 };
      store.put({
        schemaVersion: 1,
        exercise: 'squat',
        reps: 10,
        weight: 60,
        effort: 7,
        pain: 'Légère gêne au genou droit',
        source: 'counter-core',
        machineResult: { reps: 10 },
        correctedResult: null,
        createdAt: Date.now() - 60000,
        planned,
      }, 'set-c058-1');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), [id]);

  await page.reload();
  await expect(screen).toBeVisible({ timeout: 15000 });

  // 4. Client sends results back
  await page.getByTestId('programme-send').click();
  await page.waitForFunction(() => window.__shared?.url?.includes('#resultats='), null, { timeout: 3000 });
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.url).toContain('#resultats=');

  // 5. Coach opens the results URL in a new window/tab
  const coach = await page.context().newPage();
  await prepare(coach);
  await coach.goto(shared.url);

  const resultsScreen = coach.getByTestId('results-screen');
  await expect(resultsScreen).toBeVisible({ timeout: 15000 });
  await expect(resultsScreen.locator('h1.title')).toHaveText('Force Bas du corps');

  // Target reflects 3 x 10 @ 60 kg
  const targetText = await coach.getByTestId('results-item').first().locator('.programme-target').textContent();
  expect(targetText).toMatch(/3\s*×\s*10\s*@\s*60\s*kg/);

  // Set cells indicate 10 reps done
  const cells = coach.getByTestId('results-sets').first().locator('li');
  await expect(cells.nth(0)).toHaveText('10');

  // Verify decoded results data object contains exact load 60 kg, effort 7, and verbatim pain note
  const rawPayload = shared.url.split('#resultats=')[1];
  expect(rawPayload.length).toBeLessThan(MAX_PAYLOAD);

  const { gunzipSync } = await import('node:zlib');
  const isGzip = rawPayload[0] === 'z';
  const buf = Buffer.from(rawPayload.slice(1), 'base64url');
  const rawJson = JSON.parse((isGzip ? gunzipSync(buf) : buf).toString('utf8'));

  expect(rawJson.t).toBe('Force Bas du corps');
  expect(rawJson.l).toEqual([60]);
  expect(rawJson.L).toEqual([[60]]);
  expect(rawJson.e).toEqual([[7]]);
  expect(rawJson.p).toEqual([['Légère gêne au genou droit']]);

  // Physiotherapist lens check: pain note must remain verbatim client words, never converted to medical advice
  expect(rawJson.p[0][0]).toBe('Légère gêne au genou droit');
  expect(rawJson.p[0][0]).not.toMatch(/ordonnance|diagnostic|thérapie|traitement/i);

  expect(errors).toEqual([]);
  await coach.close();
});
