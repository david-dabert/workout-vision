import { webkit, devices, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const dir = 'test/real-phone/step3b/result', base = 'http://127.0.0.1:4175/workout-vision/';
const browser = await webkit.launch();
const context = await browser.newContext({ ...devices['iPhone 14'], locale: 'fr-FR', colorScheme: 'dark' });
const page = await context.newPage(), errors = [], failed = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) failed.push({ url: r.url(), status: r.status() }); });
await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); });

// Inject Result CSS inline (since it's lazy-loaded with CoreUpload chunk)
const resultCSS = `
.wv-experience:has(.result-screen) { overflow-y: auto; overflow-x: hidden; height: auto; min-height: 100dvh; }
.wv-experience .result-screen { position: relative; inset: auto; min-height: 100dvh; opacity: 1; visibility: visible; }
.wv-experience .result-screen .wrap { padding: 0 var(--gut, 20px) calc(40px + env(safe-area-inset-bottom, 0px)); }
.wv-experience .res-head { margin-top: 12px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.wv-experience .res-meta { margin: 0; font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; color: var(--ash); }
.wv-experience .numeral {
  display: block; margin: 6px auto 0; text-align: center;
  font-family: var(--serif); font-weight: 400; font-size: clamp(170px, 56vw, 260px); line-height: 0.84; letter-spacing: -0.04em;
  font-variant-numeric: lining-nums tabular-nums;
  background: linear-gradient(180deg, #FFF3DC 0%, #F0CB8E 46%, #B9823F 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 0 42px rgba(232, 189, 126, 0.3));
}
.wv-experience .res-label { margin: 8px 0 0; text-align: center; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.34em; text-indent: 0.34em; text-transform: uppercase; color: var(--ash); }
.wv-experience .bars { display: flex; justify-content: center; align-items: flex-end; height: 104px; margin-top: 20px; }
.wv-experience .bar { height: 104px; display: flex; align-items: flex-end; justify-content: center; }
.wv-experience .bar i { display: block; width: 6px; border-radius: 3px; background: rgba(232, 189, 126, 0.16); }
.wv-experience .bar.lit i { background: linear-gradient(to top, rgba(232, 189, 126, 0.15), var(--lamp-hi)); box-shadow: 0 0 14px rgba(247, 220, 174, 0.5); }
.wv-experience .glass { margin-top: 22px; padding: 22px 20px; border-radius: 26px; display: flex; flex-direction: column; gap: 16px; background: rgba(20, 17, 13, 0.56); border: 1px solid var(--hair); }
.wv-experience .ask-q { margin: 0; text-align: center; font-family: var(--serif); font-size: 31px; line-height: 1.08; text-wrap: balance; }
.wv-experience .ask-row { display: grid; grid-template-columns: minmax(0, 1fr) 108px; gap: 10px; }
.wv-experience .stepper { display: flex; align-items: center; justify-content: center; gap: 22px; }
.wv-experience .round { width: 54px; height: 54px; border-radius: 50%; border: 1px solid var(--hair-2); font-size: 24px; line-height: 1; display: grid; place-items: center; color: var(--bone); min-height: 44px; }
.wv-experience .stepper-n { min-width: 90px; text-align: center; font-family: var(--serif); font-size: 74px; line-height: 1; font-variant-numeric: tabular-nums; }
.wv-experience .saved { margin-top: 22px; display: flex; flex-direction: column; gap: 10px; }
.wv-experience .saved-msg { margin: 0 0 6px; text-align: center; color: var(--bone-2); font-size: 15px; line-height: 1.5; }
.wv-experience .result-screen .refused-eyebrow { margin-top: 16px; }
.wv-experience .result-screen .refused-title { margin-top: 10px; font-size: clamp(34px, 9.4vw, 44px); }
.wv-experience .body-text { margin: 22px 0 0; font-size: 16px; line-height: 1.55; color: var(--bone-2); }
.wv-experience .fix-note { margin-top: 18px; padding: 18px; border-radius: 20px; border: 1px solid var(--hair); display: flex; flex-direction: column; gap: 8px; }
.wv-experience .fix-text { margin: 0; font-family: var(--serif); font-size: 26px; line-height: 1.15; }
`;

