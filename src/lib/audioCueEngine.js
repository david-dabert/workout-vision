/**
 * AudioCueEngine — Tactile Acoustic & Micro-Haptic Kinematic Feedback
 *
 * Provides real-time acoustic feedback at exact kinematic turnaround points,
 * lockouts, stretch depth, and fatigue/velocity thresholds without looking at the screen.
 *
 * 100% Client-Side. Uses native Web Audio API synthesis via audioCoach.
 * ZERO network downloads. ZERO latency (<5ms acoustic latency).
 */

import { audioCoach } from './audioCoach';

export function playLockoutCue(pan = 0) {
  audioCoach.playLockoutCue(pan);
}

export function playTurnaroundCue() {
  audioCoach.playTurnaroundCue();
}

export function playVelocityLossAlert(lossPercentage) {
  audioCoach.playVelocityLossAlert(lossPercentage);
}

export function playStretchDepthClick() {
  audioCoach.playStretchDepthClick();
}

export function playBounceWarning() {
  audioCoach.playBounceWarning();
}

export function playContinuousTensionAlert() {
  audioCoach.playContinuousTensionAlert();
}
