import { describe, it, expect } from 'vitest';
import {
  encodePayload,
  decodePayload,
  createChatInvitationUrl,
} from '../channel';

describe('Decentralized P2P Messaging & Telemetry Channel', () => {
  it('encodes and decodes telemetry payload symmetrically', () => {
    const original = {
      type: 'telemetry_card',
      exerciseName: 'Barbell Squat',
      repsCounted: 8,
      formScore: 94,
      symmetryIndexPct: 96,
      lengthenedPartialsCount: 2,
      timestamp: 1776000000000,
    };

    const encoded = encodePayload(original);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = decodePayload<typeof original>(encoded);
    expect(decoded).toEqual(original);
  });

  it('generates a clean chat invitation URL with hash fragment', () => {
    const url = createChatInvitationUrl('https://workout.vision/app', 'Coach Julien');
    expect(url).toContain('https://workout.vision/app#chat=');

    const fragment = url.split('#chat=')[1];
    const payload = decodePayload(fragment);
    expect(payload.sender).toBe('Coach Julien');
  });

  it('returns null on corrupted or invalid payloads gracefully', () => {
    const decoded = decodePayload('invalid_token_123!@#');
    expect(decoded).toBeNull();
  });
});
