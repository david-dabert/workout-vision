import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveMetronome } from '../adaptiveMetronome';

describe('AdaptiveMetronome (Web Audio Cadence Synthesizer)', () => {
  let metronome: AdaptiveMetronome;

  beforeEach(() => {
    metronome = new AdaptiveMetronome({
      eccentricSeconds: 3.0,
      pauseSeconds: 1.0,
      concentricSeconds: 1.0,
    });
  });

  it('initializes with default cadence and REST phase', () => {
    expect(metronome.getPhase()).toBe('REST');
    const cadence = metronome.getCadence();
    expect(cadence.eccentricSeconds).toBe(3.0);
    expect(cadence.pauseSeconds).toBe(1.0);
  });

  it('transitions cleanly between repetition phases', () => {
    metronome.enable();

    metronome.transitionPhase('ECCENTRIC');
    expect(metronome.getPhase()).toBe('ECCENTRIC');

    metronome.transitionPhase('INFLECTION_PAUSE');
    expect(metronome.getPhase()).toBe('INFLECTION_PAUSE');

    metronome.transitionPhase('CONCENTRIC');
    expect(metronome.getPhase()).toBe('CONCENTRIC');

    metronome.transitionPhase('REST');
    expect(metronome.getPhase()).toBe('REST');
  });

  it('updates cadence and preserves configuration when disabled', () => {
    metronome.setCadence({
      eccentricSeconds: 4.0,
      pauseSeconds: 2.0,
      concentricSeconds: 1.5,
    });

    const cadence = metronome.getCadence();
    expect(cadence.eccentricSeconds).toBe(4.0);
    expect(cadence.pauseSeconds).toBe(2.0);

    metronome.disable();
    expect(metronome.getPhase()).toBe('REST');
  });
});
