/**
 * KineticForcedAligner - Continuous Kineme Dynamic Time Warping (DTW) Alignment
 *
 * Grounded in speech recognition forced alignment (ASR) principles:
 * maps continuous, variable-rate kinematic joint trajectories onto canonical
 * biomechanical "kineme" states (UNRACK, ECCENTRIC, INFLECTION, STICKING_REGION,
 * CONCENTRIC, LOCKOUT) via Sakoe-Chiba constrained Dynamic Time Warping.
 *
 * Extracts:
 * 1. Sub-frame phase boundaries and turnaround inflection points.
 * 2. Local temporal warp velocities (\nu_k = dj/di) to locate sticking points.
 * 3. Kinematic form distortion metrics comparing execution against canonical templates.
 */

export type KinemeId =
  | 'UNRACK'
  | 'ECCENTRIC'
  | 'INFLECTION'
  | 'STICKING_REGION'
  | 'CONCENTRIC'
  | 'LOCKOUT';

export interface KinemeDefinition {
  id: KinemeId;
  label: string;
  startNorm: number; // 0.0 to 1.0 in canonical progression
  endNorm: number;
}

export interface KineticTemplate {
  exercise: string;
  kinemes: KinemeDefinition[];
  trajectory: number[]; // Canonical 1D normalized joint angles (e.g., 0 to 1)
  secondaryAngles?: { [joint: string]: number[] }; // Optional canonical secondary angles
}

export interface AlignmentPathPoint {
  queryIndex: number;
  templateIndex: number;
  cost: number;
}

export interface StickingPointAnalysis {
  frameIndex: number;
  subFrameIndex: number;
  normalizedAngle: number;
  warpVelocity: number; // Low value (< 0.5) indicates severe grinding/sticking
  severity: 'mild' | 'moderate' | 'severe';
}

export interface KinemeAlignmentResult {
  kineme: KinemeId;
  label: string;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

export interface ForcedAlignmentResult {
  path: AlignmentPathPoint[];
  totalDistance: number;
  normalizedDistance: number; // Mean cost per step (form distortion score)
  subFrameInflectionIndex: number;
  kinemeAlignments: KinemeAlignmentResult[];
  stickingPoint: StickingPointAnalysis | null;
  localWarpVelocities: number[];
}

/**
 * Standard Canonical Kinematic Templates (normalized 0..1 scale, 50 points)
 */
export function getCanonicalTemplate(exercise: string): KineticTemplate {
  const normExercise = exercise.toLowerCase().replace(/[\s-_]+/g, '');

  // Default kineme progression
  const standardKinemes: KinemeDefinition[] = [
    { id: 'UNRACK', label: 'Unrack & Setup', startNorm: 0.0, endNorm: 0.08 },
    { id: 'ECCENTRIC', label: 'Eccentric Descent', startNorm: 0.08, endNorm: 0.46 },
    { id: 'INFLECTION', label: 'Inflection Turnaround', startNorm: 0.46, endNorm: 0.54 },
    { id: 'STICKING_REGION', label: 'Sticking Region', startNorm: 0.54, endNorm: 0.72 },
    { id: 'CONCENTRIC', label: 'Concentric Drive', startNorm: 0.72, endNorm: 0.94 },
    { id: 'LOCKOUT', label: 'Lockout Stabilization', startNorm: 0.94, endNorm: 1.0 },
  ];

  const N = 50;
  const trajectory: number[] = new Array(N);

  if (normExercise.includes('squat') || normExercise.includes('chair')) {
    // Squat: starts at top (1.0), descents down to bottom (0.0), ascends back to (1.0)
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      if (t <= 0.5) {
        // Smooth cosine descent
        trajectory[i] = 0.5 * (1 + Math.cos(Math.PI * (t / 0.5)));
      } else {
        // Smooth cosine ascent with biomechanical sticking deceleration at ~0.65
        const ascentT = (t - 0.5) / 0.5;
        trajectory[i] = 0.5 * (1 - Math.cos(Math.PI * ascentT));
      }
    }
  } else if (normExercise.includes('curl') || normExercise.includes('lateral')) {
    // Curl/Raise: starts at bottom (0.0), ascends to peak flexion (1.0), descents back to (0.0)
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      if (t <= 0.5) {
        const ascentT = t / 0.5;
        trajectory[i] = 0.5 * (1 - Math.cos(Math.PI * ascentT));
      } else {
        const descentT = (t - 0.5) / 0.5;
        trajectory[i] = 0.5 * (1 + Math.cos(Math.PI * descentT));
      }
    }
  } else {
    // Generic reciprocal cycle
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      trajectory[i] = 0.5 * (1 + Math.cos(2 * Math.PI * t));
    }
  }

  return {
    exercise,
    kinemes: standardKinemes,
    trajectory,
  };
}

/**
 * Normalizes an arbitrary query trajectory to 0..1 range.
 */
