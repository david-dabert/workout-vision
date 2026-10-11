/**
 * Step 3a final: Live site Exercise Guide in WebKit iPhone profile.
 * Tests the deployed GitHub Pages version with real CDN frame loading.
 */
import { webkit, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EVIDENCE_DIR = 'evidence/step3a';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const BASE = 'https://david-dabert.github.io/workout-vision/';
const device = devices['iPhone 14'];
const consoleLogs = [];

(async () => {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE_ERROR] ${err.message}`);
  });

  // Load and seed profile
  console.log('Loading live site...');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Seeding profile...');
  await page.evaluate(async () => {
    localStorage.setItem('wv_seen_landing', 'true');
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('workoutVision');
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('profile')) { db.close(); resolve(); return; }
        const tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put({
          profileComplete: true, mode: 'individual', name: 'Test',
          age: '30', sex: 'male', weight: '80', height: '180',
          experience: 'intermediate', goal: 'strength',
          activityLevel: 'moderate', injuries: [], lang: 'en',
        }, 'userProfile');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Reload to dashboard
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Navigate to exercises
  await page.goto(`${BASE}#exercises`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${EVIDENCE_DIR}/04-live-exercise-library.png`, fullPage: false });
  console.log('Screenshot: 04-live-exercise-library.png');

  // Open an exercise with known working frames (e.g., index 5 should have frames)
  const cards = page.locator('[class*="exerciseCard"]');
  const cardCount = await cards.count();
  console.log(`Live site: ${cardCount} exercise cards`);

  if (cardCount > 5) {
    await cards.nth(5).scrollIntoViewIfNeeded();
    const cardText = await cards.nth(5).textContent();
    console.log(`Opening: ${cardText.trim().slice(0, 50)}...`);
    await cards.nth(5).click();
    const detailCard = page.locator('[class*="detailCard"]');
    await detailCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    // Extra time for CDN frame loading on live
    await page.waitForTimeout(5000);
    await detailCard.first().screenshot({ path: `${EVIDENCE_DIR}/05-live-exercise-detail-frames.png` });
    console.log('Screenshot: 05-live-exercise-detail-frames.png');
  }

  await browser.close();

  writeFileSync(`${EVIDENCE_DIR}/live-console-output.txt`, consoleLogs.join('\n'));
  console.log(`\nLive console output saved (${consoleLogs.length} lines)`);
  console.log('\n--- Live console output ---');
  consoleLogs.forEach(l => console.log(l));
  console.log('--- End ---');
})();
