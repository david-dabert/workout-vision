#!/usr/bin/env node
// node test/real-phone/synth/smoke.mjs <video.mp4> <lift> <card name, English> — the app end to end on the
// production build, as a visitor drives it, with a synthetic set filmed into a video (run-video.mjs): entry,
// the card, the filming screen, the video, the analysis, the result, yes, the replay, the report, the history.
// Every screen is shot into SHOTS; any page error, console error or failed request is a fault. Prints a JSON
// summary with the count against the video's truth. Needs `vite preview` on 4176 (started here).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const [video, lift, card] = process.argv.slice(2);
const SHOTS = process.env.SHOTS || 'smoke-shots', LANG = process.env.LANG_APP || 'fr', W = Number(process.env.W || 390), H = Number(process.env.H || 664);
mkdirSync(SHOTS, { recursive: true });
const truth = JSON.parse(readFileSync(`${video}.truth.json`, 'utf8'));
// A timed test is judged on its protocol score (synth.js, P.window), every other set on its reps.
const expected = Number.isFinite(truth.score) ? truth.score : truth.reps.length;
const PORT = 4176, BASE = `http://127.0.0.1:${PORT}/workout-vision/`;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const faults = [], steps = [];
const t0 = Date.now();
try {
  for (let i = 0; i < 60; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  const { defaultBrowserType, ...iphone } = devices['iPhone 14']; void defaultBrowserType;
  const ctx = await browser.newContext({ ...iphone, viewport: { width: W, height: H }, locale: LANG === 'fr' ? 'fr-FR' : 'en-GB' });
  const page = await ctx.newPage();
  const prefetch = (u, t = '') => /pose_landmarker_full\.task$/.test(u) && /ERR_CACHE_WRITE_FAILURE/.test(t);
  page.on('pageerror', e => faults.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !prefetch(m.location().url, m.text())) faults.push(`console: ${m.text()}`); });
  // A blob link aborted once the replay has opened is the replay's video released as it closes; any other is a fault.
  let replayOpened = false;
  const excused = [];
  page.on('requestfailed', r => {
    if (prefetch(r.url(), r.failure()?.errorText)) return;
    const f = `failed: ${r.url()} ${r.failure()?.errorText}`;
    faults.push(f);
    if (replayOpened && /^blob:/.test(r.url()) && r.failure()?.errorText === 'net::ERR_ABORTED') excused.push(f);
  });
  page.on('response', r => { if (r.status() >= 400) faults.push(`${r.status()} ${r.url()}`); });
  // CONTRIBUTE=1: the visitor has said yes to helping improve the count (contribute.js) before this set.
  await page.addInitScript(([l, c]) => { localStorage.setItem('wv_lang', l); if (c) localStorage.setItem('wv_contribute', 'yes'); window.addEventListener('wv:core-result', e => { window.__core = e.detail; }); }, [LANG, !!process.env.CONTRIBUTE]);
  let n = 0;
  // AXE=<path to axe.min.js>: every screen is also audited (WCAG 2.1 A and AA rules); its violations are listed.
  const axe = process.env.AXE ? readFileSync(process.env.AXE, 'utf8') : null, audit = [];
  const shot = async name => {
    n++; const f = `${String(n).padStart(2, '0')}-${name}.png`; await page.screenshot({ path: resolve(SHOTS, f) }); steps.push({ step: name, at: ((Date.now() - t0) / 1000).toFixed(1) });
    if (axe) {
      const v = await page.evaluate(async src => { if (!window.axe) (0, eval)(src); const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }); return r.violations.map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, help: x.help, target: x.nodes.slice(0, 3).map(nd => nd.target.join(' ')) })); }, axe);
      for (const x of v) audit.push({ step: name, ...x });
    }
  };

  await page.goto(BASE);
  await page.waitForTimeout(1500); await shot('entry');
  // Past the entry, wherever it asks to begin.
  const begin = page.locator('button').filter({ hasText: /Commencer|Begin|Entrer|Enter|Start/i }).first();
  if (await begin.count()) { await begin.click(); await page.waitForTimeout(1200); await shot('after-entry'); }
  // TEST=<key>: a fitness test, chosen from its row under the cards (Choice.jsx), not a card.
  if (process.env.TEST) await page.locator(`[data-testid="choose-${process.env.TEST}"]`).click();
  else await page.locator(`.rail > .altar[aria-label="${card}"]`).click();
  await page.waitForTimeout(1200); await shot('film');
  const inputs = page.locator('.film-screen input[type="file"]');
  await inputs.last().setInputFiles(video);
  await page.waitForTimeout(2500); await shot('watch');
  await page.waitForFunction(() => window.__core, null, { timeout: 400000 });
  await page.locator('.result-screen').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500); await shot('result');
  const core = await page.evaluate(() => ({ count: window.__core.count, refused: window.__core.refused, samples: window.__core.timestamps.length, method: window.__core.metadata?.method }));
  await page.locator('[data-testid="ask-card"]').waitFor({ timeout: 20000 });
  await page.locator('.result-screen').evaluate(e => e.closest('.screen')?.scrollTo?.(0, 9999));
  await page.waitForTimeout(800); await shot('result-below');
  // CORRECT=+1 or -1: the visitor says No and saves the count corrected by that much.
  const delta = Number(process.env.CORRECT || 0);
  // TYPE=34: the visitor says No, taps the numeral and types the count instead.
  if (process.env.TYPE) {
    await page.locator('[data-testid="ask-card"] .btn-ghost').click();
    await page.locator('[data-testid="fix-card"]').waitFor({ timeout: 10000 });
    await shot('fix');
    await page.locator('[data-testid="fix-card"] .stepper-in').click();
    await page.keyboard.type(process.env.TYPE);
    await page.waitForTimeout(500); await shot('fix-typed');
    await page.locator('[data-testid="fix-card"] .btn-primary').click();
  } else if (delta) {
    await page.locator('[data-testid="ask-card"] .btn-ghost').click();
    await page.locator('[data-testid="fix-card"]').waitFor({ timeout: 10000 });
    await shot('fix');
    for (let i = 0; i < Math.abs(delta); i++) await page.locator('[data-testid="fix-card"] .round').nth(delta > 0 ? 1 : 0).click();
    await page.locator('[data-testid="fix-card"] .btn-primary').click();
  } else await page.locator('[data-testid="ask-card"] .btn-primary').click();
  // Saved only once the saved card is there (a failed save keeps the question on screen).
  let savedSeen = true;
  await page.locator('[data-testid="saved-card"]').waitFor({ timeout: 20000 }).catch(() => { savedSeen = false; });
  await page.waitForTimeout(800); if (savedSeen) await shot('saved');
  // What the saved card says the visitor kept (absent when the app's count was accepted).
  const kept = await page.locator('.saved-corr').count() ? (await page.locator('.saved-corr').textContent()).trim() : '';
  // The replay, from the top bar.
  const replay = page.locator('.rp-open').first();
  if (await replay.count()) { replayOpened = true; await replay.click(); await page.waitForTimeout(2500); await shot('replay'); await page.locator('.replay-screen .icon-btn').first().click(); await page.waitForTimeout(1200); }
  // The report.
  const report = page.locator('button').filter({ hasText: /Rapport|report/i }).first();
  if (await report.count()) { await report.click(); await page.waitForTimeout(2000); await shot('report'); }
  // The history: the saved set is listed with the saved count.
  await page.goto(BASE);
  const hist = page.locator('button, a').filter({ hasText: /Vos séries|Your sets|Historique|History/ }).first();
  let listed = null;
  // The row appears once the sets are read from the phone's storage: waited for, not timed.
  if (await hist.waitFor({ timeout: 20000 }).then(() => true, () => false)) { await hist.click(); await page.waitForTimeout(1500); await shot('history'); listed = (await page.locator('body').innerText()).slice(0, 400); }
  // The count the phone stored for the newest set, read from its storage, not from the screen.
  const stored = await page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      try {
        const q = r.result.transaction('workouts').objectStore('workouts').getAll();
        q.onsuccess = () => { const last = q.result.filter(w => w && typeof w === 'object').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]; ok(last ? { reps: last.reps, corrected: !!last.corrected, machine: last.machineResult?.reps ?? null } : null); };
        q.onerror = () => ok(null);
      } catch { ok(null); }
    };
  }));
  // With CONTRIBUTE, the contribution kept for this set: its counts and how many pose samples it holds.
  const contributed = process.env.CONTRIBUTE ? await page.evaluate(() => new Promise(ok => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      try { const q = r.result.transaction('contributions').objectStore('contributions').getAll(); q.onsuccess = () => ok(q.result.map(c => ({ count: c.count, appCount: c.appCount, samples: c.worldLandmarks.length, posed: c.worldLandmarks.filter(Boolean).length, timestamps: c.timestamps.length, video: 'video' in c }))); q.onerror = () => ok(null); }
      catch { ok(null); }
    };
  })) : null;
  const out = { video, lift, delta, kept, stored, contributed, listed, audit, truth: expected, count: core.count, refused: core.refused, samples: core.samples, decoder: core.method, seconds: ((Date.now() - t0) / 1000).toFixed(0), steps, faults };
  // STRICT=1 (CI, the "Journey" job): the run fails unless the count equals the video's truth, every screen
  // of the journey was reached, a typed or stepped correction is the count saved, and no fault was seen
  // beyond the two known aborted requests: the page script refetched as the service worker takes over, and
  // the replay's video link released as the replay closes.
  if (process.env.STRICT) {
    const known = f => /^failed: \S+\/assets\/index-[\w-]+\.js net::ERR_ABORTED$/.test(f) || excused.includes(f);
    const want = Number(process.env.TYPE || 0) || (delta ? core.count + delta : 0);
    const reached = new Set(steps.map(x => x.step));
    out.verdict = [
      core.refused && 'refused',
      core.count !== expected && `counted ${core.count} of ${expected}`,
      ...['result', 'saved', 'replay', 'report', 'history'].filter(x => !reached.has(x)).map(x => `screen not reached: ${x}`),
      // The phone stored the kept count, marked corrected when it differs from the app's, beside the app's own.
      (!stored || stored.reps !== (want || core.count) || stored.machine !== core.count || stored.corrected !== !!want) && `stored ${JSON.stringify(stored)}, expected ${want || core.count} reps (app ${core.count}, corrected ${!!want})`,
      // With CONTRIBUTE: one contribution, holding the counts kept and the app's, and the pose of every sample.
      process.env.CONTRIBUTE && !(contributed?.length === 1 && contributed[0].count === (want || core.count) && contributed[0].appCount === core.count && contributed[0].samples === core.samples && contributed[0].timestamps === core.samples && contributed[0].posed > 0 && !contributed[0].video) && `contribution ${JSON.stringify(contributed)}, expected one of ${want || core.count} over ${core.count} with ${core.samples} samples`,
      want && !new RegExp(`(Corrigé|Corrected)\\s*:\\s*${want}\\.`).test(kept) && `correction to ${want} not saved ("${kept}")`,
      ...faults.filter(f => !known(f)).map(f => `fault: ${f}`),
    ].filter(Boolean);
  }
  writeFileSync(resolve(SHOTS, 'summary.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out));
  await browser.close();
  if (out.verdict?.length) { console.error(`JOURNEY FAILED:\n- ${out.verdict.join('\n- ')}`); process.exitCode = 1; }
} finally { try { process.kill(-server.pid); } catch {} }
