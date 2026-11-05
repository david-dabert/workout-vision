import { describe, it, expect } from 'vitest';
import { AdaptiveDutyGovernor, DUTY_TIERS } from '../adaptiveDutyCycle';

describe('AdaptiveDutyGovernor', () => {
  it('initializes with nominal tier configs', () => {
    const governor = new AdaptiveDutyGovernor('idle');
    expect(governor.getState()).toBe('idle');
    expect(governor.getEffectiveIntervalMs()).toBe(DUTY_TIERS.idle.intervalMs);
  });

  it('samples at 4 fps during idle state and throttles intermediate frames', () => {
    const governor = new AdaptiveDutyGovernor('idle'); // 250 ms interval

    expect(governor.shouldProcess(0)).toBe(true);
    expect(governor.shouldProcess(50)).toBe(false);
    expect(governor.shouldProcess(100)).toBe(false);
    expect(governor.shouldProcess(200)).toBe(false);
    expect(governor.shouldProcess(250)).toBe(true);
    expect(governor.shouldProcess(300)).toBe(false);
    expect(governor.shouldProcess(500)).toBe(true);

    const stats = governor.getStats();
    expect(stats.totalFramesPresented).toBe(7);
    expect(stats.totalFramesProcessed).toBe(3);
    expect(stats.totalFramesSkipped).toBe(4);
    expect(stats.thermalReductionRatio).toBeGreaterThan(0.5);
  });

  it('transitions cleanly to active state with 15 fps core cadence', () => {
    const governor = new AdaptiveDutyGovernor('idle');
    governor.setState('active');
    expect(governor.getState()).toBe('active');

    const interval = governor.getEffectiveIntervalMs();
    expect(interval).toBeCloseTo(66.7, 1);

    expect(governor.shouldProcess(1000)).toBe(true);
    expect(governor.shouldProcess(1030)).toBe(false);
    expect(governor.shouldProcess(1070)).toBe(true);
  });

  it('expands interval under high worker latency backpressure', () => {
    const governor = new AdaptiveDutyGovernor('active'); // 66.7 ms interval
    const nominalInterval = governor.getEffectiveIntervalMs();

    // Normal latency (20 ms)
    for (let i = 0; i < 5; i++) governor.recordLatency(20);
    expect(governor.getEffectiveIntervalMs()).toBe(nominalInterval);

    // High latency (65 ms on 66.7 ms interval)
    for (let i = 0; i < 10; i++) governor.recordLatency(65);
    const throttledInterval = governor.getEffectiveIntervalMs();

    expect(throttledInterval).toBeGreaterThan(nominalInterval);
    expect(throttledInterval).toBe(Math.round(nominalInterval * 1.25));
  });

  it('resets counters and history accurately', () => {
    const governor = new AdaptiveDutyGovernor('standby');
    governor.shouldProcess(0);
    governor.shouldProcess(50);
    governor.recordLatency(15);

    governor.reset();
    const stats = governor.getStats();
    expect(stats.totalFramesPresented).toBe(0);
    expect(stats.totalFramesProcessed).toBe(0);
    expect(stats.averageLatencyMs).toBe(0);
  });
});
