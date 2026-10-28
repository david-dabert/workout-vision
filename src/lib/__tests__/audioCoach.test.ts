import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioCoach } from '../audioCoach';

describe('AudioCoach Web Audio Synthesizer', () => {
  beforeEach(() => {
    audioCoach.setEnabled(true);
    audioCoach.setVolume(0.8);
  });

  it('allows toggling enabled state and volume scaling', () => {
    expect(audioCoach.isEnabled()).toBe(true);
    audioCoach.setEnabled(false);
    expect(audioCoach.isEnabled()).toBe(false);
    audioCoach.setEnabled(true);
    audioCoach.setVolume(0.5);
  });

  it('safely handles playTempoTick without throwing in headless environments', () => {
    expect(() => {
      audioCoach.playTempoTick(false);
      audioCoach.playTempoTick(true);
    }).not.toThrow();
  });

  it('safely handles playPhaseTransition for all phases', () => {
    expect(() => {
      audioCoach.playPhaseTransition('concentric');
      audioCoach.playPhaseTransition('eccentric');
      audioCoach.playPhaseTransition('turnaround');
      audioCoach.playPhaseTransition('lockout');
    }).not.toThrow();
  });

  it('safely handles playVelocityLossAlert and threshold gating', () => {
    expect(() => {
      audioCoach.playVelocityLossAlert(0.10); // under threshold, silent
      audioCoach.playVelocityLossAlert(0.35); // above threshold
    }).not.toThrow();
  });

  it('safely handles playCountdownTick', () => {
    expect(() => {
      audioCoach.playCountdownTick(3);
      audioCoach.playCountdownTick(2);
      audioCoach.playCountdownTick(1);
      audioCoach.playCountdownTick(0);
    }).not.toThrow();
  });

  it('safely handles playStretchDepthClick and tactile feedback', () => {
    expect(() => {
      audioCoach.playStretchDepthClick();
    }).not.toThrow();
  });

  it('safely handles playBounceWarning for ballistic turnaround', () => {
    expect(() => {
      audioCoach.playBounceWarning();
    }).not.toThrow();
  });

  it('safely handles playContinuousTensionAlert for lockout dwell', () => {
    expect(() => {
      audioCoach.playContinuousTensionAlert();
    }).not.toThrow();
  });

  it('safely handles playLockoutCue and playTurnaroundCue', () => {
    expect(() => {
      audioCoach.playLockoutCue(0);
      audioCoach.playLockoutCue(-0.5);
      audioCoach.playTurnaroundCue();
    }).not.toThrow();
  });
});

