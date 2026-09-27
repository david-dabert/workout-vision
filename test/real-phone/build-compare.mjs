/**
 * Automated build comparison: run every approved clip through two
 * production builds (baseline and candidate) in Chrome, compare counts.
 *
 * Usage:
 *   node test/real-phone/build-compare.mjs <baseline-ref> <candidate-ref>
 *
 * Example:
 *   node test/real-phone/build-compare.mjs 91aa10a 91ec236
 *
 * For each ref it:
 *   1. Checks out the ref in a temporary worktree
 *   2. Runs npm ci && npx vite build
 *   3. Starts a vite preview server on a unique port
 *   4. Runs each approved clip through the app in Chrome via Playwright
 *   5. Collects count, sample count, console errors
 *   6. Tears down the worktree
 *
 * Then prints a side-by-side table and exits non-zero if any count differs.
 */
import { chromium } from '@playwright/test';
import { resolve, join } from 'node:path';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';

const CLIPS = [
  { file: 'bicep_curl_7_side_mufhf3wy',     lift: 'bicep_curl',    label: 'Curl biceps',           expected: 7 },
  { file: 'lateral_raise_10_front_mufhhbun', lift: 'lateral_raise', label: 'Élévations latérales',  expected: 10 },
  { file: 'lat_pulldown_10_front_mufhlh4o',  lift: 'lat_pulldown',  label: 'Tirage vertical',       expected: 10 },
];

const [baseRef, candRef] = process.argv.slice(2);
if (!baseRef || !candRef) {
  console.error('Usage: node build-compare.mjs <baseline-ref> <candidate-ref>');
  process.exit(1);
}

const repoRoot = resolve('.');
const outDir = resolve('test/real-phone/step3d');
mkdirSync(outDir, { recursive: true });

async function buildInWorktree(ref, port) {
  const label = ref.slice(0, 8);
  const wtDir = join(repoRoot, `.worktree-${label}`);

  console.log(`\n[${label}] Creating worktree...`);
  try { execFileSync('git', ['worktree', 'remove', '--force', wtDir], { cwd: repoRoot, stdio: 'pipe' }); } catch {}
  execFileSync('git', ['worktree', 'add', '--detach', wtDir, ref], { cwd: repoRoot, stdio: 'pipe' });

  console.log(`[${label}] Installing dependencies...`);
  execFileSync('npm', ['ci'], { cwd: wtDir, stdio: 'pipe', timeout: 120000 });

  // If counting is paused, temporarily disable it for the test
  const pauseFile = join(wtDir, 'src/lib/countingPause.js');
  if (existsSync(pauseFile)) {
    writeFileSync(pauseFile, 'export const COUNTING_PAUSED = false;\n');
    console.log(`[${label}] Disabled counting pause for test.`);
  }

  console.log(`[${label}] Building...`);
  execFileSync('npx', ['vite', 'build'], { cwd: wtDir, stdio: 'pipe', timeout: 120000 });

  console.log(`[${label}] Starting preview on port ${port}...`);
  const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: wtDir, stdio: 'pipe' });
  await new Promise(r => setTimeout(r, 2000));

  return { wtDir, preview, port, label };
}

