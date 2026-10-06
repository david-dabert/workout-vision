// Step 2 (PLAN.md, GROWTH): every countable exercise of the guide but the walking lunge, 183 in all (181, and the standing and lying barbell curls since 2 October), 179 since 3 October
// (the four floor exercises counted on both sides in profile withdrawn, src/lib/offer.js WITHDRAWN, third audit C21), 181 with the two (the barbell jump squat not yet counted) of the three
// added the same day (behind-the-neck press, barbell jump squat, wall ball), 182 with the machine seated back extension of 5 October, in a searchable list
// below the nine cards, each labelled Beta or Experimental; a tap opens its filming screen, which
// names it, labels it and shows how to film it. Run in Chromium (exercises.spec.js) and in WebKit
// with the iPhone profile (exercises.webkit.spec.js).
import { layoutFaults } from '../../test/real-phone/checks.mjs';

async function openChoice(page, expect, lang) {
  await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
  await expect(page.locator('.all-exercises .item')).toHaveCount(182, { timeout: 20000 });
}

export default function exercisesTests(test, expect) {
  test('the 182 counted exercises are listed under the nine cards; only the six with evidence carry a tag, Beta, pinned on top', async ({ page }) => {
    await openChoice(page, expect, 'en');
    const rail = await page.locator('.rail').boundingBox(), list = await page.locator('.all-exercises').boundingBox();
    expect(list.y).toBeGreaterThan(rail.y + rail.height);
    await expect(page.locator('.all-exercises .tier-beta')).toHaveCount(6);
    await expect(page.locator('.all-exercises .item .tag')).toHaveCount(6);
    await expect(page.locator('.all-exercises .all-note')).toHaveText('Unless marked Beta, these exercises are experimental: we are still learning to count them.');
    await expect(page.locator('.all-exercises [data-exercise="walking_lunge"]')).toHaveCount(0);
    for (const key of ['bicep_curl', 'lat_pulldown', 'squat', 'romanian_deadlift', 'leg_press', 'machine_seated_back_extension']) {
      await expect(page.locator(`.all-exercises [data-exercise="${key}"] .tag`)).toHaveText('Beta');
    }
    // The Beta exercises lead the list (David, 3 October), alphabetical within their group; the lateral raise,
    // Experimental since 3 October (tiers.txt), carries no tag.
    const keys = await page.$$eval('.all-exercises [data-exercise]', els => els.map(e => e.dataset.exercise));
    expect(keys.slice(0, 6)).toEqual(['bicep_curl', 'lat_pulldown', 'leg_press', 'machine_seated_back_extension', 'romanian_deadlift', 'squat']);
    await expect(page.locator('.all-exercises [data-exercise="lateral_raise"] .tag')).toHaveCount(0);
    // A search still filters the whole list, the pinned group included.
    await page.fill('#all-search', 'squat');
    await expect(page.locator('.all-exercises [data-exercise="squat"]')).toBeVisible();
    await expect(page.locator('.all-exercises [data-exercise="bicep_curl"]')).toHaveCount(0);
    await page.fill('#all-search', '');
    await expect(page.locator('.all-exercises [data-exercise="pec_deck"]')).toHaveCount(0);
  });

  test('the search finds an exercise by its French or English name, and says when none matches', async ({ page }) => {
    await openChoice(page, expect, 'fr');
    await page.fill('#all-search', 'marteau');
    await expect(page.locator('.all-exercises [data-exercise="hammer_curl"]')).toBeVisible();
    await page.fill('#all-search', 'hammer');
    await expect(page.locator('.all-exercises [data-exercise="hammer_curl"]')).toBeVisible();
    await page.fill('#all-search', 'zzzz');
    await expect(page.locator('.all-exercises .item')).toHaveCount(0);
    await expect(page.locator('.all-exercises .empty')).toHaveText('Aucun exercice trouvé.');
  });

  test('a tap on an exercise without a card opens its filming screen, named, labelled and drawn from the guide', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openChoice(page, expect, 'en');
    await page.fill('#all-search', 'forward lunge');
    await page.locator('.all-exercises [data-exercise="forward_lunge"] .item-btn').click();
    await expect(page.locator('.film-screen h2.title')).toHaveText('Forward Lunge', { timeout: 10000 });
    await expect(page.locator('.film-screen .tier')).toHaveText('Experimental: we are still learning this exercise');
    await expect(page.locator('.film-screen .guide-frames img')).toHaveCount(3);
    await expect(page.locator('.film-screen .caption')).toContainText('CC BY-SA 4.0');
    await expect(page.locator('.film-screen .steps')).toContainText('whole body');
    expect(errors).toEqual([]);
  });

  test('a card lift reached from the list keeps its figure and its Beta label', async ({ page }) => {
    await openChoice(page, expect, 'fr');
    await page.fill('#all-search', 'curl biceps');
    await page.locator('.all-exercises [data-exercise="bicep_curl"] .item-btn').click();
    await expect(page.locator('.film-screen h2.title')).toHaveText('Curl biceps', { timeout: 10000 });
    await expect(page.locator('.film-screen .tier')).toHaveText('Bêta');
    await expect(page.locator('.film-screen .frame canvas')).toHaveCount(1);
    await expect(page.locator('.film-screen .guide-frames')).toHaveCount(0);
  });

  test('the choice screen with its list holds together at 375 px, in French, and no name takes more than two lines', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openChoice(page, expect, 'fr');
    await expect(page.locator('.all-exercises .all-note')).toHaveText('Sauf mention Bêta, ces exercices sont expérimentaux\u00A0: nous apprenons encore à les compter.');
    await page.evaluate(() => document.fonts.ready); // the names' face, not the fallback's
    const lines = await page.$$eval('.all-exercises .item-name', els => els.map(el => ({ name: el.textContent, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) })));
    expect(lines.filter(l => l.lines > 2)).toEqual([]);
    await page.locator('.all-exercises').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    expect((await page.evaluate(layoutFaults)).filter(f => !f.startsWith('note: '))).toEqual([]);
    expect(await page.locator('.all-exercises').textContent()).not.toContain('—');
  });

  // Review 02 of 29 September.
  test('an exercise filmed from the front is filmed from the front, whole body included', async ({ page }) => {
    await openChoice(page, expect, 'en');
    await page.fill('#all-search', 'lateral lunge');
    await page.locator('.all-exercises [data-exercise="lateral_lunge"] .item-btn').click();
    await expect(page.locator('.film-screen .eyebrow')).toHaveText('Filmed from the front', { timeout: 10000 });
    await expect(page.locator('.film-screen .steps')).not.toContainText('profile');
    await expect(page.locator('.film-screen .steps')).toContainText('facing you');
    await expect(page.locator('.film-screen .steps')).toContainText('whole body');
  });

  test('the French search finds exercises by their muscles in French', async ({ page }) => {
    await openChoice(page, expect, 'fr');
    for (const word of ['mollets', 'quadriceps', 'abdos', 'pectoraux', 'ischios', 'fessiers']) {
      await page.fill('#all-search', word);
      expect(await page.locator('.all-exercises .item').count(), word).toBeGreaterThan(0);
    }
  });

  test('if the list cannot load, the nine cards still show', async ({ page }) => {
    await page.route(/ExerciseList[^/]*\.js$/, r => r.abort());
    await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
    await page.goto('/workout-vision/');
    await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await expect(page.locator('.altar')).toHaveCount(9);
    await expect(page.locator('.all-exercises')).toHaveCount(0);
  });

  test('the welcome back names a set of an exercise without a card by its name, never its key', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
    await page.goto('/workout-vision/');
    await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
    await page.evaluate(() => new Promise((resolve, reject) => {
      const q = indexedDB.open('workoutVision');
      q.onerror = () => reject(q.error);
      q.onsuccess = () => { const tx = q.result.transaction('workouts', 'readwrite'); tx.objectStore('workouts').put({ id: 'w', exercise: 'incline_dumbbell_press', reps: 10, source: 'counter-core', createdAt: Date.now() }, 'w'); tx.oncomplete = () => { q.result.close(); resolve(); }; };
    }));
    await page.reload();
    await expect(page.locator('.welcome-l2')).toContainText('développé incliné', { timeout: 10000 });
    await expect(page.locator('.welcome-l2')).not.toContainText('incline_dumbbell_press');
  });

  // Review 03: an iPhone SE, or a mini with Display Zoom, renders the page 320 px wide.
  for (const lang of ['fr', 'en']) {
    test(`at 320 px, in ${lang === 'fr' ? 'French' : 'English'}, no name takes more than two lines`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await openChoice(page, expect, lang);
      await page.evaluate(() => document.fonts.ready);
      const lines = await page.$$eval('.all-exercises .item-name', els => els.map(el => ({ name: el.textContent, lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)) })));
      expect(lines.filter(l => l.lines > 2)).toEqual([]);
    });
  }
}
