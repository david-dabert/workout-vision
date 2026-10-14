import { describe, it, expect } from 'vitest';
import * as channel from '../channel';
import { encodePayload, decodePayload } from '../channel';

describe('the link payload encoding (an encoding, not encryption)', () => {
  it('encodes and decodes a payload symmetrically', () => {
    const original = { type: 'note', text: 'Séance de jeudi', n: 8 };
    const encoded = encodePayload(original);
    expect(typeof encoded).toBe('string');
    expect(decodePayload<typeof original>(encoded)).toEqual(original);
  });
  it('returns null on corrupted payloads', () => {
    expect(decodePayload('invalid_token_123!@#')).toBeNull();
  });
  it('offers no invitation link: the router sent #chat= to the home screen (CHT-4)', () => {
    expect('createChatInvitationUrl' in channel).toBe(false);
  });
});
