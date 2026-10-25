PLAN.md on counter-core prevails over this file.
# STATE

Before proposing any counting, measurement or data idea, read TRIED.md: it lists what was tried and closed, with the evidence.

Written 25 October 2026 from PLAN.md, HANDOFF.md, git at `main` `85eeb0fa`, and GitHub (`git ls-remote`, GitHub Actions, issue `#190`).
A line marked `(unconfirmed)` could not be confirmed from the repository or from GitHub.

Current phase: accuracy (`unconfirmed`: PLAN.md names no such phase; its last steps are GROWTH 1 to 5 and David's orders of 30 September to 25 October). Waiting on external testers and David:
- Tester blind sets collected on `#collecte` for the first independent exam (`npm run exam:testers`, `test/real-phone/exam/testers.test.ts`; 0 sets exist in `test/real-phone/exam/testers/` as of 25 October 2026). On 25 October 2026 (`#190` comment `#6396045420`), David approved amending R1 (`CLAUDE.md`, `8f2aa0c0`) so that blind counts from other testers on `#collecte` (excluding "Not sure") are valid exam labels in a separate exam table.
- David's iPhone check of PR `#246` (`28bf00c1`): the result card shows the analysis (`RepTimeline`) after the user confirms or adjusts the count (`src/screens/Result.jsx`), and the one-page checklist is committed at `docs/checklists/2026-10-25-iphone-check-pr246.md` (`85eeb0fa`). Nothing in `#246` is "done" until David confirms on his iPhone (R3; `(unconfirmed)` on iPhone as of 25 October).
- Bench press and overhead press stay offered as Experimental (`src/lib/liftTiers.js`).

Last known-good commit on David's iPhone: `84e020a`, approved by David on his iPhone on 30 September (PLAN.md); post-`84e020a` merges up to `85eeb0fa` are deployed and pass CI, awaiting David's next iPhone check (`docs/checklists/2026-10-25-iphone-check-pr246.md`).
Live commit: `85eeb0fa` on `main` (`git ls-remote`: `refs/heads/main 85eeb0fafd5b8d734757c17b13039480253c4701`). CI run `40185081473` on `85eeb0fa` concluded `"success"` (`2026-10-25T11:00:06Z`, GitHub Actions). GitHub Pages deploy run `40187043891` on `85eeb0fa` concluded `"success"` (`2026-10-25T11:05:32Z`, GitHub Actions).
Branches (`git ls-remote`, 25 October 2026): `main` at `85eeb0fa`; `counter-core` at `7b332a8c`; `range-from-rest` at `6f3b8715`; `range-from-rest-review` at `3b877726`.
Preview: `https://workout-vision-next.vercel.app`, built by David's other session; it does not rebuild on a push (PLAN.md).

## Scoreboards (25 October 2026)

- **Real-phone scoreboard (David's 15 labelled phone sets, the R2 gate)**: **12 of 15 exact**, 2 off by 1 or 2, **0 off by 3 or more**, 1 refused (`bench_press` angle, where the core alone counts 3 for 7) (`npm run scoreboard`; `test/real-phone/accuracy/scoreboard.txt`, updated through `1577a116` / `85eeb0fa`).
  - Note on `reverse_curl_10`: counted 12 for 10 on the collector's landmarks; on the built app from the source video it counts 10 for 10 (`sets-18oct-video`).
- **David's videos read by the built app (`test/real-phone/sets-18oct-video/`, 16 sets)**: **8 of 16 exact** (`HANDOFF.md`, `test/real-phone/accuracy/scoreboard.txt`).
- **Public build scoreboard (`npm run scoreboard:public`, `test/real-phone/public/scoreboard-public.txt`, 993 sets across Fitness-AQA, MM-Fit, Penn Action, RepCount-A, Synthetic, UCF101)**:
  - All 993 sets: **466 of 949 deciding exact (49%)**, 429 of 993 overall (43%), 302 off by 3 or more (30%), 44 refused.
  - By source (deciding exact): Fitness-AQA 55/60 (92%), Synthetic 74/96 (77%), MM-Fit 76/151 (50%), RepCount-A 107/269 (40%), UCF101 87/237 (37%), Penn Action 67/136 (49%).
- **Public full-set subset (`>= 8` labelled reps, rule fixed before reading in `test/real-phone/public/full-sets.txt`, commit `dc8ae46c`)**:
  - Across MM-Fit, Penn Action, RepCount-A and UCF101: **130 of 837 sets (16%)** have `>= 8` labelled reps (`127` deciding, `3` refused).
  - Deciding exact: **96 of 127 (76%)**, 74% overall, **9 off by 3 or more (7%)** — vs **216 of 666 (32%)** deciding exact and **290 off by 3 or more (42%)** on short clips (`< 8` reps).
  - When `sure.ts` marks the set sure (`115` of `130` full sets): **93 of 115 exact (81%)**, 19 off by 1–2, **3 off by 3 or more (3%)**.
  - On MM-Fit full sets (`>= 8` reps, 114 sets): **92 of 111 deciding exact (83%)**, **2 off by 3 or more (2%)**; when sure, **90 of 103 exact (87%)** and **0 off by 3 or more (0%)**.
- **Exams (`test/real-phone/exam/`, `test/real-phone/exam/testers/`)**: 0 David exam sets and 0 tester blind sets exist as of 25 October 2026; no exercise has passed an exam yet.
- **Sealed public holdout (`~/wv-tools/public-holdout/repcount/holdout/`)**: 17 RepCount-A held-out sets rebuilt on 25 October 2026 (`#190` comment `#6396372620`), kept outside git for the next candidate that passes every build gate.

## Product & governance state (25 October 2026)

- **Offered**: 181 exercises (`e2e/collect.spec.js`). Tiers (`src/lib/liftTiers.js`): Beta: lateral raise, biceps curl, lat pulldown, squat. Experimental: bench press, hip thrust, Romanian deadlift, leg press, overhead press. None has passed an exam.
- **Sub-agents**: `wv-reviewer`, `wv-verifier` and `wv-control` (`.claude/agents/`), whose briefs change only by David's order.
- **French register and naming**: the screens use `"vous"`. On 9 October 2026 David approved every French line then pending (R10; `"Everything French approved"`). On 11 October 2026 David approved the French lines of PR `#152` and `#153` and decided the two names: the brand is written `"WorkoutVision"` in every string users see, and in French the app is `"l’appli"`.
- **Anonymous usage events (`feedback-worker/`, deployed 15 October 2026)**:
  - Live at `https://workout-vision-feedback.dave-dabert.workers.dev/event` (`VITE_EVENTS_URL`), gated in the app by the CNIL audience-measurement notice and opt-out switch (`src/components/experience/UsageNotice.jsx`).
  - Verified D1 export from 15 October to 25 October 2026 (`#190` comment `#6397121878`): 318 daily-aggregate rows, 522 events across 10 active days (`131` real opens, `68` `session_end` events including `22` sessions `> 1 min`, `50` analyses started, `34` `analysis_done`, `22` `result_kept`, `3` `result_corrected`, `38` `share`, `0` feedback rows).
- **Physiotherapist reference media & Defect 1 closure (`src/lib/kine/`, `glimpse-proxy/`, 25 October 2026)**:
  - Olivier's 4 reference videos (`olivier-1-mains-jointes.mp4` through `olivier-4-elevation-paliers.mp4`) are hosted on Cloudflare R2 (`VITE_KINE_MEDIA_URL`, `#190` comment `#6200315216`).
  - Patient video upload in `KinePatient.jsx` and `glimpse-proxy/` was disabled by David's ruling of 25 October 2026 (PR `#247`, commit `74109365`; `test/real-phone/defect1-glimpse/defect1-off.test.ts`). No patient attempt video can be uploaded from the production build.
- **Triage of `BACKLOG.md` against R16 (`d7abd8ae`, 25 October 2026)**:
  - `BACKLOG.md` classifies open items into (A) items gated by R16 until the counting core passes its exam, (B) items parked on a condition or external legal/clinical dependency (EU MDR adviser), and (C) items needing David's iPhone or external testers.

## Open problems (25 October 2026)

- **Mid-set counting misses on public video (`test/real-phone/midset-misses/midset-misses.txt`, commit `0008c7bc`, 25 October 2026)**:
  - Across 420 RepCount-A and MM-Fit build sets (`2,707` labelled reps: `2,280` middle, `427` edge), the core misses `773` middle reps (`34%`, `768` in RepCount-A and `5` in MM-Fit) and `237` edge reps (`56%`).
  - None (`0%`) of the 768 missed middle reps in RepCount-A are caused by low landmark visibility (`minVis < 0.5`).
  - **50% (`384 / 768`)** are `merged_no_rest_return`: the counted joint completes a full working excursion (`>= 70%` of the set's found-rep median ROM), but does not cross back past the global rest threshold between consecutive constant-tension reps or exceeds `MAX_REP_SEC` (`8.0 s`) when multiple reps merge before returning to rest.
  - **44% (`341 / 768`)** have full excursion and cross both thresholds, but are absorbed into an adjacent cycle before a state transition completes.
  - **6% (`43 / 768`)** have weak excursion (`< 70%` of found median) on the primary counted joint; on **36 of those 43 (`84%`)**, another angle joint in `signalBank` (`src/lib/counting/psc.js`) records a full excursion (`>= 70%` of found median and `delta_z >= 1.5`).
- **2D camera pose ceiling on public short clips (`TRIED.md`, 18–24 October 2026)**:
  - Seven independent counting algorithms (`core.ts`, `psc.js`, periodogram, autocorrelation, phase, consensus, and 3D lifter) hit the same ceiling (~40–44% on all public clips, mostly 1–5 rep Kinetics snippets where clip boundaries cut inside a rep).
- **David's sets edge & press misses (`test/real-phone/accuracy/diagnosis.txt`, `edges-2026-10-15.md`)**:
  - The remaining 2 non-exact deciding sets on David's 15 phone sets are off by 1 or 2 (`reverse_curl_10` counts 12 for 10 on collector landmarks and 10 for 10 on video; `bench_press` is refused on camera angle).
- **Collector & live-app items carried forward from 30 September and 10 October (`STATE.md` history)**:
  - The batch collector remembers only the next set number across a reload; a video collected twice across a reload is not caught on the page.
  - `index.html` still allows `'unsafe-eval'` for MediaPipe WASM.
  - Three `it.fails` tests for the overhead press with context in `src/lib/counting/__tests__/context.test.ts`.
  - `e2e/core-app.spec.js` has not run with a real video clip in CI because video clips are git-ignored.
  - Live-app audit open items (10 October): a phone that refuses all storage loses a received programme after each set; the installed app has no field to paste a results link and results links do not carry rests; `CollectHistory.jsx` and `ContributeHistory.jsx` still excuse `InvalidStateError` on share; wake lock before iOS 18.4 and WebCodecs watchdog remain unverified.
- **Parked branch `range-from-rest` (`6f3b8715`) and `range-from-rest-review` (`3b877726`)**:
  - Parked by David's decision of 28 September 2026 ("a rep's range is measured from its rest"); condition for return: real sets show reps of 20 to 30° that the current core misses.

Next step: address the `merged_no_rest_return` and absorbed-cycle mid-set counting bottleneck documented in `test/real-phone/midset-misses/midset-misses.txt` under the strict half-A / half-B / R2 evaluation protocol (`scripts/compare-variants.mjs`), while awaiting tester blind sets on `#collecte` and David's iPhone check of `#246`.
