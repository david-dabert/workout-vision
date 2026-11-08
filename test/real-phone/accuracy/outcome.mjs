// The app's outcome on a set's stored landmarks, as the scoreboards read it. Moved unchanged from scoreboard.test.ts on
// 8 November 2026 (Phase 6 of David's order of 6 November 2026), so test/real-phone/blind/scoreboard-blind.test.ts and
// scripts/tester-exam.mjs read the blind sets exactly as the main scoreboard does, against the one baseline
// (scoreboard-baseline.json). Plain JavaScript, so the Node scripts and the TypeScript tests import the same code.
import { summarizeCount, withProposal } from '../../../src/lib/coreAnalysis.js';

/**
 * The live core's count on the set, or 'refused' with the proposal the app would offer there (shown, decides nothing).
 * A read the app itself refused (appRefused: a partial read of a whole video) is refused here.
 * @param {{ lift: string, wl: any[], ts: number[], il?: any[] | null, appRefused?: boolean }} s
 * @returns {{ now: number | 'refused', doubt?: any, note?: string }}
 */
export function appOutcome(s) {
  if (s.appRefused) return { now: 'refused' };
  const r = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
  if (!r.refused) return { now: r.count, doubt: r.doubt };
  const p = s.il ? withProposal({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il }, s.lift) : null;
  return { now: 'refused', note: p?.proposal?.count ? `(proposal ${p.proposal.count})` : '(no proposal)' };
}

/**
 * A blind set is read by the live core whatever the phone answered when it was kept: its appRefused is not applied, as
 * the main scoreboard has read David's and the testers' blind sets since their sections were added.
 * @param {{ lift: string, wl: any[], ts: number[], il?: any[] | null }} s
 */
export const blindOutcome = s => appOutcome({ ...s, appRefused: false });
