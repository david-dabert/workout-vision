#!/usr/bin/env tsx
/**
 * scripts/benchmarks/count_rehab_sets.ts
 *
 * Evaluates WorkoutVision's core counter against IntelliRehabDS continuous session sets.
 * Calls summarizeCount directly from src/lib/coreAnalysis, exactly as test/real-phone/accuracy/ does.
 *
 * Generates:
 * - data/benchmarks/intellirehabds/results.json
 * - data/benchmarks/intellirehabds/REPORT.md
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeCount } from '../../src/lib/coreAnalysis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '../..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'data/benchmarks/intellirehabds/manifest.json');
const RESULTS_PATH = resolve(REPO_ROOT, 'data/benchmarks/intellirehabds/results.json');
const REPORT_PATH = resolve(REPO_ROOT, 'data/benchmarks/intellirehabds/REPORT.md');

const REPRODUCTION_COMMAND = 'npx tsx scripts/benchmarks/count_rehab_sets.ts';

// 95% Wilson score interval
function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 0];
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const mid = (p + z2 / (2 * n)) / d, half = (z / d) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}

function pct(x: number): string {
  return (100 * x).toFixed(1);
}

interface ManifestSession {
  id: string;
  exercise: string;
  gestureId: number;
  gestureName: string;
  subject: number;
  posture: string;
  trueCount: number;
  totalReps: number;
  samples: number;
  durationSec: number;
  file: string;
  fileSizeBytes: number;
  sourceFiles: string[];
}

interface Manifest {
  dataset: string;
  doi: string;
  citation: string;
  license: string;
  generatedAt: string;
  totalSessions: number;
  discontinuousSessionsCount: number;
  totalSizeBytes: number;
  mappedGestures: Record<string, { exercise: string; name: string }>;
  skippedGestures: Record<string, { name: string; reason: string }>;
  sessions: ManifestSession[];
}

interface EvalResult {
  id: string;
  exercise: string;
  gestureId: number;
  gestureName: string;
  subject: number;
  posture: string;
  trueCount: number;
  totalReps: number;
  appCount: number | null;
  refused: boolean;
  diff: number | null;
  samples: number;
  durationSec: number;
}

function runBenchmark() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  console.log(`Evaluating ${manifest.sessions.length} continuous sessions...`);

  const results: EvalResult[] = [];

  for (const s of manifest.sessions) {
    const fullPath = resolve(REPO_ROOT, 'data/benchmarks/intellirehabds', s.file);
    if (!existsSync(fullPath)) {
      console.warn(`File not found: ${fullPath}`);
      continue;
    }

    const rawGz = readFileSync(fullPath);
    const setRecord = JSON.parse(gunzipSync(rawGz).toString());

    const wl = setRecord.worldLandmarks;
    const ts = setRecord.timestamps;
    const lift = s.exercise;

    // Call summarizeCount exactly as real-phone/accuracy does
    const res: any = summarizeCount(wl, ts, lift);

    const refused = Boolean(res.refused);
    const appCount = refused ? null : (typeof res.count === 'number' ? res.count : null);
    const diff = (appCount !== null && typeof appCount === 'number') ? (appCount - s.trueCount) : null;

    results.push({
      id: s.id,
      exercise: s.exercise,
      gestureId: s.gestureId,
      gestureName: s.gestureName,
      subject: s.subject,
      posture: s.posture,
      trueCount: s.trueCount,
      totalReps: s.totalReps,
      appCount,
      refused,
      diff,
      samples: s.samples,
      durationSec: s.durationSec
    });
  }

  // Save raw results
  writeFileSync(RESULTS_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalEvaluated: results.length,
    results
  }, null, 2));
  console.log(`Results saved to ${RESULTS_PATH}`);

  // Generate REPORT.md
  generateReport(manifest, results);
}

function generateReport(manifest: Manifest, results: EvalResult[]) {
  const lines: string[] = [];

  lines.push('# IntelliRehabDS Physical Rehabilitation Benchmark Report');
  lines.push('');
  lines.push(`> **Reproduction Command**: \`${REPRODUCTION_COMMAND}\``);
  lines.push('> Benchmark of WorkoutVision core counting engine against continuous multi-repetition sessions from IntelliRehabDS (CC BY 4.0).');
  lines.push('');

  lines.push('## Overview');
  lines.push('');
  lines.push(`- **Dataset**: IntelliRehabDS (Zenodo DOI: [10.5281/zenodo.4610859](https://doi.org/10.5281/zenodo.4610859))`);
  lines.push(`- **Continuous Sessions Evaluated**: ${results.length}`);
  lines.push(`- **Discontinuous / Resetting Sessions Excluded**: ${manifest.discontinuousSessionsCount} (see \`data/benchmarks/intellirehabds/BLOCKED.md\`)`);
  lines.push(`- **Total Sets Gzipped Footprint**: ${(manifest.totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`);
  lines.push('');

  // 1. Summary by Mapped Exercise
  lines.push('## 1. Accuracy Summary by Mapped Exercise');
  lines.push('');
  lines.push('| Mapped Exercise | Gestures | Evaluated Sets | Exact Matches | Exact Share (95% Wilson) | Refused Sets | Mean Absolute Error | Total True Reps | Total Counted Reps |');
  lines.push('| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');

  const exercises = [...new Set(results.map(r => r.exercise))].sort();

  let grandTotalSets = 0;
  let grandExact = 0;
  let grandRefused = 0;
  let grandTrueReps = 0;
  let grandCountedReps = 0;
  let grandAbsErrSum = 0;

  for (const ex of exercises) {
    const exResults = results.filter(r => r.exercise === ex);
    const n = exResults.length;
    const exact = exResults.filter(r => !r.refused && r.diff === 0).length;
    const refused = exResults.filter(r => r.refused).length;
    const countedSets = exResults.filter(r => !r.refused && r.appCount !== null);
    
    const trueReps = exResults.reduce((sum, r) => sum + r.trueCount, 0);
    const countedReps = countedSets.reduce((sum, r) => sum + (r.appCount ?? 0), 0);
    const absErr = countedSets.reduce((sum, r) => sum + Math.abs(r.diff ?? 0), 0);
    const mae = countedSets.length > 0 ? (absErr / countedSets.length).toFixed(2) : 'N/A';

    const [lo, hi] = wilson(exact, n);
    const wilsonStr = `${exact}/${n} (${pct(exact/n)}%, ${pct(lo)}-${pct(hi)}%)`;

    const gestures = [...new Set(exResults.map(r => `G${r.gestureId}`))].join(', ');

    lines.push(`| \`${ex}\` | ${gestures} | ${n} | ${exact} | ${wilsonStr} | ${refused} | ${mae} | ${trueReps} | ${countedReps} |`);

    grandTotalSets += n;
    grandExact += exact;
    grandRefused += refused;
    grandTrueReps += trueReps;
    grandCountedReps += countedReps;
    grandAbsErrSum += absErr;
  }

  const [gLo, gHi] = wilson(grandExact, grandTotalSets);
  const grandWilsonStr = `${grandExact}/${grandTotalSets} (${pct(grandExact/grandTotalSets)}%, ${pct(gLo)}-${pct(gHi)}%)`;
  const grandMae = (grandTotalSets - grandRefused) > 0 ? (grandAbsErrSum / (grandTotalSets - grandRefused)).toFixed(2) : 'N/A';

  lines.push(`| **Overall** | **All Mapped** | **${grandTotalSets}** | **${grandExact}** | **${grandWilsonStr}** | **${grandRefused}** | **${grandMae}** | **${grandTrueReps}** | **${grandCountedReps}** |`);
  lines.push('');

  // 2. Error Distribution Table (Count - Truth)
  lines.push('## 2. Distribution of Error (Count − Truth)');
  lines.push('');
  lines.push('Distribution of deviations `(app_count - true_count)` across counted sets (refusals excluded):');
  lines.push('');

  // Collect all unique diff values
  const allDiffs = results.filter(r => !r.refused && r.diff !== null).map(r => r.diff as number);
  const minDiff = Math.min(...allDiffs, -3);
  const maxDiff = Math.max(...allDiffs, 3);

  const diffCols: number[] = [];
  for (let d = minDiff; d <= maxDiff; d++) {
    diffCols.push(d);
  }

  lines.push('| Exercise | Total Counted | ' + diffCols.map(d => `${d >= 0 ? '+' : ''}${d}`).join(' | ') + ' |');
  lines.push('| :--- | :---: | ' + diffCols.map(() => ':---:').join(' | ') + ' |');

  for (const ex of exercises) {
    const exCounted = results.filter(r => r.exercise === ex && !r.refused && r.diff !== null);
    const counts = diffCols.map(d => exCounted.filter(r => r.diff === d).length);
    lines.push(`| \`${ex}\` | ${exCounted.length} | ` + counts.map(c => String(c)).join(' | ') + ' |');
  }

  const allCounted = results.filter(r => !r.refused && r.diff !== null);
  const totalCounts = diffCols.map(d => allCounted.filter(r => r.diff === d).length);
  lines.push(`| **Total** | **${allCounted.length}** | ` + totalCounts.map(c => `**${c}**`).join(' | ') + ' |');
  lines.push('');

  // 3. Breakdown by Posture
  lines.push('## 3. Accuracy Breakdown by Patient Posture');
  lines.push('');
  lines.push('| Posture | Sessions | Exact Matches | Exact Share | Refused | Mean Error |');
  lines.push('| :--- | :---: | :---: | :---: | :---: | :---: |');

  const postures = [...new Set(results.map(r => r.posture))].sort();
  for (const pos of postures) {
    const posResults = results.filter(r => r.posture === pos);
    const n = posResults.length;
    const exact = posResults.filter(r => !r.refused && r.diff === 0).length;
    const refused = posResults.filter(r => r.refused).length;
    const counted = posResults.filter(r => !r.refused && r.diff !== null);
    const [lo, hi] = wilson(exact, n);
    const mae = counted.length > 0 ? (counted.reduce((a, b) => a + Math.abs(b.diff!), 0) / counted.length).toFixed(2) : 'N/A';
    lines.push(`| \`${pos}\` | ${n} | ${exact} | ${pct(exact/n)}% (${pct(lo)}-${pct(hi)}%) | ${refused} | ${mae} |`);
  }
  lines.push('');

  // 4. Skipped Gestures
  lines.push('## 4. Skipped Gestures');
  lines.push('');
  lines.push('The following dataset gestures were excluded from evaluation because the catalogue has no counter for their joint kinematics:');
  lines.push('');
  lines.push('| Gesture ID | Gesture Name | Reason for Exclusion |');
  lines.push('| :---: | :--- | :--- |');
  for (const [gid, ginfo] of Object.entries(manifest.skippedGestures)) {
    lines.push(`| ${gid} | ${ginfo.name} | ${ginfo.reason} |`);
  }
  lines.push('');

  writeFileSync(REPORT_PATH, lines.join('\n') + '\n');
  console.log(`REPORT written to ${REPORT_PATH}`);
}

runBenchmark();
