import { E as EXERCISES, t as tModule, u as useT, r as reactExports, j as jsxRuntimeExports, a as useProfile, s as saveWorkout, g as getAllWorkouts, c as getExerciseIllustration, b as EXERCISE_GROUPS, M as MuscleMap } from "./index-ClV8Qj7m.js";
import { extractJointAngles, LANDMARKS, drawPose, getImageLandmarker, disposeAllLandmarkers, detectPoseImage, selectSubjectPose } from "./poseAnalysis-Bd3N5Gcc.js";
import { R as RepCounter, E as ExerciseAutoDetector } from "./exerciseDetector-CpWumcCN.js";
let NORM_TO_METERS = 1.7;
function analyzeSet(landmarkFrames, fps, exerciseKey, externalReps, userHeightCm) {
  if (!landmarkFrames || landmarkFrames.length < 2) return emptyResult();
  const exercise = EXERCISES[exerciseKey];
  if (!exercise) return emptyResult();
  const rawFrames = landmarkFrames.map((f) => Array.isArray(f) ? f : f.landmarks || f);
  const anglesPerFrame = rawFrames.map((lm) => extractJointAngles(lm));
  const validAngles = anglesPerFrame.filter((a) => a !== null);
  if (validAngles.length < 2) return emptyResult();
  const trackingValues = anglesPerFrame.map((a) => a ? exercise.getValue(a) : null);
  let reps;
  if (externalReps && externalReps.length > 0) {
    reps = externalReps.map((r) => ({
      start: Math.min(r.startFrame, rawFrames.length - 1),
      bottom: Math.min(r.bottomFrame, rawFrames.length - 1),
      end: Math.min(r.endFrame, rawFrames.length - 1)
    })).filter((r) => r.start >= 0 && r.bottom >= 0 && r.end >= 0 && r.end > r.start);
  } else {
    reps = detectReps(trackingValues);
  }
  const isPulling = [
    "chest_supported_row",
    "seated_row",
    "lat_pulldown",
    "bent_over_row",
    "pull_up",
    "bicep_curl",
    "leg_curl"
  ].includes(exerciseKey);
  const velocity = analyzeVelocity(rawFrames, fps, reps, exercise, isPulling);
  const timeUnderTension = analyzeTUT(reps, fps, isPulling);
  const rangeOfMotion = analyzeROM(trackingValues, reps);
  const asymmetry = analyzeAsymmetry(anglesPerFrame);
  const fatigue = analyzeFatigue(velocity);
  const movementQuality = scoreQuality(velocity, timeUnderTension, rangeOfMotion, asymmetry, fatigue);
  return {
    velocity,
    timeUnderTension,
    rangeOfMotion,
    asymmetry,
    fatigue,
    movementQuality
  };
}
function emptyResult() {
  return {
    velocity: { avg: 0, perRep: [], trend: "insufficient data" },
    timeUnderTension: { total: 0, eccentric: 0, concentric: 0, perRep: [] },
    rangeOfMotion: { avgDegrees: 0, perRep: [], consistency: 100 },
    asymmetry: { score: 0, details: {}, risk: "low" },
    fatigue: { index: 0, velocityDropoff: 0, curve: [], recommendation: "Need more data." },
    movementQuality: 0
  };
}
function detectReps(values) {
  const firstValid = values.find((v) => v !== null);
  if (firstValid === void 0) return [];
  const filled = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] !== null) {
      filled.push(values[i]);
    } else if (filled.length > 0) {
      filled.push(filled[filled.length - 1]);
    } else {
      filled.push(firstValid);
    }
  }
  if (filled.length < 6) return [];
  const smooth = [];
  if (filled.length < 30) {
    smooth.push(...filled);
  } else {
    for (let i = 0; i < filled.length; i++) {
      if (i === 0 || i === filled.length - 1) {
        smooth.push(filled[i]);
      } else {
        smooth.push((filled[i - 1] + filled[i] + filled[i + 1]) / 3);
      }
    }
  }
  const peaks = [];
  const valleys = [];
  for (let i = 1; i < smooth.length - 1; i++) {
    if (smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1] && smooth[i] > smooth[i - 1]) {
      peaks.push({ idx: i, val: smooth[i] });
    }
    if (smooth[i] <= smooth[i - 1] && smooth[i] <= smooth[i + 1] && smooth[i] < smooth[i - 1]) {
      valleys.push({ idx: i, val: smooth[i] });
    }
  }
  const extrema = [
    ...peaks.map((p) => ({ ...p, type: "peak" })),
    ...valleys.map((v) => ({ ...v, type: "valley" }))
  ].sort((a, b) => a.idx - b.idx);
  const alternating = [];
  for (const e of extrema) {
    if (alternating.length === 0 || alternating[alternating.length - 1].type !== e.type) {
      alternating.push(e);
    } else {
      const prev = alternating[alternating.length - 1];
      if (e.type === "peak" && e.val > prev.val) alternating[alternating.length - 1] = e;
      if (e.type === "valley" && e.val < prev.val) alternating[alternating.length - 1] = e;
    }
  }
  const globalMin = Math.min(...smooth);
  const globalMax = Math.max(...smooth);
  const globalRange = globalMax - globalMin;
  const minProminence = Math.max(12, globalRange * 0.3);
  const minFrameGap = 3;
  const significant = [];
  for (let i = 0; i < alternating.length; i++) {
    if (significant.length === 0) {
      significant.push(alternating[i]);
      continue;
    }
    const prev = significant[significant.length - 1];
    const diff = Math.abs(alternating[i].val - prev.val);
    const gap = alternating[i].idx - prev.idx;
    if (diff >= minProminence && gap >= minFrameGap) {
      significant.push(alternating[i]);
    } else if (alternating[i].type === prev.type) {
      if (alternating[i].type === "peak" && alternating[i].val > prev.val || alternating[i].type === "valley" && alternating[i].val < prev.val) {
        significant[significant.length - 1] = alternating[i];
      }
    }
  }
  const reps = [];
  for (let i = 0; i < significant.length - 2; i++) {
    const a = significant[i];
    const b = significant[i + 1];
    const c = significant[i + 2];
    if (a.type === c.type && a.type !== b.type) {
      reps.push({
        start: a.idx,
        bottom: b.idx,
        end: c.idx
      });
      i++;
    }
  }
  return reps;
}
function analyzeVelocity(rawFrames, fps, reps, exercise, isPulling = false) {
  if (reps.length === 0) {
    return { avg: 0, perRep: [], trend: "insufficient data" };
  }
  const isLower = ["knee", "hip"].includes(exercise.joint);
  const timeDelta = 1 / fps;
  const perRep = reps.map((rep) => {
    const concentricStart = isPulling ? rep.start : rep.bottom;
    const concentricEnd = isPulling ? rep.bottom : rep.end;
    if (concentricStart >= concentricEnd || concentricEnd >= rawFrames.length) return 0;
    let totalDisplacement = 0;
    for (let i = concentricStart; i < concentricEnd; i++) {
      const lm1 = rawFrames[i];
      const lm2 = rawFrames[i + 1];
      if (!lm1 || !lm2) continue;
      let p1, p2;
      if (isLower) {
        p1 = midpoint(lm1[LANDMARKS.LEFT_HIP], lm1[LANDMARKS.RIGHT_HIP]);
        p2 = midpoint(lm2[LANDMARKS.LEFT_HIP], lm2[LANDMARKS.RIGHT_HIP]);
      } else {
        p1 = midpoint(lm1[LANDMARKS.LEFT_WRIST], lm1[LANDMARKS.RIGHT_WRIST]);
        p2 = midpoint(lm2[LANDMARKS.LEFT_WRIST], lm2[LANDMARKS.RIGHT_WRIST]);
      }
      const dx = (p2.x - p1.x) * NORM_TO_METERS;
      const dy = (p2.y - p1.y) * NORM_TO_METERS;
      const dz = ((p2.z || 0) - (p1.z || 0)) * NORM_TO_METERS;
      totalDisplacement += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    const duration = (concentricEnd - concentricStart) * timeDelta;
    return duration > 0 ? round(totalDisplacement / duration, 3) : 0;
  });
  const valid = perRep.filter((v) => v > 0);
  const avg = valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
  let trend = "stable";
  if (valid.length >= 3) {
    const firstHalf = valid.slice(0, Math.floor(valid.length / 2));
    const secondHalf = valid.slice(Math.floor(valid.length / 2));
    const f = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const l = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const change = (l - f) / (f || 1) * 100;
    if (change < -15) trend = "declining (fatigue)";
    else if (change < -5) trend = "slightly declining";
    else if (change > 10) trend = "increasing (warm-up)";
  }
  return { avg: round(avg, 3), perRep, trend };
}
function analyzeTUT(reps, fps, isPulling = false) {
  if (reps.length === 0) {
    return { total: 0, eccentric: 0, concentric: 0, perRep: [] };
  }
  const perRep = reps.map((rep) => {
    const phaseA = (rep.bottom - rep.start) / fps;
    const phaseB = (rep.end - rep.bottom) / fps;
    const eccentric = isPulling ? round(phaseB, 2) : round(phaseA, 2);
    const concentric = isPulling ? round(phaseA, 2) : round(phaseB, 2);
    return {
      eccentric,
      concentric,
      total: round(phaseA + phaseB, 2)
    };
  });
  const totalEcc = perRep.reduce((s, r) => s + r.eccentric, 0);
  const totalCon = perRep.reduce((s, r) => s + r.concentric, 0);
  return {
    total: round(totalEcc + totalCon, 2),
    eccentric: round(totalEcc, 2),
    concentric: round(totalCon, 2),
    perRep
  };
}
function analyzeROM(values, reps) {
  if (reps.length === 0) {
    return { avgDegrees: 0, perRep: [], consistency: 100 };
  }
  const perRep = reps.map((rep) => {
    const getVal = (idx, searchUp) => {
      if (values[idx] != null) return values[idx];
      for (let d = 1; d <= 3; d++) {
        if (searchUp && idx + d < values.length && values[idx + d] != null) return values[idx + d];
        if (!searchUp && idx - d >= 0 && values[idx - d] != null) return values[idx - d];
        if (idx + d < values.length && values[idx + d] != null) return values[idx + d];
        if (idx - d >= 0 && values[idx - d] != null) return values[idx - d];
      }
      return 0;
    };
    const topStart = getVal(rep.start, true);
    const topEnd = getVal(rep.end, false);
    const top = Math.max(topStart, topEnd);
    const bottom = getVal(rep.bottom, false);
    return round(Math.abs(top - bottom), 1);
  });
  const valid = perRep.filter((v) => v > 0);
  const avg = valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : 0;
  let consistency = 100;
  if (valid.length >= 2 && avg > 0) {
    const variance = valid.reduce((s, v) => s + (v - avg) ** 2, 0) / valid.length;
    const cv = Math.sqrt(variance) / avg * 100;
    consistency = Math.max(0, Math.round(100 - cv));
  }
  return { avgDegrees: round(avg, 1), perRep, consistency };
}
function analyzeAsymmetry(anglesArray) {
  const pairs = [
    ["leftKnee", "rightKnee", "_visLeftKnee", "_visRightKnee", "Knee"],
    ["leftHip", "rightHip", "_visLeftHip", "_visRightHip", "Hip"],
    ["leftElbow", "rightElbow", "_visLeftElbow", "_visRightElbow", "Elbow"],
    ["leftShoulder", "rightShoulder", "_visLeftShoulder", "_visRightShoulder", "Shoulder"]
  ];
  const VIS_MIN = 0.5;
  const details = {};
  let total = 0;
  let count = 0;
  for (const [left, right, visLeft, visRight, name] of pairs) {
    const diffs = anglesArray.filter((a) => a !== null).filter((a) => {
      const lv = a[visLeft] || 0;
      const rv = a[visRight] || 0;
      return lv >= VIS_MIN && rv >= VIS_MIN;
    }).map((a) => {
      const dominant = Math.max(a[left], a[right]);
      return dominant > 5 ? Math.abs(a[left] - a[right]) / dominant * 100 : 0;
    });
    const avg = diffs.length > 0 ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
    details[name] = round(avg, 1);
    total += avg;
    count++;
  }
  const score = count > 0 ? round(total / count, 1) : 0;
  return {
    score,
    details,
    risk: score > 15 ? "elevated" : score > 10 ? "moderate" : "low"
  };
}
function analyzeFatigue(velocity, reps) {
  if (!velocity.perRep || velocity.perRep.length < 2) {
    return { index: 0, velocityDropoff: 0, curve: [], recommendation: "Need more reps." };
  }
  const vels = velocity.perRep.filter((v) => v > 0);
  if (vels.length < 2) {
    return { index: 0, velocityDropoff: 0, curve: [], recommendation: "Need more reps." };
  }
  const n = Math.min(3, Math.ceil(vels.length / 3));
  const sortedFirst = vels.slice(0, n).sort((a, b) => a - b);
  const sortedLast = vels.slice(-n).sort((a, b) => a - b);
  const medianFirst = sortedFirst[Math.floor(sortedFirst.length / 2)];
  const medianLast = sortedLast[Math.floor(sortedLast.length / 2)];
  const baseline = vels.length >= 4 && vels[0] < medianFirst * 0.8 ? vels.slice(1, n + 1).sort((a, b) => a - b)[Math.floor(n / 2)] : medianFirst;
  const dropoff = baseline > 0 ? round((baseline - medianLast) / baseline * 100, 0) : 0;
  const clampedDropoff = Math.max(0, dropoff);
  const index = Math.min(100, clampedDropoff);
  const normPeak = Math.max(...vels);
  const curve = vels.map((v) => normPeak > 0 ? Math.round(v / normPeak * 100) : 0);
  let recommendation = "";
  if (clampedDropoff > 30) recommendation = "Significant fatigue. Consider reducing volume or increasing rest.";
  else if (clampedDropoff > 20) recommendation = "Moderate fatigue. Good for hypertrophy (Pareja-Blanco 2017).";
  else if (clampedDropoff > 10) recommendation = "Low fatigue. Good for strength without excessive fatigue.";
  else if (dropoff < 0) recommendation = "Velocity increased through the set. Warm-up effect detected.";
  else recommendation = "Minimal fatigue. Could increase intensity or volume.";
  return { index, velocityDropoff: clampedDropoff, curve, recommendation };
}
function scoreQuality(velocity, tut, rom, asymmetry, fatigue) {
  const romScore = Math.min(35, Math.max(0, (rom.consistency || 0) * 0.35));
  let symScore = 25;
  if (asymmetry.score > 25) symScore = 5;
  else if (asymmetry.score > 20) symScore = 10;
  else if (asymmetry.score > 15) symScore = 15;
  else if (asymmetry.score > 10) symScore = 20;
  let tempoScore = 10;
  if (tut.perRep.length > 0) {
    const avgRatio = tut.eccentric / (tut.concentric || 1);
    if (avgRatio >= 1.5 && avgRatio <= 3) tempoScore = 20;
    else if (avgRatio >= 1 && avgRatio <= 4) tempoScore = 15;
    else if (avgRatio < 0.5 || avgRatio > 5) tempoScore = 5;
  }
  let velScore = 5;
  if (velocity.perRep && velocity.perRep.length >= 2) {
    const mean = velocity.perRep.reduce((s, v) => s + v, 0) / velocity.perRep.length;
    if (mean > 0) {
      const variance = velocity.perRep.reduce((s, v) => s + (v - mean) ** 2, 0) / velocity.perRep.length;
      const cv = Math.sqrt(variance) / mean * 100;
      if (cv < 10) velScore = 10;
      else if (cv < 20) velScore = 7;
      else if (cv > 40) velScore = 2;
    }
  }
  let fatigueScore = 5;
  if (fatigue && fatigue.velocityDropoff != null) {
    if (fatigue.velocityDropoff < 10) fatigueScore = 10;
    else if (fatigue.velocityDropoff < 20) fatigueScore = 7;
    else if (fatigue.velocityDropoff > 35) fatigueScore = 2;
  }
  const total = romScore + symScore + tempoScore + velScore + fatigueScore;
  return Math.max(0, Math.min(100, Math.round(total)));
}
function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2
  };
}
function round(val, decimals) {
  const f = 10 ** decimals;
  return Math.round(val * f) / f;
}
function generateWorkoutReport(profile, exerciseResults) {
  if (!exerciseResults || exerciseResults.length === 0) {
    return {
      summary: { key: "coach_no_exercises" },
      grade: "D",
      highlights: [],
      improvements: [{ key: "coach_complete_one" }],
      volumeLoad: 0,
      musclesWorked: []
    };
  }
  const muscleMap = {};
  let totalVolumeLoad = 0;
  let totalScore = 0;
  let totalScoredSets = 0;
  const highlights = [];
  const improvements = [];
  for (const result of exerciseResults) {
    const exercise = EXERCISES[result.exerciseKey || result.exercise];
    if (!exercise) continue;
    const sets = result.sets || 1;
    const reps = result.reps || 0;
    const weight = result.estimatedWeight || 0;
    const repVolume = reps * sets * weight;
    totalVolumeLoad += repVolume;
    const allMuscles = [
      ...exercise.muscles.primary.map((m) => ({ name: m, isPrimary: true })),
      ...exercise.muscles.secondary.map((m) => ({ name: m, isPrimary: false }))
    ];
    for (const m of allMuscles) {
      if (!muscleMap[m.name]) {
        muscleMap[m.name] = { sets: 0, estimatedVolume: 0, isPrimary: false };
      }
      if (m.isPrimary && reps > 0) {
        muscleMap[m.name].sets += sets;
        muscleMap[m.name].isPrimary = true;
      }
      muscleMap[m.name].estimatedVolume += repVolume;
    }
    if (result.analysis && result.analysis.movementQuality != null) {
      totalScore += result.analysis.movementQuality;
      totalScoredSets++;
    } else if (result.repHistory && result.repHistory.length > 0) {
      const avgRepScore = result.repHistory.reduce((s, r) => s + (r.score || 0), 0) / result.repHistory.length;
      if (!isNaN(avgRepScore)) {
        totalScore += avgRepScore;
        totalScoredSets++;
      }
    }
    if (result.analysis) {
      if (result.analysis.asymmetry && result.analysis.asymmetry.score <= 10) {
        highlights.push({ key: "coach_symmetry", exercise: exercise.key, exerciseName: exercise.name });
      }
      if (result.analysis.fatigue && result.analysis.fatigue.velocityDropoff > 30) {
        improvements.push({ key: "coach_velocity_drop", exercise: exercise.key, exerciseName: exercise.name, dropoff: Math.round(result.analysis.fatigue.velocityDropoff) });
      }
      if (result.analysis.rangeOfMotion && result.analysis.rangeOfMotion.consistency < 70) {
        improvements.push({ key: "coach_rom_inconsistent", exercise: exercise.key, exerciseName: exercise.name, consistency: result.analysis.rangeOfMotion.consistency });
      }
      if (result.analysis.compensationPatterns) {
        for (const comp of result.analysis.compensationPatterns) {
          if (comp.severity === "major") {
            improvements.push({ key: "coach_compensation", exercise: exercise.key, exerciseName: exercise.name, pattern: comp.pattern, description: comp.description });
          }
        }
      }
      if (result.analysis.movementQuality >= 85) {
        highlights.push({ key: "coach_quality_strong", exercise: exercise.key, exerciseName: exercise.name, score: result.analysis.movementQuality });
      }
    }
  }
  const avgScore = totalScoredSets > 0 ? totalScore / totalScoredSets : 50;
  const grade = _scoreToGrade(avgScore);
  const musclesWorked = Object.entries(muscleMap).filter(([_, data]) => data.isPrimary).sort((a, b) => b[1].sets - a[1].sets).map(([name, data]) => ({
    name,
    sets: data.sets,
    estimatedVolume: data.estimatedVolume > 0 ? `${Math.round(data.estimatedVolume)} kg` : "bodyweight"
  }));
  for (const m of musclesWorked) {
    if (m.sets >= 4) {
      highlights.push({ key: "coach_good_volume", muscle: m.name, sets: m.sets });
    }
  }
  if (highlights.length === 0) {
    highlights.push({ key: "coach_session_completed", count: exerciseResults.length });
  }
  if (improvements.length === 0) {
    improvements.push({ key: "coach_no_issues" });
  }
  const dedup = (arr) => {
    const seen = /* @__PURE__ */ new Set();
    return arr.filter((item) => {
      const id = `${item.key}:${item.exercise || item.muscle || ""}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, 5);
  };
  const totalReps = exerciseResults.reduce((s, r) => s + (r.reps || 0) * (r.sets || 1), 0);
  const qualityTier = avgScore >= 85 ? "strong" : avgScore >= 70 ? "solid" : avgScore >= 55 ? "needs_attention" : "significant_issues";
  return {
    summary: {
      key: "coach_summary",
      grade,
      totalReps,
      exerciseCount: exerciseResults.length,
      exerciseNames: exerciseResults.map((r) => EXERCISES[r.exerciseKey]?.name || r.exerciseKey).filter(Boolean),
      volumeLoad: Math.round(totalVolumeLoad),
      qualityTier
    },
    grade,
    highlights: dedup(highlights),
    improvements: dedup(improvements),
    volumeLoad: Math.round(totalVolumeLoad),
    musclesWorked
  };
}
function _scoreToGrade(score) {
  if (score >= 93) return "A+";
  if (score >= 85) return "A";
  if (score >= 78) return "B+";
  if (score >= 68) return "B";
  if (score >= 55) return "C";
  return "D";
}
function resolveText(item) {
  if (typeof item === "string") return item;
  if (item && item.key) return tModule(item.key, item);
  return String(item);
}
const W = 1080;
const H = 1350;
const PAD = 60;
const ACCENT = "#00FF88";
const BG = "#06060A";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const TEXT = "#E8E8EF";
const MUTED = "#6B6B82";
const RED = "#FF3B5C";
const YELLOW = "#FFB836";
function gradeFromScore$1(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 70) return "C+";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}
function gradeColor(score) {
  if (score >= 80) return ACCENT;
  if (score >= 60) return YELLOW;
  return RED;
}
function formatTime$1(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
async function generateShareCard(result, videoEl) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.5);
  glow1.addColorStop(0, "rgba(0,255,136,0.04)");
  glow1.addColorStop(1, "transparent");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(W * 0.8, H * 0.85, 0, W * 0.8, H * 0.85, W * 0.4);
  glow2.addColorStop(0, "rgba(0,212,255,0.03)");
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);
  let thumbH = 500;
  {
    thumbH = 0;
  }
  let y = Math.max(thumbH, 40);
  const grade = gradeFromScore$1(result.formScore);
  const gc = gradeColor(result.formScore);
  const badgeSize = 100;
  const bx = W - PAD - badgeSize;
  const by = y + 10;
  roundRect(ctx, bx, by, badgeSize, badgeSize, 20);
  ctx.fillStyle = gc;
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.font = "bold 48px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(grade, bx + badgeSize / 2, by + badgeSize / 2);
  ctx.fillStyle = TEXT;
  ctx.font = "bold 56px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(result.exerciseName, PAD, y + 20);
  ctx.fillStyle = MUTED;
  ctx.font = "28px -apple-system, system-ui, sans-serif";
  ctx.fillText(formatTime$1(result.duration), PAD, y + 88);
  y += 150;
  const stats = [
    { value: `${result.reps}`, label: "REPS" },
    { value: `${result.formScore}`, label: "FORM" },
    { value: result.bioAnalysis?.movementQuality != null ? `${Math.round(result.bioAnalysis.movementQuality)}` : "--", label: "QUALITY" }
  ];
  if (result.bioAnalysis?.asymmetry?.score != null) {
    stats.push({ value: `${Math.round(result.bioAnalysis.asymmetry.score)}%`, label: "SYMMETRY" });
  }
  const statsCardH = 160;
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 20);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  ctx.fill();
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 20);
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const statW = (W - PAD * 2) / stats.length;
  stats.forEach((s, i) => {
    const cx2 = PAD + statW * i + statW / 2;
    ctx.fillStyle = ACCENT;
    ctx.font = "bold 52px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(s.value, cx2, y + 30);
    ctx.fillStyle = MUTED;
    ctx.font = "600 22px -apple-system, system-ui, sans-serif";
    ctx.fillText(s.label, cx2, y + 100);
  });
  y += statsCardH + 30;
  if (result.repHistory && result.repHistory.length > 0) {
    ctx.fillStyle = TEXT;
    ctx.font = "bold 32px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Rep Quality", PAD, y);
    y += 50;
    const barsH = 180;
    roundRect(ctx, PAD, y, W - PAD * 2, barsH, 16);
    ctx.fillStyle = CARD_BG;
    ctx.fill();
    const barPad = 20;
    const barAreaW = W - PAD * 2 - barPad * 2;
    const barAreaH = barsH - barPad * 2 - 30;
    const gap = 6;
    const barW = Math.max(8, (barAreaW - gap * (result.repHistory.length - 1)) / result.repHistory.length);
    result.repHistory.forEach((r, i) => {
      const score = r.score || 0;
      const barH = Math.max(4, score / 100 * barAreaH);
      const bx2 = PAD + barPad + i * (barW + gap);
      const by2 = y + barPad + barAreaH - barH;
      roundRect(ctx, bx2, by2, barW, barH, 3);
      ctx.fillStyle = score >= 80 ? ACCENT : score >= 50 ? YELLOW : RED;
      ctx.fill();
      ctx.fillStyle = MUTED;
      ctx.font = "18px -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${i + 1}`, bx2 + barW / 2, y + barPad + barAreaH + 6);
    });
    y += barsH + 30;
  }
  if (result.repHistory && result.repHistory.length > 0) {
    const allIssues = {};
    result.repHistory.forEach((r) => {
      (r.issues || []).forEach((issue) => {
        allIssues[issue] = (allIssues[issue] || 0) + 1;
      });
    });
    const sorted = Object.entries(allIssues).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sorted.length > 0) {
      ctx.fillStyle = TEXT;
      ctx.font = "bold 32px -apple-system, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Form Notes", PAD, y);
      y += 50;
      sorted.forEach(([issue, count]) => {
        ctx.fillStyle = YELLOW;
        ctx.font = "26px -apple-system, system-ui, sans-serif";
        ctx.fillText(`! ${issue} (${count}/${result.repHistory.length} reps)`, PAD + 10, y);
        y += 40;
      });
      y += 10;
    }
  }
  if (result.report?.highlights?.length > 0) {
    ctx.fillStyle = TEXT;
    ctx.font = "bold 32px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Highlights", PAD, y);
    y += 50;
    result.report.highlights.slice(0, 2).forEach((h) => {
      ctx.fillStyle = ACCENT;
      ctx.font = "26px -apple-system, system-ui, sans-serif";
      const maxW = W - PAD * 2 - 20;
      wrapText(ctx, `> ${resolveText(h)}`, PAD + 10, y, maxW, 36);
      y += 44;
    });
    y += 10;
  }
  const cx = W / 2;
  const skY = Math.min(y + 40, H - 280);
  const scale = W / 500;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 6 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.arc(cx, skY, 18 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, skY + 18 * scale);
  ctx.lineTo(cx, skY + 80 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, skY + 25 * scale);
  ctx.lineTo(cx - 35 * scale, skY + 50 * scale);
  ctx.lineTo(cx - 25 * scale, skY + 20 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, skY + 25 * scale);
  ctx.lineTo(cx + 35 * scale, skY + 50 * scale);
  ctx.lineTo(cx + 25 * scale, skY + 20 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, skY + 80 * scale);
  ctx.lineTo(cx - 25 * scale, skY + 130 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, skY + 80 * scale);
  ctx.lineTo(cx + 25 * scale, skY + 130 * scale);
  ctx.stroke();
  const footerY = H - 90;
  const sepGrad = ctx.createLinearGradient(PAD * 3, 0, W - PAD * 3, 0);
  sepGrad.addColorStop(0, "transparent");
  sepGrad.addColorStop(0.2, "rgba(0,255,136,0.3)");
  sepGrad.addColorStop(0.8, "rgba(0,212,255,0.3)");
  sepGrad.addColorStop(1, "transparent");
  ctx.fillStyle = sepGrad;
  ctx.fillRect(PAD * 3, footerY - 20, W - PAD * 6, 1.5);
  ctx.fillStyle = ACCENT;
  ctx.font = "800 38px -apple-system, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WorkoutVision", W / 2, footerY + 10);
  ctx.fillStyle = MUTED;
  ctx.font = "500 22px -apple-system, system-ui, sans-serif";
  ctx.fillText("AI-Powered Form Analysis", W / 2, footerY + 52);
  return canvas.toDataURL("image/png");
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y);
      line = word + " ";
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y);
}
async function downloadShareCard(result, videoEl) {
  const dataUrl = await generateShareCard(result);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `workout-${result.exerciseName.replace(/\s+/g, "-")}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.png`;
  a.click();
}
async function shareCard(result, videoEl) {
  const dataUrl = await generateShareCard(result);
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `workout-${result.exerciseName.replace(/\s+/g, "-")}.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${result.exerciseName} - ${gradeFromScore$1(result.formScore)}`,
          text: `${result.reps} reps, Form: ${result.formScore}/100`
        });
        return;
      }
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  downloadShareCard(result);
}
function findClosestFrame(frames, time) {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (frames[mid].timestamp < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].timestamp - time) < Math.abs(frames[lo].timestamp - time)) {
    return frames[lo - 1];
  }
  return frames[lo];
}
function drawOverlay(ctx, w, h, frames, time, exerciseName, reps, formScore, repHistory) {
  let currentFeedback = null;
  if (repHistory && repHistory.length > 0) {
    const rep = repHistory.find((r) => time >= r.startTime && time <= r.endTime);
    if (rep) currentFeedback = rep.feedback;
  }
  const closest = frames.length > 0 ? findClosestFrame(frames, time) : null;
  if (closest && closest.landmarks) {
    drawPose(ctx, closest.landmarks, w, h, 1, currentFeedback);
  }
  const scale = w / 480;
  const pad = Math.round(16 * scale);
  const boxH = Math.round(70 * scale);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, w, boxH);
  ctx.fillStyle = "#00FF88";
  ctx.font = `bold ${Math.round(24 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(exerciseName, pad, boxH / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.round(22 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(`${reps} reps`, w - pad, boxH / 2);
  const brandH = Math.round(36 * scale);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, h - brandH, w, brandH);
  ctx.fillStyle = "#00FF88";
  ctx.font = `bold ${Math.round(16 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("WorkoutVision", w / 2, h - brandH / 2);
}
function getBestMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const mimeTypes = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4"
  ];
  for (const m of mimeTypes) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}
