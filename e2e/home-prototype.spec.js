// Card 053 (cards/053-home-to-prototype.md): aligned home (<= 12 non-rail controls, < 2 screens on 390x844
// and 390x664, zero foot-link layout faults at 320px, Guide + Catalogue merged behind Trouver un exercice) and
// Result.jsx saved card (at most 1 question; unsure sets still ask; half-answered FirstWord resumes; ignoring FirstWord
// advances without starving later prompts even if localStorage.setItem throws; keepAndClose never burns prompts).
import { test, expect } from '@playwright/test';
import { start, saveSet, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';
import { layoutFaults } from '../test/real-phone/checks.mjs';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

const BASE = '/workout-vision/';
const EVENTS = 'http://localhost:4175/workout-vision/';
const PROD = 'http://localhost:4176/workout-vision/';

test('Card 053: home stays under two screens at 390x844 and 390x664 with <= 12 non-rail controls even with recents and install', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
  });
  await page.goto(BASE);
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await expect(page.locator('.all-exercises')).toHaveCount(0);

  // Seed 2 recent sets & trigger install prompt to test the busiest home state.
  await page.evaluate(() => new Promise((ok, ko) => {
    const q = indexedDB.open('workoutVision');
    q.onerror = () => ko(q.error);
    q.onsuccess = () => {
      const tx = q.result.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({ id: 'r1', exercise: 'squat', reps: 8, source: 'counter-core', createdAt: Date.now() }, 'r1');
      tx.objectStore('workouts').put({ id: 'r2', exercise: 'bicep_curl', reps: 10, source: 'counter-core', createdAt: Date.now() - 60_000 }, 'r2');
      tx.oncomplete = () => { q.result.close(); ok(); };
    };
  }));
  await page.reload();
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await expect(page.getByTestId('install-row')).toBeVisible();

  const m844 = await page.evaluate(() => ({
    scrollHeight: document.querySelector('.choose-screen').scrollHeight,
    nonRailCount: [...document.querySelectorAll('.choose-screen button:not(.altar), .choose-screen a')].length,
  }));
  expect(m844.scrollHeight).toBeLessThan(844 * 2);
  expect(m844.nonRailCount).toBeLessThanOrEqual(12);

  // Card 043, reopened by the board of 18 November 2026 (PLAN.md): the « Espace kiné » row is off the home.
  await expect(page.getByTestId('choice-reference')).toBeVisible();
  await expect(page.getByTestId('choice-pro')).toBeVisible();
  await expect(page.getByTestId('choice-foot-links')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 664 });
  const h664 = await page.evaluate(() => document.querySelector('.choose-screen').scrollHeight);
  expect(h664).toBeLessThan(664 * 2);

  await page.getByTestId('choice-find-exercise').click();
  await expect(page.locator('#guide-search')).toBeVisible({ timeout: 20_000 });
  const searchBox = await page.locator('#guide-search').boundingBox();
  const listBox = await page.locator('.guide-screen .list').boundingBox();
  expect(listBox.y).toBeGreaterThan(searchBox.y + searchBox.height);
});

test('Card 053: foot test links have zero orphan-word layout faults at 320x568 in French', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
  });
  await page.goto(BASE);
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.getByTestId('choice-foot-links').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const faults = (await page.evaluate(layoutFaults)).filter(f => !f.startsWith('note: '));
  expect(faults).toEqual([]);
});

test('Card 053: ignoring FirstWord advances to ContributeAsk on Set 2 (even if localStorage.setItem throws) without stacking', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page);
  await page.addInitScript(() => {
    localStorage.removeItem('wv_level');
    localStorage.removeItem('wv_level_asked');
    localStorage.removeItem('wv_first_word');
    localStorage.removeItem('wv_first_word_asked');
    localStorage.removeItem('wv_install_hint');
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'wv_first_word_asked') throw new DOMException('Quota', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  const card1 = await saveSet(page, PROD);
  const prompts1 = card1.locator('[data-testid="install-suggest"], [data-testid="contribute-ask"], [data-testid="level-ask"], [data-testid="first-word-ask"]');
  expect(await prompts1.count()).toBe(1);
  await expect(card1.getByTestId('first-word-ask')).toBeVisible();

  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  await chooseDrawnVideo(page);
  const yes = page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ });
  await expect(yes).toBeVisible({ timeout: 60_000 });
  await yes.click();
  const card2 = page.getByTestId('saved-card');
  await expect(card2).toBeVisible();
  const prompts2 = card2.locator('[data-testid="install-suggest"], [data-testid="contribute-ask"], [data-testid="level-ask"], [data-testid="first-word-ask"], [data-testid="first-word"]');
  expect(await prompts2.count()).toBe(1);
  await expect(card2.getByTestId('contribute-ask')).toBeVisible();
});

