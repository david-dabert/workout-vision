/**
 * Step 3a fix2 evidence: scroll the entire library and record every failed request.
 * WebKit iPhone 14, both dark and light mode.
 */
import { webkit, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const DIR = '/Users/azeliebernard/Developer/workout-vision-main/evidence/step3a-fix2';
mkdirSync(DIR, { recursive: true });

const BASE = 'http://localhost:4174/workout-vision/';
const device = devices['iPhone 14'];

async function seedAndNavigate(page) {
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_landing', 'true');
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
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
}

async function runMode(mode) {
  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({ ...device, colorScheme: mode });
  const page = await context.newPage();

  // Record every failed network request
  const failedRequests = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push({ url: response.url(), status: response.status() });
    }
  });
  const consoleLines = [];
  page.on('console', msg => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLines.push(`[PAGE_ERROR] ${err.message}`));

  await seedAndNavigate(page);
  await page.goto(`${BASE}#exercises`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Screenshot library top
  await page.screenshot({ path: `${DIR}/01-${mode}-library-top.png`, fullPage: false });
  console.log(`${mode}: 01-library-top — top of exercise library`);

  // Scroll through the entire library to trigger all lazy image loads
  const gridCards = page.locator('[class*="exerciseGrid"] > div');
  const total = await gridCards.count();
  console.log(`${mode}: ${total} exercise cards in grid`);

  for (let i = 0; i < total; i += 20) {
    const idx = Math.min(i + 19, total - 1);
    await gridCards.nth(idx).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }
  // Scroll to very bottom
  await gridCards.last().scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${DIR}/02-${mode}-library-bottom.png`, fullPage: false });
  console.log(`${mode}: 02-library-bottom — bottom of exercise library after full scroll`);

  // Open Squat specifically
  const squat = page.locator('[class*="exerciseGrid"] > div').filter({ hasText: /^Squat/ });
  if (await squat.count() > 0) {
    await squat.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await squat.first().click();
    const detail = page.locator('[class*="detailCard"]');
    await detail.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
    if (await detail.count() > 0) {
      await detail.first().screenshot({ path: `${DIR}/03-${mode}-squat-detail.png` });
      const text = await detail.first().textContent();
      console.log(`${mode}: 03-squat-detail — Squat exercise detail card`);
    }
    const closeBtn = page.locator('[class*="detailClose"]');
    if (await closeBtn.count() > 0) await closeBtn.first().click();
    await page.waitForTimeout(500);
  } else {
    console.log(`${mode}: WARNING — Squat card not found`);
  }

  // Open two more details for evidence
  for (let n = 0; n < 2 && n < total; n++) {
    const idx = n * 5 + 1;
    if (idx >= total) break;
    await gridCards.nth(idx).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await gridCards.nth(idx).click();
    const detail = page.locator('[class*="detailCard"]');
    await detail.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
    if (await detail.count() > 0) {
      await detail.first().screenshot({ path: `${DIR}/04-${mode}-detail-${n+1}.png` });
      console.log(`${mode}: 04-detail-${n+1} — exercise detail card`);
    }
    const closeBtn = page.locator('[class*="detailClose"]');
    if (await closeBtn.count() > 0) await closeBtn.first().click();
    await page.waitForTimeout(500);
  }

  // Report failed requests
  if (failedRequests.length > 0) {
    console.log(`${mode}: FAILED REQUESTS (status >= 400):`);
    failedRequests.forEach(r => console.log(`  ${r.status} ${r.url}`));
  } else {
    console.log(`${mode}: OK — zero failed requests after full library scroll`);
  }

  // Report console errors
  const errors = consoleLines.filter(l => l.startsWith('[error]') || l.startsWith('[PAGE_ERROR]'));
  if (errors.length > 0) {
    console.log(`${mode}: CONSOLE ERRORS:`);
    errors.forEach(e => console.log(`  ${e}`));
  } else {
    console.log(`${mode}: OK — zero console errors`);
  }

  writeFileSync(`${DIR}/05-${mode}-console.txt`, consoleLines.join('\n'));
  writeFileSync(`${DIR}/05-${mode}-failed-requests.json`, JSON.stringify(failedRequests, null, 2));
  console.log(`${mode}: 05-console — ${consoleLines.length} lines, ${failedRequests.length} failed requests`);

  await browser.close();
}

(async () => {
  await runMode('dark');
  await runMode('light');
  console.log('\nEvidence saved to', DIR);
})();
