// The dormant feedback panel posts nowhere (WP0.4, docs/SPEC-production.md, 3 October 2026): the worker's /ingest is
// removed, and FeedbackPanel.jsx's sender is inert whatever the build sets. A source check, since the panel's only
// network calls were in that sender.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../../components/FeedbackPanel.jsx', import.meta.url), 'utf8');

describe('FeedbackPanel sends nothing', () => {
  it('holds no network call and no worker address', () => {
    for (const call of [/\bfetch\s*\(/, /sendBeacon/, /XMLHttpRequest/, /WebSocket/, /\/ingest/, /__FEEDBACK_URL__/]) {
      expect(SOURCE).not.toMatch(call);
    }
  });
  it('keeps the sender as an empty function', () => {
    expect(SOURCE).toMatch(/function beaconFeedback\(\) \{\}/);
  });
});
