# WorkoutVision: Build Directives

Owner: David Dabert. Executor: the Claude Code companion.
Version 1, 24 September 2026.
This file overrides any earlier roadmap, council report or plan in this repository.

## How to use this file

1. Save it at the repository root as DIRECTIVES.md.
2. Copy Part 2 verbatim into CLAUDE.md, replacing any rule that conflicts with it.
3. Create STATE.md from the template in Part 6.
4. Work one phase at a time, in order. Phases 0 and 1 run in parallel: the companion stabilises the app while David films and labels.
5. A phase ends only when its exit criteria are met and David confirms in writing.
6. Every session starts by reading CLAUDE.md, DIRECTIVES.md and STATE.md, and ends by updating STATE.md.

## Part 1. What we are building

WorkoutVision is a private set audit. A person films one set on their phone. Without the video leaving the device, the app tells them how many reps they did, whether their execution held up, and what to do next, in a way they can trust.

### The promise, in order of priority

1. The rep count is right, or the app says it is not sure.
2. Nothing is presented as a measurement unless it has been validated on real phone video.
3. Advice is grounded in published evidence, or clearly labelled as coaching convention.
4. The individual comes first. Coaches are a first-class path, not the identity of the product.
5. French and English are both native.
6. The video never leaves the device.

### Who it serves

- Beginners: do not know exercise names; need the exercise guide, plain words, and simple next steps.
- Intermediate and advanced trainees: want honest volume, reps, tempo and execution feedback.
- Coaches: want to review a client's set, add their judgement, and send a branded report.

### The five launch lifts

Dumbbell bench press, biceps curl, lateral raise, shoulder press (machine or dumbbell), lat pulldown.

David may change this list in STATE.md. Everything else stays available but labelled experimental.

### Frozen until the end of Phase 5

New exercises beyond the launch lifts; velocity in m/s; injury-risk predictions; challenges and social features; design overhauls; councils, think tanks and grades of the codebase; monetisation.

## Part 2. Standing rules (copy into CLAUDE.md)

**R1. Ground truth is sacred.**
Never modify a label. Never delete a test clip. Never set or adjust a label from the app's output, a video title, a thumbnail or a guess. Labels come only from David, or from human-annotated public datasets (Countix). If a label looks wrong, report it to David and wait.

**R2. Measure every counting change.**
Any change that can affect a rep count is run through npm run scoreboard before and after, and the per-clip diff is shown in the report. A change ships only if the real-phone exact count does not decrease and no clip becomes a catastrophic error (off by 3 or more).

**R3. Prove before you claim.**
Never write "fixed", "passing", "working" or "deployed" without pasting the command output that proves it. "Build passes" proves the code compiles, nothing more. Any change visible to users is confirmed by David on his iPhone before it is called done.

**R4. One agent, one branch, one task per session.**
No parallel agents writing to the working tree. Every task starts on a new branch named after it.

**R5. Destructive commands need David's explicit approval.**
git checkout -- ., git reset --hard, git clean, rm -rf, force push, deleting files under test/ or benchmark/. Before any of them, commit work in progress to a branch.

**R6. Main is production.**
Merge to main only when CI is green, including the real-phone gate, and David has confirmed on his iPhone.

**R7. Scope freeze.**
New ideas go into BACKLOG.md with a date. They are not built until the current phase is complete.

**R8. Honest interface.**
Never display a number the app cannot measure reliably. When confidence is low, the app asks the user to confirm and shows no grade.

**R9. Science.**
Every threshold, form check and coaching statement carries, in a code comment: its source, and a status among validated (measured on our real clips), literature (published, not yet measured by us), convention (accepted coaching practice without a specific source), experimental. Never invent a citation; write UNSOURCED when unsure.

**R10. Language.**
French is written as a French coach speaks in a gym, never translated word for word. Use the glossary in Part 7 and one register throughout (tu or vous, decided by David). David approves French copy before release.

**R11. Session hygiene.**
Keep sessions short and focused on one step. After any context compaction, re-read STATE.md before acting. End every session with the report format in Part 5.

**R12. Stop conditions.**
Stop and report to David if: a task would break a rule; a gate fails twice; a label seems wrong; the work drifts outside the current phase; a fix requires deleting data.

**R13. Public claims.**
Numbers in the README, the site and any external document come only from the latest scoreboard output, with its date.

## Part 3. The phases

### Phase 0. Stabilise the live app

Goal: anyone can use the app on an iPhone without it crashing.

