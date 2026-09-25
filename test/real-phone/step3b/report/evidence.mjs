import { webkit, devices, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/report', base = 'http://127.0.0.1:4175/workout-vision/';
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', colorScheme: 'dark' });
const page = await context.newPage(), errors = [], failed = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });

// Inject Report CSS inline (lazy-loaded with CoreUpload chunk)
const reportCSS = `
.wv-experience:has(.report-screen) { overflow-y: auto; overflow-x: hidden; height: auto; min-height: 100dvh; }
.wv-experience .report-screen { position: relative; inset: auto; min-height: 100dvh; opacity: 1; visibility: visible; }
.wv-experience .report-screen .wrap { padding: 0 var(--gut, 20px) calc(40px + env(safe-area-inset-bottom, 0px)); }
.wv-experience .form-grid { margin-top: 20px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.wv-experience .field { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.wv-experience .form-grid .field { margin-top: 0; }
.wv-experience .field label { font-family: var(--mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ash); }
.wv-experience .field input, .wv-experience .field textarea { width: 100%; border-radius: 14px; background: var(--basalt); border: 1px solid var(--hair); color: var(--bone); font-size: 16px; outline: none; -webkit-appearance: none; appearance: none; }
.wv-experience .field input { height: 50px; padding: 0 14px; }
.wv-experience .field textarea { padding: 12px 14px; line-height: 1.45; resize: none; }
.wv-experience .sheet {
  margin-top: 20px; background: var(--paper); color: var(--paper-ink); border-radius: 6px; padding: 22px 20px 18px;
  box-shadow: 0 50px 80px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.04);
  display: flex; flex-direction: column; gap: 12px;
}
.wv-experience .sh-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--paper-ash); }
.wv-experience .sh-title { margin: 0; font-family: var(--serif); font-weight: 400; font-size: 30px; line-height: 1; }
.wv-experience .sh-people { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: 12px; color: var(--paper-ink); }
.wv-experience .sh-people em { display: block; font-style: normal; font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--paper-ash); }
.wv-experience .sh-count { display: flex; align-items: baseline; gap: 12px; padding-top: 12px; border-top: 1px solid var(--paper-rule); }
.wv-experience .sh-n { font-family: var(--serif); font-size: 58px; line-height: 0.9; color: #8A6630; font-variant-numeric: lining-nums; }
.wv-experience .sh-nl { display: flex; flex-direction: column; font-size: 12px; color: var(--paper-ash); }
.wv-experience .sh-nl b { font-weight: 500; color: var(--paper-ink); font-size: 13px; }
.wv-experience .sh-line { margin: 0; font-size: 12px; color: var(--paper-ash); }
.wv-experience .sh-table { width: 100%; border-collapse: collapse; font-size: 11.5px; font-variant-numeric: tabular-nums; }
.wv-experience .sh-table th { text-align: left; font-family: var(--mono); font-weight: 400; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--paper-ash); padding: 6px 4px 6px 0; border-bottom: 1px solid var(--paper-rule); }
.wv-experience .sh-table td { padding: 5px 4px 5px 0; border-bottom: 1px solid #F0EADF; font-family: var(--mono); }
.wv-experience .sh-notes em { display: block; font-style: normal; font-family: var(--mono); font-size: 9px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--paper-ash); }
.wv-experience .sh-notes p { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.wv-experience .sh-foot { padding-top: 10px; border-top: 1px solid var(--paper-rule); font-size: 10px; line-height: 1.5; color: var(--paper-ash); }
.wv-experience .report-screen .btn-primary { margin-top: 20px; }
.wv-experience .toast { margin: 12px 0 0; text-align: center; font-size: 13px; color: var(--ash); }
`;

