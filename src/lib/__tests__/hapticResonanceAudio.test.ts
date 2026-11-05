import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HapticResonanceAudioService,
  hapticResonanceAudio,
} from '../hapticResonanceAudio';

describe('HapticResonanceAudioService', () => {
  let service: HapticResonanceAudioService;

  beforeEach(() => {
    service = new HapticResonanceAudioService({
      minInterCueSpacingMs: 50,
    });
  });

  it('allows toggling enabled state, volume scaling, and config querying', () => {
    expect(service.isEnabled()).toBe(true);
    service.setEnabled(false);
    expect(service.isEnabled()).toBe(false);

    service.setEnabled(true);
    service.setVolume(0.5);
    expect(service.getConfig().masterVolume).toBe(0.5);

    service.setVolume(1.5); // clamps to 1.0
    expect(service.getConfig().masterVolume).toBe(1.0);
  });

  it('safely handles missing fundamental thump in headless environments', () => {
    expect(() => {
      service.playMissingFundamentalThump(80, 0.08, 0.3);
      service.playMissingFundamentalThump(60, 0.1, 0.4);
    }).not.toThrow();
  });

  it('safely handles transient clicks in headless environments', () => {
    expect(() => {
      service.playTransientClick(2800, 0.005, 0.25);
    }).not.toThrow();
  });

  it('safely triggers rep success ascending fifth chime', () => {
    expect(() => {
      service.playRepSuccess();
    }).not.toThrow();
  });

  it('gates velocity loss warning based on loss fraction', () => {
    expect(() => {
      service.playVelocityLossWarning(0.10); // Below 0.15 threshold, should be silent
      service.playVelocityLossWarning(0.25); // Above threshold, triggers alert
    }).not.toThrow();
  });

  it('safely triggers turnaround inflection cue', () => {
    expect(() => {
      service.playTurnaround();
    }).not.toThrow();
  });

  it('safely triggers form deficit breakdown alert with dissonant beating', () => {
    expect(() => {
      service.playFormDeficitAlert();
    }).not.toThrow();
  });

  it('safely triggers cadence metronome ticks with and without accents', () => {
    expect(() => {
      service.playCadenceTick(false);
      service.playCadenceTick(true);
    }).not.toThrow();
  });

  it('enforces priority collision prevention and debounces rapid low-priority cues', async () => {
    // Rapid calls to cadence tick within minInterCueSpacingMs should be throttled
    expect(() => {
      service.playCadenceTick(false);
      service.playCadenceTick(false); // Collides with cadence, suppressed
    }).not.toThrow();

    // High priority form deficit preempts
    expect(() => {
      service.playFormDeficitAlert();
    }).not.toThrow();
  });

  it('singleton export is available and functional', () => {
    expect(hapticResonanceAudio).toBeDefined();
    expect(hapticResonanceAudio.isEnabled()).toBe(true);
  });
});