- 0.1 Save everything. Commit all uncommitted changes to a new branch wip-accuracy and push it. Create and push a branch pre-rollback at the current main.
- 0.2 Roll back main to the last commit before the "Architecture overhaul" commit de8ff3f of 23 September. Expected: 4cad6df; confirm with git log and show David before acting. On main: git revert --no-commit 4cad6df..HEAD, commit "Roll back to 4cad6df to restore a working build", push. Report CI and Deploy results with gh run view output.
- 0.3 Phone test. David clears the site data on his iPhone and analyses the same 60-second clip three times.
- 0.4 If the page still reloads, on branch fix-memory: downscale every frame to at most 640 px on the long side before inference; close every ImageBitmap after inference; keep only landmarks after inference, never frames; create the video replay and share images only when the user taps for them; guarantee a single pose-model instance; set an explicit frame cap on iOS, where navigator.deviceMemory does not exist; compute any cache key from file size, last-modified date and the first and last megabyte, never the whole file.
- 0.5 Crash breadcrumbs. Write the current stage (extracting, analysing, rendering-result, saving) to localStorage; on the next load, if a stage was not completed, show it to the user with an explanation.
- 0.6 Make CI honest. The benchmark job must fail when any clip is excluded or scored as "Unknown exercise", and when the scored count differs from the manifest. The typecheck step must run TypeScript against a real tsconfig.json, or be renamed so it does not claim to typecheck. Prove it: push a deliberately broken commit on a throwaway branch, show CI failing, delete the branch.
- 0.7 Re-apply later work from pre-rollback and wip-accuracy only through the Phase 1 and Phase 2 gates, one change at a time.

Exit criteria: three consecutive analyses of the same 60-second clip complete on David's iPhone; the exercise guide and the coach report open; CI shown to fail on a broken commit.

David: tests on his phone. If this phase is not complete, nobody else tests the app.

### Phase 1. Build the truth

Goal: a locked, human-labelled set of real phone sets, and a scoreboard that cannot lie.

- 1.1 Real-phone set. Create test/real-phone/ with a manifest.json: file, lift, true count, counting convention (for example "per arm" for single-arm sets), camera view (side, front, 45 degrees), labelled by, labelled on, notes.
- 1.2 Extraction. A script that turns a local video into landmarks using the app's own production modules and settings. No mirrored copy of the pipeline anywhere: the scoreboard imports the same code the app runs.
- 1.3 Quarantine. Move every clip added to the benchmark on 22 September (everything beyond the original 43 Countix clips) to benchmark/unverified/, excluded from all gates. Reason, to record in benchmark/unverified/README.md: labels were guessed from titles and thumbnails, at least one was set from the counter's own output, and clips the counter failed on were deleted. The 43 Countix clips keep their human labels and become the secondary set.
- 1.4 Scoreboard. npm run scoreboard prints, for the real-phone set and the Countix set, per lift and overall: exact, within one, mean absolute error, catastrophic errors (off by 3 or more). It shows a per-clip diff against the saved baseline, writes scoreboard/history/<date>.json, and exits with an error if the real-phone exact count decreases or a new catastrophic error appears. It runs in CI.
- 1.5 Debug reports that teach. Add a required "true count" field and the camera view to the in-app report. With the user's explicit consent, attach the landmark export (never the video), so a report can become a test clip after David approves it.

Exit criteria: at least 20 clips (target 30) across the five lifts, filmed from the views users will actually use; baseline scoreboard recorded for the current counter.

David: films and labels. Count only completed reps, per arm for single-arm sets, watching at half speed. Approves every clip before it enters the set.

### Phase 2. The new counter

Goal: replace the stack of heuristics with one principled method.

- 2.1 Freeze the old counter. No further threshold changes in src/lib/repCounter/. It remains only as the comparison baseline.
- 2.2 Build src/lib/counting/recurrence.ts, a pure, deterministic function with no DOM access.
  - Input: landmarks per frame, frames per second, lift configuration (relevant joints, period bounds, alternating or not).
  - Features. For the lift's relevant joints, both sides separately, never merged with a minimum or maximum across sides: joint angles, and wrist, elbow and knee positions relative to the mid-hip, scaled by torso length. Interpolate gaps up to half a second; mark longer gaps as low quality.
  - Standardise each feature over the set, and weight features by how much they move, so static joints do not dominate.
  - Self-similarity. Compare every frame's feature vector with every other frame.
  - Period. Average the similarity along each time lag; take the first strong peak inside the lift's period bounds. Guard against double and half periods by comparing the peak at the chosen lag with the peak at half that lag.
  - Count. Define the reference pose as the median of the frames closest to the lift's start position (for example arms extended in a press). Build the similarity-to-reference curve over time. Count peaks at least 0.6 of a period apart, and only when the curve falls below a low band between them, so a movement must leave the start position and fully return to count. Sub-cycles and left-right tracker jumps cannot satisfy that.
  - Edges. Count a first or last rep only if its excursion reaches at least 70% of the median rep's excursion.
  - Alternating lifts. Run per side, then pair, according to the counting convention in the manifest.
  - Output. Reps; start, bottom and end frame for each rep; a confidence between 0 and 1 built from interval regularity, peak consistency and agreement between the period and the peak count; and a plain-language reason whenever confidence is low.
  - Scientific basis: self-similarity for repetition counting, Dwibedi et al., "Counting Out Time: Class Agnostic Video Repetition Counting in the Wild", CVPR 2020. Our adaptation uses pose features rather than pixels.
