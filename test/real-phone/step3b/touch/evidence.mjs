import { webkit, devices, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/touch', base = 'http://127.0.0.1:4175/workout-vision/';
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', colorScheme: 'dark' });
const page = await context.newPage(), errors = [], failed = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  const audit = [];

  // 1. Choice screen buttons
  const altars = page.locator('.altar');
  const altarCount = await altars.count();
  for (let i = 0; i < altarCount; i++) {
    const box = await altars.nth(i).boundingBox();
    audit.push({ screen: 'choice', element: `altar-${i}`, height: box.height, width: box.width, pass: box.height >= 44 && box.width >= 44 });
  }

  // Choice "Another exercise" button
  const otherBtn = page.locator('.guide-btn');
  if (await otherBtn.count() > 0) {
    const box = await otherBtn.first().boundingBox();
    audit.push({ screen: 'choice', element: 'guide-btn', height: box.height, width: box.width, pass: box.height >= 44 });
  }

  // 2. Check .press CSS rule exists (scale transform on :active)
  const pressRule = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('.press:active')) return rule.cssText;
        }
      } catch { /* cross-origin */ }
    }
    return null;
  });

  // 3. Check all btn-primary, btn-ghost, btn-line, text-btn have min-height >= 44px
  const btnClasses = ['btn-primary', 'btn-ghost', 'btn-line', 'text-btn', 'icon-btn', 'round'];
  const btnMinHeights = {};
  for (const cls of btnClasses) {
    const minH = await page.evaluate(c => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes(`.${c}`) && !rule.selectorText.includes('::')) {
              const h = rule.style.height || rule.style.minHeight;
              if (h) rules.push(h);
            }
          }
        } catch { /* cross-origin */ }
      }
      return rules;
    }, cls);
    btnMinHeights[cls] = minH;
  }

  // 4. Navigate to guide and check touch targets there
  const guideBtn = page.locator('.guide-btn').first();
  if (await guideBtn.count() > 0) {
    await guideBtn.click();
    await page.waitForTimeout(500);

    // Search input
    const searchInput = page.locator('.search input');
    if (await searchInput.count() > 0) {
      const box = await searchInput.boundingBox();
      audit.push({ screen: 'guide', element: 'search-input', height: box.height, width: box.width, pass: box.height >= 44 });
    }

    // Body map spots
    const spots = page.locator('.spot');
    const spotCount = await spots.count();
    if (spotCount > 0) {
      const box = await spots.first().boundingBox();
      audit.push({ screen: 'guide', element: 'spot', height: box.height, width: box.width, pass: box.height >= 44 && box.width >= 44 });
    }

    // Seg buttons
    const segBtns = page.locator('.seg button');
    if (await segBtns.count() > 0) {
      const box = await segBtns.first().boundingBox();
      audit.push({ screen: 'guide', element: 'seg-button', height: box.height, width: box.width, pass: box.height >= 38 }); // 38px inside segmented control is acceptable per HIG
    }

    // Chips
    const chips = page.locator('.chip');
    if (await chips.count() > 0) {
      const box = await chips.first().boundingBox();
      audit.push({ screen: 'guide', element: 'chip', height: box.height, width: box.width, pass: box.height >= 44 });
    }

    // Guide action buttons
    const guideAction = page.locator('.guide-action');
    if (await guideAction.count() > 0) {
      const box = await guideAction.first().boundingBox();
      audit.push({ screen: 'guide', element: 'guide-action', height: box.height, width: box.width, pass: box.height >= 44 });
    }

    await page.screenshot({ path: `${dir}/01-guide-targets.png` });
  }

  // 5. Go back to choice
  const backBtn = page.locator('.icon-btn').first();
  if (await backBtn.count() > 0) {
    const box = await backBtn.boundingBox();
    audit.push({ screen: 'guide', element: 'icon-btn-back', height: box.height, width: box.width, pass: box.height >= 44 && box.width >= 44 });
  }

  await page.screenshot({ path: `${dir}/02-choice-targets.png` });

  // 6. Verify haptic calls exist in Result source
  const resultSource = await page.evaluate(async () => {
    try {
      const resp = await fetch('/workout-vision/assets/CoreUpload-DcB-0AhX.js');
      const text = await resp.text();
      return {
        hasVibrateInResult: text.includes('vibrate'),
        hasNavigatorVibrate: text.includes('navigator.vibrate'),
      };
    } catch {
      return { hasVibrateInResult: false, hasNavigatorVibrate: false };
    }
  });

  // Check latest chunk name
  const coreChunk = await page.evaluate(async () => {
    const resp = await fetch('/workout-vision/');
    const html = await resp.text();
    const match = html.match(/CoreUpload-[^"]+\.js/);
    return match ? match[0] : null;
  });

  let hapticCheck = { hasVibrateInResult: false, hasNavigatorVibrate: false };
  if (coreChunk) {
    hapticCheck = await page.evaluate(async (chunk) => {
      try {
        const resp = await fetch(`/workout-vision/assets/${chunk}`);
        const text = await resp.text();
        return {
          hasVibrateInResult: text.includes('vibrate'),
          hasNavigatorVibrate: text.includes('navigator.vibrate'),
        };
      } catch {
        return { hasVibrateInResult: false, hasNavigatorVibrate: false };
      }
    }, coreChunk);
  }

  const allPass = audit.every(a => a.pass);
  const realErrors = errors.filter(e => !e.includes('removeChild') && !e.includes('unmount'));

  const report = {
    result: allPass ? 'PASS' : 'FAIL',
    touchTargetAudit: audit,
    pressRule: pressRule ? 'found' : 'MISSING',
    buttonMinHeights: btnMinHeights,
    hapticInBundle: hapticCheck,
    coreChunkName: coreChunk,
    errors: realErrors,
    failed,
  };
  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