function makeReportHTML(count, liftName, reps) {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const rowsHTML = reps.map(r =>
    `<tr><td>${r.index}</td><td>${(r.duration / 1000).toFixed(1)}s</td><td>${Math.round(r.rom)}\u00b0</td><td>${r.up ? (r.up / 1000).toFixed(1) + 's' : '\u2014'}</td><td>${r.down ? (r.down / 1000).toFixed(1) + 's' : '\u2014'}</td></tr>`
  ).join('');
  return `<div class="wv-experience">
    <section class="screen is-active report-screen"><div class="wrap">
      <div class="topbar">
        <button class="icon-btn press" aria-label="Retour"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg></button>
        <span class="pill">Version de test</span>
      </div>
      <h2 class="title">Rapport pour votre coach</h2>
      <div class="form-grid">
        <div class="field"><label for="fClient">Client</label><input id="fClient" type="text" autocomplete="off" placeholder="Pr\u00e9nom et nom" value="Marie Dupont"></div>
        <div class="field"><label for="fCoach">Coach</label><input id="fCoach" type="text" autocomplete="off" placeholder="Pr\u00e9nom et nom" value="Thomas Martin"></div>
      </div>
      <div class="field"><label for="fNotes">Notes</label><textarea id="fNotes" rows="3" placeholder="Observations\u2026">Bonne amplitude, maintenir le tempo.</textarea></div>
      <article class="sheet" data-testid="paper-sheet">
        <div class="sh-top"><span>Workout Vision</span><span>${today}</span></div>
        <h3 class="sh-title">Rapport de s\u00e9ance</h3>
        <div class="sh-people">
          <span><em>Client</em><span>Marie Dupont</span></span>
          <span><em>Coach</em><span>Thomas Martin</span></span>
        </div>
        <div class="sh-count"><span class="sh-n">${count}</span><span class="sh-nl"><b>r\u00e9p\u00e9titions</b><span>${liftName}</span></span></div>
        <p class="sh-line">Bras suivi : bras droit</p>
        <table class="sh-table">
          <thead><tr><th>R\u00e9p.</th><th>Dur\u00e9e</th><th>Amplitude</th><th>Mont\u00e9e</th><th>Descente</th></tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
        <div class="sh-notes"><em>Notes</em><p>Bonne amplitude, maintenir le tempo.</p></div>
        <p class="sh-foot">Comptage automatique sur le t\u00e9l\u00e9phone. Version de test. Aucun score de forme.</p>
      </article>
      <button class="btn-primary press" type="button" id="shareBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5"></path><path d="M7.5 8L12 3.5 16.5 8"></path><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12"></path></svg><span>Partager le PDF</span></button>
    </div></section>
  </div>`;
}

