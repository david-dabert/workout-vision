PLAN.md on counter-core prevails over this file.
# STATE

Before proposing any counting, measurement or data idea, read TRIED.md: it lists what was tried and closed, with the evidence.

Written 8 November 2026 from PLAN.md, git at `main` `0b82f89c`; the section "State of main, 11 November 2026" below was added on 11 November from git at `main` `55747d0e`, GitHub Actions and issue `#190`.
Where that section and an older line disagree, that section is the current one.
A line marked `(unconfirmed)` could not be confirmed from the repository or from GitHub.

Current phase: Phase 7 (`docs/state-fixes`) of David's order of 6 November 2026 (PLAN.md).
- Phases 1–4: deployed (device verification pending).
- Phase 5 (`perf/first-paint`): entry chunk 135.9 kB gz (< 150 kB budget), FCP < 800 ms, interactive choice < 1500 ms, MediaPipe pose models deferred until first tap, merged in PR #333 (`f45963d8`), deployed and live.
- Phase 6 (`loop/blind-count`): blind count collection schema (`test/real-phone/blind/`), `recordedAt` and `sessionId` in shared payload, `npm run scoreboard:blind` gate, SHA-256 integrity lock (`labels.lock`), merged in PR #337 (`0b82f89c`), deployed and live.
- Phase 7 (`docs/state-fixes`): honest documentation with verified figures only, strict privacy wording, Kinetic Forced Aligner marked experimental, evidence screenshots untracked (`.gitignore`; the last 208 images under `test/real-phone/` by the follow-up to #338).

Live commit: `ec12a7ac` on `main` (deploy run 601, 11 November 2026, 13:11 UTC). `55747d0e` is main's tip; its CI and deploy had not finished when this was written.
Preview: `https://david-dabert.github.io/workout-vision/`

## State of main, 11 November 2026

Merged between 9 and 11 November (Antigravity, PRs #342 to #364): the confidence gate asks only when a recount is refused or differs by 2 or more (#342), and a series of biomechanical readings, kiné screens and a printed "Pessac" dossier.
Measured on 11 November (issue `#190`):
- **Gate of #342**: on the public build sets, shown as sure 731 (was 670), exact among them 428, that is 58.5 % (was 408, 60.9 %); errors of 3 or more shown as sure 10 (was 6). On David's sets: 13 sure with 11 exact, and 8 of 8. `test/real-phone/accuracy/sure.ts` still models the gate of before #342.
- **Biomechanical readings on David's 20 stored sets**: scapular index "critical" on 20 of 20, bar index "critical tilt" on 16, "butt wink" on 13, "hip shoot" on 12, velocity decline 0 to 82 %. They do not discriminate.

Decisions applied on 11 November (David's orders of that day, PRs #366 to #370):
- **One switch, `UNVALIDATED_BIOMECHANICS_SHOWN = false`** (`src/components/experience/measures.js`): the replay shows the video, the skeleton, the count and the tempo, and none of those readings; no file deleted (#366).
- **Printed dossier**: prints « Non mesuré » unless a value was measured, and claims no certification (#366).
- **Comparer tab**: the patient's healthy side can be the reference, mirrored (#367). Not yet run on a real pair of recordings.
- **Result screen**: `MovementOptimizationCard` is no longer rendered; the retention quiz waits for the third saved set (#368).
- **Kiné workspace**: four tabs, Programme, Suivi, Comparer, Mon cabinet. The Pessac assessment tab and the "Dossier Clinique BDK" button render only with `VITE_EXTENDED_ROUTES=1`, unset in production (#369).
- **Replay**: "Vue 3D" and "Trajectoire de la barre" sit under the playback controls (#370). David, 11 November: both stay.
- **Per-rep table**: exists already (`repTable`, `report-sheet.js`): always in the report, on the result screen at expert level only. The speed-change line stays off (`SPEED_CHANGE_SHOWN = false`).

Scoreboards on 11 November: unchanged, CI passed them against the baselines of 7 November on each of those PRs (13 of 15, 12 of 16, 468 of 949).

Open on 11 November:
- None of PRs #366 to #370 has been confirmed by David on his iPhone (R3).
- The tour step "Keep Filmer ma série in view for every exercise" failed once on #369 and passed on one re-run with no code change; not root-caused.
- Unreachable code in main: `mirrorReference.ts`, `KineCabinetMode.jsx`, `stateMachines.ts`, `pessacClinicalSpecialties.ts`.
- `src/components/experience/__tests__/no-unmeasured-metrics.test.jsx` checks a word list, not what a screen measures.
- Committed at the repository root in #351, purpose not confirmed by David: `workoutvision-standing-deltoids` (8.5 MB), `IMG_3198.jpg`, `IMG_3209.jpg`.
- PRs #335 and #323 are superseded and still open.
- Antigravity's quota is exhausted until 14 November 2026.

## Scoreboards (8 November 2026)

- **Real-phone scoreboard (David's 15 labelled phone sets, the R2 gate)**: **13 of 15 exact**, 2 off by 1 (`reverse_curl_10` counted 9 for 10 on collector landmarks, `lateral_raise_9` counted 8 for 9), **0 off by 3 or more**, 0 refused (`npm run scoreboard`; `test/real-phone/accuracy/scoreboard.txt`). The 5 bench and overhead press sets are measured and decide nothing (PLAN.md).
- **David's videos read whole by the built app (`test/real-phone/sets-07oct-video/` and `sets-18oct-video/`, 16 sets)**: **12 of 16 exact**, 2 off by 1 (`behind_neck_chin_up_5` counted 6 for 5, `lat_pulldown_11_back` 10 for 11), 2 refused (`sissy_squat_7_5008`, `standing_barbell_curl_8`), and **0 known errors of 3 or more** (`test/real-phone/accuracy/scoreboard.txt`).
- **Public build scoreboard (`npm run scoreboard:public`, 949 deciding sets across Countix, MM-Fit, CFRep)**:
  - Deciding exact: **468 of 949 deciding exact (49%)**, 1064 build sets total, 517 exact (49%), 0 newly off by 3 or more.
  - Per dataset (counted by sets, press included as in headline): MM-Fit 117 of 158 (74%), Countix cut 204 of 447 (46%), Countix whole 188 of 447 (42%), CFRep 8 of 12 (67%). Countix distinct clips: both readings exact on 172 of 447 (38%), either reading on 220 (49%).
- **Testers' blind counts (`npm run scoreboard:blind`, `test/real-phone/blind/`)**: **0 recorded sets** as of 8 November 2026; collection loop, schema, baseline gate, and lock are operational.
- **Exams (`test/real-phone/exam/`, `test/real-phone/exam/testers/`)**: 0 David exam sets and 0 tester blind exam sets exist as of 8 November 2026; no exercise has passed an exam yet.

## Privacy & Legal Statement

*"Aucune vidéo ni donnée patient ne quitte le téléphone sans action explicite de l'utilisateur ; seuls des compteurs d'usage anonymes sont envoyés."* (David's ruling of 8 November 2026).
- Pose detection, repetition counting, biomechanical metrics, storage, and PDF generation run entirely in the browser on the user's phone.
- The app never uploads videos, frames, or landmarks to any server without explicit user action.
- Usage events (`feedback-worker/`) send only anonymous operational counters when configured, gated by the CNIL audience-measurement notice and opt-out toggle (`src/components/experience/UsageNotice.jsx`).
- Kiné patient video upload in `KinePatient.jsx` and `glimpse-proxy/` is disabled (ruled off by David on 24 October 2026; `glimpse-proxy/proxy.test.js`, `src/components/kine/Kine.test.jsx`, `src/lib/kine/__tests__/glimpse.test.js`).
- The published build sends the anonymous usage counts: deploy run `42468256377` builds with `VITE_EVENTS_URL` naming the feedback worker.
- No claims of "zero legal friction", "zero HDS", or "100% compliant" are permitted or made.

## Product & Governance State (8 November 2026)

- **Offered**: 183 exercises. Tiers (`src/lib/liftTiers.js`): Beta: biceps curl, lat pulldown, squat, hip thrust, Romanian deadlift, leg press, machine seated back extension. Experimental: lateral raise, bench press, overhead press, and all other lifts. None has passed an exam.
- **Experimental Markers**: Kinetic Forced Aligner trajectory matching in `MovementOptimizationCard.jsx` is marked experimental (its template in `KineticForcedAligner.ts` is hand-written, R9); since 11 November the card is not rendered (#368).
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
