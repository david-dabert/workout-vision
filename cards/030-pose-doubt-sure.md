# 030. Surface existing poseDoubt on Result and "Right when sure"
Status: done
Executor: quick
Claim: Wire the already-computed `result.doubt?.flagged` (`src/lib/counting/doubt.js`, frozen thresholds kept intact) into `Result.jsx` (`toCheck` and `lowAsk` cause), `result-copy.js` (`doubtCause` FR/EN), `test/real-phone/accuracy/sure.ts` (`sureRow`), and `test/real-phone/accuracy/sure-parity.test.ts` (`screenSure`) so sets with incomplete pose coverage or tracking holes between the first counted rep's start and the last one's end open for confirmation instead of appearing as sure. Setup and walk-away tails outside `[firstRep.startTime, lastRep.endTime]` are ignored by `poseDoubt` so finishing a live or recorded set does not count as a hole.
Reference: Handover Flaw #1 (Phase 1.4 Refusal & "Right when sure" audit), R8, R10, R14, R16.
Eval:
1. Unit tests (`result-blind.test.jsx`, `result-bodycheck.test.jsx`, `no-unmeasured-metrics.test.jsx`, `french-typography.test.js`) pass.
2. `SURE_PARITY=1 npx vitest run --no-cache test/real-phone/accuracy/sure-parity.test.ts` passes with `screenSure(r)` matching `sureRow(r)`.
3. `npm run scoreboard`, `npm run scoreboard:blind`, `npm run scoreboard:public`, and synthetic suite pass R2 with improved public "Right when sure" exact rate and fewer 3+ catastrophic errors, without lowering `DAVID_VIDEO` exactness or tuning core constants (R14).
4. Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:css-tokens`, `npm run audit:swarm` pass with zero em-dashes.
Scope: `cards/030-pose-doubt-sure.md`, `src/components/experience/Result.jsx`, `src/components/experience/result-copy.js`, `src/components/experience/__tests__/result-blind.test.jsx`, `test/real-phone/accuracy/sure.ts`, `test/real-phone/accuracy/sure-parity.test.ts`, and refreshed `scoreboard.txt` / `public-scoreboard.txt` / `sure-parity.txt` outputs.
Needs from David: Confirm or reword the new French `doubtCause` line in `src/components/experience/result-copy.js` (R10) and confirm `Result.jsx` screen flow on iPhone (R3).
