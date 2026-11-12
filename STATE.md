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

## Handover: the vision, what was tried, the bottlenecks (12 November 2026)

Written by Claude on David's order of 12 November 2026, so that whichever agent works next, Antigravity included, starts from here and not from zero. Everything below is from David's own messages of 11 and 12 November, from the repository, or from measurements recorded on issue #190.

### The vision, in David's words

- "A server-free, very, very cheap to run, if not free to run, tool": the video never leaves the phone, and that is the proof of the idea, not a limit of it.
- "Free doesn't have to be mediocre, free can be excellent, innovative, groundbreaking, beautiful, captivating and useful and reliable."
- "It has to have the feel, the touch, the tactility, the usability, the adaptability."
- The replay, the person's own video with the skeleton, the count and the tempo: "the part of the app that is the most viral, that people like the most. So I must keep it, but it need to be presented better."
- The moment that must exist: "when people entered in the app, after their first try, they have to ask a few questions and feel like the app understands them, that the app is giving them something of value, something that they cannot get anywhere else unless they hire a coach or a physio."
- "How can we make it impossible not to adopt for any user who tried it", "impossible not to share it with other friends".
- On rules: "the rules cannot forbid us from trying"; "we will make mistakes"; "if they don't work, we remove them".
- On data: "To ask me for more videos is just lazy"; public videos and datasets come first.
- On the two agents: Antigravity for speed, Claude for depth, "without us having to do things and then redo them".

What this adds up to: a person films one set and gets, on the phone and for nothing, what only a coach or a physiotherapist gives today: a count they trust, their own movement shown back to them, and a word about it that is true. They pass it on because the video is theirs and looks like nothing else.

### What was tried from 6 to 12 November, and what came of it