function canExportVideo() {
  if (typeof MediaRecorder === "undefined") return false;
  const testCanvas = document.createElement("canvas");
  return typeof testCanvas.captureStream === "function";
}
function VideoReplay({ videoUrl, frames, exerciseName, reps, formScore, repHistory, onClose }) {
  const { t } = useT();
  const videoRef = reactExports.useRef(null);
  const canvasRef = reactExports.useRef(null);
  const ctxRef = reactExports.useRef(null);
  const hdCanvasRef = reactExports.useRef(null);
  const hdRafRef = reactExports.useRef(null);
  const rafRef = reactExports.useRef(null);
  const recorderRef = reactExports.useRef(null);
  const chunksRef = reactExports.useRef([]);
  const progressFrameRef = reactExports.useRef(0);
  const [playing, setPlaying] = reactExports.useState(false);
  const [exporting, setExporting] = reactExports.useState(false);
  const [exportProgress, setExportProgress] = reactExports.useState(0);
  const [progress, setProgress] = reactExports.useState(0);
  const IS_IOS2 = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const lastDrawRef = reactExports.useRef(0);
  const DRAW_INTERVAL = IS_IOS2 ? 66 : 33;
  const drawFrame = reactExports.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused) return;
    const now = performance.now();
    if (now - lastDrawRef.current < DRAW_INTERVAL) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    lastDrawRef.current = now;
    try {
      const ctx = ctxRef.current || canvas.getContext("2d");
      ctxRef.current = ctx;
      const w = canvas.width;
      const h = canvas.height;
      ctx.drawImage(video, 0, 0, w, h);
      drawOverlay(ctx, w, h, frames, video.currentTime, exerciseName, reps, formScore, repHistory);
      progressFrameRef.current++;
      if (progressFrameRef.current % 5 === 0) {
        setProgress(video.duration > 0 ? video.currentTime / video.duration * 100 : 0);
      }
    } catch (e) {
      console.warn("Draw frame error:", e);
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [frames, exerciseName, reps, formScore, repHistory]);
  reactExports.useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.src = videoUrl;
    video.load();
    const onLoaded = () => {
      const canvas = canvasRef.current;
      if (canvas && video.videoWidth > 0) {
        const maxWidth = IS_IOS2 ? 480 : 720;
        const displayScale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * displayScale);
        canvas.height = Math.round(video.videoHeight * displayScale);
        const ctx = canvas.getContext("2d");
        ctxRef.current = ctx;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (frames.length > 0 && frames[0].landmarks) {
          drawOverlay(ctx, canvas.width, canvas.height, frames, 0, exerciseName, reps, formScore, repHistory);
        }
      }
    };
    video.addEventListener("loadeddata", onLoaded, { once: true });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hdRafRef.current) cancelAnimationFrame(hdRafRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [videoUrl, frames, exerciseName, reps, formScore, repHistory]);
  const togglePlay = reactExports.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
      rafRef.current = requestAnimationFrame(drawFrame);
    } else {
      video.pause();
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [drawFrame]);
  reactExports.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnd = () => {
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    video.addEventListener("ended", onEnd);
    return () => video.removeEventListener("ended", onEnd);
  }, []);
  const exportHD = reactExports.useCallback(() => {
    const video = videoRef.current;
    if (!video || exporting) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPlaying(false);
    const maxExportWidth = IS_IOS2 ? 1080 : video.videoWidth;
    const exportScale = Math.min(1, maxExportWidth / video.videoWidth);
    const hdCanvas = document.createElement("canvas");
    hdCanvas.width = Math.round(video.videoWidth * exportScale);
    hdCanvas.height = Math.round(video.videoHeight * exportScale);
    hdCanvasRef.current = hdCanvas;
    const hdCtx = hdCanvas.getContext("2d");
    video.currentTime = 0;
    setExporting(true);
    setExportProgress(0);
    chunksRef.current = [];
    const mime = getBestMime();
    const stream = hdCanvas.captureStream(30);
    try {
      if (video.captureStream) {
        const videoStream = video.captureStream();
        videoStream.getAudioTracks().forEach((t2) => stream.addTrack(t2));
      }
    } catch (e) {
    }
    const recorder = new MediaRecorder(stream, {
      mimeType: mime || void 0,
      videoBitsPerSecond: 8e6
      // 8 Mbps for HD quality
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `WorkoutVision-${exerciseName.replace(/\s+/g, "-")}-${reps}reps.${ext}`;
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `${exerciseName} - Form: ${formScore}`,
          text: `${reps} reps analyzed by WorkoutVision`
        }).catch(() => {
          triggerDownload(blob, fileName);
        });
      } else {
        triggerDownload(blob, fileName);
      }
      setExporting(false);
      setExportProgress(0);
      hdCanvasRef.current = null;
    };
    recorderRef.current = recorder;
    recorder.start(100);
    const drawHDFrame = () => {
      if (video.paused || video.ended) return;
      const w = hdCanvas.width;
      const h = hdCanvas.height;
      hdCtx.drawImage(video, 0, 0, w, h);
      drawOverlay(hdCtx, w, h, frames, video.currentTime, exerciseName, reps, formScore, repHistory);
      setExportProgress(video.duration > 0 ? Math.round(video.currentTime / video.duration * 100) : 0);
      hdRafRef.current = requestAnimationFrame(drawHDFrame);
    };
    const onExportEnd = () => {
      if (hdRafRef.current) {
        cancelAnimationFrame(hdRafRef.current);
        hdRafRef.current = null;
      }
      if (recorder.state !== "inactive") recorder.stop();
      video.removeEventListener("ended", onExportEnd);
      video.muted = true;
    };
    video.addEventListener("ended", onExportEnd);
    video.muted = true;
    video.play();
    hdRafRef.current = requestAnimationFrame(drawHDFrame);
  }, [frames, exerciseName, reps, formScore, repHistory, exporting]);
  const cancelExport = reactExports.useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    if (hdRafRef.current) {
      cancelAnimationFrame(hdRafRef.current);
      hdRafRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setExporting(false);
    setExportProgress(0);
    chunksRef.current = [];
  }, []);
  const saveScreenshot = reactExports.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const hdCanvas = document.createElement("canvas");
    hdCanvas.width = video.videoWidth;
    hdCanvas.height = video.videoHeight;
    const ctx = hdCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0, hdCanvas.width, hdCanvas.height);
    drawOverlay(ctx, hdCanvas.width, hdCanvas.height, frames, video.currentTime, exerciseName, reps);
    hdCanvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `WorkoutVision-${exerciseName.replace(/\s+/g, "-")}-${reps}reps.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: `${exerciseName} - Form: ${formScore}` }).catch(() => {
        });
      } else {
        triggerDownload(blob, fileName);
      }
    }, "image/png");
  }, [frames, exerciseName, reps, formScore, repHistory]);
  const supportsVideoExport = canExportVideo();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "replay-page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "replay-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "btn btn-ghost btn-sm", onClick: onClose, children: [
        "← ",
        t("back")
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { children: t("ai_overlay") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: 60 } })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "replay-view", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("video", { ref: videoRef, style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.01, pointerEvents: "none", zIndex: -1 }, muted: true, playsInline: true, preload: "auto" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "canvas",
        {
          ref: canvasRef,
          className: "replay-canvas",
          onClick: !exporting ? togglePlay : void 0
        }
      ),
      !playing && !exporting && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "replay-play-btn", onClick: togglePlay, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "▶" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "replay-progress", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "replay-progress-fill", style: { width: `${progress}%` } }) })
    ] }),
    exporting && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { textAlign: "center", padding: "10px 0" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { fontSize: "0.85rem", color: "var(--muted)", marginBottom: 6 }, children: [
        t("exporting"),
        "... ",
        exportProgress,
        "%"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "replay-progress", style: { margin: "0 20px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "replay-progress-fill", style: { width: `${exportProgress}%` } }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 8 }, onClick: cancelExport, children: t("cancel") })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "replay-actions", children: [
      supportsVideoExport ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "btn btn-primary replay-btn",
          onClick: exportHD,
          disabled: exporting,
          style: { flex: 1 },
          children: t("download_hd")
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "btn btn-primary replay-btn",
          onClick: saveScreenshot,
          style: { flex: 1 },
          children: t("save_screenshot")
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost replay-btn", onClick: onClose, children: t("back") })
    ] })
  ] });
}
function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  if (navigator.share) {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => {
        fallbackDownload(url, fileName);
      });
      return;
    }
  }
  fallbackDownload(url, fileName);
}
function fallbackDownload(url, fileName) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
const BUILD_ID = "v10-single-canvas";
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
const MAX_FRAMES = IS_IOS ? 90 : 150;
const MAX_FILE_SIZE = IS_IOS ? 250 * 1024 * 1024 : 500 * 1024 * 1024;
function gradeFromScore(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 70) return "C+";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}
function gradeClass(score) {
  if (score >= 80) return "good";
  if (score >= 60) return "ok";
  return "poor";
}
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function VideoUpload({ onClose, preSelectedExercise }) {
  const { t, tExercise, lang, setLang } = useT();
  const { profile: userProfile } = useProfile();
  const [queue, setQueue] = reactExports.useState([]);
  const [exercise, setExercise] = reactExports.useState(preSelectedExercise || "__auto__");
  const [autoDetect, setAutoDetect] = reactExports.useState(!preSelectedExercise);
  const userChangedExercise = reactExports.useRef(!!preSelectedExercise);
  const [weight, setWeight] = reactExports.useState("");
  const [analyzing, setAnalyzing] = reactExports.useState(false);
  const [analysisPhase, setAnalysisPhase] = reactExports.useState("");
  const [currentFile, setCurrentFile] = reactExports.useState(null);
  const [progress, setProgress] = reactExports.useState(0);
  const [results, setResults] = reactExports.useState([]);
  const [replayResult, setReplayResult] = reactExports.useState(null);
  const [liveReps, setLiveReps] = reactExports.useState(0);
  const fileInputRef = reactExports.useRef(null);
  const videoRef = reactExports.useRef(null);
  const overlayRef = reactExports.useRef(null);
  const abortRef = reactExports.useRef(false);
  const blobUrlRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    return () => {
      abortRef.current = true;
      disposeAllLandmarkers();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      }
    };
  }, []);
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("video/") || f.type === "");
    if (files.length === 0) return;
    const items = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        alert(`${f.name} (${(f.size / 1024 / 1024).toFixed(0)} MB) ${t("too_large")}`);
        continue;
      }
      items.push({
        id: Date.now() + Math.random(),
        file: f,
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(1) + " MB",
        status: "queued",
        progress: 0
      });
    }
    if (items.length) setQueue((prev) => [...prev, ...items]);
    e.target.value = "";
  };
  const removeFromQueue = (id) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };
  const analyzeVideo = reactExports.useCallback(async (queueItem) => {
    const video = videoRef.current;
    if (!video) return null;
    setAnalysisPhase("model");
    const landmarker = await getImageLandmarker();
    if (!landmarker) {
      alert(t("model_failed"));
      return null;
    }
    setAnalysisPhase("loading");
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const url = URL.createObjectURL(queueItem.file);
    blobUrlRef.current = url;
    let urlRevoked = false;
    const safeRevoke = () => {
      if (!urlRevoked) {
        urlRevoked = true;
        URL.revokeObjectURL(url);
        blobUrlRef.current = null;
      }
    };
    const loaded = await new Promise((resolve) => {
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = url;
      video.load();
      let settled = false;
      const done = (v) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };
      video.addEventListener("loadeddata", () => done(true), { once: true });
      video.onerror = () => done(false);
      setTimeout(() => done(false), 2e4);
    });
    if (!loaded) {
      safeRevoke();
      alert(t("video_failed"));
      return null;
    }
    const duration = video.duration;
    if (!duration || !isFinite(duration)) {
      safeRevoke();
      alert("Cannot read video duration. Try a different file.");
      return null;
    }
    const analysisFps = Math.min(IS_IOS ? 4 : 6, MAX_FRAMES / duration);
    const totalFrames = Math.min(MAX_FRAMES, Math.ceil(duration * analysisFps));
    const interval = duration / totalFrames;
    const maxAnalysisWidth = IS_IOS ? 480 : 720;
    const scale = Math.min(1, maxAnalysisWidth / video.videoWidth);
    const offscreen = document.createElement("canvas");
    offscreen.width = Math.round(video.videoWidth * scale);
    offscreen.height = Math.round(video.videoHeight * scale);
    const offCtx = offscreen.getContext("2d");
    console.log(`[Upload] ${BUILD_ID}: ${duration.toFixed(1)}s, ${video.videoWidth}x${video.videoHeight}, ${totalFrames} frames at ${analysisFps.toFixed(1)} FPS`);
    const frames = [];
    const replayFrames = [];
    const isAutoMode = exercise === "__auto__";
    const initialExercise = isAutoMode ? "squat" : exercise;
    let detectedExercise = initialExercise;
    let repCounter = new RepCounter(initialExercise, { fps: analysisFps });
    const skipAutoDetect = !isAutoMode && userChangedExercise.current;
    const autoDetector = isAutoMode || autoDetect && !skipAutoDetect ? new ExerciseAutoDetector({ fps: analysisFps }) : null;
    let autoDetected = false;
    const analysisStart = Date.now();
    setAnalysisPhase("analyzing");
    setLiveReps(0);
    const hasRVFC = typeof video.requestVideoFrameCallback === "function";
    const waitForFrame = () => new Promise((resolve) => {
      if (hasRVFC) {
        const timeout = setTimeout(resolve, 800);
        video.requestVideoFrameCallback(() => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        const start = Date.now();
        const check = () => {
          if (video.readyState >= 2 || Date.now() - start > 500) {
            if (typeof requestAnimationFrame !== "undefined") {
              requestAnimationFrame(() => requestAnimationFrame(resolve));
            } else {
              setTimeout(resolve, 80);
            }
          } else {
            setTimeout(check, 20);
          }
        };
        check();
      }
    });
    let lockedSubjectIdx = null;
    const processFrame = (frameIdx2) => {
      return new Promise((res) => {
        const time = frameIdx2 * interval;
        if (time >= duration || abortRef.current) {
          res(false);
          return;
        }
        video.currentTime = time;
        let settled = false;
        const settle = (cont) => {
          if (!settled) {
            settled = true;
            res(cont);
          }
        };
        const onSeeked = async () => {
          video.removeEventListener("seeked", onSeeked);
          await waitForFrame();
          offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
          const result = detectPoseImage(landmarker, offscreen);
          const canvas = overlayRef.current;
          if (canvas) {
            const vw = video.videoWidth || 1080;
            const vh = video.videoHeight || 1920;
            if (canvas.width !== vw || canvas.height !== vh) {
              canvas.width = vw;
              canvas.height = vh;
            }
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, vw, vh);
            ctx.drawImage(video, 0, 0, vw, vh);
            if (result?.landmarks?.length) {
              let landmarks;
              if (result.landmarks.length === 1) {
                landmarks = result.landmarks[0];
              } else {
                if (lockedSubjectIdx === null) {
                  landmarks = selectSubjectPose(result.landmarks);
                  lockedSubjectIdx = result.landmarks.indexOf(landmarks);
                } else {
                  landmarks = result.landmarks[lockedSubjectIdx] || selectSubjectPose(result.landmarks);
                }
              }
              const angles = extractJointAngles(landmarks);
              frames.push({ landmarks, timestamp: time, angles });
              const updateResult = repCounter.update(landmarks);
              setLiveReps(updateResult.reps);
              drawPose(ctx, landmarks, vw, vh, 1, null);
              ctx.fillStyle = "#00FF88";
              ctx.font = `bold ${Math.max(24, Math.round(vw / 12))}px -apple-system, sans-serif`;
              ctx.textAlign = "left";
              ctx.textBaseline = "top";
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 4;
              ctx.fillText(`${updateResult.reps} reps`, 20, 20);
              ctx.shadowBlur = 0;
              if (!IS_IOS || frameIdx2 % 2 === 0) {
                replayFrames.push({ landmarks, timestamp: time });
              }
            }
          }
          const pct = Math.min(99, Math.round((frameIdx2 + 1) / totalFrames * 100));
          setProgress(pct);
          setQueue((prev) => prev.map(
            (q) => q.id === queueItem.id ? { ...q, progress: pct } : q
          ));
          await new Promise((r) => requestAnimationFrame(r));
          settle(true);
        };
        video.addEventListener("seeked", onSeeked);
        setTimeout(() => {
          video.removeEventListener("seeked", onSeeked);
          settle(true);
        }, 5e3);
      });
    };
    let frameIdx = 0;
    while (frameIdx < totalFrames) {
      const cont = await processFrame(frameIdx);
      if (!cont) break;
      frameIdx++;
      if (frameIdx % 5 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
      if (Date.now() - analysisStart > 18e4) {
        console.warn("[Upload] 3-minute wall-clock cap reached");
        break;
      }
    }
    const analysisTime = ((Date.now() - analysisStart) / 1e3).toFixed(1);
    if (frames.length === 0) {
      safeRevoke();
      video.removeAttribute("src");
      video.load();
      alert(`${t("no_poses")} ${queueItem.name}.

