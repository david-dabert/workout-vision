/**
 * Periodicity-first rep counting.
 *
 * Primary counting principle: "how many cycles of a periodic process
 * fit in this signal?" — NOT "how many local minima exist."
 *
 * Algorithm:
 *   1. Compute normalized autocorrelation of the demeaned signal.
 *   2. Find ALL peaks in the physiological period band.
 *   3. Select the fundamental period using sub-harmonic checking
 *      (standard pitch detection technique from audio processing).
 *   4. Count reps as round(usableLength / T).
 *   5. Phase-align rep boundaries by snapping to nearest valley within ±T/3.
 *
 * Reference: "RGB camera-based live repetition counter using autocorrelation"
 * (Nature Scientific Reports, 2025).
 */

import { getRepPeriodBounds } from '../analysisConfig';

export interface PeriodResult {
  /** Estimated rep count from periodicity */
  reps: number;
  /** Dominant period in seconds */
  periodSeconds: number;
  /** Dominant period in frames */
  periodFrames: number;
  /** Autocorrelation peak height (0-1, higher = more periodic) */
  autocorrPeak: number;
  /** Frame indices of period-aligned rep boundaries (valleys) */
  repFrames: number[];
}

/**
 * Compute normalized autocorrelation for all lags in [minLag, maxLag].
 * Returns array indexed by lag. Values are in [-1, 1].
 */
function computeACF(
  signal: number[],
  minLag: number,
  maxLag: number,
): number[] {
  const N = signal.length;
  let mean = 0;
  for (let i = 0; i < N; i++) mean += signal[i];
  mean /= N;

  let variance = 0;
  for (let i = 0; i < N; i++) variance += (signal[i] - mean) ** 2;
  variance /= N;
  if (variance < 1e-8) return [];

  const acf = new Array(maxLag + 1).fill(0);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let t = 0; t < N - lag; t++) {
      corr += (signal[t] - mean) * (signal[t + lag] - mean);
    }
    acf[lag] = corr / ((N - lag) * variance);
  }
  return acf;
}

/**
 * Find all local maxima in the ACF above a threshold.
 */
function findACFPeaks(
  acf: number[],
  minLag: number,
  maxLag: number,
  threshold: number,
): { lag: number; height: number }[] {
  const peaks: { lag: number; height: number }[] = [];
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (acf[lag] >= threshold
        && acf[lag] >= acf[lag - 1]
        && acf[lag] >= acf[lag + 1]) {
      peaks.push({ lag, height: acf[lag] });
    }
  }
  return peaks;
}

/**
 * Select the fundamental period from ACF peaks using sub-harmonic checking.
 *
 * Standard pitch detection technique: for each candidate peak at lag L,
 * check if L could be a harmonic (2T, 3T) of a shorter period. If there's
 * a peak near L/2 or L/3 (even a weak one), the shorter period is likely
 * the true fundamental.
 *
 * This prevents the common ACF failure mode where the 2T harmonic peak
 * is stronger than the fundamental T peak (happens with non-sinusoidal
 * waveforms and noisy signals).
 */
function selectFundamental(
  acf: number[],
  peaks: { lag: number; height: number }[],
  minLag: number,
): { lag: number; height: number } | null {
  if (peaks.length === 0) return null;
  if (peaks.length === 1) return peaks[0];

  // Sort by lag (shortest first)
  const sorted = [...peaks].sort((a, b) => a.lag - b.lag);

  // For each peak starting from the shortest, check if it could be
  // the fundamental. A peak is the fundamental if:
  //   1. It's reasonably strong (height > 0.15), OR
  //   2. A peak at ~2× its lag also exists (harmonic confirmation)
  for (const candidate of sorted) {
    // Check harmonic confirmation: is there a peak near 2× this lag?
    const doubleLag = candidate.lag * 2;
    const tolerance = Math.max(2, Math.round(candidate.lag * 0.15));

    const hasHarmonic = peaks.some(p =>
      p !== candidate && Math.abs(p.lag - doubleLag) <= tolerance
    );

    if (hasHarmonic) {
      // This lag has a harmonic at 2× — strong fundamental evidence
      return candidate;
    }

    // No harmonic found. Accept if strong enough on its own.
    if (candidate.height >= 0.25) {
      return candidate;
    }
  }

  // No candidate with harmonic confirmation or sufficient strength.
  // Fall back to the strongest peak.
  return sorted.reduce((best, p) => p.height > best.height ? p : best, sorted[0]);
}

/**
 * Estimate the dominant period of a signal via normalized autocorrelation
 * with sub-harmonic fundamental detection.
 */
