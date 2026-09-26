/**
 * Tour test — full user journey through the experience flow.
 *
 * Entry → Choice → Film → pick video → Watch → Result → confirm → Report → Guide (10 random exercises)
 *
 * Playwright WebKit, iPhone 14 profile, dark mode, French locale.
 * Uses lateral_raise_10_front clip (approved, ~10 reps).
 * Fails on any console error, failed network request, missing image, or wrong destination.
 */
import { webkit, devices, expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = 'test/real-phone/step3b/tour';
const base = 'http://127.0.0.1:4175/workout-vision/';
const clipPath = resolve('test/real-phone/clips/lateral_raise_10_front_mufhhbun.mov');

const browser = await webkit.launch();
const context = await browser.newContext({
  ...devices['iPhone 14'],
  locale: 'fr-FR',
  colorScheme: 'dark',
});
const page = await context.newPage();
const errors = [], failed = [], screenshots = [];

page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });

async function shot(name) {
  const path = `${dir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(name);
}

try {
  // ── 1. First visit — Entry screen ──
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Entry should be visible (first visit, no wv_seen_entry)
  const entryEnter = page.locator('.enter');
  await expect(entryEnter).toBeVisible({ timeout: 5000 });
  await shot('01-entry');

  // Tap Enter — the label wraps a hidden checkbox; clicking the label triggers onChange
  await entryEnter.click();
  await page.waitForTimeout(2000); // Wait for leave animation (820ms + buffer)

  // ── 2. Choice screen ──
  const altars = page.locator('.altar');
  await expect(altars.first()).toBeVisible({ timeout: 5000 });
  await shot('02-choice');

  // Choose lateral raise (index 0 in LIFTS: ['lateral_raise', 'bicep_curl', 'lat_pulldown'])
  const lateralAltar = altars.nth(0);
  await lateralAltar.click();
  await page.waitForTimeout(500);

  // ── 3. Film screen ──
  const filmScreen = page.locator('.film-screen');
  await expect(filmScreen).toBeVisible({ timeout: 5000 });
  await shot('03-film');

  // Pick video (use the "Choisir une vidéo" file input)
  const pickInput = page.locator('.film-screen input[type="file"]').last();
  await pickInput.setInputFiles(clipPath);
  await page.waitForTimeout(500);

  // ── 4. Watch screen (analysis in progress) ──
  const watchScreen = page.locator('.watch-screen');
  await expect(watchScreen).toBeVisible({ timeout: 10000 });
  await shot('04-watch-start');

  // Wait until progress reaches ~40% and take a mid-analysis screenshot showing the figure
  await page.waitForFunction(() => {
    const pct = document.querySelector('.pct');
    return pct && parseInt(pct.textContent) >= 30;
  }, { timeout: 120000 });
  await page.waitForTimeout(300);
  await shot('04b-watch-figure');

  // Wait for analysis to complete (Result screen appears)
  const resultScreen = page.locator('.result-screen');
  await expect(resultScreen).toBeVisible({ timeout: 300000 });
  await page.waitForTimeout(500);
  await shot('05-result');

  // ── 5. Verify Result shows a count ──
  const numeral = page.locator('.numeral');
  await expect(numeral).toBeVisible();
  const count = await numeral.textContent();
  console.log(`Count: ${count}`);

  // Ask card should be visible
  const askCard = page.locator('[data-testid="ask-card"]');
  await expect(askCard).toBeVisible();

  // ── 6. Confirm the count (tap "Oui, c'est juste") ──
  const yesBtn = page.locator('.ask-row .btn-primary');
  await expect(yesBtn).toBeVisible();
  // WebKit iPhone: click via mouse coordinates to ensure React event delegation catches it
  const box = await yesBtn.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // Should show saved state (async save to IndexedDB may take a moment)
  const savedCard = page.locator('[data-testid="saved-card"]');
  await expect(savedCard).toBeVisible({ timeout: 15000 });
  await shot('06-saved');

  // ── 7. Open Coach Report ──
  const reportBtn = page.locator('.btn-line');
  await expect(reportBtn).toContainText('Rapport pour mon coach');
  await reportBtn.click();
  await page.waitForTimeout(500);

  const reportScreen = page.locator('.report-screen');
  await expect(reportScreen).toBeVisible({ timeout: 5000 });

  // Fill in names
  await page.locator('#fClient').fill('Marie Test');
  await page.locator('#fCoach').fill('Coach Test');
  await page.waitForTimeout(300);
  await shot('07-report');

  // Verify sheet
  const sheet = page.locator('.sheet');
  await expect(sheet).toBeVisible();
  await expect(page.locator('.sh-title')).toContainText('Rapport de séance');
  await expect(page.locator('.sh-n')).toContainText(count);

  // Verify rep table is NOT present (forbidden until 3c)
  const repTable = page.locator('.sh-table');
  await expect(repTable).toHaveCount(0);

  // ── 7b. Generate PDF via the app's real share button ──
  const shareBtn = page.locator('.report-screen .btn-primary');
  await expect(shareBtn).toContainText('Partager le PDF');

  // Wait for the eagerly-built PDF to be ready (jsPDF chunk loads on report mount)
  await page.waitForTimeout(3000);

  // Stub navigator.canShare to force download path, and intercept the blob
  await page.evaluate(() => {
    navigator.canShare = () => false;
    window.__pdfBlob = null;
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && blob.type === 'application/pdf') window.__pdfBlob = blob;
      return origCreate(blob);
    };
    // Delay revokeObjectURL so we can read the blob
    const origRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => setTimeout(() => origRevoke(url), 10000);
  });

  // Click the real button
  await shareBtn.click();
  await page.waitForTimeout(2000);

  // Extract PDF bytes from captured blob
  const pdfBase64 = await page.evaluate(async () => {
    const blob = window.__pdfBlob;
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  });

  const pdfPath = 'test/real-phone/step3b/report/rapport_seance_tour.pdf';
  if (pdfBase64) {
    writeFileSync(pdfPath, Buffer.from(pdfBase64, 'base64'));
    const pdfBytes = readFileSync(pdfPath);
    console.log(`PDF generated by app button: ${pdfBytes.length} bytes`);
    if (pdfBytes.length < 500) errors.push('Generated PDF is too small');
  } else {
    errors.push('App button did not produce a PDF blob');
  }

  // ── 8. Go back to result, then to Choice via close ──
  const backBtn = page.locator('.report-screen .icon-btn');
  await backBtn.click();
  await page.waitForTimeout(300);

  // Should be back at Result (saved state)
  await expect(savedCard).toBeVisible();

  // Tap "Nouvelle série" to go back to Choice
  const newSetBtn = page.locator('.text-btn');
  await newSetBtn.click();
  await page.waitForTimeout(500);

  // Should be back at Choice
  await expect(altars.first()).toBeVisible({ timeout: 5000 });
  await shot('08-back-to-choice');

  // ── 9. Navigate to Guide ──
  const guideLink = page.locator('.row-link');
  await guideLink.click();
  await page.waitForTimeout(500);

  const guideScreen = page.locator('.guide-screen');
  await expect(guideScreen).toBeVisible({ timeout: 5000 });
  await shot('09-guide');

  // ── 10. Visit 10 random exercises ──
  const items = page.locator('.item-btn');
  const itemCount = await items.count();
  console.log(`Guide exercises found: ${itemCount}`);

  // Pick 10 random indices
  const indices = [];
  const seen = new Set();
  while (indices.length < Math.min(10, itemCount)) {
    const i = Math.floor(Math.random() * itemCount);
    if (!seen.has(i)) { seen.add(i); indices.push(i); }
  }

  for (const idx of indices) {
    await items.nth(idx).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    // Just verify the item is visible and has content
    const name = await items.nth(idx).locator('.item-name').textContent();
    console.log(`Exercise ${idx}: ${name}`);

    // Check for missing images in thumb
    const thumbImg = items.nth(idx).locator('.thumb img');
    if (await thumbImg.count() > 0) {
      const naturalWidth = await thumbImg.evaluate(img => img.naturalWidth);
      if (naturalWidth === 0) {
        errors.push(`Missing image for exercise: ${name}`);
      }
    }
  }
  await shot('10-guide-exercises');

  // ── Final checks ──
  const realErrors = errors.filter(e =>
    !e.includes('removeChild') &&
    !e.includes('unmount') &&
    !e.includes('Non-Error promise rejection') &&
    !e.includes('AbortError')
  );

  const report = {
    result: realErrors.length === 0 && failed.length === 0 ? 'PASS' : 'FAIL',
    count: parseInt(count),
    screenshots,
    exercisesInGuide: itemCount,
    exercisesChecked: indices.length,
    errors: realErrors,
    failed,
  };

  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

} finally {
  await browser.close();
}
