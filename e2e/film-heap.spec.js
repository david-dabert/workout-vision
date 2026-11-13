// Card 017, last part (docs/FLAWS-2026-11.md #18): the tour's WebKit step timed out twice on the click that opens the
// 35th filming screen of one page (STATE.md), and the cause was guessed as a page that slows as filming screens open
// and close. Measured here in Chromium on the production build: the filming screen opened and left 40 times, alternating
// over the rail's exercises, with garbage collected before each reading of the JavaScript heap and of the DOM's nodes,
// listeners and documents (Chrome DevTools protocol). Rule fixed before the first run: a leak is a used heap at the 40th
// opening more than 5 MB above the 5th, or DOM nodes or listeners more than 10 % above the 5th.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const PROD = 'http://localhost:4176/workout-vision/';

test('the filming screen opened 40 times: no growth of heap, nodes or listeners', async ({ page, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'The heap is read through the Chrome DevTools protocol.');
  test.setTimeout(600_000);
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  const cdp = await page.context().newCDPSession(page);
  await page.goto(PROD);
  await expect(page.locator('.rail > .altar')).toHaveCount(9, { timeout: 20000 });
  const read = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    const d = await cdp.send('Memory.getDOMCounters');
    return { heapMB: usedSize / 1048576, nodes: d.nodes, listeners: d.jsEventListeners, documents: d.documents };
  };
  const rows = [];
  for (let i = 1; i <= 40; i++) {
    const card = page.locator('.choose-screen .altar').nth(i % 9);
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page.locator('.wv-current .film-screen .frame')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.wv-leaving')).toHaveCount(0, { timeout: 20000 });
    await page.locator('.film-screen .icon-btn').first().click();
    await expect(page.locator('.wv-current .choose-screen')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.wv-leaving')).toHaveCount(0, { timeout: 20000 });
    rows.push({ i, ...(await read()) });
  }
  const at = n => rows[n - 1];
  const text = ['# Card 017: the filming screen opened and left 40 times (e2e/film-heap.spec.js, Chromium, production build)',
    'opening  heap MB  nodes  listeners  documents',
    ...rows.filter(r => r.i === 1 || r.i % 5 === 0).map(r => `${String(r.i).padStart(7)}  ${r.heapMB.toFixed(1).padStart(7)}  ${String(r.nodes).padStart(5)}  ${String(r.listeners).padStart(9)}  ${String(r.documents).padStart(9)}`),
    `5th to 40th: heap ${(at(40).heapMB - at(5).heapMB).toFixed(1)} MB, nodes ${at(40).nodes - at(5).nodes}, listeners ${at(40).listeners - at(5).listeners}`, ''].join('\n');
  writeFileSync(info.outputPath('film-heap.txt'), text);
  process.stdout.write(text);
  expect(at(40).heapMB - at(5).heapMB).toBeLessThanOrEqual(5);
  expect(at(40).nodes).toBeLessThanOrEqual(at(5).nodes * 1.1);
  expect(at(40).listeners).toBeLessThanOrEqual(at(5).listeners * 1.1);
});
