// Frames dropped during a scripted fling across all lift cards, and the longest
// main-thread task, in Chromium with an iPhone-sized touch viewport (CDP synthetic
// touch events). Not WebKit: this container has no WebKit build.
//   npm run build && npx vite preview --port 4176 &  node scripts/measure-fling.mjs [runs] [max-dropped]
// With max-dropped, exits 1 when the median frames dropped exceed it (the check that fails if they rise).
import { chromium } from 'playwright';

const URL = process.env.WV_URL || 'http://127.0.0.1:4176/workout-vision/';
const RUNS = Number(process.argv[2] || 5);
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const rows = [];
for (let run = 0; run < RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en');
    window.__long = 0;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long = Math.max(window.__long, e.duration); }).observe({ type: 'longtask', buffered: true }); } catch { /* no longtask */ }
  });
  await page.goto(URL);
  await page.locator('.altar').first().waitFor();
  await page.waitForTimeout(2500); // entry reveal and first paint settled
  const box = await page.locator('.rail').boundingBox();
  const width = await page.evaluate(() => { const r = document.querySelector('.rail'); return r.scrollWidth - r.clientWidth; });
  await page.evaluate(() => {
    window.__long = 0; window.__frames = [];
    const tick = t => { window.__frames.push(t); if (!window.__stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const cdp = await context.newCDPSession(page);
  // Quick thumb flings to the left until the last card is reached (at most 12), then the rail settles.
  const y = Math.round(box.y + box.height / 2);
  let flings = 0;
  for (let k = 0; k < 12; k++) {
    flings++;
    let x = Math.round(box.x + box.width * 0.85);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 0; i < 8; i++) { x -= 34; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await page.waitForTimeout(8); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
    if (await page.evaluate(w => document.querySelector('.rail').scrollLeft >= w - 2, width)) break;
  }
  await page.waitForTimeout(900);
  const r = await page.evaluate(flings => {
    window.__stop = true;
    const f = window.__frames, gaps = f.slice(1).map((t, i) => t - f[i]);
    const dropped = gaps.reduce((n, g) => n + Math.max(0, Math.round(g / (1000 / 60)) - 1), 0);
    const seconds = (f[f.length - 1] - f[0]) / 1000;
    return { flings, seconds: +seconds.toFixed(2), frames: f.length, dropped, perFling: +(dropped / flings).toFixed(1), perSecond: +(dropped / seconds).toFixed(1), worstGap: Math.round(Math.max(...gaps)), longest: Math.round(window.__long), end: Math.round(document.querySelector('.rail').scrollLeft) };
  }, flings);
  rows.push(r);
  await context.close();
}
await browser.close();
const med = k => { const v = rows.map(r => r[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
console.log(JSON.stringify(rows));
console.log(`headless Chromium, iPhone-sized touch emulation (not an iPhone), median over ${RUNS} runs: flings ${med('flings')}, scrolling ${med('seconds')} s, frames dropped ${med('dropped')}, per fling ${med('perFling')}, per second ${med('perSecond')}, worst frame gap ${med('worstGap')} ms, longest task ${med('longest')} ms (longtask entries, 50 ms and over)`);
const max = process.argv[3];
if (max !== undefined && med('dropped') > Number(max)) { console.error(`FAIL: ${med('dropped')} frames dropped, more than ${max}`); process.exit(1); }
