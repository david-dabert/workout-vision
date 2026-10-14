#!/usr/bin/env tsx
/**
 * scripts/benchmarks/count_uiprmd_sets.ts
 *
 * Evaluates WorkoutVision's core counter against UI-PRMD benchmark sets.
 * Calls summarizeCount directly from src/lib/coreAnalysis, exactly as test/real-phone/accuracy/ does.
 *
 * Generates:
 * - data/benchmarks/ui-prmd/results.json
 * - data/benchmarks/ui-prmd/REPORT.md
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeCount } from '../../src/lib/coreAnalysis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = resolve(__dirname, '../..');
const MANIFEST_PATH = resolve(REPO_ROOT, 'data/benchmarks/ui-prmd/manifest.json');
const DOWNLOADS_MANIFEST_PATH = resolve(REPO_ROOT, 'data/benchmarks/ui-prmd/downloads_manifest.json');
const RESULTS_PATH = resolve(REPO_ROOT, 'data/benchmarks/ui-prmd/results.json');
const REPORT_PATH = resolve(REPO_ROOT, 'data/benchmarks/ui-prmd/REPORT.md');

const REPRODUCTION_COMMAND = 'npx tsx scripts/benchmarks/count_uiprmd_sets.ts';

function pct(x: number): string {
  return (100 * x).toFixed(1);
}

interface ManifestSet {
  id: string;
  movementCode: string;
  movementName: string;
  exercise: string;
  trueCount: number;
  samples: number;
  durationSec: number;
  file: string;
  fileSizeBytes: number;
  sourceFiles: string[];
}

interface Manifest {
  dataset: string;
  description: string;
  citation: string;
  license: string;
  commercialUse: string;
  generatedAt: string;
  totalSets: number;
  totalSizeBytes: number;
  mappedExercises: Record<string, { exercise: string; name: string; true_count: number }>;
  skippedMovements: Record<string, { name: string; reason: string }>;
  sets: ManifestSet[];
}

interface EvalResult {
  id: string;
  movementCode: string;
  movementName: string;
  exercise: string;
  trueCount: number;
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
  console.log(`Evaluating ${manifest.sets.length} UI-PRMD movement sets...`);

  const results: EvalResult[] = [];

  for (const s of manifest.sets) {
    const fullPath = resolve(REPO_ROOT, 'data/benchmarks/ui-prmd', s.file);
    if (!existsSync(fullPath)) {
      console.warn(`File not found: ${fullPath}`);
      continue;
    }

    const rawGz = readFileSync(fullPath);
    const setRecord = JSON.parse(gunzipSync(rawGz).toString());

    const wl = setRecord.worldLandmarks;
    const ts = setRecord.timestamps;
    const lift = s.exercise;

    const res: any = summarizeCount(wl, ts, lift);

    const refused = Boolean(res.refused);
    const appCount = refused ? null : (typeof res.count === 'number' ? res.count : null);
    const diff = (appCount !== null && typeof appCount === 'number') ? (appCount - s.trueCount) : null;

    results.push({
      id: s.id,
      movementCode: s.movementCode,
      movementName: s.movementName,
      exercise: s.exercise,
      trueCount: s.trueCount,
      appCount,
      refused,
      diff,
      samples: s.samples,
      durationSec: s.durationSec
    });
  }

  writeFileSync(RESULTS_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalEvaluated: results.length,
    results
  }, null, 2));
  console.log(`Results saved to ${RESULTS_PATH}`);

  generateReport(manifest, results);
}

function generateReport(manifest: Manifest, results: EvalResult[]) {
  const lines: string[] = [];

  lines.push('# UI-PRMD Physical Rehabilitation Benchmark Report');
  lines.push('');
  lines.push(`> **Reproduction Command**: \`${REPRODUCTION_COMMAND}\``);
  lines.push('> Benchmark of WorkoutVision core counting engine against University of Idaho Physical Rehabilitation Movement Dataset (UI-PRMD, ODC-PDDL v1.0).');
  lines.push('');

  lines.push('## Overview');
  lines.push('');
  lines.push(`- **Dataset**: UI-PRMD (MDPI Data 2018, DOI: [10.3390/data3020017](https://doi.org/10.3390/data3020017))`);
  lines.push(`- **License**: Open Data Commons Public Domain Dedication and License (PDDL) v1.0 (Commercial Use Permitted)`);
  lines.push(`- **Downloads Manifest**: \`data/benchmarks/ui-prmd/downloads_manifest.json\` (20 files verified via SHA-256)`);
  lines.push(`- **Evaluated Sets**: ${results.length}`);
  lines.push(`- **Total Sets Gzipped Footprint**: ${(manifest.totalSizeBytes / 1024).toFixed(1)} KB`);
  lines.push('');

  // 1. Results Table
  lines.push('## 1. Evaluation Results by Movement');
  lines.push('');
  lines.push('| Movement Code | Movement Name | Catalogue Exercise | True Reps | Counted Reps | Delta (Count − Truth) | Status | Samples | Duration (s) |');
  lines.push('| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |');

  let exactMatches = 0;
  for (const r of results) {
    const isExact = !r.refused && r.diff === 0;
    if (isExact) exactMatches++;
    const status = r.refused ? 'REFUSED' : (isExact ? 'EXACT' : 'OFF');
    const diffStr = r.diff !== null ? `${r.diff >= 0 ? '+' : ''}${r.diff}` : 'N/A';
    lines.push(`| \`${r.movementCode}\` | ${r.movementName} | \`${r.exercise}\` | ${r.trueCount} | ${r.appCount ?? 'REFUSED'} | ${diffStr} | ${status} | ${r.samples} | ${r.durationSec.toFixed(2)} |`);
  }

  const exactPct = pct(exactMatches / results.length);
  lines.push('');
  lines.push(`- **Exact Match Share**: ${exactMatches}/${results.length} (${exactPct}%)`);
  lines.push('');

  // 2. Skipped Movements
  lines.push('## 2. Skipped Movements');
  lines.push('');
  lines.push('The following UI-PRMD movements were excluded from counting because the catalogue has no matching counter:');
  lines.push('');
  lines.push('| Movement Code | Movement Name | Reason for Exclusion |');
  lines.push('| :---: | :--- | :--- |');
  for (const [code, info] of Object.entries(manifest.skippedMovements)) {
    lines.push(`| \`${code}\` | ${info.name} | ${info.reason} |`);
  }
  lines.push('');

  writeFileSync(REPORT_PATH, lines.join('\n') + '\n');
  console.log(`REPORT written to ${REPORT_PATH}`);
}

runBenchmark();
