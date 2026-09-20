#!/usr/bin/env node
/**
 * Full-pipeline replay — runs everything analyzeVideo runs AFTER MediaPipe
 * inference, on pre-extracted landmark artifacts.
 *
 * Usage:
 *   node benchmark/replay-full-pipeline.mjs <artifact.json> [--exercise <key>] [--weight <kg>]
 *   node benchmark/replay-full-pipeline.mjs --cache [video_name]
 *
 * Accepts two formats:
 *   1. New landmark artifact (from dump-landmarks.html): { version, video, metadata, frames[] }
 *   2. Legacy landmark cache (from browser benchmark): [{ video, exercise, expected, fps, landmarks[] }]
 *
 * Pipeline (matches buildFullResult in analyzeVideo.js):
 *   calibration → exercise auto-detection → RepCounter → quality gate →
 *   biomechanics → coaching engine → coach report → ProgressionScore
 *
 * Output: full result card data — gate, scores, highlights — for any dumped video.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = join(__dirname, 'artifacts');

// ── CLI args ──
const args = process.argv.slice(2);
let artifactPath = null;
let exerciseOverride = null;
let weightKg = 0;
let useLegacyCache = false;
let legacyVideoFilter = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--exercise' && args[i + 1]) { exerciseOverride = args[++i]; continue; }
  if (args[i] === '--weight' && args[i + 1]) { weightKg = parseFloat(args[++i]); continue; }
  if (args[i] === '--cache') { useLegacyCache = true; continue; }
  if (!artifactPath && !args[i].startsWith('--')) {
    // If --cache mode, this is a video name filter; otherwise it's a file path
    if (useLegacyCache) { legacyVideoFilter = args[i]; }
    else { artifactPath = args[i]; }
  }
}

// If --cache but we already parsed something as artifactPath, reinterpret
if (useLegacyCache && artifactPath) {
  legacyVideoFilter = artifactPath;
  artifactPath = null;
}

// ── Module loader hooks (same pattern as replay-benchmark.mjs) ──

// Write the shim for poseAnalysis.js
const shimPath = join(__dirname, '..', 'src', 'lib', '_node_shim_poseAnalysis.mjs');
const shimUrl = new URL('../src/lib/_node_shim_poseAnalysis.mjs', import.meta.url).href;

// The shim file should already exist from a prior benchmark run.
// If it doesn't, the loader will fail and we generate it.
if (!existsSync(shimPath)) {
  console.error('Shim file not found. Run replay-benchmark.mjs once first to generate it.');
  process.exit(1);
}

// Patch exercises.js to replace import.meta.env.BASE_URL (Vite-only) with '/'
const exercisesPath = join(__dirname, '..', 'src', 'lib', 'exercises.js');
const exercisesOriginal = readFileSync(exercisesPath, 'utf-8');
const exercisesPatched = exercisesOriginal.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesPatched);
}

import module from 'node:module';

if (module.registerHooks) {
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('/poseAnalysis') || specifier === './poseAnalysis') {
        return { shortCircuit: true, url: shimUrl };
      }
      if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.split('/').pop().includes('.')) {
        try { return nextResolve(specifier + '.ts', context); } catch {}
        try { return nextResolve(specifier + '.js', context); } catch {}
        // Directory import: try index.ts / index.js
        try { return nextResolve(specifier + '/index.ts', context); } catch {}
        return nextResolve(specifier + '/index.js', context);
      }
      if (specifier.endsWith('.js')) {
        try { return nextResolve(specifier, context); } catch {}
        return nextResolve(specifier.replace(/\.js$/, '.ts'), context);
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (result.source != null) {
        const src = typeof result.source === 'string' ? result.source : result.source.toString();
        if (src.includes('import.meta.env')) {
          let patched = src.replace(/import\.meta\.env\.BASE_URL/g, "'/'");
          patched = patched.replace(/import\.meta\.env/g, '({})');
          result.source = patched;
        }
      }
      return result;
    },
  });
} else {
  console.error('Node version too old: needs module.registerHooks (Node 23+)');
  process.exit(1);
}

// ── Import pipeline modules (same as analyzeVideo.js) ──
const { extractJointAngles } = await import('../src/lib/_node_shim_poseAnalysis.mjs');
const { EXERCISES } = await import('../src/lib/exercises.js');
const { RepCounter } = await import('../src/lib/repCounter/index.js');
const { ProgressionScore } = await import('../src/lib/ProgressionScore.js');
const { ExerciseAutoDetector } = await import('../src/lib/exerciseDetector.js');
const { analyzeSet } = await import('../src/lib/biomechanics.ts');
const { generateWorkoutReport } = await import('../src/lib/coach.js');
const { analyzeCoaching } = await import('../src/lib/coachingEngine.js');
const { computeCalibration, applyCalibration } = await import('../src/lib/calibration.js');
const { runInputQualityGate } = await import('../src/lib/inputQualityGate.js');

// Restore exercises.js
if (exercisesPatched !== exercisesOriginal) {
  writeFileSync(exercisesPath, exercisesOriginal);
}

// ── Load landmark data ──

function loadNewArtifact(path) {
  const raw = readFileSync(path, 'utf-8');
  const data = JSON.parse(raw);
  if (data.version && data.frames) {
    return [{
      video: data.video,
      fps: data.metadata.fps,
      duration: data.metadata.duration,
      exercise: null, // auto-detect
      expected: null,
      landmarks: data.frames.map(f => f.landmarks),
      timestamps: data.frames.map(f => f.timestamp),
      worldLandmarks: data.frames.map(f => f.worldLandmarks || null),
    }];
  }
  // Could be legacy format
  if (Array.isArray(data)) {
    return data.map(v => ({
      video: v.video,
      fps: v.fps,
      duration: v.landmarks ? v.landmarks.length / v.fps : 0,
      exercise: v.exercise || null,
      expected: v.expected,
      landmarks: v.landmarks,
      timestamps: v.landmarks ? v.landmarks.map((_, i) => i / v.fps) : [],
      worldLandmarks: null,
    }));
  }
  console.error('Unknown artifact format');
  process.exit(1);
}

function loadLegacyCache() {
  const cacheDir = join(__dirname, 'landmark-cache');
  if (!existsSync(cacheDir)) {
    console.error('No landmark-cache directory found.');
    process.exit(1);
  }
  const jsonFiles = readdirSync(cacheDir).filter(f => f.endsWith('.json') && !f.endsWith('.json.gz')).sort().reverse();
  const gzFiles = readdirSync(cacheDir).filter(f => f.endsWith('.json.gz')).sort().reverse();
  let cachePath;
  if (jsonFiles.length > 0) cachePath = join(cacheDir, jsonFiles[0]);
  else if (gzFiles.length > 0) cachePath = join(cacheDir, gzFiles[0]);
  else { console.error('No cache files found.'); process.exit(1); }

  const rawCache = cachePath.endsWith('.gz')
    ? gunzipSync(readFileSync(cachePath)).toString('utf-8')
    : readFileSync(cachePath, 'utf-8');
  const data = JSON.parse(rawCache);
  return data.map(v => ({
    video: v.video,
    fps: v.fps,
    duration: v.landmarks ? v.landmarks.length / v.fps : 0,
    exercise: v.exercise || null,
    expected: v.expected,
    landmarks: v.landmarks,
    timestamps: v.landmarks ? v.landmarks.map((_, i) => i / v.fps) : [],
    worldLandmarks: null,
  }));
}

let videos;
if (useLegacyCache) {
  videos = loadLegacyCache();
  if (legacyVideoFilter) {
    videos = videos.filter(v => v.video.includes(legacyVideoFilter));
    if (videos.length === 0) {
      console.error(`No videos matching "${legacyVideoFilter}".`);
      process.exit(1);
    }
  }
} else if (artifactPath) {
  videos = loadNewArtifact(artifactPath);
} else {
  // Default: look for artifacts/ directory
  if (existsSync(ARTIFACTS_DIR)) {
    const artifactFiles = readdirSync(ARTIFACTS_DIR).filter(f => f.endsWith('.json')).sort().reverse();
    if (artifactFiles.length > 0) {
      videos = loadNewArtifact(join(ARTIFACTS_DIR, artifactFiles[0]));
    }
  }
  if (!videos) {
    console.error('Usage: node benchmark/replay-full-pipeline.mjs <artifact.json>');
    console.error('       node benchmark/replay-full-pipeline.mjs --cache [video_filter]');
    process.exit(1);
  }
}

console.log(`\n  Full-Pipeline Replay`);
console.log(`  Videos: ${videos.length}\n`);

// ── Run full pipeline for each video ──

for (const video of videos) {
  const { video: name, fps, landmarks: rawLandmarks, timestamps, exercise: cacheExercise, expected } = video;

  console.log('='.repeat(74));
  console.log(`VIDEO: ${name}`);
  console.log(`FPS: ${fps}  |  Frames: ${rawLandmarks?.length ?? 0}  |  Duration: ${video.duration.toFixed(1)}s`);
  if (cacheExercise) console.log(`Cache exercise: ${cacheExercise}  |  Expected reps: ${expected ?? '?'}`);
  console.log('='.repeat(74));

  if (!rawLandmarks || rawLandmarks.length === 0) {
    console.log('  (no landmarks — skipping)\n');
    continue;
  }

  // Filter out null frames
  const validIndices = [];
  for (let i = 0; i < rawLandmarks.length; i++) {
    if (rawLandmarks[i] && rawLandmarks[i].length >= 33) validIndices.push(i);
  }
  if (validIndices.length === 0) {
    console.log('  (all frames null — skipping)\n');
    continue;
  }

  // Build frames array matching analyzeVideo's format
  let frames = validIndices.map(i => ({
    landmarks: rawLandmarks[i],
    timestamp: timestamps[i] ?? i / fps,
    angles: extractJointAngles(rawLandmarks[i]),
  }));

  const analysisFps = fps;
  const interval = 1 / analysisFps;

  // ── Phase 1: Calibration (same as buildFullResult lines 487-500) ──
  const calibFrameCount = Math.min(Math.ceil(analysisFps * 1), frames.length);
  if (calibFrameCount >= analysisFps * 0.5) {
    const calibLandmarks = frames.slice(0, calibFrameCount).map(f => f.landmarks);
    const calibration = computeCalibration(calibLandmarks, analysisFps);
    if (calibration && Math.abs(calibration.rotationAngle) > 0.05) {
      for (const f of frames) {
        f.landmarks = applyCalibration(f.landmarks, calibration);
        f.angles = extractJointAngles(f.landmarks);
      }
    }
  }

  // ── Phase 2: Confidence (same as buildFullResult lines 504-513) ──
  let totalVis = 0, visCount = 0;
  for (const f of frames) {
    if (!f.landmarks) continue;
    for (const lm of f.landmarks) {
      if (lm.visibility != null) { totalVis += lm.visibility; visCount++; }
    }
  }
  const avgVisibility = visCount > 0 ? totalVis / visCount : 0;
  const confidenceLevel = avgVisibility > 0.7 ? 'high' : avgVisibility > 0.5 ? 'medium' : 'low';

  // ── Phase 3: Exercise detection + rep counting (same as lines 517-576) ──
  const effectiveExercise = exerciseOverride || cacheExercise || '__auto__';
  const isAutoMode = effectiveExercise === '__auto__';
  const initialExercise = isAutoMode ? 'squat' : effectiveExercise;
  let detectedExercise = initialExercise;
  let detectionConfidence = isAutoMode ? 0 : 1;
  let detectionLowConfidence = false;
  let candidateScores = [];
  let autoDetected = false;

  let repCounter = new RepCounter(initialExercise, { fps: analysisFps, mode: 'video', weightKg });
  for (const f of frames) repCounter.update(f.landmarks, f.timestamp);

  if (isAutoMode) {
    const tallies = {};
    const detector = new ExerciseAutoDetector({ fps: analysisFps });
    for (const f of frames) {
      const det = detector.update(f.landmarks);
      if (det) tallies[det] = (tallies[det] || 0) + 1;
    }
    const detectionInfo = detector.getDetectionInfo();
    detectionConfidence = detectionInfo.confidence;
    detectionLowConfidence = detectionInfo.isLowConfidence;

    const candidates = Object.keys(tallies);
    if (candidates.length > 0) {
      let bestEx = initialExercise;
      let bestScore = -1;
      for (const ex of candidates) {
        const rc = new RepCounter(ex, { fps: analysisFps, mode: 'video', weightKg });
        for (const f of frames) rc.update(f.landmarks, f.timestamp);
        rc.finalize();
        const reps = rc.repHistory ? rc.repHistory.length : 0;
        const hasChecks = EXERCISES[ex]?.formChecks?.length > 0 ? 500 : 0;
        const score = reps * 1000 + hasChecks + tallies[ex];
        candidateScores.push({ exercise: ex, score, reps, tally: tallies[ex] });
        if (score > bestScore) { bestScore = score; bestEx = ex; }
      }
      candidateScores.sort((a, b) => b.score - a.score);
      if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
        detectedExercise = bestEx;
        autoDetected = true;
        repCounter = new RepCounter(detectedExercise, { fps: analysisFps, mode: 'video', weightKg });
        for (const f of frames) repCounter.update(f.landmarks, f.timestamp);
      }
    } else {
      autoDetected = 'failed';
    }
  }

  repCounter.finalize();

  const enrichedRepHistory = repCounter.repHistory.map(r => ({
    ...r,
    startTime: (r.startFrame * interval),
    peakTime: ((r.peakFrame || r.bottomFrame) * interval),
    endTime: (r.endFrame * interval),
  }));

  const landmarkFrames = frames.map(f => f.landmarks);
  const repHistory = enrichedRepHistory;
  const reps = repHistory.length;

  // ── Phase 4: Quality gate (same as lines 584-606) ──
  const frameTimestamps = reps > 0 ? frames.map(f => f.timestamp) : [];
  const videoDurationSec = frames.length > 0
    ? frames[frames.length - 1].timestamp - frames[0].timestamp
    : 0;
  const repCounterDiagnostics = repCounter.diagnostics || {};
  const qualityGate = runInputQualityGate({
    exercise: detectedExercise,
    reps,
    durationSec: videoDurationSec,
    detectionLowConfidence,
    frameTimestamps,
    fps: analysisFps,
    observedRange: repCounterDiagnostics.observedRange,
  });

  if (!qualityGate.pass && detectionConfidence > 0) {
    detectionConfidence = detectionConfidence * 0.5;
    detectionLowConfidence = true;
  }

  // ── Phase 5: Biomechanics (same as lines 610-625) ──
  let bioAnalysis = null;
  const safeForFormChecks = !detectionLowConfidence && qualityGate.pass;
  try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory); }
  catch (err) { console.log(`  Bio analysis error: ${err.message}`); }

  if (bioAnalysis && !safeForFormChecks) {
    bioAnalysis = {
      ...bioAnalysis,
      compensationPatterns: [],
      formCheckResults: [],
      movementQuality: null,
      _lowConfidenceGated: true,
    };
  }

  // ── Phase 6: Coaching engine (same as lines 628-630) ──
  let coaching = null;
  try { coaching = analyzeCoaching(landmarkFrames, repHistory, detectedExercise, analysisFps); }
  catch (err) { console.log(`  Coaching error: ${err.message}`); }

  // ── Phase 7: Coach report (same as lines 636-643) ──
  let report = null;
  try {
    report = generateWorkoutReport({}, [{
      exerciseKey: detectedExercise, exercise: detectedExercise,
      reps, analysis: bioAnalysis, bioAnalysis, repHistory,
    }]);
  } catch (err) { console.log(`  Report error: ${err.message}`); }

  // ── Phase 8: Scoring (same as lines 645-669) ──
  const exerciseDef = EXERCISES[detectedExercise];
  const hasFormChecks = safeForFormChecks && exerciseDef?.formChecks?.length > 0;
  const scoredReps = repHistory.filter(r => r.score !== null && r.score !== undefined);
  const avgScore = !hasFormChecks ? null
    : scoredReps.length > 0
      ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length)
      : bioAnalysis?.movementQuality || 0;

  let progressionResult = null;
  try {
    const formScores = repHistory.map(r => r.score).filter(s => s != null);
    const repVelocities = repHistory.map(r => r.velocity).filter(Boolean);
    if (formScores.length > 0 || reps > 0) {
      progressionResult = ProgressionScore.computeSet({
        formScores,
        repVelocities,
        reps,
        weightKg,
      });
    }
  } catch (_) {}

  // ── Build result (same fields as analyzeVideo return value) ──
  const result = {
    exercise: detectedExercise,
    exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
    reps,
    formScore: avgScore,
    progressionScore: progressionResult?.score ?? null,
    hasFormChecks,
    autoDetected,
    detectionConfidence,
    detectionLowConfidence,
    detectionCandidates: candidateScores.slice(0, 3),
    insufficientFootage: qualityGate.insufficientFootage,
    qualityGateReasons: qualityGate.reasons,
    qualityGatePass: qualityGate.pass,
    confidence: { visibility: Math.round(avgVisibility * 100) / 100, level: confidenceLevel },
    weight: weightKg,
  };

  // ════════════════════════════════════════════════════════════════════
  // PRINT RESULTS
  // ════════════════════════════════════════════════════════════════════

  console.log('\n── DETECTION ──');
  console.log(`  Exercise:   ${result.exercise} (${result.exerciseName})`);
  console.log(`  Auto-detected: ${autoDetected}`);
  console.log(`  Confidence: ${result.detectionConfidence.toFixed(3)} (${result.detectionLowConfidence ? 'LOW' : 'ok'})`);
  if (candidateScores.length > 0) {
    console.log(`  Candidates:`);
    for (const c of candidateScores.slice(0, 5)) {
      console.log(`    ${c.exercise.padEnd(20)} reps=${String(c.reps).padStart(3)}  score=${c.score}  tally=${c.tally}`);
    }
  }

  console.log('\n── QUALITY GATE ──');
  console.log(`  Pass: ${qualityGate.pass}`);
  console.log(`  Insufficient footage: ${qualityGate.insufficientFootage}`);
  if (qualityGate.reasons.length > 0) {
    console.log(`  Reasons:`);
    for (const r of qualityGate.reasons) console.log(`    - ${r}`);
  }

  console.log('\n── REP COUNT ──');
  console.log(`  Reps: ${reps}${expected != null ? ` (expected: ${expected}, error: ${reps - expected >= 0 ? '+' : ''}${reps - expected})` : ''}`);
  console.log(`  Method: ${repCounterDiagnostics.method || '(none)'}`);
  console.log(`  Observed range: ${repCounterDiagnostics.observedRange ?? '?'}°`);
  console.log(`  Visibility: ${result.confidence.visibility} (${result.confidence.level})`);

  console.log('\n── FORM SCORING ──');
  console.log(`  Form checks active: ${hasFormChecks}`);
  console.log(`  formScore (avg):    ${avgScore ?? 'N/A'}`);
  if (progressionResult) {
    console.log(`  Progression score:  ${progressionResult.score} (${progressionResult.grade.label})`);
    console.log(`  Components:         form=${progressionResult.components.form} consistency=${progressionResult.components.consistency} tempo=${progressionResult.components.tempo} volume=${progressionResult.components.volume}`);
  }

  // Per-rep form results
  if (repHistory.length > 0 && hasFormChecks) {
    console.log('\n── PER-REP FORM ──');
    console.log(`  ${'Rep'.padStart(3)}  ${'Score'.padStart(5)}  Feedback`);
    console.log(`  ${'-'.repeat(60)}`);
    for (let i = 0; i < repHistory.length; i++) {
      const rep = repHistory[i];
      const score = rep.score != null ? String(rep.score).padStart(5) : '  N/A';
      const feedback = (rep.feedback || []).map(f => {
        const q = f.quality != null ? ` (q=${f.quality.toFixed(2)})` : '';
        return `${f.check || f.key || f.name || '?'}${q}`;
      }).join(', ') || '(none)';
      console.log(`  ${String(i + 1).padStart(3)}  ${score}  ${feedback}`);
    }
  }

  // Biomechanics details
  if (bioAnalysis) {
    console.log('\n── BIOMECHANICS ──');
    if (bioAnalysis.rangeOfMotion) {
      console.log(`  ROM: avg=${bioAnalysis.rangeOfMotion.avgDegrees?.toFixed(1) ?? '?'}°  min=${bioAnalysis.rangeOfMotion.minDegrees?.toFixed(1) ?? '?'}°  max=${bioAnalysis.rangeOfMotion.maxDegrees?.toFixed(1) ?? '?'}°`);
    }
    if (bioAnalysis.timeUnderTension) {
      console.log(`  TUT: total=${bioAnalysis.timeUnderTension.totalSeconds?.toFixed(1) ?? '?'}s  avg/rep=${bioAnalysis.timeUnderTension.avgPerRep?.toFixed(1) ?? '?'}s`);
    }
    if (bioAnalysis.asymmetry) {
      console.log(`  Asymmetry: ${bioAnalysis.asymmetry.score?.toFixed(1) ?? '?'}% (${bioAnalysis.asymmetry.risk || '?'})`);
    }
    if (bioAnalysis.movementQuality != null) {
      console.log(`  Movement quality: ${bioAnalysis.movementQuality}`);
    }
    if (bioAnalysis.formCheckResults?.length > 0) {
      console.log(`  Form check results:`);
      for (const fc of bioAnalysis.formCheckResults) {
        console.log(`    ${(fc.check || fc.name || '?').padEnd(25)} pass=${fc.pass ?? '?'}  value=${fc.value?.toFixed(2) ?? '?'}  threshold=${fc.threshold ?? '?'}`);
      }
    }
    if (bioAnalysis.compensationPatterns?.length > 0) {
      console.log(`  Compensation patterns: ${bioAnalysis.compensationPatterns.join(', ')}`);
    }
    if (bioAnalysis._lowConfidenceGated) {
      console.log(`  [GATED — form checks stripped due to low confidence]`);
    }
  }

  // Coaching engine
  if (coaching) {
    console.log('\n── COACHING ENGINE ──');
    const m = coaching.metrics || {};
    if (m.sparc != null) console.log(`  SPARC smoothness: ${typeof m.sparc === 'object' ? JSON.stringify(m.sparc) : m.sparc}`);
    if (m.dtwConsistency != null) console.log(`  DTW consistency:  ${typeof m.dtwConsistency === 'object' ? JSON.stringify(m.dtwConsistency) : m.dtwConsistency}`);
    if (m.fatigue) console.log(`  Fatigue: ${JSON.stringify(m.fatigue)}`);
    if (m.squat) console.log(`  Squat: depth=${JSON.stringify(m.squat.depth)}  valgus=${JSON.stringify(m.squat.valgus)}`);
    if (m.lockout) console.log(`  Lockout: ${JSON.stringify(m.lockout)}`);
    if (m.trunkLean) console.log(`  Trunk lean: ${JSON.stringify(m.trunkLean)}`);
    if (m.barPath) console.log(`  Bar path: ${JSON.stringify(m.barPath)}`);
    if (coaching.feedback?.length > 0) {
      console.log(`  Coaching feedback (${coaching.feedbackCount}):`);
      for (const f of coaching.feedback) {
        console.log(`    [${f.severity || '?'}] ${f.message || f.text || JSON.stringify(f)}`);
      }
    }
    if (coaching.hasWarnings) console.log(`  Has warnings: true`);
    if (coaching.hasCorrections) console.log(`  Has corrections: true`);
  }

  // Coach report (highlights + issues)
  if (report) {
    console.log('\n── COACH REPORT ──');
    console.log(`  Grade: ${report.grade || '?'}`);
    if (report.highlights?.length > 0) {
      console.log(`  Highlights:`);
      for (const h of report.highlights) {
        console.log(`    + ${h.key || h.id || h}`);
      }
    }
    if (report.improvements?.length > 0) {
      console.log(`  Improvements:`);
      for (const imp of report.improvements) {
        console.log(`    - ${imp.key || imp.id || imp}`);
      }
    }
  }

  // Summary line for quick scanning
  console.log('\n── RESULT CARD SUMMARY ──');
  if (result.insufficientFootage) {
    console.log(`  *** INSUFFICIENT FOOTAGE — grade="--", reasons: ${qualityGate.reasons.join('; ')}`);
  } else {
    const grade = progressionResult?.grade?.label || '?';
    console.log(`  ${result.exerciseName}  |  ${reps} reps  |  form=${avgScore ?? 'N/A'}  |  score=${progressionResult?.score ?? 'N/A'} (${grade})  |  gate=${qualityGate.pass ? 'PASS' : 'FAIL'}`);
  }
  console.log('');

  // Save full result as JSON artifact
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const resultArtifact = {
    ...result,
    bioAnalysis,
    coaching,
    report,
    repHistory,
    progressionResult,
    diagnostics: repCounterDiagnostics,
    expected,
  };
  const baseName = (name || 'unknown').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const outPath = join(ARTIFACTS_DIR, `result-${baseName}.json`);
  writeFileSync(outPath, JSON.stringify(resultArtifact, null, 2));
  console.log(`  Result saved: ${outPath}\n`);
}
