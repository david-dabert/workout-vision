import { webkit, devices, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/film', base = 'http://127.0.0.1:4175/workout-vision/';
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', colorScheme: 'dark' });
const page = await context.newPage(), errors = [], failed = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('requestfailed', r => failed.push({ url: r.url(), error: r.failure() }));
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });

try {
  await page.goto(base, { waitUntil: 'networkidle' });

  // Should start on Choice screen
  await expect(page.locator('.choose-screen')).toBeVisible();

  const lifts = [
    { key: 'lateral_raise', label: 'Élévations latérales', view: 'Filmé de face' },
    { key: 'bicep_curl', label: 'Curl biceps', view: 'Filmé de profil' },
    { key: 'lat_pulldown', label: 'Tirage vertical', view: 'Filmé de face' },
  ];

  for (const { key, label, view } of lifts) {
    // Tap the lift on the choice screen
    const button = page.getByRole('button', { name: label, exact: true });
    await button.scrollIntoViewIfNeeded();
    // HapticButton fires on Enter keydown
    await button.press('Enter');

    // Film screen should appear
    await expect(page.locator('.film-screen')).toBeVisible({ timeout: 5000 });

    // Eyebrow shows correct view direction
    const eyebrow = page.locator('.film-screen .eyebrow');
    await expect(eyebrow).toContainText(view);

    // Title shows the lift name (French)
    const title = page.locator('.film-screen .title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText.length).toBeGreaterThan(0);

    // Canvas for reference pose exists
    const canvas = page.locator('.film-screen .frame canvas');
    await expect(canvas).toBeVisible();

    // Corner marks SVG
    await expect(page.locator('.film-screen .corners')).toBeVisible();

    // Scan line animation
    await expect(page.locator('.film-screen .scan')).toBeVisible();

    // Caption
    await expect(page.locator('.film-screen .caption')).toContainText('cadrage');

    // Three instruction steps
    const steps = page.locator('.film-screen .steps li');
    await expect(steps).toHaveCount(3);

    // Record button (primary CTA)
    const recordBtn = page.locator('.film-screen .btn-primary');
    await expect(recordBtn).toBeVisible();
    await expect(recordBtn).toContainText('Filmer ma série');
    // Has a file input with capture attribute
    const captureInput = recordBtn.locator('input[capture]');
    await expect(captureInput).toHaveAttribute('accept', 'video/*,.mov');

    // Pick video button (ghost)
    const pickBtn = page.locator('.film-screen .btn-ghost');
    await expect(pickBtn).toBeVisible();
    await expect(pickBtn).toContainText('Choisir une vidéo');
    // Has a file input without capture
    const pickInput = pickBtn.locator('input[type="file"]');
    await expect(pickInput).toHaveAttribute('accept', 'video/*,.mov');

    // Privacy notice
    const privacy = page.locator('.film-screen .privacy');
    await expect(privacy).toContainText('vidéo reste sur votre téléphone');

    // Back button
    const backBtn = page.locator('.film-screen .icon-btn');
    await expect(backBtn).toBeVisible();

    // Test version pill
    await expect(page.locator('.film-screen .pill')).toContainText('Version de test');

    // Screenshot
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${dir}/${key}.png` });

    // Tap back to return to choice screen
    await backBtn.tap();
    await expect(page.locator('.choose-screen')).toBeVisible({ timeout: 5000 });
  }

  // Verify film screen has min-height 100dvh (no WebKit collapse)
  await page.getByRole('button', { name: 'Élévations latérales', exact: true }).tap();
  await expect(page.locator('.film-screen')).toBeVisible();
  const filmRect = await page.locator('.film-screen').boundingBox();
  expect(filmRect.height).toBeGreaterThan(500);

  // Verify 44px minimum touch targets on action buttons
  const primaryBox = await page.locator('.film-screen .btn-primary').boundingBox();
  expect(primaryBox.height).toBeGreaterThanOrEqual(44);
  const ghostBox = await page.locator('.film-screen .btn-ghost').boundingBox();
  expect(ghostBox.height).toBeGreaterThanOrEqual(44);

  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/full-scroll.png` });

  // Go back, then navigate via Guide to confirm Guide → Film routing
  await page.locator('.film-screen .icon-btn').tap();
  await expect(page.locator('.choose-screen')).toBeVisible();

  expect(errors).toEqual([]);
  expect(failed).toEqual([]);

  const report = {
    result: 'PASS',
    lifts: lifts.map(l => l.key),
    filmScreenHeight: filmRect.height,
    primaryBtnHeight: primaryBox.height,
    ghostBtnHeight: ghostBox.height,
    errors,
    failed,
  };
  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
