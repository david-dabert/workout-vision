/**
 * Step 3a verification: Exercise Guide in WebKit iPhone profile.
 * Seeds profile + landing flag to bypass onboarding, then:
 * - Opens dashboard, taps Exercise Guide, opens 3 exercises
 * - Captures screenshots + console output
 */
import { webkit, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const EVIDENCE_DIR = 'evidence/step3a';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const BASE = 'http://localhost:4174/workout-vision/';
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

  // 1. Load the page once so the app's IndexedDB is created
  console.log('Initial load to create IndexedDB...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 2. Seed: set localStorage landing flag + update profile in IndexedDB
  console.log('Seeding profile...');
  await page.evaluate(async () => {
    // Skip landing page
    localStorage.setItem('wv_seen_landing', 'true');

    // Update the existing profile in localforage's IndexedDB
    // localforage uses DB 'workoutVision', store 'profile', key 'userProfile'
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('workoutVision');
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('profile')) {
          db.close();
          resolve();
          return;
        }
        const tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put({
          profileComplete: true,
          mode: 'individual',
          name: 'Test User',
          age: '30',
          sex: 'male',
          weight: '80',
          height: '180',
          experience: 'intermediate',
          goal: 'strength',
          activityLevel: 'moderate',
          injuries: [],
          lang: 'en',
        }, 'userProfile');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // 3. Reload — should now land on dashboard
  console.log('Reloading to dashboard...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${EVIDENCE_DIR}/01-dashboard.png`, fullPage: true });
  console.log('Screenshot: 01-dashboard.png');

  // 4. Navigate to Exercise Guide via hash
  console.log('Navigating to #exercises...');
  await page.goto(`${BASE}#exercises`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${EVIDENCE_DIR}/02-exercise-guide-library.png`, fullPage: false });
  console.log('Screenshot: 02-exercise-guide-library.png');

  // 5. Find exercise cards via CSS module class
  const cards = page.locator('[class*="exerciseCard"]');
  const cardCount = await cards.count();
  console.log(`Found ${cardCount} exercise cards`);

  if (cardCount === 0) {
    const bodyHTML = await page.evaluate(() => document.body.innerHTML.slice(0, 5000));
    writeFileSync(`${EVIDENCE_DIR}/debug-dom.html`, bodyHTML);
    console.log('Saved debug-dom.html');
  }

  // Open 3 exercises (pick indices 0, 3, 6 for variety)
  const indices = [0, 3, 6].filter(i => i < cardCount);
  for (let n = 0; n < indices.length; n++) {
    const i = indices[n];
    await cards.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const cardText = await cards.nth(i).textContent();
    console.log(`Opening exercise ${n + 1} (index ${i}): ${cardText.trim().slice(0, 50)}...`);
    await cards.nth(i).click();
    // Wait for detail overlay to appear
    const overlay = page.locator('[class*="detailOverlay"]');
    await overlay.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000); // wait for PNG frames to load from CDN
    // Screenshot the detail card element (not the overlay — fixed overlay captures full scroll height in WebKit)
    const detailCard = page.locator('[class*="detailCard"]');
    if (await detailCard.count() > 0) {
      await detailCard.first().screenshot({ path: `${EVIDENCE_DIR}/03-exercise-detail-${n + 1}.png` });
    } else {
      // Fallback: viewport clip
      await page.screenshot({ path: `${EVIDENCE_DIR}/03-exercise-detail-${n + 1}.png`, fullPage: false });
    }
    console.log(`Screenshot: 03-exercise-detail-${n + 1}.png`);

    // Close via overlay click or close button
    const closeBtn = page.locator('[class*="detailClose"]');
    if (await closeBtn.count() > 0) {
      await closeBtn.first().click();
    } else {
      const closeFallback = page.locator('button').filter({ hasText: /Close|Fermer/i });
      if (await closeFallback.count() > 0) await closeFallback.first().click();
    }
    await page.waitForTimeout(800);
  }

  await browser.close();

  // Write console log
  writeFileSync(`${EVIDENCE_DIR}/console-output.txt`, consoleLogs.join('\n'));
  console.log(`\nConsole output saved (${consoleLogs.length} lines)`);
  console.log('\n--- Console output ---');
  consoleLogs.forEach(l => console.log(l));
  console.log('--- End console output ---');
})();