export function normalizeQueryTrajectory(
  query: number[],
  expectedDirection: 'descent_first' | 'ascent_first' = 'descent_first'
): number[] {
  if (query.length === 0) return [];

  let minVal = Infinity;
  let maxVal = -Infinity;

  for (const v of query) {
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  const range = maxVal - minVal;
  if (range <= 1e-6) {
    return query.map(() => 0.5);
  }

  const normalized = query.map(v => (v - minVal) / range);

  // If descent_first, start should be closer to 1.0 and turnaround closer to 0.0
  if (expectedDirection === 'descent_first') {
    if (normalized[0] < 0.5 && normalized[Math.floor(normalized.length / 2)] > 0.5) {
      // Invert if upside down
      return normalized.map(v => 1 - v);
    }
  } else {
    if (normalized[0] > 0.5 && normalized[Math.floor(normalized.length / 2)] < 0.5) {
      return normalized.map(v => 1 - v);
    }
  }

  return normalized;
}

/**
 * Aligns a continuous joint angle query sequence against a canonical kinetic template
 * using Dynamic Time Warping with a Sakoe-Chiba constraint band.
 */
export function alignKineticTrajectory(
  rawQuery: number[],
  template: KineticTemplate,
  options?: {
    windowRadiusRatio?: number; // Fraction of max(N, M), default 0.25
    expectedDirection?: 'descent_first' | 'ascent_first';
  }
): ForcedAlignmentResult {
  const normQuery = normalizeQueryTrajectory(
    rawQuery,
    options?.expectedDirection || 'descent_first'
  );
  const N = normQuery.length;
  const M = template.trajectory.length;

  if (N < 2 || M < 2) {
    return {
      path: [],
      totalDistance: 0,
      normalizedDistance: 0,
      subFrameInflectionIndex: 0,
      kinemeAlignments: [],
      stickingPoint: null,
      localWarpVelocities: [],
    };
  }

  const windowRatio = options?.windowRadiusRatio ?? 0.35;
  const band = Math.max(3, Math.ceil(Math.max(N, M) * windowRatio));

  // Initialize DP Matrix with infinity
  const costMatrix: number[][] = Array.from({ length: N }, () =>
    new Array(M).fill(Infinity)
  );

  costMatrix[0][0] = Math.abs(normQuery[0] - template.trajectory[0]);

  // Forward pass with Sakoe-Chiba band
  for (let i = 0; i < N; i++) {
    const templateCenter = Math.floor((i / (N - 1)) * (M - 1));
    const jMin = Math.max(0, templateCenter - band);
    const jMax = Math.min(M - 1, templateCenter + band);

    for (let j = jMin; j <= jMax; j++) {
      if (i === 0 && j === 0) continue;

      const d = Math.abs(normQuery[i] - template.trajectory[j]);
      let prevCost = Infinity;

      if (i > 0 && costMatrix[i - 1][j] !== Infinity) {
        prevCost = Math.min(prevCost, costMatrix[i - 1][j]);
      }
      if (j > 0 && costMatrix[i][j - 1] !== Infinity) {
        prevCost = Math.min(prevCost, costMatrix[i][j - 1]);
      }
      if (i > 0 && j > 0 && costMatrix[i - 1][j - 1] !== Infinity) {
        prevCost = Math.min(prevCost, costMatrix[i - 1][j - 1]);
      }

      if (prevCost !== Infinity) {
        costMatrix[i][j] = prevCost + d;
      }
    }
  }

  // Backtracking optimal path
  let currI = N - 1;
  let currJ = M - 1;

  // Fallback if boundary wasn't reached due to narrow band
  if (costMatrix[currI][currJ] === Infinity) {
    let bestJ = M - 1;
    let minFinalCost = Infinity;
    for (let j = 0; j < M; j++) {
      if (costMatrix[currI][j] < minFinalCost) {
        minFinalCost = costMatrix[currI][j];
        bestJ = j;
      }
    }
    currJ = bestJ;
  }

  const path: AlignmentPathPoint[] = [];
  path.push({
    queryIndex: currI,
    templateIndex: currJ,
    cost: costMatrix[currI][currJ],
  });

  while (currI > 0 || currJ > 0) {
    let nextI = currI;
    let nextJ = currJ;
    let minCost = Infinity;

    // Diagonal
    if (currI > 0 && currJ > 0 && costMatrix[currI - 1][currJ - 1] < minCost) {
      minCost = costMatrix[currI - 1][currJ - 1];
      nextI = currI - 1;
      nextJ = currJ - 1;
    }
    // Up
    if (currI > 0 && costMatrix[currI - 1][currJ] < minCost) {
      minCost = costMatrix[currI - 1][currJ];
      nextI = currI - 1;
      nextJ = currJ;
    }
    // Left
    if (currJ > 0 && costMatrix[currI][currJ - 1] < minCost) {
      minCost = costMatrix[currI][currJ - 1];
      nextI = currI;
      nextJ = currJ - 1;
    }

    if (minCost === Infinity) {
      // Degenerate step
      if (currI > 0) nextI = currI - 1;
      if (currJ > 0) nextJ = currJ - 1;
    }

    currI = nextI;
    currJ = nextJ;

    path.push({
      queryIndex: currI,
      templateIndex: currJ,
      cost: costMatrix[currI][currJ],
    });
  }

  path.reverse();

  const totalDistance = path[path.length - 1].cost;
  const normalizedDistance = totalDistance / Math.max(1, path.length);

  // Compute Local Warp Velocities: nu(i) = delta_j / delta_i
  const warpVelocities: number[] = new Array(N).fill(1.0);
  const queryToTemplateMap: number[] = new Array(N);

  for (const pt of path) {
    queryToTemplateMap[pt.queryIndex] = pt.templateIndex;
  }

  // Smooth forward/backward difference over window of 2 frames
  for (let i = 1; i < N - 1; i++) {
    const dj = queryToTemplateMap[i + 1] - queryToTemplateMap[i - 1];
    const di = 2; // frames
    // Normalize relative to expected 1:1 speed ratio (M/N)
    const expectedRatio = M / N;
    warpVelocities[i] = expectedRatio > 0 ? (dj / di) / expectedRatio : 1.0;
  }
  warpVelocities[0] = warpVelocities[1];
  warpVelocities[N - 1] = warpVelocities[N - 2];

  // Map Kineme boundaries
  const kinemeAlignments: KinemeAlignmentResult[] = [];
  for (const kineme of template.kinemes) {
    const startTmpl = Math.floor(kineme.startNorm * (M - 1));
    const endTmpl = Math.floor(kineme.endNorm * (M - 1));

    let startFrame = -1;
    let endFrame = -1;

    for (const pt of path) {
      if (pt.templateIndex >= startTmpl && startFrame === -1) {
        startFrame = pt.queryIndex;
      }
      if (pt.templateIndex <= endTmpl) {
        endFrame = pt.queryIndex;
      }
    }

    if (startFrame === -1) startFrame = 0;
    if (endFrame === -1 || endFrame < startFrame) endFrame = startFrame;

    kinemeAlignments.push({
      kineme: kineme.id,
      label: kineme.label,
      startFrame,
      endFrame,
      durationFrames: endFrame - startFrame + 1,
    });
  }

  // Identify Sticking Point
  // Search within STICKING_REGION kineme or concentric phase for minimal warp velocity
  let stickingPoint: StickingPointAnalysis | null = null;
  const stickingKineme = kinemeAlignments.find(
    k => k.kineme === 'STICKING_REGION'
  );

  let searchStart = stickingKineme
    ? stickingKineme.startFrame
    : Math.floor(0.55 * N);
  let searchEnd = stickingKineme
    ? stickingKineme.endFrame
    : Math.floor(0.85 * N);

  searchStart = Math.max(1, Math.min(N - 2, searchStart));
  searchEnd = Math.max(searchStart, Math.min(N - 2, searchEnd));

  let minWarp = Infinity;
  let minFrame = searchStart;

  for (let i = searchStart; i <= searchEnd; i++) {
    if (warpVelocities[i] < minWarp) {
      minWarp = warpVelocities[i];
      minFrame = i;
    }
  }

  if (minWarp < 0.75) {
    const severity: 'mild' | 'moderate' | 'severe' =
      minWarp < 0.35 ? 'severe' : minWarp < 0.55 ? 'moderate' : 'mild';

    stickingPoint = {
      frameIndex: minFrame,
      subFrameIndex: minFrame,
      normalizedAngle: normQuery[minFrame],
      warpVelocity: Math.round(minWarp * 100) / 100,
      severity,
    };
  }

  // Sub-frame Inflection Point Extraction
  const inflectionKineme = kinemeAlignments.find(
    k => k.kineme === 'INFLECTION'
  );
  const centerFrame = inflectionKineme
    ? Math.floor((inflectionKineme.startFrame + inflectionKineme.endFrame) / 2)
    : Math.floor(N / 2);

  let subFrameInflectionIndex = centerFrame;
  if (centerFrame > 0 && centerFrame < N - 1) {
    // Parabolic vertex fitting around centerFrame: f(x) = a*x^2 + b*x + c
    const y0 = normQuery[centerFrame - 1];
    const y1 = normQuery[centerFrame];
    const y2 = normQuery[centerFrame + 1];

    const denom = 2 * (y0 - 2 * y1 + y2);
    if (Math.abs(denom) > 1e-5) {
      const delta = (y0 - y2) / denom;
      if (Math.abs(delta) <= 1.0) {
        subFrameInflectionIndex = centerFrame + delta;
      }
    }
  }

  return {
    path,
    totalDistance,
    normalizedDistance: Math.round(normalizedDistance * 1000) / 1000,
    subFrameInflectionIndex:
      Math.round(subFrameInflectionIndex * 100) / 100,
    kinemeAlignments,
    stickingPoint,
    localWarpVelocities: warpVelocities.map(v => Math.round(v * 100) / 100),
  };
}
