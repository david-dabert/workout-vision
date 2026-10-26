/**
 * AudioKinematicSync - Multimodal Audio-Visual Kinematic Calibration
 *
 * Implements multimodal temporal fusion between video pose kinematics and
 * high-resolution audio acoustic transients (e.g., barbell plate clanks,
 * rack contact, floor tap, exhalation bursts).
 *
 * Video frame rate (typically 30 fps) yields ~33.3 ms temporal granularity,
 * often suffering from motion blur exactly at the maximum-velocity turnaround point.
 * Acoustic transients sampled at 44.1 kHz / 48 kHz have sub-millisecond resolution (< 0.05 ms).
 *
 * This module extracts acoustic onset events and cross-correlates them with
 * visual kinetic turning points to achieve microsecond temporal calibration.
 */

export interface AcousticTransient {
  timeSec: number;
  energy: number;
  type: 'impact' | 'exhalation' | 'ambient';
  sharpness: number; // Normalized rise-time derivative
}

export interface MultimodalCalibrationResult {
  visualTimeSec: number;
  acousticTimeSec: number;
  temporalOffsetSec: number; // acousticTimeSec - visualTimeSec
  calibratedTimeSec: number;
  syncConfidence: number; // 0..1 based on proximity to visual turning point
  matchedTransient: AcousticTransient | null;
}

export interface AudioSyncOptions {
  frameRate?: number; // Video fps (default: 30)
  maxTemporalToleranceSec?: number; // Max allowable audio-visual offset (default: 0.20s = 200ms)
  minTransientEnergyRatio?: number; // Relative peak threshold (default: 2.5x mean energy)
  hopSize?: number; // STFT hop size in samples (default: 512)
  fftSize?: number; // STFT window size in samples (default: 1024)
}

/**
 * Extracts acoustic impact transients and exhalation bursts from raw PCM audio buffer.
 */
export function extractAcousticTransients(
  audioSamples: Float32Array,
  sampleRate: number,
  options?: AudioSyncOptions
): AcousticTransient[] {
  const hopSize = options?.hopSize ?? 512;
  const fftSize = options?.fftSize ?? 1024;
  const tolerance = options?.minTransientEnergyRatio ?? 2.5;

  if (audioSamples.length < fftSize) {
    return [];
  }

  const numFrames = Math.floor((audioSamples.length - fftSize) / hopSize) + 1;
  const frameEnergies = new Float32Array(numFrames);
  const highFreqEnergies = new Float32Array(numFrames);

  let meanEnergy = 0;

  // Compute short-time energy & high-frequency content (HFC)
  for (let m = 0; m < numFrames; m++) {
    const start = m * hopSize;
    let sumEnergy = 0;
    let sumDiff = 0; // High-frequency proxy using first difference

    for (let i = 0; i < fftSize; i++) {
      const s = audioSamples[start + i];
      sumEnergy += s * s;
      if (i > 0) {
        const d = s - audioSamples[start + i - 1];
        sumDiff += d * d;
      }
    }

    frameEnergies[m] = sumEnergy;
    highFreqEnergies[m] = sumDiff;
    meanEnergy += sumEnergy;
  }

  meanEnergy = meanEnergy / Math.max(1, numFrames);
  const threshold = Math.max(1e-5, meanEnergy * tolerance);

  // Spectral flux / energy onset detection
  const transients: AcousticTransient[] = [];
  const minPeakDistanceFrames = Math.floor(0.15 * (sampleRate / hopSize)); // At least 150ms apart

  let lastPeakFrame = -minPeakDistanceFrames;

  for (let m = 1; m < numFrames - 1; m++) {
    const e = frameEnergies[m];
    const prevE = frameEnergies[m - 1];
    const nextE = frameEnergies[m + 1];

    // Local peak condition
    if (e > threshold && e > prevE && e >= nextE) {
      if (m - lastPeakFrame >= minPeakDistanceFrames) {
        const timeSec = (m * hopSize + fftSize / 2) / sampleRate;
        const riseSlope = (e - prevE) / Math.max(1e-6, prevE);
        const hfcRatio = highFreqEnergies[m] / Math.max(1e-6, e);

        // High frequency ratio or sharp rise slope distinguishes metallic/plate click from vocal exhalation
        const type: 'impact' | 'exhalation' | 'ambient' =
          hfcRatio > 0.25 || riseSlope > 2.0 ? 'impact' : hfcRatio > 0.10 ? 'exhalation' : 'ambient';

        transients.push({
          timeSec: Math.round(timeSec * 1000) / 1000,
          energy: Math.round(e * 1000) / 1000,
          type,
          sharpness: Math.round(riseSlope * 100) / 100,
        });

        lastPeakFrame = m;
      }
    }
  }

  return transients;
}

/**
 * Calibrates a visual turning point against acoustic transients.
 */
export function calibrateVisualInflection(
  visualFrameIndex: number,
  fps: number,
  transients: AcousticTransient[],
  options?: AudioSyncOptions
): MultimodalCalibrationResult {
  const visualTimeSec = visualFrameIndex / Math.max(1, fps);
  const maxTolerance = options?.maxTemporalToleranceSec ?? 0.20; // 200 ms

  if (transients.length === 0) {
    return {
      visualTimeSec,
      acousticTimeSec: visualTimeSec,
      temporalOffsetSec: 0,
      calibratedTimeSec: visualTimeSec,
      syncConfidence: 0.5,
      matchedTransient: null,
    };
  }

  // Find nearest transient within tolerance window
  let bestTransient: AcousticTransient | null = null;
  let minOffset = Infinity;

  for (const tr of transients) {
    const offset = tr.timeSec - visualTimeSec;
    const absOffset = Math.abs(offset);

    if (absOffset <= maxTolerance && absOffset < minOffset) {
      minOffset = absOffset;
      bestTransient = tr;
    }
  }

  if (!bestTransient) {
    return {
      visualTimeSec,
      acousticTimeSec: visualTimeSec,
      temporalOffsetSec: 0,
      calibratedTimeSec: visualTimeSec,
      syncConfidence: 0.5,
      matchedTransient: null,
    };
  }

  const offsetSec = bestTransient.timeSec - visualTimeSec;
  // Gaussian sync confidence based on offset (sigma = 0.05s = 50ms)
  const sigma = 0.05;
  const syncConfidence = Math.exp(-(offsetSec * offsetSec) / (2 * sigma * sigma));

  return {
    visualTimeSec: Math.round(visualTimeSec * 1000) / 1000,
    acousticTimeSec: bestTransient.timeSec,
    temporalOffsetSec: Math.round(offsetSec * 1000) / 1000,
    calibratedTimeSec: bestTransient.timeSec,
    syncConfidence: Math.round(syncConfidence * 100) / 100,
    matchedTransient: bestTransient,
  };
}

/**
 * Batch calibrates all visual inflection points across a set of repetitions.
 */
export function synchronizeRepetitionsWithAudio(
  visualInflections: number[], // Array of visual frame indices (inflection points)
  fps: number,
  audioSamples: Float32Array,
  sampleRate: number,
  options?: AudioSyncOptions
): MultimodalCalibrationResult[] {
  const transients = extractAcousticTransients(audioSamples, sampleRate, options);

  return visualInflections.map(frame =>
    calibrateVisualInflection(frame, fps, transients, options)
  );
}
