import { describe, expect, it } from 'vitest';
import { parseBlindRecord, validateBlindRecord, type BlindCountRecord } from '../schema';
import { evaluateBlindSets } from '../../accuracy/scoreboard-blind.test';

describe('Blind count recording protocol and schema validation', () => {
  it('validates a complete, canonical blind count record', () => {
    const valid: BlindCountRecord = {
      version: 1,
      videoSha256: '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1',
      lift: 'squat',
      testerCount: 10,
      appCount: 10,
      appRefused: false,
      timestamp: '2026-11-08T00:00:00.000Z',
      sessionId: 'anon-test-session-1234',
    };

    const res = validateBlindRecord(valid);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('validates a record with landmarks and timestamps', () => {
    const validWithLandmarks: BlindCountRecord = {
      version: 1,
      videoSha256: 'abcdef1234567890',
      lift: 'bicep_curl',
      testerCount: 8,
      appCount: 8,
      timestamp: Date.now(),
      sessionId: 'sess-abc',
      worldLandmarks: [[[0, 0, 0]]],
      timestamps: [0],
    };

    const res = validateBlindRecord(validWithLandmarks);
    expect(res.valid).toBe(true);
  });

  it('rejects invalid or missing videoSha256', () => {
    const missing = { lift: 'squat', testerCount: 5, appCount: 5, timestamp: '2026-11-08', sessionId: 's1' };
    const res1 = validateBlindRecord(missing);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some(e => e.includes('videoSha256'))).toBe(true);

    const nonHex = { ...missing, videoSha256: 'not-hex-chars!' };
    const res2 = validateBlindRecord(nonHex);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some(e => e.includes('videoSha256'))).toBe(true);
  });

  it('rejects missing or empty lift', () => {
    const noLift = { videoSha256: '12345678', lift: '   ', testerCount: 5, appCount: 5, timestamp: '2026-11-08', sessionId: 's1' };
    const res = validateBlindRecord(noLift);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('lift'))).toBe(true);
  });

  it('rejects invalid testerCount (labels must be integer >= 1 under R1/R2)', () => {
    const zero = { videoSha256: '12345678', lift: 'squat', testerCount: 0, appCount: 0, timestamp: '2026-11-08', sessionId: 's1' };
    expect(validateBlindRecord(zero).valid).toBe(false);

    const float = { videoSha256: '12345678', lift: 'squat', testerCount: 5.5, appCount: 5, timestamp: '2026-11-08', sessionId: 's1' };
    expect(validateBlindRecord(float).valid).toBe(false);
  });

  it('parses valid JSON string with parseBlindRecord', () => {
    const json = JSON.stringify({
      videoSha256: 'beefcafe12345678',
      lift: 'hip_thrust',
      testerCount: 12,
      appCount: 12,
      timestamp: '2026-11-08T01:00:00Z',
      sessionId: 'sess-001',
    });
    const parsed = parseBlindRecord(json);
    expect(parsed.testerCount).toBe(12);
    expect(parsed.lift).toBe('hip_thrust');
  });

  it('throws on parseBlindRecord with invalid data', () => {
    expect(() => parseBlindRecord('{}')).toThrow(/Invalid blind count record/);
  });
});

describe('Scoreboard comparator and evaluation logic', () => {
  it('correctly tallies exact matches, catastrophic errors, and refusal rate', () => {
    const mockSets: any[] = [
      { name: 'blind/set1.json', lift: 'squat', label: 10, testerCount: 10, appCount: 10, appRefused: false, wl: null, ts: null },
      { name: 'blind/set2.json', lift: 'bicep_curl', label: 8, testerCount: 8, appCount: 7, appRefused: false, wl: null, ts: null }, // off by 1
      { name: 'blind/set3.json', lift: 'lateral_raise', label: 12, testerCount: 12, appCount: 9, appRefused: false, wl: null, ts: null }, // off by 3 (catastrophic)
      { name: 'blind/set4.json', lift: 'leg_press', label: 10, testerCount: 10, appCount: 'refused', appRefused: true, wl: null, ts: null }, // refused
    ];

    const result = evaluateBlindSets(mockSets);
    expect(result.total).toBe(4);
    expect(result.exactCount).toBe(1);
    expect(result.catastrophicCount).toBe(1);
    expect(result.refusedCount).toBe(1);
    expect(result.rows[0].verdict).toBe('exact');
    expect(result.rows[1].verdict).toBe('off -1');
    expect(result.rows[2].verdict).toBe('catastrophic');
    expect(result.rows[3].verdict).toBe('refused');
  });
});
