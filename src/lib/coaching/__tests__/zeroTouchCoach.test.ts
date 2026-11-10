import { describe, it, expect, beforeEach } from 'vitest';
import { ZeroTouchCoach } from '../zeroTouchCoach';

describe('ZeroTouchCoach (Hands-Free Gym Engine)', () => {
  let coach: ZeroTouchCoach;

  beforeEach(() => {
    coach = new ZeroTouchCoach({
      requiredHoldDurationMs: 1500,
      countdownDurationSeconds: 3,
      restAutoStopTimeoutMs: 3500,
    });
  });

  it('starts in STANDBY_UNFRAMED and moves to FRAMING_ACQUIRED when subject enters', () => {
    expect(coach.getContext().state).toBe('STANDBY_UNFRAMED');

    const ctx = coach.handleEvent({ type: 'SUBJECT_ENTERED_FRAME' });
    expect(ctx.state).toBe('FRAMING_ACQUIRED');
    expect(ctx.audioAnnouncementFr).toContain('Cadrage validé');
  });

  it('engages countdown only after steady posture is held for minimum required duration', () => {
    coach.handleEvent({ type: 'SUBJECT_ENTERED_FRAME' });

    // Under duration (1000ms < 1500ms)
    let ctx = coach.handleEvent({ type: 'POSTURE_HELD_STEADY', payload: { durationMs: 1000 } });
    expect(ctx.state).toBe('FRAMING_ACQUIRED');

    // Sufficient duration (1600ms >= 1500ms)
    ctx = coach.handleEvent({ type: 'POSTURE_HELD_STEADY', payload: { durationMs: 1600 } });
    expect(ctx.state).toBe('COUNTDOWN');
    expect(ctx.audioAnnouncementFr).toContain('Début dans 3... 2... 1...');
  });

  it('progresses from COUNTDOWN to TRACKING_ACTIVE and increments reps cleanly', () => {
    coach.handleEvent({ type: 'SUBJECT_ENTERED_FRAME' });
    coach.handleEvent({ type: 'POSTURE_HELD_STEADY', payload: { durationMs: 1600 } });

    let ctx = coach.handleEvent({ type: 'COUNTDOWN_EXPIRED' });
    expect(ctx.state).toBe('TRACKING_ACTIVE');
    expect(ctx.audioAnnouncementFr).toBe('Partez.');

    ctx = coach.handleEvent({ type: 'REP_COMPLETED', payload: { count: 1 } });
    expect(ctx.completedReps).toBe(1);
    expect(ctx.audioAnnouncementFr).toBe('1');

    ctx = coach.handleEvent({ type: 'REP_COMPLETED', payload: { count: 2 } });
    expect(ctx.completedReps).toBe(2);
    expect(ctx.audioAnnouncementFr).toBe('2');
  });

  it('detects auto-rerack termination after timeout and triggers vocal set summary', () => {
    coach.handleEvent({ type: 'SUBJECT_ENTERED_FRAME' });
    coach.handleEvent({ type: 'POSTURE_HELD_STEADY', payload: { durationMs: 1600 } });
    coach.handleEvent({ type: 'COUNTDOWN_EXPIRED' });
    coach.handleEvent({ type: 'REP_COMPLETED', payload: { count: 8 } });

    expect(coach.shouldAutoTerminateSet(2000, 8)).toBe(false);
    expect(coach.shouldAutoTerminateSet(4000, 8)).toBe(true);

    const ctx = coach.handleEvent({ type: 'RERACK_OR_REST_DETECTED' });
    expect(ctx.state).toBe('SET_TERMINATED');
    expect(ctx.completedReps).toBe(8);
    expect(ctx.audioAnnouncementFr).toContain('8 répétitions enregistrées');
  });
});
