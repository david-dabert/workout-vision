// Card 005 (cards/005-first-minute.md): on a first visit to the production build, the exercises the first screen of
// the carousel shows are all Beta (src/lib/liftTiers.js), and an Experimental exercise says so before filming.
// Screenshots at 390x844 go to test-results/ for the report.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const PROD = 'http://localhost:4176/workout-vision/';

async function firstVisit(page) {
  await page.goto(PROD);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
}

test('first visit: every exercise on the first screen of the carousel is Beta', async ({ page }, info) => {
  await firstVisit(page);
  await page.waitForTimeout(1200); // the cards' reveal
  const width = page.viewportSize().width;
  const cards = await page.locator('.rail > .altar').evaluateAll((els, w) => els
    .map(e => { const r = e.getBoundingClientRect(); return { name: e.getAttribute('aria-label'), seen: r.right > 0 && r.left < w, tier: e.querySelector('.tier')?.className ?? '' }; }), width);
  const seen = cards.filter(c => c.seen);
  expect(seen.length).toBeGreaterThan(0);
  for (const c of seen) expect(c.tier, `${c.name} on the first screen`).toContain('tier-beta');
  // Every Experimental exercise on the rail comes after every Beta one, and says what it is.
  const firstExperimental = cards.findIndex(c => !c.tier.includes('tier-beta'));
  expect(firstExperimental).toBeGreaterThan(0);
  expect(cards.slice(firstExperimental).every(c => c.tier.includes('tier-experimental'))).toBe(true);
  await page.screenshot({ path: info.outputPath('first-minute-carousel-390x844.png') });
});

test('an Experimental exercise says so before filming', async ({ page }, info) => {
  await firstVisit(page);
  const bench = page.locator('.rail > .altar[aria-label="Bench press"]');
  await expect(bench.locator('.tier')).toHaveText('Experimental: we are still learning this exercise');
  await bench.scrollIntoViewIfNeeded();
  await bench.click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  const notice = page.locator('.film-screen .tier.tier-experimental');
  await expect(notice).toHaveText('Experimental: we are still learning this exercise');
  // The notice comes before the button that starts filming, in reading order.
  const before = await notice.evaluate(n => {
    const btn = document.querySelector('.film-screen .actions .btn-primary');
    return !!btn && !!(n.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(before).toBe(true);
  await page.waitForTimeout(1500); // the screens' cross-fade, so the picture shows the filming screen alone
  await page.screenshot({ path: info.outputPath('first-minute-experimental-film-390x844.png') });
});