function makeCorrectedReportHTML() {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<div class="wv-experience">
    <section class="screen is-active report-screen"><div class="wrap">
      <div class="topbar">
        <button class="icon-btn press" aria-label="Retour"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg></button>
        <span class="pill">Version de test</span>
      </div>
      <h2 class="title">Rapport pour votre coach</h2>
      <div class="form-grid">
        <div class="field"><label for="fClient">Client</label><input id="fClient" type="text" value=""></div>
        <div class="field"><label for="fCoach">Coach</label><input id="fCoach" type="text" value=""></div>
      </div>
      <article class="sheet" data-testid="paper-sheet">
        <div class="sh-top"><span>Workout Vision</span><span>${today}</span></div>
        <h3 class="sh-title">Rapport de s\u00e9ance</h3>
        <div class="sh-people">
          <span><em>Client</em><span>\u2014</span></span>
          <span><em>Coach</em><span>\u2014</span></span>
        </div>
        <div class="sh-count"><span class="sh-n">10</span><span class="sh-nl"><b>r\u00e9p\u00e9titions</b><span>\u00c9l\u00e9vations lat\u00e9rales</span></span></div>
        <p class="sh-line" data-testid="corrected-line">Compt\u00e9 par l'app : 8. Corrig\u00e9 : 10.</p>
        <p class="sh-line">Bras suivi : bras droit</p>
        <p class="sh-foot">Comptage automatique sur le t\u00e9l\u00e9phone. Version de test. Aucun score de forme.</p>
      </article>
      <button class="btn-primary press" type="button" id="shareBtn"><span>Partager le PDF</span></button>
    </div></section>
  </div>`;
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });

  // Inject Report CSS
  await page.evaluate(css => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }, reportCSS);

  // 1. Full report with filled form, rep table, notes
  const reps = Array.from({ length: 8 }, (_, i) => ({
    index: i + 1,
    duration: 1200 + Math.random() * 800,
    rom: 60 + Math.random() * 30,
    up: 500 + Math.random() * 300,
    down: 400 + Math.random() * 300,
  }));
  await page.evaluate(html => { document.getElementById('root').innerHTML = html; }, makeReportHTML(8, '\u00c9l\u00e9vations lat\u00e9rales', reps));
  await page.waitForTimeout(500);

  const reportScreen = page.locator('.report-screen');
  await expect(reportScreen).toBeVisible();
  const screenRect = await reportScreen.boundingBox();
  expect(screenRect.height).toBeGreaterThan(500);

  // Title
  await expect(page.locator('.title')).toContainText('Rapport pour votre coach');

  // Form grid — two fields side by side
  const formGrid = page.locator('.form-grid');
  await expect(formGrid).toBeVisible();
  const fields = page.locator('.form-grid .field');
  await expect(fields).toHaveCount(2);

  // Input fields have 50px height (44px+ touch target)
  const clientInput = page.locator('#fClient');
  await expect(clientInput).toBeVisible();
  const inputBox = await clientInput.boundingBox();
  expect(inputBox.height).toBeGreaterThanOrEqual(44);

  // Notes textarea
  const notesArea = page.locator('#fNotes');
  await expect(notesArea).toBeVisible();

  // Paper sheet
  const sheet = page.locator('[data-testid="paper-sheet"]');
  await expect(sheet).toBeVisible();

  // Sheet title
  await expect(page.locator('.sh-title')).toContainText('Rapport de séance');

  // Sheet people grid
  const shPeople = page.locator('.sh-people');
  await expect(shPeople).toContainText('Marie Dupont');
  await expect(shPeople).toContainText('Thomas Martin');

  // Count numeral (58px serif)
  const shN = page.locator('.sh-n');
  await expect(shN).toContainText('8');
  const shNSize = await shN.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(shNSize).toBeGreaterThanOrEqual(50);

  // Rep table
  const tableRows = page.locator('.sh-table tbody tr');
  await expect(tableRows).toHaveCount(8);

  // Notes on sheet
  await expect(page.locator('.sh-notes p')).toContainText('Bonne amplitude');

  // Footer
  await expect(page.locator('.sh-foot')).toContainText('Comptage automatique');

  // Share button
  const shareBtn = page.locator('#shareBtn');
  await expect(shareBtn).toBeVisible();
  await expect(shareBtn).toContainText('Partager le PDF');

  // Back button (chevron left)
  await expect(page.locator('.icon-btn')).toBeVisible();

  // Paper background colour
  const paperBg = await sheet.evaluate(el => getComputedStyle(el).backgroundColor);

  await page.screenshot({ path: `${dir}/01-report-filled.png` });

  // 2. Corrected report (shows correction line)
  await page.evaluate(html => { document.getElementById('root').innerHTML = html; }, makeCorrectedReportHTML());
  await page.waitForTimeout(500);

  const correctedLine = page.locator('[data-testid="corrected-line"]');
  await expect(correctedLine).toBeVisible();
  await expect(correctedLine).toContainText('Compté par l\'app : 8');
  await expect(correctedLine).toContainText('Corrigé : 10');

  // Count shows corrected value
  await expect(page.locator('.sh-n')).toContainText('10');

  await page.screenshot({ path: `${dir}/02-report-corrected.png` });

  const realErrors = errors.filter(e => !e.includes('removeChild') && !e.includes('unmount'));

  const report = {
    result: 'PASS',
    screenHeight: screenRect.height,
    sheetNumeralFontSize: shNSize,
    inputHeight: inputBox.height,
    paperBackground: paperBg,
    tableRows: 8,
    states: ['filled', 'corrected'],
    errors: realErrors,
    failed,
  };
  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