| Tried | By | Outcome |
|---|---|---|
| Seven phases: honesty, counting gates, first paint under 150 kB, blind-count loop, honest documents (#324 to #340) | Antigravity | Held. The blind-count loop exists and has zero sets from testers. |
| A looser confidence gate (#342) | Antigravity, David's ruling of 9 November | More sets shown as sure, less often right (60.9 to 58.5 % on public sets). Tightened on 11 November (#372): 60.3 %. |
| 23 features in about 40 hours: sticking point, velocity loss, hip shoot, butt wink, bar tilt, scapular plane, live clinical overlay, Pessac dossier, kiosk mode, trend engine, retention quiz (#343 to #364) | Antigravity | All passed CI. On David's 20 stored sets the readings did not separate anything (scapular "critical" on 20 of 20). They covered the athlete in the replay. Hidden behind one switch on 11 November (#366), nothing deleted. |
| Removing what covered the video; four kiné tabs; the comparison's reference and angles under the video; the home without unbuilt offers; light mode on every screen (#366 to #379) | Claude | Merged and live. Not yet confirmed by David on his iPhone. |
| Gate 7 in CI: a reading must vary across the labelled sets before it is shown (#375) | Claude | Running. Three of six readings fail it today. Passing it is necessary, not sufficient. |
| A first screen that says what the app stands in for, with what works today said plainly (#381) | Claude | In review on 12 November. |
| One run per night without David | Claude | Failed on 12 November (no access to the repository). Fires since into a session that holds it. |

The lesson both agents must keep: a green CI proves that code runs, not that what the screen says is true. Speed without that proof produced three days of work that had to be hidden.

### The bottlenecks, and where each solution is

| Bottleneck | Where the solution is |
|---|---|
| The count on public video is exact 49 % of the time. | One documented cause: reps done without a return to rest are merged (`test/real-phone/midset-misses/midset-misses.txt`). Card 003. Read TRIED.md first: much is already closed. |
| No reading of form is proven, so the app cannot yet say "what only a coach says". | Start from what is already measured and true: tempo and range per rep, and how they change across the set. Card 010 builds the first honest word on those. Each other reading returns through its own card, with a reference (gate 7). |
| Nobody outside David has counted blind. | Public datasets with human labels are already on disk (949 sets) and decide the scoreboards. Testers' counts add to them; three would be a start. |
| The kiné comparison runs and is unproven. | Card 001: same exercise by the same person must score closer than different exercises, on the public sets; then David's four videos. |
| The replay is loved and slow to share. | Card 004: one tap, the wait cut, the app's name on the video. |
| Nothing brings a person back on the second day. | Card 011: today's set against the person's own best set, with the comparison engine that already exists (`src/lib/reference/compare.js`). |
| The first minute offers 183 exercises when 7 are solid. | Card 005. |
| Two agents, one memory. | AGENTS.md "Start here", this file, METHOD.md, `cards/`. An agent that follows them needs nothing else. `ANTIGRAVITY.md` is the prompt to paste into Antigravity. |

### Where to look for a solution that does not exist yet

- First in the repository: `src/lib/` holds more than the screens use (the audit, card 006, lists it), and TRIED.md says what failed and why.
- Then in public data and published work: datasets with human labels (Countix, MM-Fit, RepCount are already used), papers on repetition counting and on pose from one camera. A method enters only with a way to check it on the labelled sets.
- A new idea is tried in the lab lane (METHOD.md), behind a switch, at full speed. It reaches a user through a card.

## The promises and where each stands (11 November 2026)

David's recorded words (DIRECTIVES.md Part 1, docs/VISION.md, R16), held against what is measured.

| Promise | Status | Evidence |
|---|---|---|
| The video never leaves the phone, no server, free to run | Kept | No upload path; GitHub Pages; anonymous usage counts only |
| The rep count is right, or the app says it is not sure | Partly | David's sets 13 of 15 and 12 of 16; public sets 468 of 949; right when sure 60.3 % on public sets |
| Whether the execution held up | Partly | Tempo and range per rep are measured and shown; every reading of form is off (gate 7) |
| What to do next | Not kept | No advice rests on a validated reading |
| The physiotherapist compares a patient to a reference | Built, unproven | Runs on a real video (David, 11 November); never tested for repeatability (card 001) |
| A tool for every exercise | Offered, unproven | 183 exercises, 7 Beta, none has passed an exam |
| Beautiful, one system of design | Partly | Replay and kiné workspace cleaned on 11 November; no screen approved on the iPhone since |
| A video people share | Built, slow | The replay exports after a wait (card 004) |

## Now

Main at `cb32af66` (12 November 2026, evening): cards 006, 013 and 010 merged (#383, #384, #386). Live since #384: no coach prescription in the report or its PDF, no athlete profile row on the home, `#equine` and the sport addresses return to the home. Since #386: after a saved set, two questions (the goal, what bothers the person), one tap each and skippable, then one sentence read from range and tempo per rep under « Votre objectif : … » (`first-word.js`, checked on David's 20 sets). None seen by David on his iPhone yet. Next card: 004.

Main at `63b113ee` (12 November 2026): PRs #366 to #380 merged, except #373 (home badge, open). In progress: PR #381, the first screen (headline, and under it why, what works today, one repeated action), branch `feat/first-screen`. Cards done: 002, 007, 008, 009. Next ready, in the order of `cards/README.md`: 006, 004, 001, 005, 003.

The nightly run (03:17 Paris time) did not start on 12 November: its session had no access to the repository. Since 12 November it fires into a session that holds the repository and can push (checked that day by a dry run).

A wanted change of a screen that has a picture test gets its new picture from CI: run the workflow "Update visual snapshots" on the branch (`.github/workflows/snapshots.yml`), then read which pictures its commit changed.

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
- The tour step "Keep Filmer ma série in view for every exercise" timed out twice on CI's WebKit (#369, then main at `44e47a35`), on the click that opens the 35th filming screen of one page. The sweep now takes a fresh page every 20 screens. The cause, a page that slows as filming screens are opened and closed, is not found: it may be a leak in the filming screen, and no WebKit was available to measure it.
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
