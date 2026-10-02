/**
 * PDF race-condition test.
 *
 * Delays the PDF code by 3 s, so it is still loading when the report opens and
 * the visitor types into the Client field. Since the second round the PDF is
 * built at the tap from what the screen shows, so no edit can be lost: while the
 * code loads, the button says so and does nothing; once it is ready, the PDF
 * shared must carry the name typed (its file name is made from it) and be a PDF.
 */
import { webkit, devices, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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

  // Delay the PDF code once. The app asks for it as soon as the set is saved.
  let delayed = false;
  await page.route(/(report-pdf|jspdf)[^/]*\.js$/, async route => {
    if (!delayed) {
      delayed = true;
      await new Promise(r => setTimeout(r, 3000));
    }
    await route.continue();
  });

  // Confirm count
  const yesBtn = page.locator('.ask-row .btn-primary');
  await expect(yesBtn).toBeVisible();
  const box = await yesBtn.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const savedCard = page.locator('[data-testid="saved-card"]');
  await expect(savedCard).toBeVisible({ timeout: 15000 });

  // Open report
  const reportBtn = page.locator('[data-testid="saved-card"] button').filter({ hasText: /Rapport de séance|Session report/ });
  await reportBtn.click();
  const reportScreen = page.locator('.report-screen');
  await expect(reportScreen).toBeVisible({ timeout: 5000 });

  // While the PDF code loads, the button says so and does nothing.
  const shareBtn = page.locator('.report-screen .share-bar .btn-primary');
  await expect(shareBtn).toContainText('Préparation du PDF');
  if (await shareBtn.getAttribute('aria-disabled') !== 'true') {
    console.log('FAIL: the share button is not marked unavailable while the PDF code loads.');
    process.exit(1);
  }

  // Type the name meanwhile, one character at a time.
  const clientInput = page.locator('#fName');
  await clientInput.click();
  await clientInput.pressSequentially('Alice Durand', { delay: 80 });
  await page.locator('#fNotes').pressSequentially('Tempo lent, puis repos.', { delay: 20 });
  await expect(shareBtn).toContainText('Partager le PDF', { timeout: 10000 });

  // Stub canShare to force the download, and capture the blob and the file name.
  await page.evaluate(() => {
    navigator.canShare = () => false;
    window.__pdfBlob = null;
    window.__pdfName = null;
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      if (blob && blob.type === 'application/pdf') window.__pdfBlob = blob;
      return origCreate(blob);
    };
    const origRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => setTimeout(() => origRevoke(url), 10000);
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) window.__pdfName = this.download; return origClick.call(this); };
  });

  // Tap share, where a finger would: the label carries the hidden switch.
  const shareBox = await shareBtn.boundingBox();
  await page.mouse.click(shareBox.x + shareBox.width / 2, shareBox.y + shareBox.height / 2);
  await page.waitForTimeout(2000);

  // The PDF, and the name it was shared under.
  const shared = await page.evaluate(async () => {
    const blob = window.__pdfBlob;
    if (!blob) return null;
    const head = new TextDecoder('latin1').decode(new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
    return { head, name: window.__pdfName, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  });

  if (!shared) {
    console.log('FAIL: no PDF blob captured');
    process.exit(1);
  }
  console.log(`Shared: ${shared.name} (${shared.head})`);
  if (shared.head !== '%PDF-' || !/^rapport-seance-alice-durand-\d{4}-\d{2}-\d{2}\.pdf$/.test(shared.name || '')) {
    console.log('FAIL: the PDF shared does not carry the name typed while the PDF code loaded.');
    process.exit(1);
  }

  const dir = 'test/real-phone/wave2/pdf-race';
  mkdirSync(dir, { recursive: true });
  const file = `${dir}/${shared.name}`;
  writeFileSync(file, Buffer.from(shared.bytes));
  const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
  writeFileSync(`${dir}/content.txt`, text);
  expect(text).toContain('Alice Durand');
  expect(text.replace(/\s+/g, ' ')).toContain('Tempo lent, puis repos.');
  expect(errors).toEqual([]);
  console.log(text);

  console.log('PASS: PDF matches the screen.');
  process.exit(0);

} finally {
  await browser.close();
}
