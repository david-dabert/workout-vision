import { describe, it, expect, beforeEach } from 'vitest';
import { AutoSetGate } from '../autoSetGate';

describe('AutoSetGate (Hands-Free Autonomous Workout Lifecycle)', () => {
  let gate: AutoSetGate;

  beforeEach(() => {
    gate = new AutoSetGate({
      braceDwellSec: 1.0,
      rackDwellSec: 3.0,
      angularVelocityThresholdDegPerSec: 10,
    });
  });

  it('triggers countdown when athlete establishes stationary brace in optimal framing', () => {
    // Frame 1: framed and stationary at t=1000
    const trigger1 = gate.update(true, 175, true, 1000);
    expect(trigger1).toBeNull();
    expect(gate.getState()).toBe('BRACING');

    // Frame 2: still stationary at t=1500 (500ms dwell)
    const trigger2 = gate.update(true, 175, true, 1500);
    expect(trigger2).toBeNull();

    // Frame 3: stationary at t=2100 (1100ms dwell > 1000ms threshold)
    const trigger3 = gate.update(true, 175, true, 2100);
    expect(trigger3).toBe('TRIGGER_COUNTDOWN');
    expect(gate.getState()).toBe('COUNTDOWN');
  });

  it('aborts brace if athlete moves violently or loses framing before dwell expires', () => {
    gate.update(true, 175, true, 1000);
    expect(gate.getState()).toBe('BRACING');

    // Moves fast at t=1500 (angle jumps from 175 to 140 over 500ms -> vel = 70 deg/s)
    const trigger = gate.update(true, 140, true, 1500);
    expect(trigger).toBeNull();
    expect(gate.getState()).toBe('IDLE');
  });

  it('triggers auto-finish when athlete completes reps and rests at lockout', () => {
    gate.onSetStarted();
    gate.setReps(8);
    expect(gate.getState()).toBe('ACTIVE_LIFTING');

    // Finishes rep and reaches lockout at t=10000
    gate.update(true, 175, true, 10000);
    expect(gate.getState()).toBe('LOCKOUT_RESTING');

    // Resting for 2.0s at t=12000 (still under 3.0s rack dwell)
    const midDwell = gate.update(true, 175, true, 12000);
    expect(midDwell).toBeNull();

    // Reaches 3.2s dwell at t=13200
    const finishTrigger = gate.update(true, 175, true, 13200);
    expect(finishTrigger).toBe('TRIGGER_FINISH');
    expect(gate.getState()).toBe('COMPLETED');
  });

  it('resumes active lifting if lifter initiates another rep during lockout rest', () => {
    gate.onSetStarted();
    gate.setReps(5);

    gate.update(true, 175, true, 10000);
    expect(gate.getState()).toBe('LOCKOUT_RESTING');

    // Lifter starts descending for rep 6 at t=11500 (angle drops to 140 deg)
    gate.update(true, 140, false, 11500);
    expect(gate.getState()).toBe('ACTIVE_LIFTING');
  });
});