async function runClips(buildInfo) {
  const { port, label } = buildInfo;
  const base = `http://127.0.0.1:${port}/workout-vision/`;
  const results = [];

  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    for (const clip of CLIPS) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

      await page.addInitScript(() => {
        localStorage.setItem('wv_seen_entry', 'true');
        localStorage.setItem('wv_lang', 'fr');
        window.__coreOutput = null;
        window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
      });

      await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });

      // Find and click the lift
      const altar = page.locator('.altar', { hasText: clip.label }).first();
      try {
        await altar.waitFor({ state: 'visible', timeout: 5000 });
        await altar.click();
      } catch {
        // Lift may not be offered (e.g. paused or different UI version)
        results.push({ clip: clip.file, lift: clip.lift, expected: clip.expected, count: null, samples: null, errors: ['Lift not found in UI: ' + clip.label], status: 'SKIP' });
        await ctx.close();
        continue;
      }

      const input = page.locator('.film-screen input[type="file"]').last();
      try {
        await input.waitFor({ state: 'attached', timeout: 10000 });
      } catch {
        results.push({ clip: clip.file, lift: clip.lift, expected: clip.expected, count: null, samples: null, errors: ['No file input (counting paused?)'], status: 'PAUSED' });
        await ctx.close();
        continue;
      }

      await input.setInputFiles(resolve(`test/real-phone/clips/${clip.file}.mov`));
      console.log(`  [${label}] ${clip.file}: analysing...`);

      await page.waitForFunction(() => window.__coreOutput || document.querySelector('.refused-title'), null, { timeout: 300000 });

      const failed = await page.evaluate(() => window.__coreOutput ? null : document.querySelector('.refused-title')?.textContent);
      if (failed) {
        results.push({ clip: clip.file, lift: clip.lift, expected: clip.expected, count: null, samples: null, errors: ['Refused: ' + failed, ...errors], status: 'REFUSED' });
      } else {
        const r = await page.evaluate(() => {
          const o = window.__coreOutput;
          return { count: o.count, samples: o.worldLandmarks.length };
        });
        results.push({ clip: clip.file, lift: clip.lift, expected: clip.expected, count: r.count, samples: r.samples, errors, status: 'OK' });
        console.log(`  [${label}] ${clip.file}: count=${r.count} (expected ${clip.expected}), ${r.samples} samples`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  return results;
}

function cleanup(buildInfo) {
  buildInfo.preview.kill();
  try { execFileSync('git', ['worktree', 'remove', '--force', buildInfo.wtDir], { cwd: repoRoot, stdio: 'pipe' }); } catch {}
}

// --- Main ---
console.log(`Comparing ${baseRef} (baseline) vs ${candRef} (candidate)`);
console.log(`Clips: ${CLIPS.map(c => c.file).join(', ')}`);

const baseBuild = await buildInWorktree(baseRef, 4180);
const candBuild = await buildInWorktree(candRef, 4181);

let baseResults, candResults;
try {
  console.log(`\n--- Running clips on baseline (${baseBuild.label}) ---`);
  baseResults = await runClips(baseBuild);
  console.log(`\n--- Running clips on candidate (${candBuild.label}) ---`);
  candResults = await runClips(candBuild);
} finally {
  cleanup(baseBuild);
  cleanup(candBuild);
}

// --- Report ---
console.log('\n' + '='.repeat(70));
console.log('COMPARISON TABLE');
console.log('='.repeat(70));
console.log(`| Clip | Expected | ${baseBuild.label} | ${candBuild.label} | Match |`);
console.log('|---|---:|---:|---:|---|');

let anyDiff = false;
for (let i = 0; i < CLIPS.length; i++) {
  const b = baseResults[i], c = candResults[i];
  const bStr = b.status === 'OK' ? String(b.count) : b.status;
  const cStr = c.status === 'OK' ? String(c.count) : c.status;
  const match = b.count === c.count ? '✓' : '✗';
  if (b.count !== c.count) anyDiff = true;
  console.log(`| ${CLIPS[i].file} | ${CLIPS[i].expected} | ${bStr} | ${cStr} | ${match} |`);
}

const report = {
  baseline: { ref: baseRef, label: baseBuild.label, results: baseResults },
  candidate: { ref: candRef, label: candBuild.label, results: candResults },
  verdict: anyDiff ? 'DIFFER' : 'MATCH',
};
writeFileSync(`${outDir}/build-compare.json`, JSON.stringify(report, null, 2));

console.log(`\nVerdict: ${report.verdict}`);
if (anyDiff) {
  console.log('\nDifferences:');
  for (let i = 0; i < CLIPS.length; i++) {
    if (baseResults[i].count !== candResults[i].count) {
      console.log(`  ${CLIPS[i].file}: baseline=${baseResults[i].count}, candidate=${candResults[i].count}`);
      if (candResults[i].errors.length) console.log(`    Candidate errors: ${candResults[i].errors.join('; ')}`);
    }
  }
}
console.log(`Report: ${outDir}/build-compare.json`);
process.exit(anyDiff ? 1 : 0);
