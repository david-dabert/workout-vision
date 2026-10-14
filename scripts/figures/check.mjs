#!/usr/bin/env node
/**
 * scripts/figures/check.mjs
 * 
 * Verifies generated figures:
 * 1. Counts specs in test/real-phone/synth/motions/ and SVG files written in public/figures/.
 * 2. Computes SHA-256 of all SVG files, counts distinct hashes, and lists all duplicate exceptions by name.
 * 3. Chooses 20 keys with a fixed seed and calculates the largest distance between drawn joints
 *    and their projected landmarks (verifying it is strictly under 0.5 px).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderExerciseFigures } from './render.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MOTIONS_DIR = path.join(REPO_ROOT, 'test/real-phone/synth/motions');
const FIGURES_DIR = path.join(REPO_ROOT, 'public/figures');

// Simple deterministic PRNG (Linear Congruential Generator)
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function parseJointsFromSvg(svgContent) {
  const joints = {};
  // Extract line endpoints
  const lineRegex = /<line\s+[^>]*data-joint="([^"]+)"[^>]*x1="([^"]+)"\s+y1="([^"]+)"\s+x2="([^"]+)"\s+y2="([^"]+)"/g;
  let match;
  while ((match = lineRegex.exec(svgContent)) !== null) {
    const [_, jointPair, x1, y1, x2, y2] = match;
    const [j1, j2] = jointPair.split(',');
    joints[j1] = { x: parseFloat(x1), y: parseFloat(y1) };
    joints[j2] = { x: parseFloat(x2), y: parseFloat(y2) };
  }
  // Extract circle center
  const circleRegex = /<circle\s+[^>]*data-joint="([^"]+)"[^>]*cx="([^"]+)"\s+cy="([^"]+)"/g;
  while ((match = circleRegex.exec(svgContent)) !== null) {
    const [_, j, cx, cy] = match;
    joints[j] = { x: parseFloat(cx), y: parseFloat(cy) };
  }
  return joints;
}

async function main() {
  const specFiles = fs.readdirSync(MOTIONS_DIR).filter(f => f.endsWith('.json')).sort();
  const svgFiles = fs.readdirSync(FIGURES_DIR).filter(f => f.endsWith('.svg')).sort();

  console.log('=== Exercise Figures Verification ===');
  console.log(`Number of specs: ${specFiles.length}`);
  console.log(`Number of SVG files written: ${svgFiles.length}`);

  // 1. Check distinct files by SHA-256
  const hashToFiles = new Map();
  for (const svgFile of svgFiles) {
    const content = fs.readFileSync(path.join(FIGURES_DIR, svgFile), 'utf8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (!hashToFiles.has(hash)) {
      hashToFiles.set(hash, []);
    }
    hashToFiles.get(hash).push(svgFile);
  }

  const distinctCount = hashToFiles.size;
  console.log(`\nDistinct files by SHA-256: ${distinctCount} / ${svgFiles.length}`);

  const exceptions = [];
  for (const [hash, group] of hashToFiles.entries()) {
    if (group.length > 1) {
      exceptions.push(group);
    }
  }

  if (exceptions.length > 0) {
    console.log(`\nExceptions (${exceptions.length} identical SVG groups):`);
    for (const group of exceptions) {
      console.log(`  - [SHA: ${group[0].split('.')[0]}...] ${group.join(', ')}`);
    }
  } else {
    console.log('\nAll SVG files are completely distinct by SHA-256.');
  }

  // 2. Fixed-seed 20 keys joint distance check
  const SEED = 20261014;
  const rand = seededRandom(SEED);

  // Shuffle and pick 20 keys
  const keys = specFiles.map(f => f.replace(/\.json$/, ''));
  const shuffled = [...keys];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sampleKeys = shuffled.slice(0, 20);

  console.log(`\nVerifying drawn joint coordinates for 20 sample keys (seed: ${SEED}):`);
  let maxGlobalDist = 0;
  const sampleReports = [];

  for (const key of sampleKeys) {
    const spec = JSON.parse(fs.readFileSync(path.join(MOTIONS_DIR, `${key}.json`), 'utf8'));
    const rendered = renderExerciseFigures(spec, key);

    for (const tag of ['start', 'end']) {
      const svgPath = path.join(FIGURES_DIR, `${key}-${tag}.svg`);
      const svgContent = fs.readFileSync(svgPath, 'utf8');
      const drawnJoints = parseJointsFromSvg(svgContent);

      const ref = rendered[tag];
      const scale = ref.scale;
      const cx = ref.cx;
      const cy = ref.cy;
      const proj = ref.proj;

      // Compare every numeric joint landmark
      for (let j = 0; j < proj.length; j++) {
        if (!proj[j] || !drawnJoints[j]) continue;
        const expectedX = 120 + (proj[j].x - cx) * scale;
        const expectedY = 120 + (proj[j].y - cy) * scale;

        const drawnX = drawnJoints[j].x;
        const drawnY = drawnJoints[j].y;

        const dist = Math.hypot(drawnX - expectedX, drawnY - expectedY);
        if (dist > maxGlobalDist) {
          maxGlobalDist = dist;
        }
      }
    }
    sampleReports.push(key);
  }

  console.log(`  Sample keys checked: ${sampleReports.join(', ')}`);
  console.log(`  Largest distance between drawn joint and projected landmark: ${maxGlobalDist.toFixed(4)} px`);
  if (maxGlobalDist < 0.5) {
    console.log(`  -> PASS: Largest distance (${maxGlobalDist.toFixed(4)} px) is under 0.5 px threshold.`);
  } else {
    console.error(`  -> FAIL: Largest distance (${maxGlobalDist.toFixed(4)} px) exceeds 0.5 px threshold!`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in check.mjs:', err);
  process.exit(1);
});
