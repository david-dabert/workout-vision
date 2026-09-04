/**
 * copy-models.js — Copy MediaPipe WASM files from node_modules to public/
 * so they can be served locally instead of fetched from CDN at runtime.
 *
 * Run: node scripts/copy-models.js
 * Or automatically via: npm run prebuild
 *
 * TODO (runtime code changes needed to use local files):
 *   1. In src/lib/poseAnalysis.js:
 *      - Change VISION_WASM from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
 *        to '/workout-vision/mediapipe' (matching vite base path)
 *      - Change the CDN import in getMediaPipeVision() to import from node_modules
 *        (or keep the CDN import with a local fallback)
 *
 *   2. In src/lib/poseWorker.js:
 *      - Change WASM_URL from CDN to '/workout-vision/mediapipe'
 *      - Change the CDN import in loadMediaPipe() similarly
 *
 *   3. In src/lib/frameExtractor.js:
 *      - Change baseURL from 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
 *        to a local path if @ffmpeg/core is installed locally
 *      - Note: @ffmpeg/core is NOT currently in package.json; install it first
 *        with: npm install @ffmpeg/core@0.12.6
 */

import { existsSync, mkdirSync, cpSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const COPIES = [
  {
    name: 'MediaPipe tasks-vision WASM',
    src: join(ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
    dest: join(ROOT, 'public', 'mediapipe'),
  },
  // Uncomment after running: npm install @ffmpeg/core@0.12.6
  // {
  //   name: 'ffmpeg-core WASM',
  //   src: join(ROOT, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm'),
  //   dest: join(ROOT, 'public', 'ffmpeg'),
  // },
];

let exitCode = 0;

for (const { name, src, dest } of COPIES) {
  if (!existsSync(src)) {
    console.warn(`[copy-models] WARN: ${name} source not found at ${src}`);
    console.warn(`[copy-models]       Run 'npm install' and try again.`);
    exitCode = 0; // warn but don't fail the build
    continue;
  }

  mkdirSync(dest, { recursive: true });

  try {
    cpSync(src, dest, { recursive: true });
    const files = readdirSync(dest);
    console.log(`[copy-models] OK: ${name} -> ${dest} (${files.length} files)`);
  } catch (err) {
    console.error(`[copy-models] ERROR copying ${name}: ${err.message}`);
    exitCode = 1;
  }
}

process.exit(exitCode);
