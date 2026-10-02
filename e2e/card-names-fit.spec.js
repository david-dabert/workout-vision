// Every card on the choice screen, in both languages, from the smallest iPhone width to the largest: its name
// and lines stay whole inside the card, and the screen keeps every layout rule (checks.mjs). The tour looked at
// the first card only; "Soulevé de terre roumain", the seventh, ran under the card's edge (David, 2 October 2026).
import { test, expect } from '@playwright/test';
import { layoutFaults } from '../test/real-phone/checks.mjs';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 664 }, { width: 430, height: 932 }]) {
  for (const lang of ['fr', 'en']) {
    test(`the nine cards at ${size.width}x${size.height} (${lang}): every name whole inside its card`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: size, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
      await page.addInitScript(([l]) => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); localStorage.setItem('wv_level', 'intermediate'); }, [lang]);
      await page.goto('/workout-vision/');
      const cards = page.locator('.altar');
      await expect(cards).toHaveCount(9);
      const faults = [];
      for (let i = 0; i < 9; i++) {
        const card = cards.nth(i);
        await card.evaluate(c => c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' }));
        await page.waitForTimeout(250);
        const name = await card.locator('.altar-name').textContent();
        // The name's text, line by line, inside the card's box.
        const out = await card.evaluate(c => {
          const n = c.querySelector('.altar-name'), r = document.createRange(); r.selectNodeContents(n);
          const box = c.getBoundingClientRect();
          return [...r.getClientRects()].some(l => l.left < box.left - 0.5 || l.right > box.right + 0.5);
        });
        if (out) faults.push(`${name}: runs out of its card`);
        for (const f of await page.evaluate(layoutFaults)) if (!f.startsWith('note: ')) faults.push(`${name}: ${f}`);
      }
      expect([...new Set(faults)]).toEqual([]);
      await context.close();
    });
  }
}