${t("try_different")}`);
      return null;
    }
    if (autoDetector && !userChangedExercise.current) {
      const tallies = {};
      const detector = new ExerciseAutoDetector({ fps: analysisFps });
      for (const f of frames) {
        const det = detector.update(f.landmarks);
        if (det) tallies[det] = (tallies[det] || 0) + 1;
      }
      const candidates = Object.keys(tallies);
      if (candidates.length > 0) {
        let bestEx = initialExercise;
        let bestScore = -1;
        for (const ex of candidates) {
          const rc = new RepCounter(ex, { fps: analysisFps });
          for (const f of frames) rc.update(f.landmarks);
          rc.finalize();
          const reps2 = rc.repHistory ? rc.repHistory.length : 0;
          const score = reps2 * 1e3 + tallies[ex];
          if (score > bestScore) {
            bestScore = score;
            bestEx = ex;
          }
        }
        if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
          detectedExercise = bestEx;
          autoDetected = true;
          setExercise(detectedExercise);
          repCounter = new RepCounter(detectedExercise, { fps: analysisFps });
          for (const f of frames) repCounter.update(f.landmarks);
        }
      }
    }
    repCounter.finalize();
    const enrichedRepHistory = repCounter.repHistory.map((r) => ({
      ...r,
      startTime: r.startFrame * interval,
      peakTime: r.peakFrame * interval,
      endTime: r.endFrame * interval
    }));
    console.log(`[Upload] Exercise: ${detectedExercise}, ${frames.length}/${totalFrames} frames in ${analysisTime}s`);
    console.log(`[Upload] Reps detected: ${repCounter.reps}, diagnostics:`, repCounter.diagnostics);
    if (frames.length > 0) {
      const ex = EXERCISES[detectedExercise];
      const sampleAngles = frames.filter((_, i) => i % 5 === 0).map((f) => {
        if (!f.angles) return null;
        const val = ex?.getValue(f.angles, f.landmarks);
        return val !== null ? Math.round(val) : null;
      }).filter((v) => v !== null);
      console.log(`[Upload] Angle signal (every 5th frame):`, sampleAngles.join(", "));
    }
    const landmarkFrames = frames.map((f) => f.landmarks);
    const repHistory = enrichedRepHistory;
    const reps = repHistory.length;
    let bioAnalysis = null;
    try {
      bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory);
    } catch (err) {
      console.error("Bio analysis error:", err);
    }
    let report = null;
    try {
      report = generateWorkoutReport(userProfile, [{
        exerciseKey: detectedExercise,
        exercise: detectedExercise,
        reps,
        analysis: bioAnalysis,
        bioAnalysis,
        repHistory
      }]);
    } catch (err) {
      console.error("Report error:", err);
    }
    const diagnostics = repCounter.diagnostics || null;
    const scoredReps = repHistory.filter((r) => r.score !== null && r.score !== void 0);
    const avgScore = scoredReps.length > 0 ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length) : bioAnalysis?.movementQuality || 0;
    const w = parseFloat(weight) || 0;
    const workout = {
      id: Date.now().toString(),
      date: (/* @__PURE__ */ new Date()).toISOString(),
      exercise: detectedExercise,
      exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
      reps,
      duration: Math.round(duration),
      formScore: avgScore,
      repHistory,
      weight: w,
      volume: w * reps,
      source: "upload",
      avgRom: bioAnalysis?.rangeOfMotion?.avgDegrees || 0
    };
    try {
      await saveWorkout(workout);
    } catch (err) {
      console.error("Save error:", err);
    }
    let progression = null;
    try {
      const allWorkouts = await getAllWorkouts();
      const prev = allWorkouts.filter((s) => s.exercise === detectedExercise && s.id !== workout.id).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (prev) {
        progression = { prevReps: prev.reps, prevScore: prev.formScore, prevRom: prev.avgRom || 0, prevWeight: prev.weight || 0, prevDate: prev.date };
      }
    } catch (_) {
    }
    setProgress(100);
    video.removeAttribute("src");
    video.load();
    return {
      fileName: queueItem.name,
      exercise: detectedExercise,
      exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
      reps,
      duration: Math.round(duration),
      analysisTime,
      formScore: avgScore,
      bioAnalysis,
      repHistory,
      progression,
      report,
      diagnostics,
      videoUrl: url,
      frames: replayFrames,
      autoDetected
    };
  }, [exercise, autoDetect]);
  const startAnalysis = reactExports.useCallback(async () => {
    setAnalyzing(true);
    abortRef.current = false;
    const pending = queue.filter((q) => q.status === "queued");
    const allResults = [...results];
    for (const item of pending) {
      if (abortRef.current) break;
      setCurrentFile(item.name);
      setProgress(0);
      setQueue((prev) => prev.map(
        (q) => q.id === item.id ? { ...q, status: "analyzing" } : q
      ));
      try {
        const result = await analyzeVideo(item);
        if (result) {
          setQueue((prev) => prev.map(
            (q) => q.id === item.id ? { ...q, status: "done", progress: 100 } : q
          ));
          allResults.push(result);
        } else {
          setQueue((prev) => prev.map(
            (q) => q.id === item.id ? { ...q, status: "error", progress: 0 } : q
          ));
        }
      } catch (err) {
        console.error("[VideoUpload] Analysis failed for", item.name, err);
        setQueue((prev) => prev.map(
          (q) => q.id === item.id ? { ...q, status: "error", progress: 0 } : q
        ));
      }
    }
    setResults(allResults);
    setAnalyzing(false);
    setCurrentFile(null);
  }, [queue, results, analyzeVideo]);
  const hasQueued = queue.some((q) => q.status === "queued");
  if (replayResult) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      VideoReplay,
      {
        videoUrl: replayResult.videoUrl,
        frames: replayResult.frames,
        exerciseName: replayResult.exerciseName,
        reps: replayResult.reps,
        formScore: replayResult.formScore,
        repHistory: replayResult.repHistory,
        onClose: () => setReplayResult(null)
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "page-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: t("analyze_video") }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-ghost btn-sm",
            style: { fontSize: "0.7rem", padding: "4px 8px", opacity: lang === "en" ? 1 : 0.5 },
            onClick: () => setLang("en"),
            children: "EN"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-ghost btn-sm",
            style: { fontSize: "0.7rem", padding: "4px 8px", opacity: lang === "fr" ? 1 : 0.5 },
            onClick: () => setLang("fr"),
            children: "FR"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost btn-sm", onClick: onClose, children: t("close") })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "upload-zone", onClick: () => fileInputRef.current?.click(), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "upload-content", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "upload-icon", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("polyline", { points: "17 8 12 3 7 8" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("line", { x1: "12", y1: "3", x2: "12", y2: "15" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm", style: { color: "#fff", fontWeight: 700, marginTop: 2 }, children: t("tap_to_select") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted", children: t("file_types") })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          ref: fileInputRef,
          type: "file",
          accept: "video/*",
          multiple: true,
          onChange: handleFiles,
          style: { display: "none" }
        }
      )
    ] }),
    queue.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 10 }, children: queue.map((q) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `queue-item ${q.status === "done" ? "done" : ""}`, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "queue-info", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "queue-name", children: q.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "queue-size", children: q.size })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "queue-right", children: [
        q.status === "analyzing" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "queue-progress", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "progress-bar", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "progress-fill", style: { width: `${q.progress}%` } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "progress-text", children: [
            q.progress,
            "%"
          ] })
        ] }),
        q.status === "done" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "queue-done", children: t("done") }),
        q.status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "var(--red)", fontSize: "0.73rem", lineHeight: 1.4 }, children: t("failed_try_different") }),
        q.status === "queued" && !analyzing && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => removeFromQueue(q.id), children: t("remove") })
      ] })
    ] }, q.id)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "analyze-controls", children: !analyzing ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      exercise !== "__auto__" && getExerciseIllustration(exercise) && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "img",
        {
          src: getExerciseIllustration(exercise, 2),
          alt: "",
          style: {
            width: 40,
            height: 40,
            objectFit: "contain",
            borderRadius: 6,
            background: "var(--surface-elevated)",
            flexShrink: 0
          },
          onError: (e) => {
            e.target.style.display = "none";
          }
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: exercise,
          onChange: (e) => {
            const val = e.target.value;
            setExercise(val);
            if (val === "__auto__") {
              setAutoDetect(true);
              userChangedExercise.current = false;
            } else {
              setAutoDetect(false);
              userChangedExercise.current = true;
            }
          },
          style: { flex: 1, padding: 8, fontSize: "0.82rem" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "__auto__", children: t("automatic") }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("compound"), children: EXERCISE_GROUPS.compound.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: e.key, children: tExercise(e.key, e.name) }, e.key)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("isolation"), children: EXERCISE_GROUPS.isolation.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: e.key, children: tExercise(e.key, e.name) }, e.key)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("bodyweight"), children: EXERCISE_GROUPS.bodyweight.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: e.key, children: tExercise(e.key, e.name) }, e.key)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("other"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "superset", children: t("ex.superset") }) })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "number",
          value: weight,
          onChange: (e) => setWeight(e.target.value),
          placeholder: "kg",
          style: { width: 56, padding: "8px 6px", fontSize: "0.82rem", textAlign: "center" }
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "btn btn-primary",
          onClick: startAnalysis,
          disabled: !hasQueued,
          children: t("analyze")
        }
      )
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "analyzing-status", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "spinner-sm" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: analysisPhase === "model" ? t("loading_ai") : analysisPhase === "loading" ? `${t("loading_file")} ${currentFile}...` : analysisPhase === "analyzing" ? `${t("analyzing_file")} ${currentFile}... ${progress}%` : `${t("starting_file")} ${currentFile}...` }),
      analysisPhase === "model" && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }, children: t("downloading_model") })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "video",
      {
        ref: videoRef,
        muted: true,
        playsInline: true,
        preload: "auto",
        style: { position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "analysis-card",
        style: analyzing ? { display: "block", padding: 8 } : { display: "none" },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { borderRadius: 8, overflow: "hidden", background: "#000" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
            "canvas",
            {
              ref: overlayRef,
              style: { width: "100%", display: "block" }
            }
          ) }),
          analyzing && analysisPhase === "analyzing" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: "0 4px" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#00FF88", fontSize: 20, fontWeight: 800 }, children: [
              liveReps,
              " reps"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
              width: `${progress}%`,
              height: "100%",
              background: "#00FF88",
              borderRadius: 2,
              transition: "width 0.1s linear"
            } }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#fff", fontSize: 13, fontWeight: 600 }, children: [
              progress,
              "%"
            ] })
          ] })
        ]
      }
    ),
    results.map((r, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(ResultCard, { result: r, onReplay: () => setReplayResult(r) }, idx)),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { textAlign: "center", padding: "8px 0", fontSize: "0.65rem", color: "#555" }, children: BUILD_ID })
  ] });
}
function generateCoachingInsight(repHistory, bioAnalysis, t) {
  if (!repHistory || repHistory.length === 0) return null;
  if (bioAnalysis?.rangeOfMotion?.perRep && bioAnalysis.rangeOfMotion.perRep.length >= 3) {
    const roms = bioAnalysis.rangeOfMotion.perRep;
    const firstRom = roms[0];
    const lastRom = roms[roms.length - 1];
    if (firstRom > 0 && lastRom < firstRom * 0.8) {
      const drop = Math.round((1 - lastRom / firstRom) * 100);
      return t("insight_rom_drop", { drop });
    }
  }
  if (bioAnalysis?.fatigue?.velocityDropoff > 25) {
    return t("insight_fatigue", { drop: Math.round(bioAnalysis.fatigue.velocityDropoff) });
  }
  if (bioAnalysis?.asymmetry?.score > 15) {
    return t("insight_asymmetry", { score: Math.round(bioAnalysis.asymmetry.score) });
  }
  if (bioAnalysis?.velocity?.perRep) {
    const avgVel = bioAnalysis.velocity.perRep.reduce((a, b) => a + b, 0) / bioAnalysis.velocity.perRep.length;
    if (avgVel > 0.8) return t("insight_too_fast");
  }
  const scores = repHistory.map((r) => r.score || 0);
  const variance = Math.max(...scores) - Math.min(...scores);
  if (variance < 15 && scores[0] >= 70) return t("insight_ready_progress");
  const best = repHistory.reduce((a, b, i) => (b.score || 0) > (a.score || 0) ? { ...b, num: i + 1 } : a, { ...repHistory[0], num: 1 });
  return t("insight_best_rep", { num: best.num });
}
function generateProgressionNote(progression, t) {
  if (!progression) return null;
  const { prevScore, prevRom, prevDate } = progression;
  const daysSince = Math.round((Date.now() - new Date(prevDate).getTime()) / 864e5);
  const dateStr = daysSince <= 1 ? t("yesterday") : daysSince <= 7 ? t("days_ago", { n: daysSince }) : new Date(prevDate).toLocaleDateString();
  if (prevRom > 0 && progression.currentRom > 0) {
    const romChange = Math.round(progression.currentRom - prevRom);
    if (romChange > 5) return t("prog_rom_up", { change: romChange, date: dateStr });
    if (romChange < -5) return t("prog_rom_down", { change: romChange, date: dateStr });
  }
  if (progression.currentScore > prevScore + 5) return t("prog_form_up", { change: Math.round(progression.currentScore - prevScore), date: dateStr });
  if (progression.currentScore < prevScore - 10) return t("prog_form_down", { date: dateStr });
  return t("prog_consistent", { date: dateStr });
}
function ResultCard({ result, onReplay }) {
  const { t, tExercise } = useT();
  const {
    fileName,
    exerciseName,
    reps,
    duration,
    analysisTime,
    formScore,
    bioAnalysis,
    report,
    repHistory,
    progression
  } = result;
  const grade = gradeFromScore(formScore);
  const cls = gradeClass(formScore);
  const displayName = tExercise(result.exercise, exerciseName);
  const exerciseDef = EXERCISES[result.exercise];
  const muscles = exerciseDef?.muscles;
  const coachingInsight = generateCoachingInsight(repHistory, bioAnalysis, t);
  const progressionNote = generateProgressionNote(progression, t);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card result-card", style: { marginTop: 14 }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "result-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { flex: 1 }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }, children: [
        getExerciseIllustration(result.exercise) && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: getExerciseIllustration(result.exercise, 2),
            alt: "",
            style: {
              width: 32,
              height: 32,
              objectFit: "contain",
              borderRadius: 6,
              background: "rgba(255,255,255,0.05)",
              flexShrink: 0
            },
            onError: (e) => {
              e.target.style.display = "none";
            }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { style: { marginBottom: 0, fontSize: "1.1rem" }, children: displayName }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted", children: fileName }),
            result.autoDetected && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: {
              fontSize: "0.6rem",
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(0,255,136,0.12)",
              color: "var(--accent)",
              fontWeight: 600
            }, children: t("auto_detected") })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `score-badge ${cls}`, style: { fontSize: "1.1rem", padding: "8px 16px" }, children: grade })
    ] }),
    muscles && /* @__PURE__ */ jsxRuntimeExports.jsx(MuscleMap, { muscles, size: 90 }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stats-grid-2x2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-card-label", children: t("reps").toUpperCase() }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-card-value", children: reps })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-card-label", children: t("duration").toUpperCase() }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-card-value", children: formatTime(duration) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-card-label", children: [
          t("form").toUpperCase(),
          " SCORE"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-card-value", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: formScore >= 80 ? "var(--accent)" : formScore >= 60 ? "var(--yellow)" : "var(--red)" }, children: formScore }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "0.7em", color: "var(--muted)", marginLeft: 2 }, children: "/100" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat-card", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-card-label", children: t("quality").toUpperCase() }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-card-value", children: [
          bioAnalysis?.movementQuality != null ? Math.round(bioAnalysis.movementQuality) : "--",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { fontSize: "0.7em", color: "var(--muted)", marginLeft: 2 }, children: "%" })
        ] })
      ] })
    ] }),
    coachingInsight && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "coaching-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "coaching-icon", children: "AI" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "coaching-text", children: coachingInsight })
    ] }),
    progressionNote && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "progression-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "progression-icon", children: "↑" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm", style: { margin: 0, color: "var(--text-secondary)" }, children: progressionNote })
    ] }),
    report?.summary && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm", style: { marginTop: 12, marginBottom: 6, lineHeight: 1.5, color: "var(--text-secondary)" }, children: typeof report.summary === "string" ? report.summary : t(report.summary.key, report.summary) }),
    bioAnalysis?.velocity?.perRep && bioAnalysis.velocity.perRep.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("velocity_per_rep") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bars", children: bioAnalysis.velocity.perRep.map((v, i) => {
        const max = Math.max(...bioAnalysis.velocity.perRep, 1);
        const pct = v / max * 100;
        const declining = i > 0 && v < bioAnalysis.velocity.perRep[i - 1];
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rep-bar-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar", style: {
            height: `${Math.max(pct, 5)}%`,
            background: declining ? "var(--yellow)" : "var(--accent)"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rep-num", children: i + 1 })
        ] }, i);
      }) }),
      bioAnalysis.velocity.trend && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted", style: { marginTop: 4 }, children: [
        "Trend: ",
        bioAnalysis.velocity.trend
      ] })
    ] }),
    bioAnalysis?.timeUnderTension?.perRep && bioAnalysis.timeUnderTension.perRep.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("time_under_tension") }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "result-stats", style: { marginBottom: 6 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            bioAnalysis.timeUnderTension.eccentric?.toFixed(1),
            "s"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("eccentric") })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            bioAnalysis.timeUnderTension.concentric?.toFixed(1),
            "s"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("concentric") })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            bioAnalysis.timeUnderTension.total?.toFixed(1),
            "s"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("total") })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bars", children: bioAnalysis.timeUnderTension.perRep.map((tut, i) => {
        const ecc = tut.eccentric || tut.down || 0;
        const con = tut.concentric || tut.up || 0;
        const total = ecc + con || 1;
        const maxTut = Math.max(
          ...bioAnalysis.timeUnderTension.perRep.map((r) => (r.eccentric || r.down || 0) + (r.concentric || r.up || 0)),
          1
        );
        const pct = total / maxTut * 100;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rep-bar-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar", style: {
            height: `${Math.max(pct, 5)}%`,
            background: `linear-gradient(to top, var(--accent) ${con / total * 100}%, var(--yellow) 0%)`
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rep-num", children: i + 1 })
        ] }, i);
      }) })
    ] }),
    bioAnalysis?.rangeOfMotion && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("range_of_motion") }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "result-stats", style: { marginBottom: 6 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            Math.round(bioAnalysis.rangeOfMotion.avgDegrees),
            "°"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("avg_rom") })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            Math.round(bioAnalysis.rangeOfMotion.consistency || 0),
            "%"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("consistency") })
        ] })
      ] }),
      bioAnalysis.rangeOfMotion.perRep && bioAnalysis.rangeOfMotion.perRep.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bars", children: bioAnalysis.rangeOfMotion.perRep.map((rom, i) => {
        const maxRom = Math.max(...bioAnalysis.rangeOfMotion.perRep, 1);
        const pct = rom / maxRom * 100;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rep-bar-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar", style: {
            height: `${Math.max(pct, 5)}%`,
            background: "var(--accent)"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rep-num", children: i + 1 })
        ] }, i);
      }) })
    ] }),
    bioAnalysis?.asymmetry && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("asymmetry") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "result-stats", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-value", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: `score-badge ${bioAnalysis.asymmetry.score <= 10 ? "good" : bioAnalysis.asymmetry.score <= 20 ? "ok" : "poor"}`, children: [
          Math.round(bioAnalysis.asymmetry.score),
          "%"
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("imbalance") })
      ] }) }),
      bioAnalysis.asymmetry.details && typeof bioAnalysis.asymmetry.details === "object" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { marginTop: 6 }, children: Object.entries(bioAnalysis.asymmetry.details).map(([key, val]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted", style: { padding: "2px 0" }, children: [
        key,
        ": ",
        typeof val === "number" ? `${Math.round(val)}%` : String(val)
      ] }, key)) })
    ] }),
    bioAnalysis?.fatigue && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("fatigue") }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "result-stats", style: { marginBottom: 6 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            Math.round(bioAnalysis.fatigue.index || 0),
            "%"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("fatigue_index") })
        ] }),
        bioAnalysis.fatigue.velocityDropoff != null && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "stat-value", children: [
            Math.round(bioAnalysis.fatigue.velocityDropoff),
            "%"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-label", children: t("velocity_dropoff") })
        ] })
      ] }),
      bioAnalysis.fatigue.curve && bioAnalysis.fatigue.curve.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bars", children: bioAnalysis.fatigue.curve.map((v, i) => {
        const max = Math.max(...bioAnalysis.fatigue.curve, 1);
        const pct = v / max * 100;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rep-bar-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar", style: {
            height: `${Math.max(pct, 5)}%`,
            background: pct < 60 ? "var(--red)" : pct < 80 ? "var(--yellow)" : "var(--accent)"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rep-num", children: i + 1 })
        ] }, i);
      }) }),
      bioAnalysis.fatigue.recommendation && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted", style: { marginTop: 4 }, children: bioAnalysis.fatigue.recommendation })
    ] }),
    repHistory && repHistory.length > 0 && (() => {
      const allIssues = {};
      repHistory.forEach((r) => {
        (r.issues || []).forEach((issue) => {
          allIssues[issue] = (allIssues[issue] || 0) + 1;
        });
      });
      const sorted = Object.entries(allIssues).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) return null;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "form-notes", style: { marginTop: 14 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("form_notes") }),
        sorted.map(([issue, count]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "note-item", children: [
          issue,
          " (",
          count,
          "/",
          repHistory.length,
          " reps)"
        ] }, issue))
      ] });
    })(),
    result.diagnostics && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: "0.75rem", color: "var(--muted)" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { style: { color: "var(--text)" }, children: t("engine") }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        "Range: ",
        result.diagnostics.observedMin,
        "° – ",
        result.diagnostics.observedMax,
        "° (",
        result.diagnostics.observedRange,
        "°)"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        "Min ROM per rep: ",
        result.diagnostics.minROM,
        "°"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        "Frames: ",
        result.diagnostics.totalFrames,
        " | Method: ",
        result.diagnostics.method
      ] })
    ] }),
    report?.highlights && report.highlights.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("highlights") }),
      report.highlights.map((h, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm", style: { color: "var(--accent)", padding: "2px 0" }, children: [
        "> ",
        typeof h === "string" ? h : t(h.key, h)
      ] }, i))
    ] }),
    report?.improvements && report.improvements.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("next_steps") }),
      report.improvements.map((imp, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted", style: { padding: "2px 0" }, children: [
        i + 1,
        ". ",
        typeof imp === "string" ? imp : t(imp.key, imp)
      ] }, i))
    ] }),
    repHistory && repHistory.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rep-quality", style: { marginTop: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: t("per_rep_quality") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bars", children: repHistory.map((r, i) => {
        const score = r.score || 0;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rep-bar-col", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rep-bar", style: {
            height: `${Math.max(score, 5)}%`,
            background: score >= 80 ? "var(--accent)" : score >= 50 ? "var(--yellow)" : "var(--red)"
          } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rep-num", children: i + 1 })
        ] }, i);
      }) })
    ] }),
    result.videoUrl && result.frames && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "btn btn-primary",
        style: { width: "100%", marginTop: 16, padding: "14px 0", fontSize: "1rem", fontWeight: 700 },
        onClick: onReplay,
        children: t("watch_overlay")
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "btn btn-ghost",
        style: { width: "100%", marginTop: 8, padding: "12px 0", fontSize: "0.9rem", fontWeight: 600 },
        onClick: () => shareCard(result),
        children: t("share_card")
      }
    )
  ] });
}
function Analyze(props) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(VideoUpload, { ...props });
}
export {
  Analyze as default
};
