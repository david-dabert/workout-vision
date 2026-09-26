/**
 * PDF race-condition test.
 *
 * Delays the jsPDF chunk by 2 s so the initial PDF build is still running
 * when the user types into the Client field with pressSequentially.
 * After the share button is tapped, the captured PDF must contain the
 * text that was typed — not the empty default from the first build.
 *
 * Expected: FAIL on the current code (rebuildPDF drops edits during a build).
 */
import { webkit, devices, expect } from '@playwright/test';
import { resolve } from 'node:path';

const base = 'http://127.0.0.1:4175/workout-vision/';
const clipPath = resolve('test/real-phone/clips/lateral_raise_10_front_mufhhbun.mov');

const browser = await webkit.launch();
const context = await browser.newContext({
  ...devices['iPhone 14'],
  locale: 'fr-FR',
  colorScheme: 'dark',
  serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];

page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

try {
  // Skip entry
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });
  await page.goto(base, { waitUntil: 'networkidle' });

  // Choose lateral raise
  const altars = page.locator('.altar');
  await expect(altars.first()).toBeVisible({ timeout: 5000 });
  await altars.nth(0).click();
  await page.waitForTimeout(500);

  // Pick video
  const pickInput = page.locator('.film-screen input[type="file"]').last();
  await pickInput.setInputFiles(clipPath);

  // Wait for result
  const resultScreen = page.locator('.result-screen');
  await expect(resultScreen).toBeVisible({ timeout: 300000 });
  await page.waitForTimeout(500);

  // Confirm count
  const yesBtn = page.locator('.ask-row .btn-primary');
  await expect(yesBtn).toBeVisible();
  const box = await yesBtn.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const savedCard = page.locator('[data-testid="saved-card"]');
  await expect(savedCard).toBeVisible({ timeout: 15000 });

  // Delay the jsPDF chunk so the first PDF build on the report screen
  // takes time. Only delay once — subsequent loads proceed normally.
  let delayed = false;
  await page.route('**/*jspdf*', async route => {
    if (!delayed) {
      delayed = true;
      await new Promise(r => setTimeout(r, 2000));
    }
    await route.continue();
  });

  // Open report
  const reportBtn = page.locator('.btn-line');
  await reportBtn.click();
  const reportScreen = page.locator('.report-screen');
  await expect(reportScreen).toBeVisible({ timeout: 5000 });

  // The jsPDF chunk is delayed by 2 s. The first rebuildPDF call starts
  // on mount and will be in flight. Type into Client while it builds.
  const clientInput = page.locator('#fClient');
  await clientInput.click();
  // pressSequentially types one character at a time, triggering onChange
  // on each keystroke — each fires rebuildPDF, which returns early because
  // buildingRef.current is true. The edit is dropped.
  await clientInput.pressSequentially('Alice Durand', { delay: 80 });

  // Wait long enough for the delayed build to finish + any rebuild
  await page.waitForTimeout(4000);

  // Stub canShare to force download, hook createObjectURL to capture blob
  await page.evaluate(() => {
    navigator.canShare = () => false;
    window.__pdfBlob = null;
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && blob.type === 'application/pdf') window.__pdfBlob = blob;
      return origCreate(blob);
    };
    const origRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => setTimeout(() => origRevoke(url), 10000);
  });

  // Tap share
  const shareBtn = page.locator('.report-screen .btn-primary');
  await shareBtn.click();
  await page.waitForTimeout(2000);

  // Extract PDF text content
  const pdfText = await page.evaluate(async () => {
    const blob = window.__pdfBlob;
    if (!blob) return null;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  });

  if (!pdfText) {
    console.log('FAIL: no PDF blob captured');
    process.exit(1);
  }

  // The PDF must contain "Alice Durand" — the text typed during the build
  const hasClient = pdfText.includes('Alice Durand');
  console.log(`PDF contains "Alice Durand": ${hasClient}`);

  if (!hasClient) {
    console.log('FAIL: PDF does not contain the edited client name. The edit was dropped during the build.');
    process.exit(1);
  }

  console.log('PASS: PDF matches the screen.');
  process.exit(0);

} finally {
  await browser.close();
}
