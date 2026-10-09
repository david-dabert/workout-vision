// Espace pro (6 October 2026): a coach builds a two-exercise programme on a 390 and a 320 wide phone, shares its PDF
// (a file comes out) and its link; the link opens in a fresh browser, the client's, which shows the programme, keeps it,
// and starts the usual filming of an exercise. Sets saved from the programme show beside their target, and the
// report opened from Vos séries prints the target. Nothing runs off the side of any of these screens.
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { PRO } from '../src/components/experience/pro-copy.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

const SHOTS = process.env.PRO_SHOTS;
const c = PRO.fr;

async function prepare(page, viewport) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setViewportSize(viewport);
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
    // The share sheet, as a phone has it: the link is recorded; files are not shareable, so the PDF downloads.
    navigator.share = data => { window.__shared = data; return Promise.resolve(); };
    navigator.canShare = () => false;
  });
  return errors;
}

// Neither the screen nor the page scrolls sideways.
async function noOverflow(page, selector) {
  const o = await page.evaluate(sel => {
    const s = document.querySelector(sel);
    return { screen: s.scrollWidth - s.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  }, selector);
  expect(o, selector).toEqual({ screen: 0, page: 0 });
}

// The whole screen in one picture: the screen is fixed and scrolls itself, so it is let out for the shot.
async function fullShot(page, selector, path) {
  await page.evaluate(sel => {
    const s = document.querySelector(sel), root = s.closest('.wv-experience');
    s.scrollTop = 0; s.style.position = 'static'; s.style.overflow = 'visible';
    root.style.overflow = 'visible'; root.style.position = 'static'; root.style.height = 'auto';
  }, selector);
  await page.addStyleTag({ content: 'html, body, #root { height: auto !important; overflow: visible !important; } .topbar.is-sticky { position: static !important; }' });
  await page.waitForTimeout(400);
  await page.screenshot({ path, fullPage: true });
}

async function pick(page, key, search) {
  await page.getByTestId('pro-add').click();
  await expect(page.getByTestId('pro-picker')).toBeVisible();
  await page.locator('#all-search').fill(search);
  await page.locator(`[data-exercise="${key}"] button`).click();
  await expect(page.getByTestId('pro-editor')).toBeVisible();
}

for (const viewport of [{ width: 390, height: 664 }, { width: 320, height: 568 }]) {
  test(`a coach builds a programme, the client opens its link (${viewport.width}x${viewport.height})`, async ({ page, browser }) => {
    const shots = SHOTS && viewport.width === 390;
    if (shots) mkdirSync(SHOTS, { recursive: true });
    const errors = await prepare(page, viewport);
    await page.goto('/workout-vision/');
    await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });

    // The coach's way in: a quiet row of the choice.
    const row = page.getByTestId('choice-pro');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toContainText(c.choiceRow);
    await expect(row).toContainText(c.choiceRowSub);
    await row.click();
    await expect(page.getByTestId('pro-screen')).toBeVisible({ timeout: 20000 });
    await expect(page).toHaveURL(/#pro$/);
    await expect(page.locator('.pro-screen h1.title')).toHaveText(c.title);
    await noOverflow(page, '.pro-screen');

    // A new programme: a title, for whom, two exercises, their targets and a cue, a general note.
    await page.getByTestId('pro-new').click();
    await expect(page.getByTestId('pro-editor')).toBeVisible();
    await expect(page.locator('.pro-status')).toHaveText(c.needs);
    await page.locator('#pTitle').fill('Bas du corps, semaine 1');
    await page.locator('#pWho').fill('Camille');
    await pick(page, 'squat', 'squat');
    await pick(page, 'push_up', 'pompes');
    await expect(page.getByTestId('pro-item')).toHaveCount(2);
    await page.locator('#p1r').fill('12');
    await page.locator('#p1t').fill('60');
    await page.locator('#p1t').blur();
    await page.locator('#p0s').fill('40'); // out of bounds: brought to 10 on leaving the field
    await page.locator('#p0s').blur();
    await expect(page.locator('#p0s')).toHaveValue('10');
    await page.locator('#p0s').fill('3');
    await page.locator('#p0s').blur();
    await page.getByTestId('pro-item').first().locator('.pro-item-note').fill('Descendre lentement');
    await page.locator('#pNote').fill('Échauffement de dix minutes avant la séance.');
    // Reordered, then back.
    await page.getByRole('button', { name: c.moveDown('Squat') }).click();
    await expect(page.getByTestId('pro-item').first()).toContainText('Pompe');
    await page.getByRole('button', { name: c.moveUp('Squat') }).click();
    await expect(page.getByTestId('pro-item').first()).toContainText('Squat');
    await expect(page.locator('.pro-status')).toHaveText('');
    await noOverflow(page, '.pro-edit');
    // The draft is kept on the phone.
    const drafts = await page.evaluate(() => JSON.parse(localStorage.getItem('wv_pro_drafts')));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].items.map(i => [i.key, i.sets, i.reps, i.rest])).toEqual([['squat', 3, 10, 90], ['push_up', 3, 12, 60]]);

    // The PDF: a file comes out.
    await expect(page.getByTestId('pro-pdf')).toContainText(c.sharePdf);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('pro-pdf').click()]);
    expect(download.suggestedFilename()).toMatch(/^programme-camille-\d{4}-\d{2}-\d{2}\.pdf$/);
    const pdfPath = await download.path();
    const pdf = readFileSync(pdfPath);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000);
    if (shots) await download.saveAs(`${SHOTS}/programme.pdf`);
    await expect(page.locator('.pro-status')).toHaveText(c.pdfDownloaded);

    // The link, through the share sheet.
    await page.getByTestId('pro-link').click();
    const shared = await page.waitForFunction(() => window.__shared).then(h => h.jsonValue());
    expect(shared.title).toBe('Bas du corps, semaine 1');
    expect(shared.text).toBe(c.linkText('Bas du corps, semaine 1'));
    expect(shared.url).toMatch(/^http:\/\/localhost:4173\/workout-vision\/#programme=[zj][A-Za-z0-9_-]+$/);
    expect(shared.url.length).toBeLessThan(400);
    if (shots) {
      await page.locator('#pTitle').scrollIntoViewIfNeeded();
      await fullShot(page, '.pro-edit', `${SHOTS}/builder-fr-390.png`);
      // The list of programmes, as the coach finds it again.
      await page.reload();
      await expect(page.locator('.pro-draft')).toHaveCount(1, { timeout: 20000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${SHOTS}/pro-list-fr-390.png` });
    }

    // Back to the list: the draft is there.
    if (!shots) {
      await page.getByRole('button', { name: c.back }).click();
      await expect(page.locator('.pro-draft')).toHaveCount(1);
      await expect(page.locator('.pro-draft')).toContainText('Bas du corps, semaine 1');
    }
    expect(errors, errors.join('\n')).toEqual([]);

    // The client: another browser, with nothing on it.
    const client = await browser.newContext();
    const phone = await client.newPage();
    const clientErrors = await prepare(phone, viewport);
    await phone.goto(shared.url);
    const screen = phone.getByTestId('programme-screen');
    await expect(screen).toBeVisible({ timeout: 20000 });
    await expect(screen.locator('h1.title')).toHaveText('Bas du corps, semaine 1');
    await expect(screen).toContainText(c.whoLine('Camille'));
    await expect(phone.getByTestId('programme-item')).toHaveCount(2);
    await expect(phone.getByTestId('programme-item').first()).toContainText('Squat');
    await expect(phone.getByTestId('programme-item').first()).toContainText(c.target(3, 10, 90));
    await expect(phone.getByTestId('programme-item').first()).toContainText('Descendre lentement');
    await expect(phone.getByTestId('programme-item').nth(1)).toContainText(c.target(3, 12, 60));
    await expect(phone.getByTestId('programme-today')).toHaveText(c.today(0, 2));
    await expect(screen.locator('.programme-note')).toHaveText('Échauffement de dix minutes avant la séance.');
    // Kept on the phone, and the address no longer carries it.
    await expect(phone).toHaveURL(/#programme$/);
    const kept = await phone.evaluate(() => JSON.parse(localStorage.getItem('wv_programmes')));
    expect(kept).toHaveLength(1);
    await noOverflow(phone, '.programme-screen');

    // Sets saved from the programme, as the result screen saves them (saved-set.js).
    const id = kept[0].id;
    const putSets = list => phone.evaluate(([pid, sets]) => new Promise((resolve, reject) => {
      const request = indexedDB.open('workoutVision');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('workouts', 'readwrite'), store = tx.objectStore('workouts'), now = Date.now();
        const planned = { programme: pid, item: 0, key: 'squat', sets: 3, reps: 10, rest: 90 };
        for (const { ago, ...w } of sets) store.put({ ...w, exercise: 'squat', createdAt: now - ago, planned }, w.id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), [id, list]);

    // A set of yesterday's session, never sent: today's cells stay empty, and the session can still be sent, named by
    // its day (excellence hunt, 9 October 2026).
    await putSets([{ id: 'p-0', reps: 9, source: 'counter-core', machineResult: { reps: 9 }, ago: 24 * 3600000 }]);
    await phone.reload();
    await expect(screen).toBeVisible({ timeout: 20000 });
    await expect(phone.getByTestId('programme-sets').first().locator('li')).toHaveText(['', '', '']);
    await expect(phone.getByTestId('programme-send')).toHaveText(/^Envoyer les résultats du \d{1,2}(er)?\u00A0?\s?\S+$/);

    // Two sets of the squat saved today: one the app counted, one it refused and the client typed. The programme
    // shows them beside the target, the typed one marked as such; yesterday's set is not today's.
    await putSets([
      { id: 'p-1', reps: 10, source: 'counter-core', machineResult: { reps: 10 }, ago: 4 * 60000 },
      { id: 'p-2', reps: 8, source: 'manual', afterRefusal: true, machineResult: null, correctedResult: { reps: 8 }, ago: 2 * 60000 },
    ]);
    await phone.reload();
    await expect(screen).toBeVisible({ timeout: 20000 });
    const cells = phone.getByTestId('programme-sets').first().locator('li');
    await expect(cells).toHaveCount(3);
    await expect(cells).toHaveText(['10', '8', '']);
    await expect(cells.nth(0)).toHaveAttribute('aria-label', c.setDone(1, 10, 10));
    await expect(cells.nth(1)).toHaveAttribute('aria-label', c.setTyped(2, 8, 10));
    await expect(cells.nth(1)).toHaveClass(/is-hand/);
    await expect(cells.nth(2)).toHaveAttribute('aria-label', c.setTodo(3));
    await expect(phone.getByTestId('programme-send')).toHaveText(c.sendResults);
    await noOverflow(phone, '.programme-screen');

    // The client sends the day's results to the coach: the share sheet carries a link (#resultats=…), and the coach's
    // phone opens it as the planned sets beside the counted ones, the same cells as the client's (Results.jsx), the
    // typed set marked, with the time of the latest set.
    await phone.getByTestId('programme-send').click();
    await phone.waitForFunction(() => window.__shared?.url?.includes('#resultats='), null, { timeout: 3000 });
    const sent = await phone.evaluate(() => window.__shared);
    expect(sent.text).toBe(c.resultsText('Bas du corps, semaine 1'));
    const coach = await page.context().newPage();
    const coachErrors = await prepare(coach, viewport);
    await coach.goto(sent.url);
    const results = coach.getByTestId('results-screen');
    await expect(results.locator('h1.title')).toHaveText('Bas du corps, semaine 1', { timeout: 20000 });
    await expect(results).toContainText(c.whoLine('Camille'));
    await expect(coach.getByTestId('results-done')).toHaveText(c.resultsSets(2, 6, 1));
    await expect(coach.getByTestId('results-time')).toHaveText(/^Dernière série à \d{1,2}\u00A0h\u00A0\d{2}$/);
    await expect(coach.getByTestId('results-item')).toHaveCount(2);
    const coachCells = coach.getByTestId('results-sets').first().locator('li');
    await expect(coachCells).toHaveText(['10', '8', '']);
    await expect(coachCells.nth(0)).toHaveAttribute('aria-label', c.setDone(1, 10, 10));
    await expect(coachCells.nth(1)).toHaveAttribute('aria-label', c.setTyped(2, 8, 10));
    await expect(coach.getByTestId('results-legend')).toHaveText(c.resultsLegend);
    await expect(coach.getByTestId('results-sets').nth(1).locator('li')).toHaveText(['', '', '']);
    await noOverflow(coach, '.programme-screen');

    // Another client's link opened over this one replaces it at once (the router renders again on every change).
    const other = await phone.evaluate(() => {
      const raw = { v: 1, t: 'Haut du corps', d: '2026-10-08', x: [['push_up', 2, 12, [12]]], k: ['a'] };
      const b = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(raw))));
      return 'j' + b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    });
    await coach.evaluate(payload => { location.hash = `resultats=${payload}`; }, other);
    await expect(coach.locator('h1.title', { hasText: 'Haut du corps' })).toBeVisible({ timeout: 5000 });
    await expect(results).toHaveCount(1, { timeout: 5000 });
    await expect(coach.getByTestId('results-item')).toHaveCount(1);
    expect(coachErrors, coachErrors.join('\n')).toEqual([]);
    await coach.close();
    if (shots) {
      await fullShot(phone, '.programme-screen', `${SHOTS}/client-programme-fr-390.png`);
      await phone.reload();
      await expect(screen).toBeVisible({ timeout: 20000 });
    }

    // A tap on an exercise starts the usual filming of it; Back returns to the programme.
    await phone.getByRole('button', { name: c.film('Pompe') }).click();
    await expect(phone.locator('.film-screen')).toBeVisible({ timeout: 20000 });
    await expect(phone).toHaveURL(/#film$/);
    await phone.locator('.film-screen .icon-btn').first().click();
    await expect(screen).toBeVisible({ timeout: 20000 });

    // From the choice, the programme is one row away; the report of a set from it prints the target.
    await phone.getByRole('button', { name: c.back }).click();
    const back = phone.getByTestId('choice-programme');
    await expect(back).toBeVisible({ timeout: 20000 });
    await expect(back).toContainText('Bas du corps, semaine 1');
    await phone.getByRole('button', { name: /Vos séries/ }).click();
    await phone.locator('.hist-btn').first().click();
    await phone.locator('.hist-detail .btn-line').first().click();
    const report = phone.locator('.sheet');
    await expect(report).toBeVisible({ timeout: 20000 });
    await expect(phone.getByTestId('sh-planned')).toHaveText(c.planned('3 × 10'));
    expect(clientErrors, clientErrors.join('\n')).toEqual([]);
    await client.close();
  });
}

// A damaged link shows what went wrong and the way back, never a programme and never an error of the app.
test('a damaged link is refused, plainly', async ({ page }) => {
  const errors = await prepare(page, { width: 390, height: 664 });
  await page.goto('/workout-vision/#programme=jbm90IGEgcHJvZ3JhbW1l');
  await expect(page.getByTestId('programme-error')).toHaveText(c.errorTitle, { timeout: 20000 });
  await expect(page.locator('.programme-screen')).toContainText(c.errors.malformed);
  await page.getByRole('button', { name: c.errorBack }).click();
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => localStorage.getItem('wv_programmes'))).toBe(null);
  expect(errors, errors.join('\n')).toEqual([]);
});
