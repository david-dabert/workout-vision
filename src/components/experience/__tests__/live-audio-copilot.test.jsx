import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  playStretchDepthClick,
  playBounceWarning,
  playContinuousTensionAlert,
  playLockoutCue,
  playTurnaroundCue,
  playVelocityLossAlert,
} from '../../../lib/audioCueEngine';
import { audioCoach } from '../../../lib/audioCoach';
import { resolveKinematicAlias } from '../../../lib/biomechanics/kinematicAliasing';

describe('Live Earbud Audio Co-Pilot & Kinematic Acoustic Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioCoach.setEnabled(true);
    audioCoach.setVolume(0.8);
  });

  it('delegates all audioCueEngine cues directly to unified audioCoach', () => {
    const clickSpy = vi.spyOn(audioCoach, 'playStretchDepthClick');
    const bounceSpy = vi.spyOn(audioCoach, 'playBounceWarning');
    const tensionSpy = vi.spyOn(audioCoach, 'playContinuousTensionAlert');
    const lockoutSpy = vi.spyOn(audioCoach, 'playLockoutCue');
    const turnaroundSpy = vi.spyOn(audioCoach, 'playTurnaroundCue');
    const velocitySpy = vi.spyOn(audioCoach, 'playVelocityLossAlert');

    playStretchDepthClick();
    expect(clickSpy).toHaveBeenCalledTimes(1);

    playBounceWarning();
    expect(bounceSpy).toHaveBeenCalledTimes(1);

    playContinuousTensionAlert();
    expect(tensionSpy).toHaveBeenCalledTimes(1);

    playLockoutCue(0.5);
    expect(lockoutSpy).toHaveBeenCalledWith(0.5);

    playTurnaroundCue();
    expect(turnaroundSpy).toHaveBeenCalledTimes(1);

    playVelocityLossAlert(0.35);
    expect(velocitySpy).toHaveBeenCalledWith(0.35);
  });

  it('correctly identifies stretch-depth trigger threshold across movement archetypes', () => {
    // 1. Squat / Pendulum Squat (high rest): stretch zone is knee <= 80 deg
    const squatProfile = resolveKinematicAlias('squat');
    expect(squatProfile.restPosition).toBe('high');
    expect(squatProfile.optimalStretchAngle).toBe(80);

    const squatAngleInStretch = 78;
    const isSquatStretch = squatAngleInStretch <= squatProfile.optimalStretchAngle;
    expect(isSquatStretch).toBe(true);

    const squatAngleAboveStretch = 95;
    expect(squatAngleAboveStretch <= squatProfile.optimalStretchAngle).toBe(false);

    // 2. Preacher Curl (low rest): stretch zone is elbow >= 160 deg (lengthened bicep)
    const curlProfile = resolveKinematicAlias('preacher_curl');
    expect(curlProfile.restPosition).toBe('low');
    expect(curlProfile.optimalStretchAngle).toBe(160);

    const curlAngleInStretch = 162;
    const isCurlStretch = curlAngleInStretch >= curlProfile.optimalStretchAngle;
    expect(isCurlStretch).toBe(true);
  });

  it('simulates live kinematic sequence with acoustic cues at turnaround and lockout', () => {
    const clickSpy = vi.spyOn(audioCoach, 'playStretchDepthClick');
    const lockoutSpy = vi.spyOn(audioCoach, 'playLockoutCue');

    // Simulate eccentric descent into stretch depth
    let stretchDepthHit = false;
    const profile = resolveKinematicAlias('pendulum_squat');
    const descendingAngles = [160, 130, 100, 85, 76, 75, 82, 110, 150, 165];

    for (const angle of descendingAngles) {
      const inStretch = angle <= profile.optimalStretchAngle;
      const inRest = angle > profile.optimalStretchAngle + 15;

      if (inStretch && !stretchDepthHit) {
        playStretchDepthClick();
        stretchDepthHit = true;
      } else if (inRest) {
        stretchDepthHit = false;
      }
    }

    // Should have triggered exactly once during the rep
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Rep completed at lockout
    playLockoutCue();
    expect(lockoutSpy).toHaveBeenCalledTimes(1);
  });
});