export function estimateDominantPeriod(
  signal: number[],
  fps: number,
  minPeriodS: number,
  maxPeriodS: number,
): { lagFrames: number; peakHeight: number } {
  const N = signal.length;
  if (N < 12) return { lagFrames: 0, peakHeight: 0 };

  // Check variance
  let mean = 0;
  for (let i = 0; i < N; i++) mean += signal[i];
  mean /= N;
  let variance = 0;
  for (let i = 0; i < N; i++) variance += (signal[i] - mean) ** 2;
  variance /= N;
  if (variance < 1e-8) return { lagFrames: 0, peakHeight: 0 };

  const minLag = Math.max(3, Math.round(fps * minPeriodS));
  const maxLag = Math.min(Math.floor(N / 2), Math.round(fps * maxPeriodS));
  if (minLag >= maxLag) return { lagFrames: 0, peakHeight: 0 };

  // Extend search to half the minimum lag so we can find sub-harmonics
  // of peaks near the bottom of the band
  const searchMinLag = Math.max(3, Math.floor(minLag / 2));

  const acf = computeACF(signal, searchMinLag, maxLag);
  if (acf.length === 0) return { lagFrames: 0, peakHeight: 0 };

  // Find all peaks with a low threshold — sub-harmonic checking
  // will filter out the weak ones that aren't fundamentals
  const peaks = findACFPeaks(acf, searchMinLag, maxLag, 0.1);

  const fundamental = selectFundamental(acf, peaks, searchMinLag);
  if (!fundamental || fundamental.lag < minLag) {
    // Fundamental is below the physiological band — reject
    // unless it's very close to the minimum
    if (fundamental && fundamental.lag >= minLag * 0.8 && fundamental.height >= 0.3) {
      return { lagFrames: fundamental.lag, peakHeight: fundamental.height };
    }
    return { lagFrames: 0, peakHeight: 0 };
  }

  return { lagFrames: fundamental.lag, peakHeight: fundamental.height };
}

/**
 * Count reps by periodicity: place phase-aligned boundaries on the signal
 * using the dominant period T.
 *
 * For each expected rep position, find the nearest valley in the signal
 * within ±T/3. This snaps to real motion rather than blindly dividing.
 */
export function countByPeriod(
  signal: number[],
  fps: number,
  periodFrames: number,
): PeriodResult {
  const N = signal.length;
  const periodSeconds = periodFrames / fps;
  const emptyResult: PeriodResult = {
    reps: 0, periodSeconds, periodFrames, autocorrPeak: 0, repFrames: [],
  };

  if (periodFrames <= 0 || N < periodFrames) return emptyResult;

  const rawCount = N / periodFrames;
  const reps = Math.round(rawCount);
  if (reps < 1) return emptyResult;

  // Place expected valley positions evenly through the signal.
  const offset = (N - (reps - 1) * periodFrames) / 2;
  const expectedPositions: number[] = [];
  for (let i = 0; i < reps; i++) {
    expectedPositions.push(Math.round(offset + i * periodFrames));
  }

  // Snap each expected position to the nearest local minimum within ±T/3
  const tolerance = Math.round(periodFrames / 3);
  const repFrames: number[] = [];

  for (const expected of expectedPositions) {
    const lo = Math.max(0, expected - tolerance);
    const hi = Math.min(N - 1, expected + tolerance);

    let bestFrame = Math.min(Math.max(0, expected), N - 1);
    let bestVal = Infinity;
    for (let j = lo; j <= hi; j++) {
      if (signal[j] < bestVal) {
        bestVal = signal[j];
        bestFrame = j;
      }
    }
    repFrames.push(bestFrame);
  }

  return {
    reps,
    periodSeconds,
    periodFrames,
    autocorrPeak: 0, // caller fills from estimateDominantPeriod
    repFrames,
  };
}

/**
 * Full periodicity-based rep counting pipeline.
 *
 * Returns null only if the signal is genuinely not periodic
 * (no ACF peak above 0.2 in the physiological band).
 */
export function periodCount(
  signal: number[],
  fps: number,
  exerciseKey: string,
): PeriodResult | null {
  const bounds = getRepPeriodBounds(exerciseKey);
  const { lagFrames, peakHeight } = estimateDominantPeriod(
    signal, fps, bounds.min, bounds.max,
  );

  if (lagFrames === 0 || peakHeight < 0.2) return null;

  const result = countByPeriod(signal, fps, lagFrames);
  result.autocorrPeak = peakHeight;

  if (result.reps < 1) return null;

  return result;
}