test('Card 053: half-answered FirstWord resumes on bother question on Set 2, and if ignored again advances to ContributeAsk on Set 3', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  const card1 = await saveSet(page, PROD);
  await card1.getByTestId('fw-goal-strength').click();
  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  await chooseDrawnVideo(page);
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click({ timeout: 60_000 });
  const card2 = page.getByTestId('saved-card');
  await expect(card2.getByTestId('first-word-ask')).toBeVisible();
  await expect(card2.getByTestId('first-word-ask')).toContainText('qu’est-ce qui vous gêne le plus');

  // Ignoring botherQ on Set 2 must not starve ContributeAsk on Set 3.
  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  await chooseDrawnVideo(page);
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click({ timeout: 60_000 });
  const card3 = page.getByTestId('saved-card');
  await expect(card3.getByTestId('contribute-ask')).toBeVisible();
});

test('Card 053: home with VITE_EVENTS_URL set keeps recents visible and stays <= 12 non-rail controls and < 2 screens with install and saved set', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
  });
  await page.goto(EVENTS);
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.evaluate(() => new Promise((ok, ko) => {
    const q = indexedDB.open('workoutVision');
    q.onerror = () => ko(q.error);
    q.onsuccess = () => {
      const tx = q.result.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({ id: 'ev-r1', exercise: 'squat', reps: 8, source: 'counter-core', createdAt: Date.now() }, 'ev-r1');
      tx.oncomplete = () => { q.result.close(); ok(); };
    };
  }));
  await page.reload();
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await expect(page.getByTestId('recents')).toBeVisible();
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await expect(page.getByTestId('install-row')).toBeVisible();
  const m = await page.evaluate(() => ({
    scrollHeight: document.querySelector('.choose-screen').scrollHeight,
    nonRailCount: [...document.querySelectorAll('.choose-screen button:not(.altar), .choose-screen a')].length,
  }));
  expect(m.nonRailCount).toBeLessThanOrEqual(12);
  expect(m.scrollHeight).toBeLessThan(844 * 2);

  await page.setViewportSize({ width: 390, height: 664 });
  const h664 = await page.evaluate(() => document.querySelector('.choose-screen').scrollHeight);
  expect(h664).toBeLessThan(664 * 2);
});

test('Card 053: home with VITE_EVENTS_URL + GPC + received programme + 2 saved sets + install stays <= 12 non-rail controls', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true });
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
    localStorage.setItem('wv_programmes', JSON.stringify([{
      id: 'p-gpc', receivedAt: Date.now(), openedAt: Date.now(),
      data: { v: 1, t: 'Haut du corps', x: [['squat', 3, 8, 90]] },
    }]));
  });
  await page.goto(EVENTS);
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.evaluate(() => new Promise((ok, ko) => {
    const q = indexedDB.open('workoutVision');
    q.onerror = () => ko(q.error);
    q.onsuccess = () => {
      const tx = q.result.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({ id: 'g1', exercise: 'squat', reps: 8, source: 'counter-core', createdAt: Date.now() }, 'g1');
      tx.objectStore('workouts').put({ id: 'g2', exercise: 'bicep_curl', reps: 10, source: 'counter-core', createdAt: Date.now() - 60_000 }, 'g2');
      tx.oncomplete = () => { q.result.close(); ok(); };
    };
  }));
  await page.reload();
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await expect(page.getByTestId('install-row')).toBeVisible();
  await expect(page.getByTestId('choice-programme')).toBeVisible();
  await expect(page.getByTestId('usage-link')).toBeVisible();
  await expect(page.getByTestId('recents')).toBeVisible();
  const nonRailCount = await page.evaluate(() => [...document.querySelectorAll('.choose-screen button:not(.altar), .choose-screen a')].length);
  expect(nonRailCount).toBeLessThanOrEqual(12);
});

