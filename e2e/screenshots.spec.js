import { test, expect } from '@playwright/test';

test('dashboard screenshot', async ({ page }) => {
  await page.goto('/workout-vision/');
  await page.waitForLoadState('networkidle');
  // Wait for the logo to render before capturing
  await expect(page.locator('.logo')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveScreenshot('dashboard.png', { maxDiffPixels: 100 });
});

test('analyze page screenshot', async ({ page }) => {
  await page.goto('/workout-vision/#analyze');
  await page.waitForLoadState('networkidle');
  // Wait for the page to render
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot('analyze.png', { maxDiffPixels: 100 });
});

test('profile page screenshot', async ({ page }) => {
  await page.goto('/workout-vision/#profile');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await expect(page).toHaveScreenshot('profile.png', { maxDiffPixels: 100 });
});