- 2.3 Unit tests on synthetic signals, each giving the right count: clean repetitions; a wobble inside each rep on one joint; left-right tracker flicker; missing frames; slow reps; fast reps near the frame-rate limit; a partial first and last rep.
- 2.4 Side by side. The scoreboard reports old and new counts for every clip.
- 2.5 Decision rule. The new counter becomes the default when, on the real-phone set: exact on at least 90% of clips (27 of 30); zero catastrophic errors; no launch lift worse than the old counter. On Countix, within-one accuracy no more than 3 points below the old counter. Until then, iterate on the new counter only.
- 2.6 Integration. Behind a switch (?counter=v2 and a hidden setting) until the rule is met; then default; the old arbitration code is deleted after two weeks without regression.
- 2.7 Frame rate, only if the data demands it. If real-phone errors cluster on fast reps, test 15 frames per second on devices that can afford it, and keep it only if the scoreboard improves.

Exit criteria: decision rule met; the same input gives the same output ten times in a row.

### Phase 3. The honest result screen

- 3.1 Minimal result: the count, large; the confidence state; each counted rep marked on the replay timeline (tap to jump); one-tap correction.
- 3.2 Confidence gate: low confidence shows "We counted N, please confirm" with no grade and no score. Very low confidence shows "We could not read this set", the reason, and one filming tip.
- 3.3 Hide what is not validated: velocity in m/s, asymmetry percentages, injury and overtraining risk, strength levels where no standard exists, smoothness and consistency scores. Remove them, or keep them in a section explicitly labelled experimental.
- 3.4 Filming guide before upload, per lift: view, distance, whole body in frame, 1080p at 30 frames per second, one set per clip.
- 3.5 Memory budget: the result screen stays within the limits set in Phase 0.

Exit criteria: David and three testers review ten results each; every number is understood and none contradicts what they saw.

### Phase 4. Execution feedback that is true

