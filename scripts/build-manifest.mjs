#!/usr/bin/env node
/**
 * Build test/real-phone/manifest.json from clips in ~/Desktop/wv-clips/.
 *
 * Naming convention: lift_truecount_view.mov
 *   e.g. bench_press_5_front.mov, bicep_curl_10_side.mov
 *
 * Also copies clips to test/real-phone/clips/ for self-contained operation.
 *
 * R1 applies: never change a label, never delete a clip.
 *
 * Usage:
 *   node scripts/build-manifest.mjs
 *   node scripts/build-manifest.mjs --source ~/Desktop/wv-clips
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_SOURCE = join(process.env.HOME, 'Desktop', 'wv-clips');
const REAL_PHONE_DIR = join(ROOT, 'test', 'real-phone');
const CLIPS_DIR = join(REAL_PHONE_DIR, 'clips');
const MANIFEST_PATH = join(REAL_PHONE_DIR, 'manifest.json');

// Parse CLI args
const args = process.argv.slice(2);
let sourceDir = DEFAULT_SOURCE;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--source' && args[i + 1]) sourceDir = args[i + 1];
}

if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  console.error('David needs to film clips and place them in ~/Desktop/wv-clips/');
  console.error('Naming: lift_truecount_view.mov (e.g. bench_press_5_front.mov)');
  process.exit(1);
}

const VIDEO_EXTS = new Set(['.mov', '.mp4', '.webm', '.m4v']);

const files = readdirSync(sourceDir)
  .filter(f => VIDEO_EXTS.has(extname(f).toLowerCase()))
  .sort();

if (files.length === 0) {
  console.error(`No video files found in ${sourceDir}`);
  process.exit(1);
}

console.log(`\n  Build Real-Phone Manifest`);
console.log(`  Source: ${sourceDir}`);
console.log(`  Files: ${files.length}\n`);

mkdirSync(CLIPS_DIR, { recursive: true });

const clips = [];
const errors = [];

for (const file of files) {
  const name = basename(file, extname(file));
  // Parse: everything_before_last_two_parts is the lift,
  // second-to-last is count, last is view
  const parts = name.split('_');

  if (parts.length < 3) {
    errors.push(`${file}: cannot parse — need lift_count_view (got ${parts.length} parts)`);
    continue;
  }

  const view = parts.pop();
  const countStr = parts.pop();
  const lift = parts.join('_');
  const count = parseInt(countStr, 10);

  if (isNaN(count)) {
    errors.push(`${file}: cannot parse rep count from "${countStr}"`);
    continue;
  }

  if (!lift) {
    errors.push(`${file}: empty lift name`);
    continue;
  }

  // Copy clip to test/real-phone/clips/
  const srcPath = join(sourceDir, file);
  const dstPath = join(CLIPS_DIR, file);
  const srcStat = statSync(srcPath);

  if (!existsSync(dstPath) || statSync(dstPath).size !== srcStat.size) {
    copyFileSync(srcPath, dstPath);
    console.log(`  Copied: ${file} (${(srcStat.size / 1024 / 1024).toFixed(1)} MB)`);
  } else {
    console.log(`  Exists: ${file}`);
  }

  clips.push({
    file,
    exercise: lift,
    reps: count,
    view,
    source: 'david-phone',
    addedAt: new Date().toISOString().slice(0, 10),
  });
}

if (errors.length > 0) {
  console.log(`\n  PARSE ERRORS (${errors.length}):`);
  for (const e of errors) console.log(`    ${e}`);
}

// Build manifest — preserve any existing clips not in this batch (R1: never delete)
let existingClips = [];
if (existsSync(MANIFEST_PATH)) {
  const existing = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  existingClips = existing.clips || [];
}

// Merge: new clips override existing ones with same filename
const byFile = new Map();
for (const c of existingClips) byFile.set(c.file, c);
for (const c of clips) byFile.set(c.file, c);

const manifest = {
  name: 'WorkoutVision Real-Phone Benchmark',
  description: 'Clips filmed by David on his iPhone, with human-counted ground truth.',
  source: 'david-phone',
  rule: 'R1: never modify a label, never delete a clip, labels come from David only.',
  clips: [...byFile.values()].sort((a, b) => a.file.localeCompare(b.file)),
};

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

console.log(`\n  Manifest: ${manifest.clips.length} clips total`);
console.log(`  Saved: ${MANIFEST_PATH}`);

// Summary by lift
const byLift = {};
for (const c of manifest.clips) {
  if (!byLift[c.exercise]) byLift[c.exercise] = 0;
  byLift[c.exercise]++;
}
console.log('\n  Per lift:');
for (const [lift, n] of Object.entries(byLift).sort()) {
  console.log(`    ${lift.padEnd(20)} ${n} clips`);
}
