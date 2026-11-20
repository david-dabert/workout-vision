#!/usr/bin/env node
/**
 * Card 049 verification: network log on Chromium and WebKit showing
 * which MediaPipe files are requested during live video analysis on check.html.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = 4188;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
};

function startServer() {
  const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl.startsWith('/workout-vision/')) {
      cleanUrl = cleanUrl.replace(/^\/workout-vision\//, '/');
    }
    let filePath = path.join(DIST, cleanUrl);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';

    // HTTP 206 Partial Content support for video files (WebKit / iOS requirement)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

async function inspectEngine(engineName, engineType, contextOptions = {}) {
  const browser = await engineType.launch();
  try {
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    const requests = [];
    const failedRequests = [];
    const pageErrors = [];

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/mediapipe/')) {
        requests.push(url.split('/mediapipe/')[1].split('?')[0]);
      }
    });

    page.on('requestfailed', (req) => {
      failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText || 'failed'}`);
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    console.log(`[${engineName}] Navigating to check.html...`);
    const resp = await page.goto(`http://localhost:${PORT}/workout-vision/check.html`, { waitUntil: 'domcontentloaded' });
    if (!resp || resp.status() >= 400) {
      throw new Error(`Failed to load check.html on ${engineName}: HTTP ${resp?.status()}`);
    }

    // Run the first bundled demo clip
    const runFirstClipBtn = page.locator('[data-testid^="demo-run-"]').first();
    await runFirstClipBtn.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`[${engineName}] Triggering first bundled demo clip...`);
    await runFirstClipBtn.click();

    // Wait for the clip analysis result to populate the out element
    const firstRowOut = page.locator('#demo-clips .row .out').first();
    await page.waitForFunction(() => {
      const el = document.querySelector('#demo-clips .row .out');
      if (!el || !el.textContent) return false;
      const t = el.textContent;
      return t.includes('Exact') || t.includes('Diff') || t.includes('Refus') || t.includes('Count:') || t.includes('Nombre') || t.includes('Non décodable');
    }, { timeout: 30000 });

    const resultText = await firstRowOut.textContent();
    console.log(`[${engineName}] First clip analysis complete. Result preview:\n  ${resultText.split('\n')[0]}`);

    if (failedRequests.length > 0) {
      console.warn(`[${engineName}] Failed requests:`, failedRequests);
    }
    if (pageErrors.length > 0) {
      console.warn(`[${engineName}] Page errors:`, pageErrors);
    }

    return {
      requests: [...new Set(requests)],
      failedRequests,
      pageErrors,
    };
  } finally {
    await browser.close();
  }
}

async function main() {
  const server = await startServer();
  try {
    console.log(`Server listening at http://localhost:${PORT}`);
    const chromiumResult = await inspectEngine('Chromium', chromium);
    const webkitResult = await inspectEngine('WebKit', webkit, { ...devices['iPhone 14'] });

    console.log('\n--- Network Summary for MediaPipe Files ---');
    console.log('Chromium requested:', chromiumResult.requests);
    console.log('WebKit requested:', webkitResult.requests);

    const allRequests = [...chromiumResult.requests, ...webkitResult.requests];
    const moduleRequested = allRequests.some(f => f.includes('vision_wasm_module_internal'));
    console.log('\nWas vision_wasm_module_internal ever requested?:', moduleRequested);

    // Hard assertions
    let errors = 0;
    if (moduleRequested) {
      console.error('FAIL: vision_wasm_module_internal was requested by at least one engine.');
      errors++;
    }

    const hasSimdOrNoSimd = allRequests.some(f => f.includes('vision_wasm_internal.wasm') || f.includes('vision_wasm_nosimd_internal.wasm'));
    if (!hasSimdOrNoSimd) {
      console.error('FAIL: Neither vision_wasm_internal.wasm nor vision_wasm_nosimd_internal.wasm was requested.');
      errors++;
    }

    const hasModel = allRequests.some(f => f.includes('pose_landmarker_full.task'));
    if (!hasModel) {
      console.error('FAIL: pose_landmarker_full.task was not requested.');
      errors++;
    }

    if (chromiumResult.failedRequests.length > 0 || webkitResult.failedRequests.length > 0) {
      console.error('FAIL: Network requests failed during analysis.');
      errors++;
    }

    if (chromiumResult.pageErrors.length > 0 || webkitResult.pageErrors.length > 0) {
      console.error('FAIL: Unhandled page errors occurred during analysis.');
      errors++;
    }

    if (errors > 0) {
      console.error(`\nverification failed with ${errors} error(s).`);
      process.exit(1);
    }

    console.log('\nVERIFICATION PASS: Both Chromium and WebKit load MediaPipe successfully without vision_wasm_module_internal.');
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