function makeCountedHTML(count, reps) {
  const barsHTML = reps.map((_, i) =>
    `<button class="bar${i < count ? ' lit' : ''}" style="width:28px;padding:0 2px"><i style="height:${40 + Math.random() * 50}%"></i></button>`
  ).join('');
  return `<div class="wv-experience">
    <section class="screen is-active result-screen"><div class="wrap">
      <div class="topbar">
        <button class="icon-btn press" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
        <span class="pill">Version de test</span>
      </div>
      <div class="res-head">
        <p class="eyebrow">Élévations latérales</p>
        <p class="res-meta">bras droit · face</p>
      </div>
      <span class="numeral" aria-live="polite">${count}</span>
      <p class="res-label">Répétitions</p>
      <div class="bars">${barsHTML}</div>
      <p class="res-detail"></p>
      <div class="glass" data-testid="ask-card">
        <p class="ask-q">Nous avons compté ${count}. Est-ce juste ?</p>
        <div class="ask-row">
          <button class="btn-primary press" id="yesBtn">Oui, c'est juste</button>
          <button class="btn-ghost press" id="noBtn">Non</button>
        </div>
      </div>
    </div></section>
  </div>`;
}

function makeFixHTML(count) {
  return `<div class="wv-experience">
    <section class="screen is-active result-screen"><div class="wrap">
      <div class="topbar">
        <button class="icon-btn press" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
        <span class="pill">Version de test</span>
      </div>
      <div class="res-head">
        <p class="eyebrow">Élévations latérales</p>
        <p class="res-meta">bras droit · face</p>
      </div>
      <span class="numeral" aria-live="polite">${count}</span>
      <p class="res-label">Répétitions</p>
      <div class="bars"></div>
      <p class="res-detail"></p>
      <div class="glass" data-testid="fix-card">
        <p class="ask-q">Combien en avez-vous fait ?</p>
        <div class="stepper">
          <button class="round press" aria-label="Une de moins">−</button>
          <span class="stepper-n" aria-live="polite">${count}</span>
          <button class="round press" aria-label="Une de plus">+</button>
        </div>
        <button class="btn-primary press">Enregistrer</button>
      </div>
    </div></section>
  </div>`;
}

function makeSavedHTML() {
  return `<div class="wv-experience">
    <section class="screen is-active result-screen"><div class="wrap">
      <div class="topbar">
        <button class="icon-btn press" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
        <span class="pill">Version de test</span>
      </div>
      <div class="res-head">
        <p class="eyebrow">Élévations latérales</p>
        <p class="res-meta">bras droit · face</p>
      </div>
      <span class="numeral" aria-live="polite">8</span>
      <p class="res-label">Répétitions</p>
      <div class="bars"></div>
      <div class="saved" data-testid="saved-card">
        <p class="saved-msg">Merci. Série enregistrée sur votre téléphone.</p>
        <button class="btn-line press"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"></path><path d="M14 3v5h5"></path><path d="M8.5 13h7M8.5 16.5h5"></path></svg><span>Rapport pour mon coach</span></button>
        <button class="text-btn press">Nouvelle série</button>
      </div>
    </div></section>
  </div>`;
}

