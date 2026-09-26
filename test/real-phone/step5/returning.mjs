/**
 * Step 5: a returning visitor keeps their history across the switch.
 *
 *   node test/real-phone/step5/returning.mjs seed    before main moves, on the old live app
 *   node test/real-phone/step5/returning.mjs check   after the Pages deploy, on the new live app
 *
 * One persistent WebKit profile (iPhone 14, outside the repository) plays the
 * visitor in both runs. seed opens the old app, then stores one set in the
 * app's own database the way the app keeps a saved set. check opens the live
 * link again and requires the new app on screen, no console error, and the
 * same set still stored.
 */
import { webkit, devices } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const mode = process.argv[2];
if (mode !== 'seed' && mode !== 'check') {
  console.error('Usage: node test/real-phone/step5/returning.mjs seed|check');
  process.exit(2);
}
const live = process.env.WV_LIVE || 'https://david-dabert.github.io/workout-vision/';
const profile = process.env.WV_PROFILE || '/tmp/wv-returning-visitor';
const dir = 'test/real-phone/step5/live-returning';
const MARK = 'step5-returning-visitor';
mkdirSync(dir, { recursive: true });

const context = await webkit.launchPersistentContext(profile, {
  ...devices['iPhone 14'],
  locale: 'fr-FR',
  colorScheme: 'dark',
});
const errors = [], screenshots = [];

async function shot(page, name) {
  await page.screenshot({ path: `${dir}/${name}.jpg`, type: 'jpeg', quality: 80 });
  screenshots.push(name);
}

// Runs in the page. Opens the app's database, adding the workouts store only if
// the app has not created it yet, stores the mark when asked, then reads it back.
function workouts(page, store, mark) {
  return page.evaluate(async ({ store, mark }) => {
    const open = (version) => new Promise((resolve, reject) => {
      const req = version ? indexedDB.open('workoutVision', version) : indexedDB.open('workoutVision');
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('workouts')) req.result.createObjectStore('workouts');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('database blocked by another tab'));
    });
    const done = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    let db = await open();
    if (!db.objectStoreNames.contains('workouts')) {
      const next = db.version + 1;
      db.close();
      db = await open(next);
    }
    try {
      if (store) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction('workouts', 'readwrite');
          tx.objectStore('workouts').put({
            id: mark, exercise: 'lateral_raise', reps: 10, date: new Date().toISOString(),
            source: 'counter-core', schemaVersion: 1,
          }, mark);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }
      const os = db.transaction('workouts').objectStore('workouts');
      const [one, all] = await Promise.all([done(os.get(mark)), done(os.count())]);
      return { stillStored: !!one && one.reps === 10, count: all };
    } finally {
      db.close();
    }
  }, { store, mark });
}

try {
  if (mode === 'seed') {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(live, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000); // the old app opens its database and installs its worker
    if (await page.locator('.wv-experience').count()) {
      throw new Error('The live site already serves the new app. Seed runs before main moves.');
    }
    await shot(page, '00-old-app');
    const oldTitle = await page.title();
    await page.close();

    // A page of the same site with no app running, so nothing holds the database open.
    const quiet = await context.newPage();
    await quiet.goto(new URL('manifest.json', live).href);
    const seeded = await workouts(quiet, true, MARK);
    await quiet.close();
    if (!seeded.stillStored) throw new Error('The seeded set could not be read back.');
    writeFileSync(`${dir}/seed.json`, JSON.stringify({ oldTitle, workoutsAfterSeed: seeded.count, mark: MARK, at: new Date().toISOString(), screenshots }, null, 2));
    console.log(JSON.stringify({ oldTitle, workoutsAfterSeed: seeded.count }));
  } else {
    if (!existsSync(`${dir}/seed.json`)) throw new Error('No seed.json: run seed before main moves.');
    const seed = JSON.parse(readFileSync(`${dir}/seed.json`, 'utf8'));
    const page = context.pages()[0] || await context.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));

    // The browser may keep the old page for up to ten minutes; reload until the new app answers.
    // Only the load that shows the new app counts for errors.
    let arrived = false;
    for (let attempt = 0; attempt < 12 && !arrived; attempt++) {
      if (attempt) await page.waitForTimeout(60_000);
      errors.length = 0;
      await page.goto(live, { waitUntil: 'networkidle' });
      arrived = await page.locator('.wv-experience').first()
        .waitFor({ state: 'visible', timeout: 20_000 }).then(() => true, () => false);
    }
    if (!arrived) throw new Error('The new app did not appear on the live site within twelve minutes.');
    await page.waitForTimeout(1500);
    await shot(page, '01-returning-open');

    const enter = page.locator('.enter');
    if (await enter.count()) {
      await enter.click();
      await page.waitForTimeout(2000);
    }
    const lifts = await page.locator('.altar').count();
    await shot(page, '02-returning-choice');

    const after = await workouts(page, false, MARK);
    const realErrors = errors.filter(e => !e.includes('AbortError'));
    const srcHash = execFileSync('node', ['scripts/src-hash.mjs'], { encoding: 'utf8' }).trim();
    const report = {
      result: after.stillStored && after.count >= seed.workoutsAfterSeed && lifts === 3 && realErrors.length === 0 ? 'PASS' : 'FAIL',
      srcHash,
      newAppTitle: await page.title(),
      liftsOffered: lifts,
      stillStored: after.stillStored,
      workoutsAfterSeed: seed.workoutsAfterSeed,
      workoutsNow: after.count,
      errors: realErrors,
      screenshots,
    };
    writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await context.close();
}
