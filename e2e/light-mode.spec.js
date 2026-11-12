// Card 007 (METHOD.md, 12 November 2026): every screen reads on a phone whose system theme is light.
// The experience is dark-themed whatever the system says, but some of its rules used tokens that _tokens.css turns
// light under prefers-color-scheme: light: on 11 November the "Rapport de séance" button showed light text on a light
// ground. This walk fails when a visible text and the ground painted behind it differ by a contrast ratio under 3
// (WCAG's floor for large text and controls; a floor against unreadable text, not an accessibility audit).
import { test, expect } from '@playwright/test';
import { start, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';

const BASE = '/workout-vision/';
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });

// Every visible text whose own colour and the first opaque ground behind it are too close. A ground that is a picture
// or a gradient cannot be read as one colour: the text over it is not judged.
const unreadable = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ground = el => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a === 1) break; }
    }
    let g = { r: 255, g: 255, b: 255, a: 1 };
    for (const c of layers.reverse()) g = over(c, g);
    return g;
  };
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, canvas, video')) continue;
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (text.length < 2) continue;
    const b = el.getBoundingClientRect(), s = getComputedStyle(el);
    if (!(b.width > 0 && b.height > 0) || s.visibility === 'hidden' || Number(s.opacity) < 0.5 || b.bottom < 0 || b.top > innerHeight) continue;
    if (el.closest('[aria-hidden="true"]') || el.disabled || el.closest(':disabled')) continue;
    const g = ground(el), c = parse(s.color);
    if (!g || !c) continue;
    const fg = over(c, g), l1 = lum(fg), l2 = lum(g);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 3) out.push(`${text.slice(0, 40)} [${(el.className || el.tagName).toString().slice(0, 40)}] ${ratio.toFixed(2)}`);
  }
  return [...new Set(out)];
};

test('every screen reads in light mode', async ({ page }) => {
  test.setTimeout(300_000);
  const found = {};
  const judge = async name => {
    await page.waitForTimeout(600);
    // WV_SHOTS=<folder> keeps a picture of each screen as judged, for a report (METHOD.md, gate 7).
    if (process.env.WV_SHOTS) await page.screenshot({ path: `${process.env.WV_SHOTS}/${name}.png` });
    const scroller = () => page.evaluate(() => { const s = [...document.querySelectorAll('*')].find(e => e.scrollHeight > e.clientHeight + 200 && /auto|scroll/.test(getComputedStyle(e).overflowY)) || document.scrollingElement; s.scrollBy(0, 760); });
    let list = await page.evaluate(unreadable);
    for (let i = 0; i < 4; i++) { await scroller(); await page.waitForTimeout(250); list = list.concat(await page.evaluate(unreadable)); }
    list = [...new Set(list)];
    if (list.length) found[name] = list;
  };

  // First visit, then the home.
  await page.addInitScript(() => { if (!sessionStorage.getItem('lm')) { sessionStorage.setItem('lm', '1'); localStorage.setItem('wv_lang', 'fr'); } });
  await page.goto(BASE);
  await expect(page.getByRole('button', { name: 'Voir un exemple' })).toBeVisible({ timeout: 30000 });
  await judge('entry');
  await page.evaluate(() => localStorage.setItem('wv_seen_entry', 'true'));
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await judge('choice');

  // One set filmed, counted, saved, replayed.
  await start(page);
  await openFilm(page, BASE);
  await judge('film');
  // The drawer that changes the exercise, opened from the filming screen.
  const change = page.locator('.film-screen button').filter({ hasText: /Changer/ }).first();
  if (await change.count()) {
    await change.click();
    await judge('film-drawer');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    if (!(await page.locator('.film-screen .actions .btn-primary').isVisible())) await openFilm(page, BASE);
  }
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 90000 });
  await judge('result');
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await judge('saved');
  const replay = page.locator('button, a').filter({ hasText: /Revoir/ }).first();
  await replay.scrollIntoViewIfNeeded();
  await replay.click();
  await expect(page.locator('.replay-screen')).toBeVisible({ timeout: 20000 });
  await judge('replay');
  // Back to the saved set, then its session report: the last screen of this flow.
  await page.locator('.replay-screen .icon-btn').first().click();
  await expect(page.getByTestId('res-report-btn')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('res-report-btn').click();
  await page.waitForTimeout(1500);
  await judge('report');

  // The history, then the physiotherapist's workspace.
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  await expect(page.locator('.hist-btn').first()).toBeVisible({ timeout: 20000 });
  await judge('history');
  await page.goto(BASE + '#kine');
  await page.reload();
  await expect(page.getByTestId('kine-screen')).toBeVisible({ timeout: 20000 });
  for (const tab of ['programme', 'followup', 'compare', 'profile']) {
    await page.getByTestId(`kn-tab-${tab}`).click();
    await judge(`kine-${tab}`);
  }

  expect(found, 'text too close to its ground in light mode (card 007)').toEqual({});
});