- 4.1 For each launch lift, at most three checks that 2D pose can actually see from the recommended view (for example, curl: full extension at the bottom, elbow drift, torso swing).
- 4.2 David and Luc independently mark every rep of the real-phone set for each check. Measure their agreement (Cohen's kappa); keep only checks where humans agree (kappa at least 0.6).
- 4.3 Measure the app against the agreed labels. Show a check only if its precision is at least 0.80: false alarms destroy trust faster than missed faults.
- 4.4 Every check has a plain cue in French and English, its source, and its required camera view; when the view is wrong, the check is skipped without comment.

Exit criteria: every visible check has measured precision on real clips, recorded in docs/validation.md.

### Phase 5. Coaching that improves the workout

Voice: the model is David's pectoral breakdown: anatomy, then angle, then exercise choice, then execution cue, then substitution. One or two actions per session, explained.

- 5.1 Evidence base, in docs/evidence.md, each rule with its source and strength:
  - Weekly sets per muscle and the dose-response relationship: Schoenfeld, Ogborn and Krieger, Journal of Sports Sciences, 2017.
  - Proximity to failure: Refalo et al., Sports Medicine, 2023. Effort rating by repetitions in reserve: Helms et al., Strength and Conditioning Journal, 2016.
  - Rest between sets: Schoenfeld et al., Journal of Strength and Conditioning Research, 2016.
  - Loss of rep speed as a fatigue signal, relative and within the set only: Pareja-Blanco et al., 2017.
  - The acute-to-chronic workload ratio is contested (Impellizzeri et al., International Journal of Sports Physiology and Performance, 2020): never present it as injury prediction.
  - Exercise selection by fibre orientation and muscle function: labelled convention unless a source is added.
- 5.2 Inputs: after each set, one three-second question: "How many more reps could you have done?" (0, 1 to 2, 3 to 4, 5 or more). With the counted reps and the load, this makes advice about failure and progression real.
- 5.3 Outputs:
  - Session composition: flags redundant exercises (same movement, different machine) and missing angles, as in the pectoral example.
  - Weekly volume per muscle against the evidence ranges.
  - Progression: double progression (add reps within a range, then add load).
  - Beginner mode: plain words, links to the exercise guide, short definitions (failure, reps in reserve, progressive overload, deload).
- 5.4 Review: David and Luc read twenty generated coaching outputs; zero factual objections before release; objections logged in docs/coaching-review.md.

Exit criteria: every coaching sentence traceable to a rule and a source; review passed.

### Phase 6. Coaches

- 6.1 A coach path switched on from the profile: clients, per-client history, set review with rep markers, coach notes.
- 6.2 Report: branded PDF (coach name and logo, client name), validated metrics only, coach notes editable before export, sent through the phone's share sheet (WhatsApp, mail), in French and English.
- 6.3 Privacy: data stays on the coach's device; a client-consent note in the report flow.
- 6.4 Pilot: Luc and two other coaches, three clients each, two weeks, structured feedback.

Exit criteria: pilot feedback recorded; its three most serious issues fixed.

### Phase 7. Proof of concept

- 7.1 Anonymous, cookieless event counting, with no video and no personal data: analysis started, completed, failed with reason; count confirmed or corrected with the difference; how many analyses this device has run. Check the CNIL rules on audience measurement before enabling it.
- 7.2 A tester cohort of 20 to 30 people over three weeks. The success criteria are written in STATE.md before it starts.
- 7.3 README rewritten: what the app does, the launch lifts, the latest scoreboard with its date, the privacy statement, the limits. Internal prompts and council reports move out of the public repository.

Exit criteria: numbers David can show an investor.

## Part 4. Stop doing

- Councils, think tanks, S-tier grades and "billion-dollar" framing during work sessions.
- Parallel agents on the same working tree.
- Tuning thresholds in the old counter.
- Adding exercises, or clips without human labels.
- Claiming results without output.
- Shipping to main without a phone test.

## Part 5. How David stays in control

Every session ends with exactly this report:

1. Changes: one line per commit, with its hash.
2. Scoreboard: real-phone exact X/N, catastrophic Y, previous X/N.
3. To test on the phone: what, and how (or "nothing").
4. Next step: one line.
5. Rules at risk: any, or "none".

David's three questions after every session:

1. Did the real-phone score go up or stay the same?
2. Did anything break on my phone?
3. Is this work inside the current phase?

## Part 6. STATE.md template

```
# STATE

Current phase:
Last known-good commit:
Live commit:
Scoreboard (date): real-phone exact X/N | catastrophic Y | Countix within-one Z%
Launch lifts:
French register: tu / vous
Open problems:
Next step:
Tester criteria (Phase 7):
```

## Part 7. French glossary (native gym French)

David validates this list before it is used. One register throughout the app.

| English | French |
|---|---|
| Rep / set / rest | Repetition (rep) / serie / recuperation |
| Form (execution quality) | Execution, technique (never "forme": in French it means fitness) |
| Range of motion | Amplitude |
| Lockout | Verrouillage, extension complete |
| Eccentric / concentric | Phase excentrique (negative) / phase concentrique |
| To failure / reps in reserve | Jusqu'a l'echec / repetitions en reserve |
| Progressive overload / deload | Surcharge progressive / semaine de decharge |
| Warm-up | Echauffement |
| Bench press / dumbbell bench press | Developpe couche / developpe couche halteres |
| Incline / decline press | Developpe incline / developpe decline |
| Overhead press | Developpe militaire |
| Dumbbell or machine shoulder press | Developpe epaules halteres / a la machine |
| Lateral raise / front raise | Elevations laterales / elevations frontales |
| Rear delt fly | Oiseau |
| Dumbbell fly / cable fly | Ecarte couche halteres / ecarte a la poulie (vis-a-vis) |
| Pec deck | Pec deck, butterfly |
| Push-up / deficit push-up | Pompes / pompes en deficit |
| Dips | Dips |
| Lat pulldown | Tirage vertical |
| Seated cable row | Tirage horizontal |
| Bent-over row / one-arm dumbbell row | Rowing barre / rowing haltere |
| Pull-up / chin-up | Tractions / tractions en supination |
| Face pull | Face pull |
| Biceps curl / hammer curl / EZ-bar curl / preacher curl | Curl biceps / curl marteau / curl barre EZ / curl pupitre |
| Triceps pushdown | Extension triceps a la poulie haute |
| Skull crusher | Barre au front |
| Squat / front squat / goblet squat | Squat / squat avant / goblet squat |
| Lunge / Bulgarian split squat | Fentes / squat bulgare |
| Leg press / leg extension / leg curl | Presse a cuisses / leg extension / leg curl |
| Deadlift / Romanian deadlift | Souleve de terre / souleve de terre roumain |
| Hip thrust / glute bridge | Hip thrust / pont fessier |
| Calf raise | Extension des mollets |
| Plank | Gainage |
