PLAN.md on counter-core prevails over this file.
# STATE

Before proposing any counting, measurement or data idea, read TRIED.md: it lists what was tried and closed, with the evidence.

Written 8 November 2026 from PLAN.md, git at `main` `0b82f89c`, and GitHub (`git ls-remote`, GitHub Actions, issue `#190`).
A line marked `(unconfirmed)` could not be confirmed from the repository or from GitHub.

Current phase: Phase 7 (`docs/state-fixes`) of David's order of 6 November 2026 (PLAN.md).
- Phases 1–4: deployed (device verification pending).
- Phase 5 (`perf/first-paint`): entry chunk 135.9 kB gz (< 150 kB budget), FCP < 800 ms, interactive choice < 1500 ms, MediaPipe pose models deferred until first tap, merged in PR #333 (`f45963d8`), deployed and live.
- Phase 6 (`loop/blind-count`): blind count collection schema (`test/real-phone/blind/`), `recordedAt` and `sessionId` in shared payload, `npm run scoreboard:blind` gate, SHA-256 integrity lock (`labels.lock`), merged in PR #337 (`0b82f89c`), deployed and live.
- Phase 7 (`docs/state-fixes`): honest documentation with verified figures only, strict privacy wording, Kinetic Forced Aligner marked experimental, evidence screenshots untracked (`.gitignore`; the last 208 images under `test/real-phone/` by the follow-up to #338).

Live commit: `0b82f89c` on `main`.
Preview: `https://david-dabert.github.io/workout-vision/`

## Scoreboards (8 November 2026)

- **Real-phone scoreboard (David's 15 labelled phone sets, the R2 gate)**: **13 of 15 exact**, 2 off by 1 (`reverse_curl_10` counted 9 for 10 on collector landmarks, `lateral_raise_9` counted 8 for 9), **0 off by 3 or more**, 0 refused (`npm run scoreboard`; `test/real-phone/accuracy/scoreboard.txt`). The 5 bench and overhead press sets are measured and decide nothing (PLAN.md).
- **David's videos read whole by the built app (`test/real-phone/sets-07oct-video/` and `sets-18oct-video/`, 16 sets)**: **12 of 16 exact**, 2 off by 1 (`behind_neck_chin_up_5` counted 6 for 5, `lat_pulldown_11_back` 10 for 11), 2 refused (`sissy_squat_7_5008`, `standing_barbell_curl_8`), and **0 known errors of 3 or more** (`test/real-phone/accuracy/scoreboard.txt`).
- **Public build scoreboard (`npm run scoreboard:public`, 949 deciding sets across Countix, MM-Fit, CFRep)**:
  - Deciding exact: **468 of 949 deciding exact (49%)**, 1064 build sets total, 517 exact (49%), 0 newly off by 3 or more.
  - Per dataset (counted by sets, press included as in headline): MM-Fit 117 of 158 (74%), Countix cut 204 of 447 (46%), Countix whole 188 of 447 (42%), CFRep 8 of 12 (67%). Countix distinct clips: both readings exact on 172 of 447 (38%), either reading on 220 (49%).
- **Testers' blind counts (`npm run scoreboard:blind`, `test/real-phone/blind/`)**: **0 recorded sets** as of 8 November 2026; collection loop, schema, baseline gate, and lock are operational.
- **Exams (`test/real-phone/exam/`, `test/real-phone/exam/testers/`)**: 0 David exam sets and 0 tester blind exam sets exist as of 8 November 2026; no exercise has passed an exam yet.

## Privacy & Legal Statement

*"Aucune vidéo ni donnée patient ne quitte le téléphone ; seuls des compteurs d'usage anonymes sont envoyés."*
- Pose detection, repetition counting, biomechanical metrics, storage, and PDF generation run entirely in the browser on the user's phone.
- The app never uploads videos, frames, or landmarks to any server.
- Usage events (`feedback-worker/`) send only anonymous operational counters when configured, gated by the CNIL audience-measurement notice and opt-out toggle (`src/components/experience/UsageNotice.jsx`).
- Kiné patient video upload in `KinePatient.jsx` and `glimpse-proxy/` is disabled (ruled off by David on 24 October 2026; `glimpse-proxy/proxy.test.js`, `src/components/kine/Kine.test.jsx`, `src/lib/kine/__tests__/glimpse.test.js`).
- A physiotherapy report leaves the phone only when the patient shares it, as a `#kine-r` link (`KinePatient.jsx`).
- The published build sends the anonymous usage counts: deploy run `42468256377` builds with `VITE_EVENTS_URL` naming the feedback worker.
- No claims of "zero legal friction", "zero HDS", or "100% compliant" are permitted or made.

## Product & Governance State (8 November 2026)

- **Offered**: 183 exercises. Tiers (`src/lib/liftTiers.js`): Beta: biceps curl, lat pulldown, squat, hip thrust, Romanian deadlift, leg press. Experimental: lateral raise, bench press, overhead press, and all other lifts. None has passed an exam.
- **Experimental Markers**: Kinetic Forced Aligner trajectory matching in `MovementOptimizationCard.jsx` is explicitly marked experimental (its template in `KineticForcedAligner.ts` is hand-written, R9).
- **French register and naming**: The screens use `"vous"`. The brand is `"WorkoutVision"`, and in French the app is referred to as `"l’appli"`.
- **Sub-agents**: `wv-reviewer`, `wv-verifier` and `wv-control` (`.claude/agents/`).

## Open Problems (8 November 2026)

- **Mid-set counting misses on public video (`test/real-phone/midset-misses/midset-misses.txt`)**:
  - Across 420 RepCount-A and MM-Fit build sets, the core misses middle reps predominantly due to `merged_no_rest_return` (constant-tension reps not returning past global rest) and cycle absorption.
- **2D camera pose ceiling on short clips**:
  - Heuristics and self-similarity algorithms hit a ~40–44% ceiling on short, cut clips where reps start or terminate mid-cycle.
- **Press lifts**:
  - Bench press and overhead press remain Experimental and decide no gate.

## Not Verified (Expunged from Documentation)

- Real-phone stored sets: claims of 14/15 or 15/15 exact are unverified; measured proof is **13 of 15 exact**.
- Real videos: claims of 13/16 or 14/16 exact are unverified; measured proof is **12 of 16 exact**.
- External tester blind sets: 0 recorded sets exist to date.
- Any legal or regulatory certification claim (HDS, GDPR compliance seal).
