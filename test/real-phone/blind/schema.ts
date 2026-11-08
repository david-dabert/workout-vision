// The blind-count file's schema, typed for the TypeScript tests (Phase 6 of David's order of 6 November 2026): the file
// a phone keeps when a count is kept on the result screen (src/lib/phoneCollect.js, collectedPayload) and sends only
// through the share sheet. The reader is parse.mjs, plain JavaScript, so the Node scripts (scripts/import-sets.mjs,
// scripts/tester-exam.mjs) and the tests read one schema; this module gives it its types (README.md here).
import { parseBlindFile as parse, MAX_COUNT, SHA256, UUID } from './parse.mjs';

/** A blind-count file as the phone writes it: the collector's set, with the count kept after the app showed its own. */
export interface BlindFile {
  lift: string;
  /** The count kept on the result screen, after the app showed its own. */
  count: number;
  view?: string;
  /** The video's SHA-256, or the landmarks' when the video could not be read (hashOf). */
  videoSha256: string;
  hashOf?: 'video' | 'landmarks';
  labelKind: 'after-app';
  appCount?: number | null;
  appRefused?: boolean;
  proposal?: number | null;
  /** The day the count was kept, YYYY-MM-DD (Phase 6). */
  recordedAt?: string;
  /** The page load's anonymous id, a version 4 UUID (Phase 6). */
  sessionId?: string;
  /** The person's count before the app showed its own; count null: « Je ne sais pas ». */
  blind: { count: number | null; p: number | null };
  worldLandmarks: unknown[];
  imageLandmarks?: unknown[] | null;
  timestamps: number[];
}

/** One blind set as the scoreboards read it: the label is the blind count. */
export interface ParsedBlindSet {
  lift: string;
  label: number;
  kept: number;
  appCount: number | null;
  appRefused: boolean;
  proposal: number | null;
  videoSha256: string;
  hashOf: string | null;
  recordedAt: string | null;
  sessionId: string | null;
  wl: any[];
  ts: number[];
  il: any[] | null;
}

export type BlindRead =
  | { status: 'none' }
  | { status: 'unsure' }
  | { status: 'unreadable'; reason: string }
  | { status: 'set'; set: ParsedBlindSet };

/** Reads one parsed file (parse.mjs); `name`, the file's own name, is checked against what the file says. */
export const parseBlindFile = parse as unknown as (d: unknown, name?: string | null) => BlindRead;
export { MAX_COUNT, SHA256, UUID };
