// The anonymous usage counts (src/lib/events.js; analytics, 3 October 2026), on a build that names a server for them
// (playwright.config.js, port 4175). The server is intercepted: the test reads exactly what the app sends.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const APP = 'http://localhost:4175/workout-vision/';
const FIELDS = ['event', 'lift', 'tier', 'durationBucket', 'appVersion', 'lang'];

// Every request the page makes outside its own origin, and the events the intercepted server receives.
async function listen(page) {
  const events = [], foreign = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost:4175/') && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) foreign.push(r.url()); });
  await page.route('https://events.invalid/**', async route => {
    const req = route.request();
    expect(req.method()).toBe('POST');
    expect(Object.keys(JSON.parse(req.postData()))).toEqual(['events']);
    events.push(...JSON.parse(req.postData()).events);
    await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  return { events, foreign };
}
const pagehide = page => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));

test('a visit sends the expected events, with only their fields, and nothing else leaves the page', async ({ page }) => {
  const { events, foreign } = await listen(page);
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate'); });
  const response = await page.goto(APP);
  // The policy lets the page reach the events server, and no other.
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("connect-src 'self' blob: https://events.invalid;");
  expect(response.ok()).toBe(true);
  // The choice says what is counted, and offers to stop it.
  await expect(page.getByTestId('usage-note')).toContainText('Pour s’améliorer, l’app compte de façon anonyme l’usage de ses écrans et de ses analyses : ni identité, ni vidéo, ni mouvement.');
  await expect(page.getByRole('button', { name: 'Désactiver le comptage anonyme' })).toBeVisible();

  await page.getByRole('button', { name: /Vos séries/ }).click();
  await page.getByRole('button', { name: 'Retour' }).first().click();
  await page.getByRole('button', { name: 'Curl biceps' }).first().click({ timeout: 20000 });
  await page.locator('.film-screen input[type=file]').nth(1).setInputFiles({ name: 'set.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a real video') });
  await expect(page.getByText('L’analyse n’a pas pu démarrer.', { exact: true })).toBeVisible({ timeout: 60000 });
  await pagehide(page);

  const expected = ['open', 'history_open', 'choose_lift', 'film_start', 'analysis_start', 'analysis_failed', 'session_end'];
  await expect.poll(() => events.map(e => e.event), { timeout: 10000 }).toEqual(expected);
  // A beat more: nothing else arrives.
  await page.waitForTimeout(5000);
  expect(events.map(e => e.event)).toEqual(expected);
  for (const e of events) {
    for (const k of Object.keys(e)) expect(FIELDS).toContain(k);
    expect(e.lang).toBe('fr');
    expect(e.appVersion).toMatch(/^\d+\.\d+\.\d+/);
  }
  for (const e of events.filter(e => ['choose_lift', 'film_start', 'analysis_start', 'analysis_failed'].includes(e.event))) {
    expect(e).toMatchObject({ lift: 'bicep_curl', tier: 'beta' });
  }
  expect(events.find(e => e.event === 'session_end').durationBucket).toBe('<1');
  expect(events.filter(e => e.event !== 'session_end').every(e => !('durationBucket' in e))).toBe(true);
  // Nothing of the page's own goes anywhere but the events server.
  expect(foreign.filter(u => !u.startsWith('https://events.invalid/'))).toEqual([]);
  // No identifier was written: the page's storage holds only what it held, and no cookie.
  expect(await page.evaluate(() => document.cookie)).toBe('');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /count|event|track|uid|sid|session/i.test(k)))).toEqual([]);
});

test('turned off, nothing is sent, in this visit or the next; the entry speaks of the video', async ({ page }) => {
  const { events } = await listen(page);
  await page.addInitScript(() => { localStorage.setItem('wv_lang', 'fr'); });
  await page.goto(APP);
  // With the counts on, the entry no longer says that nothing leaves the phone.
  await expect(page.getByText('Votre vidéo ne quitte votre téléphone que si vous la partagez.')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Rien ne quitte votre téléphone sans votre accord.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Entrer' }).click();
  await page.getByRole('button', { name: 'Désactiver le comptage anonyme' }).click();
  await expect(page.getByTestId('usage-note')).toContainText('Comptage anonyme désactivé sur ce téléphone.');
  await expect(page.getByRole('button', { name: 'Réactiver le comptage anonyme' })).toBeVisible();
  // The opening, queued before the choice, is dropped if it has not left yet.
  await page.getByRole('button', { name: /Vos séries/ }).click();
  // The history open (its address is #history), then the next visit at the app's address. A reload raced the
  // screen's change: under load the hash had moved first and the reload reopened the history, where the switch is
  // not shown (full e2e run of 3 October; alone, the reload came first).
  await expect(page.locator('.history-screen')).toBeVisible({ timeout: 20000 });
  await pagehide(page);
  await page.goto(APP);
  await expect(page.getByRole('button', { name: 'Réactiver le comptage anonyme' })).toBeVisible({ timeout: 20000 });
  await pagehide(page);
  await page.waitForTimeout(5000);
  // Only the opening may have left, if its wait ran out before the tap; nothing after it.
  expect(events.filter(e => e.event !== 'open')).toEqual([]);
  expect(events.length).toBeLessThanOrEqual(1);
});
