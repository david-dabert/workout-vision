// "À propos" (6 October 2026): reached from the foot of the choice, in French and English, on a 390 and a 320 wide
// phone: the title shows, the three photos load, nothing runs off the side, and Back returns to the choice.
import { test, expect } from '@playwright/test';
import { ABOUT } from '../src/components/experience/about-copy.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

const SHOTS = process.env.ABOUT_SHOTS;

for (const lang of ['fr', 'en']) {
  for (const viewport of [{ width: 390, height: 664 }, { width: 320, height: 568 }]) {
    test(`About from the choice (${lang}, ${viewport.width}x${viewport.height})`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.setViewportSize(viewport);
      await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
      await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
      await page.goto('/workout-vision/');
      await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
      const link = page.getByTestId('about-link');
      await expect(link).toHaveText(ABOUT[lang].link);
      await link.scrollIntoViewIfNeeded();
      await link.click();
      const screen = page.locator('.about-screen');
      await expect(screen).toBeVisible({ timeout: 20000 });
      await expect(page).toHaveURL(/#about$/);
      await expect(screen.locator('h1.title')).toHaveText(ABOUT[lang].title);
      await expect(screen.locator('h1.title')).toBeVisible();
      await expect(screen.locator('.about-line')).toHaveCount(22);
      // Lazy photos load as they come into view: the page is scrolled through, then every photo has its pixels.
      const imgs = screen.locator('img');
      await expect(imgs).toHaveCount(3);
      for (let i = 0; i < 3; i++) await imgs.nth(i).scrollIntoViewIfNeeded();
      await expect.poll(() => imgs.evaluateAll(els => els.map(e => e.complete && e.naturalWidth > 0)), { timeout: 15000 }).toEqual([true, true, true]);
      const p = ABOUT[lang].photos;
      expect(await imgs.evaluateAll(els => els.map(e => e.alt))).toEqual([p.portrait.alt, p.sanSiro.alt, p.dordogne.alt]);
      // No horizontal overflow: neither the screen nor the page scrolls sideways.
      const overflow = await page.evaluate(() => {
        const s = document.querySelector('.about-screen');
        return { screen: s.scrollWidth - s.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      expect(overflow).toEqual({ screen: 0, page: 0 });
      if (SHOTS && viewport.width === 390) {
        // The whole page in one picture: the screen is fixed and scrolls itself, so it is let out for the shot.
        await page.evaluate(() => { const s = document.querySelector('.about-screen'); s.scrollTop = 0; s.style.position = 'static'; s.style.overflow = 'visible'; s.closest('.wv-experience').style.overflow = 'visible'; s.closest('.wv-experience').style.position = 'static'; s.closest('.wv-experience').style.height = 'auto'; });
        await page.addStyleTag({ content: 'html, body, #root { height: auto !important; overflow: visible !important; }' });
        await page.screenshot({ path: `${SHOTS}/shot-${lang}.png`, fullPage: true });
        await page.reload();
        await expect(screen).toBeVisible({ timeout: 20000 });
      }
      await screen.getByRole('button', { name: lang === 'fr' ? 'Retour' : 'Back' }).click();
      await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.about-screen')).toHaveCount(0);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}
