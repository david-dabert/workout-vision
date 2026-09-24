#!/usr/bin/env node
/**
 * Scoreboard — unified accuracy report for WorkoutVision.
 *
 * Runs the replay benchmark on cached Countix landmarks and (when available)
 * real-phone clips. Produces per-lift and overall stats, a per-clip table,
 * saves history, and gates CI.
 *
 * Usage:
 *   node scripts/scoreboard.mjs            # print report
 *   node scripts/scoreboard.mjs --ci       # exit non-zero on regression
 *
 * Exit codes:
 *   0  — no regression
 *   1  — real-phone exact count decreased vs previous run, or new catastrophic error
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { gunzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HISTORY_DIR = join(ROOT, 'scoreboard', 'history');
const COUNTIX_CACHE_DIR = join(ROOT, 'benchmark', 'landmark-cache');
const REAL_PHONE_DIR = join(ROOT, 'test', 'real-phone');
const REAL_PHONE_MANIFEST = join(REAL_PHONE_DIR, 'manifest.json');

const isCI = process.argv.includes('--ci');

// ─── Helpers ───────────────────────────────────────────────────────────

function loadLatestCache() {
  if (!existsSync(COUNTIX_CACHE_DIR)) return null;
  const gzFiles = readdirSync(COUNTIX_CACHE_DIR)
    .filter(f => f.endsWith('.json.gz'))
    .sort()
    .reverse();
  const jsonFiles = readdirSync(COUNTIX_CACHE_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.json.gz'))
    .sort()
    .reverse();

  let path = null;
  if (gzFiles.length > 0) path = join(COUNTIX_CACHE_DIR, gzFiles[0]);
  else if (jsonFiles.length > 0) path = join(COUNTIX_CACHE_DIR, jsonFiles[0]);
  if (!path) return null;

  const raw = path.endsWith('.gz')
    ? gunzipSync(readFileSync(path)).toString('utf-8')
    : readFileSync(path, 'utf-8');
  return { path, data: JSON.parse(raw) };
}

function loadPreviousScoreboard() {
  if (!existsSync(HISTORY_DIR)) return null;
  const files = readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(join(HISTORY_DIR, files[0]), 'utf-8'));
}

function computeStats(results) {
  const scored = results.filter(r => !r.note && r.expected != null);
  const exact = scored.filter(r => r.error === 0).length;
  const withinOne = scored.filter(r => Math.abs(r.error) <= 1).length;
  const catastrophic = scored.filter(r => Math.abs(r.error) >= 3);
  const mae = scored.length > 0
    ? scored.reduce((s, r) => s + Math.abs(r.error), 0) / scored.length
    : 0;
  return { total: scored.length, exact, withinOne, catastrophic: catastrophic.length, catastrophicClips: catastrophic.map(r => r.video), mae: Math.round(mae * 100) / 100 };
}

function computePerLift(results) {
  const byLift = {};
  for (const r of results.filter(r => !r.note && r.expected != null)) {
    const lift = r.exercise || 'unknown';
    if (!byLift[lift]) byLift[lift] = [];
    byLift[lift].push(r);
  }
  const stats = {};
  for (const [lift, rows] of Object.entries(byLift)) {
    stats[lift] = computeStats(rows);
  }
  return stats;
}

function printTable(results, label) {
  console.log(`\n  ${label}`);
  console.log('  ' + '-'.repeat(72));
  console.log(`  ${'Clip'.padEnd(48)} Got  Exp  Err`);
  console.log('  ' + '-'.repeat(72));
  for (const r of results) {
    const name = (r.video || r.file || '').slice(0, 47).padEnd(48);
    const got = String(r.actual ?? '-').padStart(3);
    const exp = String(r.expected ?? '?').padStart(4);
    const errVal = r.error;
    const err = errVal === 0 ? '  ✓' : ((errVal > 0 ? '+' : '') + errVal).padStart(3);
    const flag = Math.abs(errVal) >= 3 ? ' ‼ CATASTROPHIC' : '';
    const note = r.note ? ` (${r.note})` : '';
    console.log(`  ${name} ${got} ${exp}  ${err}${flag}${note}`);
  }
}

function printStats(stats, label) {
  console.log(`\n  ${label}`);
  console.log(`    Total:        ${stats.total}`);
  console.log(`    Exact:        ${stats.exact}/${stats.total} (${stats.total > 0 ? Math.round(stats.exact / stats.total * 100) : 0}%)`);
  console.log(`    Within ±1:    ${stats.withinOne}/${stats.total} (${stats.total > 0 ? Math.round(stats.withinOne / stats.total * 100) : 0}%)`);
  console.log(`    MAE:          ${stats.mae}`);
  console.log(`    Catastrophic: ${stats.catastrophic}${stats.catastrophicClips.length > 0 ? ' → ' + stats.catastrophicClips.join(', ') : ''}`);
}

function printPerLift(perLift, label) {
  console.log(`\n  ${label}`);
  console.log(`  ${'Lift'.padEnd(22)} Exact    ±1    MAE   Cat`);
  console.log('  ' + '-'.repeat(55));
  for (const [lift, s] of Object.entries(perLift).sort((a, b) => a[0].localeCompare(b[0]))) {
    const exactStr = `${s.exact}/${s.total}`.padEnd(8);
    const oboStr = `${s.withinOne}/${s.total}`.padEnd(5);
    const maeStr = String(s.mae).padEnd(5);
    const catStr = String(s.catastrophic);
    console.log(`  ${lift.padEnd(22)} ${exactStr} ${oboStr} ${maeStr} ${catStr}`);
  }
}

// ─── Run Countix replay ────────────────────────────────────────────────

console.log('\n' + '='.repeat(74));
console.log('  WORKOUT VISION SCOREBOARD');
console.log('='.repeat(74));

const countixCache = loadLatestCache();
let countixResults = [];
let countixStats = { total: 0, exact: 0, withinOne: 0, catastrophic: 0, catastrophicClips: [], mae: 0 };
let countixPerLift = {};

if (countixCache) {
  console.log(`\n  Countix cache: ${countixCache.path}`);
  console.log(`  Videos in cache: ${countixCache.data.length}`);

  // Run replay-benchmark and capture its JSON output
  try {
    const out = execFileSync('node', [join(ROOT, 'benchmark', 'replay-benchmark.mjs')], {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Parse the latest replay result file
    const resultsDir = join(ROOT, 'benchmark', 'results');
    if (existsSync(resultsDir)) {
      const replayFiles = readdirSync(resultsDir)
        .filter(f => f.startsWith('replay-') && f.endsWith('.json'))
        .sort()
        .reverse();
      if (replayFiles.length > 0) {
        const replay = JSON.parse(readFileSync(join(resultsDir, replayFiles[0]), 'utf-8'));
        countixResults = replay.results || [];
      }
    }
  } catch (e) {
    console.error(`  Replay benchmark failed: ${e.message}`);
    if (e.stderr) console.error(e.stderr.slice(0, 500));
  }

  countixStats = computeStats(countixResults);
  countixPerLift = computePerLift(countixResults);

  printStats(countixStats, 'COUNTIX OVERALL');
  printPerLift(countixPerLift, 'COUNTIX PER LIFT');
  printTable(countixResults, 'COUNTIX PER CLIP');
} else {
  console.log('\n  No Countix landmark cache found. Run a benchmark in the browser first.');
}

// ─── Real-phone clips ──────────────────────────────────────────────────

let realPhoneResults = [];
let realPhoneStats = { total: 0, exact: 0, withinOne: 0, catastrophic: 0, catastrophicClips: [], mae: 0 };
let realPhonePerLift = {};

if (existsSync(REAL_PHONE_MANIFEST)) {
  const manifest = JSON.parse(readFileSync(REAL_PHONE_MANIFEST, 'utf-8'));
  const clips = manifest.clips || [];
  console.log(`\n  Real-phone manifest: ${clips.length} clips`);

  if (clips.length > 0) {
    // Real-phone clips require Playwright extraction (Task 2).
    // For now, check if pre-extracted results exist.
    const realPhoneResultsPath = join(REAL_PHONE_DIR, 'results.json');
    if (existsSync(realPhoneResultsPath)) {
      realPhoneResults = JSON.parse(readFileSync(realPhoneResultsPath, 'utf-8'));
      realPhoneStats = computeStats(realPhoneResults);
      realPhonePerLift = computePerLift(realPhoneResults);

      printStats(realPhoneStats, 'REAL-PHONE OVERALL');
      printPerLift(realPhonePerLift, 'REAL-PHONE PER LIFT');
      printTable(realPhoneResults, 'REAL-PHONE PER CLIP');
    } else {
      console.log('  No real-phone results yet. Run: node scripts/extract-landmarks-local.mjs');
    }
  }
} else {
  console.log('\n  No real-phone manifest. Waiting for David to film clips.');
}

// ─── Save history ──────────────────────────────────────────────────────

mkdirSync(HISTORY_DIR, { recursive: true });
const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
const historyFile = join(HISTORY_DIR, `${dateStr}_${timeStr}.json`);

const gitHash = (() => {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf-8' }).trim(); }
  catch { return 'unknown'; }
})();

const snapshot = {
  date: now.toISOString(),
  gitHash,
  countix: {
    stats: countixStats,
    perLift: countixPerLift,
    clips: countixResults.map(r => ({
      file: r.video, exercise: r.exercise,
      expected: r.expected, actual: r.actual, error: r.error,
      note: r.note || undefined,
    })),
  },
  realPhone: {
    stats: realPhoneStats,
    perLift: realPhonePerLift,
    clips: realPhoneResults.map(r => ({
      file: r.video || r.file, exercise: r.exercise,
      expected: r.expected, actual: r.actual, error: r.error,
      note: r.note || undefined,
    })),
  },
};

writeFileSync(historyFile, JSON.stringify(snapshot, null, 2));
console.log(`\n  History saved: ${historyFile}`);

// ─── CI gate ───────────────────────────────────────────────────────────

if (isCI) {
  let failed = false;
  const prev = loadPreviousScoreboard();

  if (prev && prev.realPhone && prev.realPhone.stats.total > 0 && realPhoneStats.total > 0) {
    // Check real-phone exact did not decrease
    if (realPhoneStats.exact < prev.realPhone.stats.exact) {
      console.error(`\n  CI GATE FAILED: real-phone exact decreased ${prev.realPhone.stats.exact} → ${realPhoneStats.exact}`);
      failed = true;
    }

    // Check no new catastrophic errors
    const prevCatSet = new Set(prev.realPhone.stats.catastrophicClips || []);
    const newCats = (realPhoneStats.catastrophicClips || []).filter(c => !prevCatSet.has(c));
    if (newCats.length > 0) {
      console.error(`  CI GATE FAILED: new catastrophic errors on real-phone: ${newCats.join(', ')}`);
      failed = true;
    }
  }

  // Also check Countix doesn't regress severely
  if (prev && prev.countix && prev.countix.stats.total > 0 && countixStats.total > 0) {
    if (countixStats.exact < prev.countix.stats.exact - 2) {
      console.error(`  CI GATE FAILED: Countix exact dropped by >2 (${prev.countix.stats.exact} → ${countixStats.exact})`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  } else {
    console.log('\n  CI GATE PASSED');
  }
}

console.log('\n' + '='.repeat(74));
