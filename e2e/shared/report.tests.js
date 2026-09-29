// Step 1 (PLAN.md, GROWTH): the session report assumes no coach. The user says, if they wish,
// their name, whom they trained with (alone, a friend or a coach) and at which level; every answer
// is optional, and the sheet shows only what was filled in. Run in Chromium (report.spec.js) and in
// WebKit with the iPhone profile (report.webkit.spec.js).
import { layoutFaults } from '../../test/real-phone/checks.mjs';

async function openReport(page, expect, lang) {
  await page.addInitScript(lang => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', lang);
  }, lang);
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('workoutVision');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({ id: 'report-test', exercise: 'bicep_curl', reps: 7, source: 'manual', createdAt: Date.now() }, 'report-test');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: lang === 'fr' ? /Vos séries/ : /Your sets/ }).click();
  await page.locator('.hist-btn').click();
  await expect(page.locator('.hist-detail .btn-line')).toHaveText(lang === 'fr' ? 'Rapport de séance' : 'Session report');
  await page.locator('.hist-detail .btn-line').click();
  await expect(page.locator('.sheet')).toBeVisible();
}

export default function reportTests(test, expect) {
  test('with nothing filled in, the sheet names no client and no coach, and shows no notes', async ({ page }) => {
    await openReport(page, expect, 'en');
    await expect(page.locator('.report-screen h2.title')).toHaveText('Session report');
    await expect(page.locator('.sh-people')).toHaveCount(0);
    await expect(page.locator('.sh-notes')).toHaveCount(0);
    const sheet = await page.locator('.sheet').textContent();
    for (const word of ['Client', 'Coach', '…']) expect(sheet).not.toContain(word);
  });

  test('the sheet shows exactly the answers given, and a second tap clears an answer', async ({ page }) => {
    await openReport(page, expect, 'en');
    await page.fill('#fName', 'Ana Silva');
    await page.getByRole('group', { name: 'Training' }).getByRole('button', { name: 'With a coach' }).click();
    await page.fill('#fPartner', 'Luc');
    await page.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Beginner' }).click();
    await page.fill('#fNotes', 'Slow tempo.');
    const people = page.locator('.sh-people > span');
    await expect(people).toHaveText(['NameAna Silva', 'TrainingWith a coach', 'CoachLuc', 'LevelBeginner']);
    await expect(page.locator('.sh-notes')).toContainText('Slow tempo.');
    // Alone: no partner's name, and the field for it goes.
    await page.getByRole('group', { name: 'Training' }).getByRole('button', { name: 'Alone' }).click();
    await expect(page.locator('#fPartner')).toHaveCount(0);
    await expect(people).toHaveText(['NameAna Silva', 'TrainingAlone', 'LevelBeginner']);
    // A second tap on the chosen level clears it.
    const beginner = page.getByRole('group', { name: 'Level' }).getByRole('button', { name: 'Beginner' });
    await beginner.click();
    await expect(beginner).toHaveAttribute('aria-pressed', 'false');
    await expect(people).toHaveText(['NameAna Silva', 'TrainingAlone']);
  });

  test('in French, the form and the sheet say the same, and the screen holds together at 375 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openReport(page, expect, 'fr');
    await expect(page.locator('.report-screen h2.title')).toHaveText('Rapport de séance');
    await page.getByRole('group', { name: 'Entraînement' }).getByRole('button', { name: 'En binôme' }).click();
    await expect(page.locator('label[for="fPartner"]')).toHaveText('Nom du partenaire');
    // The field that appears must never pass over the level below it (CI run 149): the layout is
    // checked with its animation held at 20 ms, when it had just begun to show, and at 150 ms.
    for (const t of [20, 150]) {
      const faults = await page.evaluate(async ([src, t]) => {
        const check = eval(`(${src})`);
        const finite = document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime));
        finite.forEach(a => { a.pause(); a.currentTime = t; });
        const out = check().filter(f => !f.startsWith('note: '));
        finite.forEach(a => a.play());
        return out;
      }, [layoutFaults.toString(), t]);
      expect(faults, `at ${t} ms`).toEqual([]);
    }
    await page.fill('#fPartner', 'Sam');
    await page.getByRole('group', { name: 'Niveau' }).getByRole('button', { name: 'Confirmé' }).click();
    await expect(page.locator('.sh-people > span')).toHaveText(['EntraînementEn binôme', 'PartenaireSam', 'NiveauConfirmé']);
    const text = await page.locator('.report-screen').textContent();
    expect(text).not.toContain('—');
    expect((await page.evaluate(layoutFaults)).filter(f => !f.startsWith('note: '))).toEqual([]);
  });

  // Review of 29 September: a friend's name must not become the coach's.
  test('a partner\'s name typed for one answer is not kept for another', async ({ page }) => {
    await openReport(page, expect, 'en');
    const training = page.getByRole('group', { name: 'Training' });
    await training.getByRole('button', { name: 'With a friend' }).click();
    await page.fill('#fPartner', 'Sam');
    await training.getByRole('button', { name: 'With a coach' }).click();
    await expect(page.locator('#fPartner')).toHaveValue('');
    await expect(page.locator('.sh-people > span')).toHaveText(['TrainingWith a coach']);
  });

  test('the note under the title claims only what the form does', async ({ page }) => {
    await openReport(page, expect, 'fr');
    await expect(page.locator('.report-sub')).toHaveText('Tout est facultatif : seul ce que vous remplissez apparaît sur le PDF.');
  });
}
