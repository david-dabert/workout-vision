#!/usr/bin/env node
/**
 * scripts/figures/render.mjs
 * 
 * Generates exercise figures directly from the 309 motion specs in test/real-phone/synth/motions/.
 * 
 * For each spec:
 * - Computes MediaPipe 3D landmarks via specLandmarks (test/real-phone/template/fk.js)
 *   at u = 0 (start), u = 1 (end), and u = 0.5 (mid, if spec.mid exists).
 * - Projects them orthographically onto the plane given by the spec's view (0 = front, 90 = side).
 * - Slices and scales uniformly across poses into a 240x240 canvas.
 * - Draws limbs as rounded strokes (stroke="#E8C17A", stroke-width="3", stroke-linecap="round").
 * - Draws the head as a circle sized from 3D shoulder width.
 * - Draws a ground / support line placed from the spec's support or anchor field.
 * - Writes public/figures/<key>-start.svg, <key>-end.svg, and <key>-mid.svg.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { specLandmarks } from '../../test/real-phone/template/fk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MOTIONS_DIR = path.join(REPO_ROOT, 'test/real-phone/synth/motions');
const FAMILIES_PATH = path.join(REPO_ROOT, 'src/lib/counting/guide-families.json');
const OUT_DIR = path.join(REPO_ROOT, 'public/figures');

const FAMILIES = JSON.parse(fs.readFileSync(FAMILIES_PATH, 'utf8'));

// MediaPipe joint connections for human limbs
export const LIMB_CONNECTIONS = [
  // Torso / shoulders / hips
  { from: 11, to: 12, name: 'shoulders' },
  { from: 23, to: 24, name: 'hips' },
  { from: 'mid_shoulder', to: 'mid_hip', name: 'spine' },
  { from: 'mid_shoulder', to: 0, name: 'neck' },
  // Left arm
  { from: 11, to: 13, name: 'left_upper_arm' },
  { from: 13, to: 15, name: 'left_forearm' },
  // Right arm
  { from: 12, to: 14, name: 'right_upper_arm' },
  { from: 14, to: 16, name: 'right_forearm' },
  // Left leg
  { from: 23, to: 25, name: 'left_thigh' },
  { from: 25, to: 27, name: 'left_shank' },
  { from: 27, to: 31, name: 'left_foot' },
  { from: 27, to: 29, name: 'left_heel' },
  // Right leg
  { from: 24, to: 26, name: 'right_thigh' },
  { from: 26, to: 28, name: 'right_shank' },
  { from: 28, to: 32, name: 'right_foot' },
  { from: 28, to: 30, name: 'right_heel' },
];

export function getSpecView(spec, key) {
  if (spec.view !== undefined && spec.view !== null) return spec.view;
  const fam = FAMILIES[key];
  if (fam && fam.view === 'front') return 0;
  return 90;
}

export function projectLandmarks(lms, viewAngle) {
  const theta = (viewAngle * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return lms.map(p => {
    if (!p) return null;
    return {
      x: p.x * cosT - p.z * sinT,
      y: p.y,
      z: p.x * sinT + p.z * cosT,
    };
  });
}

function computeSupportY(proj, anchor) {
  if (anchor === 'hands') {
    const hands = [proj[15], proj[16]].filter(Boolean);
    return hands.length ? Math.min(...hands.map(h => h.y)) : 0;
  }
  if (anchor === 'hips') {
    const hips = [proj[23], proj[24]].filter(Boolean);
    return hips.length ? Math.max(...hips.map(h => h.y)) : 0;
  }
  if (anchor === 'lowest') {
    const valid = proj.filter(Boolean);
    return valid.length ? Math.max(...valid.map(p => p.y)) : 0;
  }
  // Default 'feet'
  const feet = [proj[27], proj[28], proj[29], proj[30], proj[31], proj[32]].filter(Boolean);
  if (feet.length) return Math.max(...feet.map(p => p.y));
  const valid = proj.filter(Boolean);
  return valid.length ? Math.max(...valid.map(p => p.y)) : 0;
}

export function renderSvg(poseProj, scale, cx, cy, supportY, headRadius) {
  const toCanvas = (x, y) => ({
    x: parseFloat((120 + (x - cx) * scale).toFixed(2)),
    y: parseFloat((120 + (y - cy) * scale).toFixed(2)),
  });

  // Calculate mid-shoulder and mid-hip
  const points = { ...poseProj };
  if (poseProj[11] && poseProj[12]) {
    points.mid_shoulder = {
      x: (poseProj[11].x + poseProj[12].x) / 2,
      y: (poseProj[11].y + poseProj[12].y) / 2,
    };
  }
  if (poseProj[23] && poseProj[24]) {
    points.mid_hip = {
      x: (poseProj[23].x + poseProj[24].x) / 2,
      y: (poseProj[23].y + poseProj[24].y) / 2,
    };
  }

  const canvasPoints = {};
  for (const [k, p] of Object.entries(points)) {
    if (p) canvasPoints[k] = toCanvas(p.x, p.y);
  }

  const elements = [];

  // 1. Ground line
  const groundY = toCanvas(0, supportY).y;
  // Span across the body plus margin
  const xs = Object.values(canvasPoints).map(p => p.x);
  const minX = xs.length ? Math.min(...xs) - 20 : 60;
  const maxX = xs.length ? Math.max(...xs) + 20 : 180;
  elements.push(`  <line data-role="ground" x1="${minX.toFixed(2)}" y1="${groundY.toFixed(2)}" x2="${maxX.toFixed(2)}" y2="${groundY.toFixed(2)}" />`);

  // 2. Limbs
  for (const conn of LIMB_CONNECTIONS) {
    const p1 = canvasPoints[conn.from];
    const p2 = canvasPoints[conn.to];
    if (p1 && p2) {
      elements.push(`  <line data-joint="${conn.from},${conn.to}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" />`);
    }
  }

  // 3. Head circle
  if (canvasPoints[0]) {
    const head = canvasPoints[0];
    const r = parseFloat(headRadius.toFixed(2));
    elements.push(`  <circle data-joint="0" cx="${head.x}" cy="${head.y}" r="${r}" />`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" fill="none" stroke="#E8C17A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
${elements.join('\n')}
</svg>
`;
}

export function renderExerciseFigures(spec, key) {
  const view = getSpecView(spec, key);
  const anchor = spec.support?.anchor || 'feet';

  const poses = [
    { u: 0, tag: 'start' },
    { u: 1, tag: 'end' },
  ];
  if (spec.mid) {
    poses.push({ u: 0.5, tag: 'mid' });
  }

  // Compute 3D landmarks and projected 2D coordinates for all poses
  const computedPoses = poses.map(p => {
    const raw = specLandmarks(spec, p.u);
    const proj = projectLandmarks(raw, view);
    const supY = computeSupportY(proj, anchor);
    return { ...p, raw, proj, supY };
  });

  // Calculate shared bounding box across all poses of this exercise
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cp of computedPoses) {
    for (const lm of cp.proj) {
      if (!lm) continue;
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    // Include ground line
    if (cp.supY < minY) minY = cp.supY;
    if (cp.supY > maxY) maxY = cp.supY;
  }

  // Include 3D head radius extent around nose
  const shoulderWidth3D = 0.36; // 2 * shoulderHalf (0.18 m)
  const headRadiusMetres = shoulderWidth3D * 0.28; // ~0.10 m
  minY -= headRadiusMetres;
  minX -= headRadiusMetres;
  maxX += headRadiusMetres;

  const width = Math.max(maxX - minX, 0.1);
  const height = Math.max(maxY - minY, 0.1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // Scale to fit within 240x240 with 25 px padding (190 px usable box)
  const PADDING = 25;
  const usable = 240 - 2 * PADDING;
  const scale = usable / Math.max(width, height);
  const headRadiusPx = headRadiusMetres * scale;

  const results = {};
  for (const cp of computedPoses) {
    const svg = renderSvg(cp.proj, scale, cx, cy, cp.supY, headRadiusPx);
    results[cp.tag] = {
      svg,
      proj: cp.proj,
      scale,
      cx,
      cy,
      supY: cp.supY,
      headRadiusPx,
    };
  }

  return results;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(MOTIONS_DIR).filter(f => f.endsWith('.json')).sort();
  console.log(`Processing ${files.length} motion specs...`);

  let fileCount = 0;
  for (const file of files) {
    const key = file.replace(/\.json$/, '');
    const spec = JSON.parse(fs.readFileSync(path.join(MOTIONS_DIR, file), 'utf8'));

    const rendered = renderExerciseFigures(spec, key);
    for (const [tag, res] of Object.entries(rendered)) {
      const outPath = path.join(OUT_DIR, `${key}-${tag}.svg`);
      fs.writeFileSync(outPath, res.svg, 'utf8');
      fileCount++;
    }
  }

  console.log(`Done. Generated ${fileCount} SVG figures in ${OUT_DIR}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Fatal error in render.mjs:', err);
    process.exit(1);
  });
}