test('Card 053: saying Pas maintenant to ContributeAsk on Set 1 still re-asks on Set 5 within the same SPA session', async ({ page }) => {
  test.setTimeout(240_000);
  await start(page);
  await page.addInitScript(() => {
    localStorage.setItem('wv_level', 'intermediate');
    localStorage.setItem('wv_level_asked', '1');
    localStorage.setItem('wv_first_word', JSON.stringify({ goal: 'strength', bother: 'counting' }));
    localStorage.setItem('wv_first_word_asked', '2');
  });
  const card1 = await saveSet(page, PROD);
  await expect(card1.getByTestId('contribute-ask')).toBeVisible();
  await card1.getByRole('button', { name: 'Pas maintenant' }).click();

  for (let i = 2; i <= 5; i++) {
    await page.getByTestId('new-set').click();
    await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
    await chooseDrawnVideo(page);
    await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click({ timeout: 60_000 });
    const card = page.getByTestId('saved-card');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('level-ask')).toHaveCount(0);
    if (i < 5) await expect(card.getByTestId('contribute-ask')).toHaveCount(0);
    else await expect(card.getByTestId('contribute-ask')).toBeVisible();
  }
});

test('Card 053: pre-existing 1@1 + Set 5 QuotaExceededError does not ask a 3rd time on Set 6', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page);
  await page.addInitScript(() => {
    localStorage.setItem('wv_level', 'intermediate');
    localStorage.setItem('wv_level_asked', '1');
    localStorage.setItem('wv_first_word', JSON.stringify({ goal: 'strength', bother: 'counting' }));
    localStorage.setItem('wv_first_word_asked', '2');
    localStorage.setItem('wv_contribute_asked', '1@1');
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'wv_contribute_asked') throw new DOMException('Quota', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await page.goto(PROD);
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.evaluate(() => new Promise((ok, ko) => {
    const q = indexedDB.open('workoutVision');
    q.onerror = () => ko(q.error);
    q.onsuccess = () => {
      const tx = q.result.transaction('workouts', 'readwrite');
      for (let i = 1; i <= 4; i++) {
        tx.objectStore('workouts').put({ id: `s${i}`, exercise: 'squat', reps: 8, source: 'counter-core', createdAt: Date.now() - i * 1000 }, `s${i}`);
      }
      tx.oncomplete = () => { q.result.close(); ok(); };
    };
  }));
  await page.reload();
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20_000 });
  await page.locator('.altar').first().click();
  await chooseDrawnVideo(page);
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click({ timeout: 60_000 });
  const card5 = page.getByTestId('saved-card');
  await expect(card5.getByTestId('contribute-ask')).toBeVisible();

  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  await chooseDrawnVideo(page);
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click({ timeout: 60_000 });
  const card6 = page.getByTestId('saved-card');
  await expect(card6).toBeVisible();
  await expect(card6.getByTestId('contribute-ask')).toHaveCount(0);
});

test('Card 053: slow IndexedDB read (> 250ms) still shows ContributeAsk instead of dropping it', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page);
  await page.addInitScript(() => {
    localStorage.setItem('wv_level', 'intermediate');
    localStorage.setItem('wv_level_asked', '1');
    localStorage.setItem('wv_first_word', JSON.stringify({ goal: 'strength', bother: 'counting' }));
    localStorage.setItem('wv_first_word_asked', '2');
    const origOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const req = origOpen.apply(this, args);
      if (args[0] === 'workoutVision') {
        const origDesc = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess');
        let handler;
        Object.defineProperty(req, 'onsuccess', {
          configurable: true,
          get: () => handler,
          set(fn) {
            handler = function (ev) {
              setTimeout(() => fn.call(req, ev), 350);
            };
            origDesc.set.call(this, handler);
          },
        });
      }
      return req;
    };
  });
  const card = await saveSet(page, PROD);
  await expect(card.getByTestId('contribute-ask')).toBeVisible();
});

test('Card 053: closing via Garder saves without marking level or first-word as asked', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page);
  await page.addInitScript(() => {
    localStorage.removeItem('wv_level');
    localStorage.removeItem('wv_level_asked');
    localStorage.removeItem('wv_first_word');
    localStorage.removeItem('wv_first_word_asked');
    localStorage.setItem('wv_contribute', 'no');
  });
  await openFilm(page, PROD);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60_000 });
  await page.locator('.result-screen .icon-btn').first().click();
  await page.getByTestId('close-keep').click();
  await expect(page.locator('.choose-screen')).toBeVisible({ timeout: 20_000 });
  const asked = await page.evaluate(() => ({
    level: localStorage.getItem('wv_level_asked'),
    fw: localStorage.getItem('wv_first_word_asked'),
  }));
  expect(asked).toEqual({ level: null, fw: null });
});
