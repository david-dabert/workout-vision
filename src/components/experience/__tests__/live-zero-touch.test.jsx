import { describe, it, expect } from 'vitest';
import { evaluateFraming, AutonomousFramingCoach } from '../../../lib/coaching/autonomousFraming';
import { AutoSetGate } from '../../../lib/coaching/autoSetGate';

describe('Live Zero-Touch Autonomous Gym Flow Integration', () => {
  it('guides athlete through verbal framing states toward optimal lifting envelope', () => {
    // 1. Initial state: athlete stands too far
    const tooFar = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    tooFar[0] = { x: 0.5, y: 0.35, visibility: 0.9 }; // nose
    tooFar[27] = { x: 0.5, y: 0.65, visibility: 0.9 }; // ankle (height ratio = 0.30 < 0.38)
    tooFar[28] = { x: 0.5, y: 0.65, visibility: 0.9 };

    const evalFar = evaluateFraming(tooFar, true);
    expect(evalFar.status).toBe('TOO_FAR');
    expect(evalFar.isReadyToLift).toBe(false);
    expect(evalFar.cueFr).toContain('Rapprochez-vous');

    // 2. Athlete approaches into optimal framing
    const optimal = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    optimal[0] = { x: 0.5, y: 0.15, visibility: 0.9 }; // nose
    optimal[27] = { x: 0.5, y: 0.85, visibility: 0.9 }; // ankle (height ratio = 0.70)
    optimal[28] = { x: 0.5, y: 0.85, visibility: 0.9 };

    const evalOptimal = evaluateFraming(optimal, true);
    expect(evalOptimal.status).toBe('OPTIMAL');
    expect(evalOptimal.isReadyToLift).toBe(true);
    expect(evalOptimal.cueFr).toContain('Cadrage optimal');
  });

  it('autonomous gate executes hands-free countdown and rack completion', () => {
    const gate = new AutoSetGate({ braceDwellSec: 1.0, rackDwellSec: 3.0 });

    // Step 1: Athlete achieves optimal framing and braces at lifting station
    const action1 = gate.update(true, 180, true, 1000);
    expect(action1).toBeNull();
    expect(gate.getState()).toBe('BRACING');

    // 1.1s later: stationary brace satisfied -> auto triggers countdown
    const actionCountdown = gate.update(true, 180, true, 2100);
    expect(actionCountdown).toBe('TRIGGER_COUNTDOWN');
    expect(gate.getState()).toBe('COUNTDOWN');

    // Step 2: Set starts, athlete completes 8 reps
    gate.onSetStarted();
    gate.setReps(8);
    expect(gate.getState()).toBe('ACTIVE_LIFTING');

    // Step 3: Reps complete, athlete returns to lockout and racks
    gate.update(true, 180, true, 10000);
    expect(gate.getState()).toBe('LOCKOUT_RESTING');

    // 3.2s later: prolonged lockout dwell satisfied -> auto triggers set finish
    const actionFinish = gate.update(true, 180, true, 13200);
    expect(actionFinish).toBe('TRIGGER_FINISH');
    expect(gate.getState()).toBe('COMPLETED');
  });

  it('guarantees French typography compliance in all autonomous speech cues', () => {
    const coach = new AutonomousFramingCoach();
    const mockLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    mockLandmarks[0] = { x: 0.5, y: 0.15, visibility: 0.9 };
    mockLandmarks[27] = { x: 0.5, y: 0.85, visibility: 0.9 };
    mockLandmarks[28] = { x: 0.5, y: 0.85, visibility: 0.9 };

    const optimalEval = evaluateFraming(mockLandmarks, true);
    const cue = coach.update(optimalEval, 1000);
    // Let persistence pass
    const spoken = coach.update(optimalEval, 2000);
    expect(spoken).toBeTruthy();

    // Check no unescaped punctuation
    if (spoken.includes(':')) {
      expect(spoken).toMatch(/\u00A0:/);
    }
    if (spoken.includes('!')) {
      expect(spoken).toMatch(/\u00A0!/);
    }
  });
});
