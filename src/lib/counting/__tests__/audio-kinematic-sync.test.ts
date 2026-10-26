import { describe, it, expect } from 'vitest';
import {
  extractAcousticTransients,
  calibrateVisualInflection,
  synchronizeRepetitionsWithAudio,
} from '../AudioKinematicSync';

describe('AudioKinematicSync', () => {
  const sampleRate = 44100;

  it('extracts sharp acoustic transients from synthetic audio signal', () => {
    // 2 seconds of audio with silence and a sharp impulse at t = 1.0s
    const totalSamples = sampleRate * 2;
    const samples = new Float32Array(totalSamples);

    // Background low noise
    for (let i = 0; i < totalSamples; i++) {
      samples[i] = (Math.random() - 0.5) * 0.002;
    }

    // High frequency impulse at t = 1.0s (sample index 44100)
    const impulseIndex = sampleRate * 1;
    for (let i = 0; i < 500; i++) {
      // 4 kHz decaying oscillation (plate contact simulation)
      const t = i / sampleRate;
      samples[impulseIndex + i] = 0.8 * Math.exp(-t * 80) * Math.sin(2 * Math.PI * 4000 * t);
    }

    const transients = extractAcousticTransients(samples, sampleRate);
    expect(transients.length).toBeGreaterThanOrEqual(1);

    const match = transients.find(tr => Math.abs(tr.timeSec - 1.0) < 0.05);
    expect(match).toBeDefined();
    if (match) {
      expect(match.type).toBe('impact');
      expect(match.energy).toBeGreaterThan(0.01);
    }
  });

  it('calibrates visual inflection with acoustic transient sub-millisecond precision', () => {
    // Video visual inflection frame at frame 30 (1.000s at 30fps)
    const fps = 30;
    const visualFrame = 30; // 1.000s

    // Real physical turnaround occurred at 1.018s (sharp barbell contact)
    const transients = [
      {
        timeSec: 1.018,
        energy: 0.5,
        type: 'impact' as const,
        sharpness: 12.5,
      },
    ];

    const result = calibrateVisualInflection(visualFrame, fps, transients);
    expect(result.visualTimeSec).toBe(1.0);
    expect(result.acousticTimeSec).toBe(1.018);
    expect(result.temporalOffsetSec).toBeCloseTo(0.018, 3);
    expect(result.calibratedTimeSec).toBe(1.018);
    expect(result.syncConfidence).toBeGreaterThan(0.9); // Within 18ms yields high confidence
    expect(result.matchedTransient).toBe(transients[0]);
  });

  it('falls back gracefully when no acoustic transients match visual inflection', () => {
    const fps = 30;
    const visualFrame = 30; // 1.000s

    // Only transient is at 5.0s (outside tolerance window)
    const transients = [
      {
        timeSec: 5.0,
        energy: 0.5,
        type: 'impact' as const,
        sharpness: 10,
      },
    ];

    const result = calibrateVisualInflection(visualFrame, fps, transients);
    expect(result.visualTimeSec).toBe(1.0);
    expect(result.calibratedTimeSec).toBe(1.0); // Retains visual time
    expect(result.temporalOffsetSec).toBe(0);
    expect(result.syncConfidence).toBe(0.5);
    expect(result.matchedTransient).toBeNull();
  });

  it('synchronizes batch repetitions with audio buffer', () => {
    const totalSamples = sampleRate * 3;
    const samples = new Float32Array(totalSamples);

    // Two impact clicks at t = 0.8s and t = 2.1s
    const click1 = Math.floor(sampleRate * 0.8);
    const click2 = Math.floor(sampleRate * 2.1);

    for (let i = 0; i < 400; i++) {
      samples[click1 + i] = 0.7 * Math.sin(2 * Math.PI * 3000 * (i / sampleRate));
      samples[click2 + i] = 0.7 * Math.sin(2 * Math.PI * 3000 * (i / sampleRate));
    }

    const visualInflections = [24, 63]; // ~0.8s and ~2.1s at 30 fps
    const results = synchronizeRepetitionsWithAudio(
      visualInflections,
      30,
      samples,
      sampleRate
    );

    expect(results.length).toBe(2);
    expect(results[0].matchedTransient).not.toBeNull();
    expect(results[1].matchedTransient).not.toBeNull();
  });
});
