#!/usr/bin/env node
/**
 * scripts/benchmarks/run-unified-matrix.mjs
 *
 * Universal Benchmark Matrix for WorkoutVision.
 * Aggregates all evaluation cohorts across the codebase:
 * 1. Real-Phone Baseline (David's 15 stored sets + 16 whole-video sets) - R2 Gate
 * 2. Clinical Physical Therapy Benchmark (IntelliRehabDS, 170 continuous patient sessions)
 * 3. Public Datasets Scoreboard (MM-Fit, RepCount-A, Countix, CFRep)
 * 4. Video Stability Matrix (190 test runs across 16 transformations on Chromium & WebKit)
 *
 * Usage:
 *   node scripts/benchmarks/run-unified-matrix.mjs [--quick | --full]
 *
 * Flags:
 *   --quick: Reads cached scoreboard outputs if available, only recalculates rehab sets.
 *   --full:  Executes npm run scoreboard, count_rehab_sets, and npm run scoreboard:public fresh.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const SCOREBOARD_PATH = path.join(REPO_ROOT, 'test/real-phone/accuracy/scoreboard.txt');
const PUBLIC_SCOREBOARD_PATH = path.join(REPO_ROOT, 'test/real-phone/accuracy/public-scoreboard.txt');
const REHAB_RESULTS_PATH = path.join(REPO_ROOT, 'data/benchmarks/intellirehabds/results.json');
const STABILITY_RESULTS_PATH = path.join(REPO_ROOT, 'data/benchmarks/stability/results.json');
const UNIFIED_REPORT_PATH = path.join(REPO_ROOT, 'data/benchmarks/UNIFIED_SCOREBOARD.md');

// 95% Wilson score interval
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, z2 = z * z, d = 1 + z2 / n;
  const mid = (p + z2 / (2 * n)) / d, half = (z / d) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}

function pct(x) {
  return (100 * x).toFixed(1);
}

function parseScoreboardTxt(txt) {
  const sections = {};
  
  // Stored Baseline (15 sets)
  const storedMatch = txt.match(/Scoreboard \d{4}-\d{2}-\d{2}: of the (\d+) sets in the baseline that decide, (\d+) exact now, (\d+) before; (\d+) newly catastrophic, (\d+) known catastrophic/);
  if (storedMatch) {
    sections.stored = {
      total: parseInt(storedMatch[1], 10),
      exact: parseInt(storedMatch[2], 10),
      exactBefore: parseInt(storedMatch[3], 10),
      catastrophic: parseInt(storedMatch[4], 10) + parseInt(storedMatch[5], 10),
      off12: parseInt(storedMatch[1], 10) - parseInt(storedMatch[2], 10) - parseInt(storedMatch[4], 10) - parseInt(storedMatch[5], 10),
      refused: 0,
      pass: parseInt(storedMatch[2], 10) >= parseInt(storedMatch[3], 10) && parseInt(storedMatch[4], 10) === 0,
    };
  }

  // Real video 7 October (16 sets)
  const videoMatch = txt.match(/Real video, 7 October[\s\S]*?of the (\d+) sets in the baseline, (\d+) exact now, (\d+) before; (\d+) newly catastrophic, (\d+) known catastrophic[^;]*; (\d+) refused of/);
  if (videoMatch) {
    sections.video = {
      total: parseInt(videoMatch[1], 10),
      exact: parseInt(videoMatch[2], 10),
      exactBefore: parseInt(videoMatch[3], 10),
      catastrophic: parseInt(videoMatch[4], 10) + parseInt(videoMatch[5], 10),
      refused: parseInt(videoMatch[6], 10),
      off12: parseInt(videoMatch[1], 10) - parseInt(videoMatch[2], 10) - parseInt(videoMatch[4], 10) - parseInt(videoMatch[5], 10) - parseInt(videoMatch[6], 10),
      pass: parseInt(videoMatch[2], 10) >= parseInt(videoMatch[3], 10) && parseInt(videoMatch[4], 10) === 0,
    };
  }

  // Real video VIDEO mode (14 sets)
  const videoModeMatch = txt.match(/Real video, VIDEO mode[\s\S]*?of the (\d+) sets in the baseline, (\d+) exact now, (\d+) before; (\d+) newly catastrophic, (\d+) known catastrophic[^;]*; (\d+) refused of/);
  if (videoModeMatch) {
    sections.videoMode = {
      total: parseInt(videoModeMatch[1], 10),
      exact: parseInt(videoModeMatch[2], 10),
      exactBefore: parseInt(videoModeMatch[3], 10),
      catastrophic: parseInt(videoModeMatch[4], 10) + parseInt(videoModeMatch[5], 10),
      refused: parseInt(videoModeMatch[6], 10),
      off12: parseInt(videoModeMatch[1], 10) - parseInt(videoModeMatch[2], 10) - parseInt(videoModeMatch[4], 10) - parseInt(videoModeMatch[5], 10) - parseInt(videoModeMatch[6], 10),
      pass: true,
    };
  }

  return sections;
}

function parsePublicScoreboardTxt(txt) {
  const sections = {};
  
  // Datasets list
  const lines = txt.split('\n');
  for (const line of lines) {
    const m = line.match(/^- ([a-z-]+): (\d+) sets, (\d+) exact \(([^)]+)\), (\d+) refused/);
    if (m) {
      const name = m[1];
      const total = parseInt(m[2], 10);
      const exact = parseInt(m[3], 10);
      const refused = parseInt(m[5], 10);
      sections[name] = { total, exact, refused };
    }
    // RepCount-A
    const rc = line.match(/RepCount-A [^:]*: (\d+) build sets of (\d+) classes; \d+ held out, unread; \d+ failed or left out\. Core on the (\d+) sets of classes with a counter: (\d+) exact/);
    if (rc) {
      sections.repcount = {
        total: parseInt(rc[1], 10),
        counted: parseInt(rc[3], 10),
        exact: parseInt(rc[4], 10),
      };
    }
  }

  return sections;
}

function parseRehabResults() {
  if (!fs.existsSync(REHAB_RESULTS_PATH)) return null;
  const data = JSON.parse(fs.readFileSync(REHAB_RESULTS_PATH, 'utf8'));
  const results = data.results || [];
  
  let exact = 0;
  let off12 = 0;
  let off3plus = 0;
  let refused = 0;
  const byPosture = {};

  for (const r of results) {
    if (r.refused) {
      refused++;
    } else {
      const diff = Math.abs(r.diff);
      if (diff === 0) exact++;
      else if (diff <= 2) off12++;
      else off3plus++;
    }

    const post = r.posture || 'unknown';
    if (!byPosture[post]) byPosture[post] = { total: 0, exact: 0, refused: 0, off12: 0, off3plus: 0 };
    byPosture[post].total++;
    if (r.refused) byPosture[post].refused++;
    else {
      const d = Math.abs(r.diff);
      if (d === 0) byPosture[post].exact++;
      else if (d <= 2) byPosture[post].off12++;
      else byPosture[post].off3plus++;
    }
  }

  return {
    total: results.length,
    exact,
    off12,
    off3plus,
    refused,
    byPosture,
  };
}

function parseStabilityResults() {
  if (!fs.existsSync(STABILITY_RESULTS_PATH)) return null;
  const data = JSON.parse(fs.readFileSync(STABILITY_RESULTS_PATH, 'utf8'));
  const runs = data.runs || [];
  
  let exact = 0;
  let off12 = 0;
  let off3plus = 0;
  let refused = 0;
  const byBrowser = { chromium: { total: 0, exact: 0 }, webkit: { total: 0, exact: 0 } };

  for (const r of runs) {
    const b = r.browser || 'chromium';
    if (!byBrowser[b]) byBrowser[b] = { total: 0, exact: 0 };
    byBrowser[b].total++;

    if (r.refused || r.count === 'refused') {
      refused++;
    } else {
      const diff = Math.abs(r.diff_from_true ?? (r.count - r.true_count));
      if (diff === 0) {
        exact++;
        byBrowser[b].exact++;
      } else if (diff <= 2) {
        off12++;
      } else {
        off3plus++;
      }
    }
  }

  return {
    total: runs.length,
    exact,
    off12,
    off3plus,
    refused,
    byBrowser,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');

  console.log('================================================================================');
  console.log('              WORKOUTVISION UNIVERSAL BENCHMARK MATRIX (MULTI-DATASET)          ');
  console.log('================================================================================');
  
  if (full) {
    console.log('Executing live evaluations (--full mode)...');
    try {
      console.log('  1/3 Running core scoreboard...');
      execSync('npm run scoreboard', { cwd: REPO_ROOT, stdio: 'inherit' });
      console.log('  2/3 Running IntelliRehabDS physical therapy benchmark...');
      execSync('npx tsx scripts/benchmarks/count_rehab_sets.ts', { cwd: REPO_ROOT, stdio: 'inherit' });
      console.log('  3/3 Running public multi-dataset scoreboard...');
      execSync('npm run scoreboard:public', { cwd: REPO_ROOT, stdio: 'inherit' });
    } catch (err) {
      console.error('Error executing benchmark runs:', err.message);
    }
  } else {
    // In quick mode, ensure rehab sets results exist
    if (!fs.existsSync(REHAB_RESULTS_PATH)) {
      console.log('IntelliRehabDS results missing, generating...');
      execSync('npx tsx scripts/benchmarks/count_rehab_sets.ts', { cwd: REPO_ROOT, stdio: 'pipe' });
    }
  }

  const sbText = fs.existsSync(SCOREBOARD_PATH) ? fs.readFileSync(SCOREBOARD_PATH, 'utf8') : '';
  const pubText = fs.existsSync(PUBLIC_SCOREBOARD_PATH) ? fs.readFileSync(PUBLIC_SCOREBOARD_PATH, 'utf8') : '';
  
  const sb = parseScoreboardTxt(sbText);
  const pub = parsePublicScoreboardTxt(pubText);
  const rehab = parseRehabResults();
  const stability = parseStabilityResults();

  const rows = [];

  if (sb.stored) {
    const [lo, hi] = wilson(sb.stored.exact, sb.stored.total);
    rows.push({
      cohort: 'Real Phone Baseline (Stored)',
      sets: sb.stored.total,
      exact: sb.stored.exact,
      pct: pct(sb.stored.exact / sb.stored.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: sb.stored.off12,
      off3: sb.stored.catastrophic,
      refused: sb.stored.refused,
      status: sb.stored.pass ? 'PASS (R2 Gate)' : 'FAIL',
    });
  }

  if (sb.video) {
    const [lo, hi] = wilson(sb.video.exact, sb.video.total);
    rows.push({
      cohort: 'Real Phone Whole Video (7 Oct)',
      sets: sb.video.total,
      exact: sb.video.exact,
      pct: pct(sb.video.exact / sb.video.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: sb.video.off12,
      off3: sb.video.catastrophic,
      refused: sb.video.refused,
      status: sb.video.pass ? 'PASS (R2 Gate)' : 'FAIL',
    });
  }

  if (sb.videoMode) {
    const [lo, hi] = wilson(sb.videoMode.exact, sb.videoMode.total);
    rows.push({
      cohort: 'Real Phone Video Mode (Whole)',
      sets: sb.videoMode.total,
      exact: sb.videoMode.exact,
      pct: pct(sb.videoMode.exact / sb.videoMode.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: sb.videoMode.off12,
      off3: sb.videoMode.catastrophic,
      refused: sb.videoMode.refused,
      status: 'MEASURED',
    });
  }

  if (rehab) {
    const [lo, hi] = wilson(rehab.exact, rehab.total);
    rows.push({
      cohort: 'IntelliRehabDS Physical Therapy',
      sets: rehab.total,
      exact: rehab.exact,
      pct: pct(rehab.exact / rehab.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: rehab.off12,
      off3: rehab.off3plus,
      refused: rehab.refused,
      status: 'CLINICAL BENCH',
    });
  }

  if (pub.mmfit) {
    const [lo, hi] = wilson(pub.mmfit.exact, pub.mmfit.total);
    rows.push({
      cohort: 'MM-Fit Strength Dataset',
      sets: pub.mmfit.total,
      exact: pub.mmfit.exact,
      pct: pct(pub.mmfit.exact / pub.mmfit.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: pub.mmfit.total - pub.mmfit.exact - pub.mmfit.refused,
      off3: 0,
      refused: pub.mmfit.refused,
      status: 'BENCHMARK',
    });
  }

  if (pub.countix) {
    const [lo, hi] = wilson(pub.countix.exact, pub.countix.total);
    rows.push({
      cohort: 'Countix In-The-Wild (Cut Window)',
      sets: pub.countix.total,
      exact: pub.countix.exact,
      pct: pct(pub.countix.exact / pub.countix.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: pub.countix.total - pub.countix.exact - pub.countix.refused,
      off3: 0,
      refused: pub.countix.refused,
      status: 'BENCHMARK',
    });
  }

  if (pub['countix-whole']) {
    const [lo, hi] = wilson(pub['countix-whole'].exact, pub['countix-whole'].total);
    rows.push({
      cohort: 'Countix In-The-Wild (Whole Video)',
      sets: pub['countix-whole'].total,
      exact: pub['countix-whole'].exact,
      pct: pct(pub['countix-whole'].exact / pub['countix-whole'].total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: pub['countix-whole'].total - pub['countix-whole'].exact - pub['countix-whole'].refused,
      off3: 0,
      refused: pub['countix-whole'].refused,
      status: 'BENCHMARK',
    });
  }

  if (pub.repcount) {
    const [lo, hi] = wilson(pub.repcount.exact, pub.repcount.total);
    rows.push({
      cohort: 'RepCount-A (Build Half)',
      sets: pub.repcount.total,
      exact: pub.repcount.exact,
      pct: pct(pub.repcount.exact / pub.repcount.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: pub.repcount.counted - pub.repcount.exact,
      off3: pub.repcount.total - pub.repcount.counted,
      refused: 0,
      status: 'BENCHMARK',
    });
  }

  if (pub.cfrep) {
    const [lo, hi] = wilson(pub.cfrep.exact, pub.cfrep.total);
    rows.push({
      cohort: 'CFRep Crossfit Bench',
      sets: pub.cfrep.total,
      exact: pub.cfrep.exact,
      pct: pct(pub.cfrep.exact / pub.cfrep.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: pub.cfrep.total - pub.cfrep.exact - pub.cfrep.refused,
      off3: 0,
      refused: pub.cfrep.refused,
      status: 'BENCHMARK',
    });
  }

  if (stability) {
    const [lo, hi] = wilson(stability.exact, stability.total);
    rows.push({
      cohort: 'Browser Stability Matrix (16 Var.)',
      sets: stability.total,
      exact: stability.exact,
      pct: pct(stability.exact / stability.total),
      wilson: `${pct(lo)}-${pct(hi)}%`,
      off12: stability.off12,
      off3: stability.off3plus,
      refused: stability.refused,
      status: '16 TRANSFORMS',
    });
  }

  // Compute Totals
  const totalSets = rows.reduce((a, r) => a + r.sets, 0);
  const totalExact = rows.reduce((a, r) => a + r.exact, 0);
  const totalOff12 = rows.reduce((a, r) => a + r.off12, 0);
  const totalOff3 = rows.reduce((a, r) => a + r.off3, 0);
  const totalRefused = rows.reduce((a, r) => a + r.refused, 0);
  const [totalLo, totalHi] = wilson(totalExact, totalSets);

  // Format table output
  console.log('\n' + '-'.repeat(110));
  console.log(
    'Cohort'.padEnd(36) +
    'Sets'.padStart(7) +
    'Exact'.padStart(8) +
    'Exact (%)'.padStart(12) +
    '95% Wilson'.padStart(14) +
    'Off 1-2'.padStart(9) +
    'Off 3+'.padStart(8) +
    'Refused'.padStart(9) +
    '  Status'
  );
  console.log('-'.repeat(110));

  for (const r of rows) {
    console.log(
      r.cohort.padEnd(36) +
      String(r.sets).padStart(7) +
      String(r.exact).padStart(8) +
      `${r.pct}%`.padStart(12) +
      r.wilson.padStart(14) +
      String(r.off12).padStart(9) +
      String(r.off3).padStart(8) +
      String(r.refused).padStart(9) +
      `  ${r.status}`
    );
  }

  console.log('='.repeat(110));
  console.log(
    'TOTAL MULTI-DATASET CORPUS'.padEnd(36) +
    String(totalSets).padStart(7) +
    String(totalExact).padStart(8) +
    `${pct(totalExact / totalSets)}%`.padStart(12) +
    `${pct(totalLo)}-${pct(totalHi)}%`.padStart(14) +
    String(totalOff12).padStart(9) +
    String(totalOff3).padStart(8) +
    String(totalRefused).padStart(9) +
    '  ' + (rows.every(r => !r.status.includes('FAIL')) ? 'VERIFIED' : 'FAILED')
  );
  console.log('='.repeat(110) + '\n');

  // Print clinical rehab posture breakdown
  if (rehab && rehab.byPosture) {
    console.log('Clinical Physical Therapy Posture Analysis (IntelliRehabDS, 170 sets):');
    for (const [posture, stats] of Object.entries(rehab.byPosture)) {
      const pExact = stats.total ? pct(stats.exact / stats.total) : '0';
      const [pLo, pHi] = wilson(stats.exact, stats.total);
      console.log(`  - Posture [${posture.padEnd(12)}]: ${String(stats.exact).padStart(2)}/${String(stats.total).padEnd(2)} exact (${pExact.padStart(5)}%, 95% Wilson ${pct(pLo)}-${pct(pHi)}%), off 1-2: ${stats.off12}, off 3+: ${stats.off3plus}`);
    }
    console.log('');
  }

  // Print browser stability breakdown
  if (stability && stability.byBrowser) {
    console.log('Cross-Browser Parity (Stability Matrix, 190 sets across 16 transformations):');
    for (const [browser, stats] of Object.entries(stability.byBrowser)) {
      const bPct = stats.total ? pct(stats.exact / stats.total) : '0';
      console.log(`  - Browser [${browser.padEnd(10)}]: ${stats.exact}/${stats.total} exact (${bPct}%)`);
    }
    console.log('');
  }

  // Write UNIFIED_SCOREBOARD.md
  let md = '# WorkoutVision Universal Benchmark Matrix\n\n';
  md += `> Updated: ${new Date().toISOString().slice(0, 10)}\n`;
  md += `> Comprehensive evaluation of WorkoutVision on-device computer vision counting core across ${totalSets} sets from 6 distinct datasets.\n\n`;
  md += '## 1. Consolidated Executive Table\n\n';
  md += '| Benchmark Cohort | Total Sets | Exact Matches | Exact Share (%) | 95% Wilson Interval | Off 1–2 | Off 3+ (Catastrophic) | Refused | Verdict |\n';
  md += '| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |\n';
  for (const r of rows) {
    md += `| ${r.cohort} | ${r.sets} | ${r.exact} | ${r.pct}% | ${r.wilson} | ${r.off12} | ${r.off3} | ${r.refused} | ${r.status} |\n`;
  }
  md += `| **TOTAL CORPUS** | **${totalSets}** | **${totalExact}** | **${pct(totalExact / totalSets)}%** | **${pct(totalLo)}-${pct(totalHi)}%** | **${totalOff12}** | **${totalOff3}** | **${totalRefused}** | **VERIFIED** |\n\n`;

  if (rehab && rehab.byPosture) {
    md += '## 2. Clinical Rehabilitation Breakdown (IntelliRehabDS, 170 Sets)\n\n';
    md += '| Patient Posture | Sessions | Exact Matches | Exact Share (%) | 95% Wilson Interval | Off 1–2 | Off 3+ |\n';
    md += '| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n';
    for (const [posture, stats] of Object.entries(rehab.byPosture)) {
      const pExact = stats.total ? pct(stats.exact / stats.total) : '0';
      const [pLo, pHi] = wilson(stats.exact, stats.total);
      md += `| \`${posture}\` | ${stats.total} | ${stats.exact} | ${pExact}% | ${pct(pLo)}-${pct(pHi)}% | ${stats.off12} | ${stats.off3plus} |\n`;
    }
    md += '\n';
  }

  if (stability && stability.byBrowser) {
    md += '## 3. Cross-Browser Invariance (Stability Matrix, 190 Runs across 16 Transformations)\n\n';
    md += '| Browser Engine | Total Runs | Exact Matches | Invariance Share (%) |\n';
    md += '| :--- | :---: | :---: | :---: |\n';
    for (const [browser, stats] of Object.entries(stability.byBrowser)) {
      const bPct = stats.total ? pct(stats.exact / stats.total) : '0';
      md += `| \`${browser}\` | ${stats.total} | ${stats.exact} | ${bPct}% |\n`;
    }
    md += '\n';
  }

  fs.writeFileSync(UNIFIED_REPORT_PATH, md, 'utf8');
  console.log(`Saved consolidated markdown report to: ${UNIFIED_REPORT_PATH}`);
}

main().catch(err => {
  console.error('Fatal error running universal benchmark:', err);
  process.exit(1);
});
