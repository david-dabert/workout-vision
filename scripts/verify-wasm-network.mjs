#!/usr/bin/env node
/**
 * Card 049 verification: network log on Chromium and WebKit showing
 * which MediaPipe files are requested during live video analysis on check.html.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

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

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      resolve(server);
    });
  });
}

async function inspectEngine(engineName, engineType) {
  const browser = await engineType.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/mediapipe/')) {
      requests.push(url.split('/mediapipe/')[1].split('?')[0]);
    }
  });

  console.log(`[${engineName}] Navigating to check.html...`);
  await page.goto(`http://localhost:${PORT}/workout-vision/check.html`, { waitUntil: 'domcontentloaded' });

  // Run the first bundled demo clip
  const runDemoBtn = page.locator('#run-demo');
  if (await runDemoBtn.isVisible()) {
    console.log(`[${engineName}] Running bundled demo clip...`);
    await runDemoBtn.click();
    // Wait for at least one clip result or timeout
    try {
      await page.waitForFunction(() => {
        const out = document.querySelector('.demo-row .out');
        return out && out.textContent && out.textContent.length > 20;
      }, { timeout: 45000 });
      console.log(`[${engineName}] Demo clip completed analysis.`);
    } catch (e) {
      console.log(`[${engineName}] Timed out waiting for full clip, but requests were captured.`);
    }
  }

  await browser.close();
  return requests;
}

async function main() {
  const server = await startServer();
  try {
    console.log(`Server listening at http://localhost:${PORT}`);
    const chromiumReqs = await inspectEngine('Chromium', chromium);
    const webkitReqs = await inspectEngine('WebKit', webkit);

    console.log('\n--- Network Summary for MediaPipe Files ---');
    console.log('Chromium requested:', [...new Set(chromiumReqs)]);
    console.log('WebKit requested:', [...new Set(webkitReqs)]);

    const moduleRequested = [...chromiumReqs, ...webkitReqs].some(f => f.includes('vision_wasm_module_internal'));
    console.log('\nWas vision_wasm_module_internal ever requested?:', moduleRequested);
  } finally {
    server.close();
  }
}

main().catch(console.error);