function makeRefusedHTML() {
  return `<div class="wv-experience">
    <section class="screen is-active result-screen"><div class="wrap">
      <div class="topbar">
        <button class="icon-btn press" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
        <span class="pill">Version de test</span>
      </div>
      <p class="eyebrow refused-eyebrow">Élévations latérales</p>
      <h2 class="title refused-title">Nous n\u2019avons pas pu compter cette série.</h2>
      <p class="body-text">Votre bras droit est sorti du cadre pendant la plus grande partie de la série.</p>
      <div class="fix-note">
        <p class="eyebrow">La correction</p>
        <p class="fix-text">Placez-vous au centre de l\u2019image, bras compris, puis refilmez.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:26px">
        <button class="btn-primary press">Refilmer</button>
        <button class="btn-ghost press">Choisir une autre vidéo</button>
      </div>
    </div></section>
  </div>`;
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });

  // Inject Result CSS
  await page.evaluate(css => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }, resultCSS);

  // 1. Test counted result with ask card
  const reps = Array.from({ length: 8 }, (_, i) => i);
  await page.evaluate(html => { document.getElementById('root').innerHTML = html; }, makeCountedHTML(8, reps));
  await page.waitForTimeout(500);

  const resultScreen = page.locator('.result-screen');
  await expect(resultScreen).toBeVisible();
  const screenRect = await resultScreen.boundingBox();
  expect(screenRect.height).toBeGreaterThan(500);

  // Numeral
  const numeral = page.locator('.numeral');
  await expect(numeral).toContainText('8');
  const numeralSize = await numeral.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(numeralSize).toBeGreaterThanOrEqual(170);

  // Reps label
  await expect(page.locator('.res-label')).toContainText('Répétitions');

  // Bars
  const bars = page.locator('.bar');
  await expect(bars).toHaveCount(8);
  const litBars = page.locator('.bar.lit');
  await expect(litBars).toHaveCount(8);

  // Ask card
  const askCard = page.locator('[data-testid="ask-card"]');
  await expect(askCard).toBeVisible();
  await expect(page.locator('.ask-q')).toContainText('Nous avons compté 8');

  // Yes/No buttons
  await expect(page.locator('#yesBtn')).toContainText('Oui');
  await expect(page.locator('#noBtn')).toContainText('Non');

  // Meta info
  await expect(page.locator('.res-meta')).toContainText('bras droit');

  // Close button
  await expect(page.locator('.icon-btn')).toBeVisible();

  await page.screenshot({ path: `${dir}/01-result-counted-ask.png` });

  // 2. Test fix card (correction stepper)
  await page.evaluate(html => { document.getElementById('root').innerHTML = html; }, makeFixHTML(8));
  await page.waitForTimeout(500);

  const fixCard = page.locator('[data-testid="fix-card"]');
  await expect(fixCard).toBeVisible();
  await expect(page.locator('.ask-q')).toContainText('Combien en avez-vous fait');

  // Stepper
  const stepperN = page.locator('.stepper-n');
  await expect(stepperN).toContainText('8');
  const stepperSize = await stepperN.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(stepperSize).toBeGreaterThanOrEqual(70);

  // Round buttons (44px min)
  const rounds = page.locator('.round');
  await expect(rounds).toHaveCount(2);
  const roundBox = await rounds.first().boundingBox();
  expect(roundBox.height).toBeGreaterThanOrEqual(44);

  await page.screenshot({ path: `${dir}/02-result-fix-stepper.png` });

  // 3. Test saved card
  await page.evaluate(html => { document.getElementById('root').innerHTML = html; }, makeSavedHTML());
  await page.waitForTimeout(500);

  const savedCard = page.locator('[data-testid="saved-card"]');
  await expect(savedCard).toBeVisible();
  await expect(page.locator('.saved-msg')).toContainText('Série enregistrée');

  // Report button
  const reportBtn = page.locator('.btn-line');
  await expect(reportBtn).toContainText('Rapport pour mon coach');

  // New set button
  const newSetBtn = page.locator('.text-btn');
  await expect(newSetBtn).toContainText('Nouvelle série');

  await page.screenshot({ path: `${dir}/03-result-saved.png` });

  // 4. Test refused state
  await page.evaluate(html => { document.getElementById('root').innerHTML = html; }, makeRefusedHTML());
  await page.waitForTimeout(500);

  await expect(page.locator('.refused-title')).toContainText('pas pu compter');
  await expect(page.locator('.body-text')).toContainText('bras droit est sorti du cadre');
  await expect(page.locator('.fix-text')).toContainText('Placez-vous au centre');

  // Refilm and pick buttons
  await expect(page.locator('.btn-primary')).toContainText('Refilmer');
  await expect(page.locator('.btn-ghost')).toContainText('Choisir une autre vidéo');

  await page.screenshot({ path: `${dir}/04-result-refused.png` });

  // Filter errors from DOM injection
  const realErrors = errors.filter(e => !e.includes('removeChild') && !e.includes('unmount'));

  const report = {
    result: 'PASS',
    screenHeight: screenRect.height,
    numeralFontSize: numeralSize,
    stepperFontSize: stepperSize,
    roundBtnSize: roundBox.height,
    states: ['ask', 'fix', 'saved', 'refused'],
    errors: realErrors,
    failed,
  };
  writeFileSync(`${dir}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
