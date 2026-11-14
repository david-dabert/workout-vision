#!/usr/bin/env node
/**
 * scripts/figures/contact-sheet.mjs
 * 
 * Renders each exercise key's start and end figures side by side,
 * 50 keys per PNG, into ~/wv-tools/figures/ (outside git).
 * Uses Playwright Chromium headless to capture full-page PNGs.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MOTIONS_DIR = path.join(REPO_ROOT, 'test/real-phone/synth/motions');
const FIGURES_DIR = path.join(REPO_ROOT, 'public/figures');
const OUT_DIR = path.join(os.homedir(), 'wv-tools/figures');

const KEYS_PER_SHEET = 50;

async function renderSheet(browser, sheetIndex, keys) {
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 }
  });

  const cardsHtml = keys.map(key => {
    const startSvg = fs.readFileSync(path.join(FIGURES_DIR, `${key}-start.svg`), 'utf8');
    const endSvg = fs.readFileSync(path.join(FIGURES_DIR, `${key}-end.svg`), 'utf8');
    return `
      <div class="card">
        <div class="key-title">${key}</div>
        <div class="figures">
          <div class="fig-box">
            <div class="tag">Start</div>
            <div class="svg-wrap">${startSvg}</div>
          </div>
          <div class="fig-box">
            <div class="tag">End</div>
            <div class="svg-wrap">${endSvg}</div>
          </div>
        </div>
      </div>
    `;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Contact Sheet ${sheetIndex}</title>
  <style>
    body {
      margin: 0;
      padding: 30px;
      background: #0f141c;
      color: #e6edf3;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    h1 {
      margin: 0 0 20px 0;
      font-size: 20px;
      color: #E8C17A;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
    }
    .card {
      background: #171d26;
      border: 1px solid #27313f;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .key-title {
      font-size: 11px;
      font-family: monospace;
      color: #94a3b8;
      margin-bottom: 8px;
      text-align: center;
      word-break: break-all;
    }
    .figures {
      display: flex;
      gap: 8px;
      justify-content: center;
      width: 100%;
    }
    .fig-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }
    .tag {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .svg-wrap {
      width: 100px;
      height: 100px;
      background: #0b0f15;
      border: 1px solid #1e2633;
      border-radius: 4px;
    }
    .svg-wrap svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <h1>Exercise Figures Contact Sheet — Sheet ${sheetIndex} (${keys.length} exercises)</h1>
  <div class="grid">
    ${cardsHtml}
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const outPath = path.join(OUT_DIR, `sheet-${sheetIndex}.png`);
  await page.screenshot({ path: outPath, fullPage: true });
  await page.close();

  console.log(`Rendered sheet ${sheetIndex} (${keys.length} keys) -> ${outPath}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const specFiles = fs.readdirSync(MOTIONS_DIR).filter(f => f.endsWith('.json')).sort();
  const keys = specFiles.map(f => f.replace(/\.json$/, ''));

  console.log(`Generating contact sheets for ${keys.length} exercise keys into ${OUT_DIR}...`);

  const browser = await chromium.launch({ headless: true });

  const numSheets = Math.ceil(keys.length / KEYS_PER_SHEET);
  for (let s = 0; s < numSheets; s++) {
    const chunk = keys.slice(s * KEYS_PER_SHEET, (s + 1) * KEYS_PER_SHEET);
    await renderSheet(browser, s + 1, chunk);
  }

  await browser.close();
  console.log('All contact sheets successfully rendered.');
}

main().catch(err => {
  console.error('Fatal error in contact-sheet.mjs:', err);
  process.exit(1);
});
