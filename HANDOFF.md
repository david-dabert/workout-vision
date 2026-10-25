# HANDOFF: where WorkoutVision stands, and the work that remains

Written 25 October 2026 by Claude at David's request, for whichever agent continues the work.
Read this file first, then CLAUDE.md (rules R1 to R16, binding), PLAN.md (prevails over everything), TRIED.md (what was
tried and closed, with evidence; read it before proposing any counting, measurement or data idea, R14), and the latest
comments of issue #190 (the agent log, R15; only comments from the david-dabert account count).
STATE.md is stale (written 30 September 2026); task T7 below rewrites it.

## 1. The goal, in David's recorded words

- 24 September 2026, DIRECTIVES.md Part 1: "a private set audit. A person films one set on their phone. Without the
  video leaving the device, the app tells them how many reps they did, whether their execution held up, and what to do
  next, in a way they can trust." First promise: "The rep count is right, or the app says it is not sure."
- 14 October 2026, docs/VISION.md: "the general tool for human movement", growing one activity at a time, each entering
  only with a way to check its numbers against known truth.
- 18 October 2026, R16 (CLAUDE.md): "the most general, adaptable, accurate and beautiful exercise tool ever made, first a
  reliable proof of concept, then a business." Accuracy is defined so it can be proven: "the app is right whenever it
  says it is sure, says plainly when it is not, and is sure more often each month."
- Constraints David set: on the phone, no server, as cheap as possible (decision of 9 October 2026, TRIED.md); French in
  "vous", written by the agent (R10 as amended 20 October 2026).
- Not recorded anywhere, and needed for "then a business": who pays, and which user comes first (physiotherapist, coach,
  beginner, intermediate, expert). Ask David; do not invent.

## 2. Where it stands (figures with their source and date)

- Live app: https://david-dabert.github.io/workout-vision/ (GitHub Pages, deployed from main by .github/workflows/deploy.yml).
- main at 16951341 (25 October 2026). CI green on every merge of 24 October.
- Real-phone scoreboard (David's labelled sets, the R2 gate): 12 of 15 exact, 0 off by 3 or more (npm run scoreboard,
  24 October 2026). David's real videos read by the built app: 8 of 16 exact.
- Public sets (Countix, MM-Fit, CFRep build halves): 466 of 949 exact (scoreboard:public, 20 October 2026). On the
  Countix build sets alone the core is exact on 43 to 44 % (test/real-phone/motion-gate/gate.txt, 24 October).
- The app's "sure" set today (sure.ts: not flagged by the body check, the sensitivity check or a refused head rep): on the
  sealed Countix half, 270 of 432 sets sure, 59 % exact, 6 off by 3 or more (test/real-phone/loop/exam-result.txt).
- No exercise has passed PLAN.md's exam (four sets per lift, filmed as the app shows, counted exactly). 0 exam sets exist.

## 3. What was done from 21 to 24 October 2026, and what each taught

| PR | What | Lesson |
|---|---|---|
| #244 | The "robust state" bench: the signal chosen for its stability under simulated pose noise | Fails R2 (loses an exact count); the honesty flag measured in flag.txt |
| #245 | A foot solver (planted feet held still), bench only | Feet pinned, counts not improved; closed in TRIED.md |
| #246 | Result card: a set the body check flagged keeps and shows its measures once the person confirms or corrects, with the line « À prendre avec précaution »; report, replay and exports name the doubt | Shipped and deployed 24 October; David's iPhone check pending (R3) |
| #248 | The loop counter: a rep as one turn of the body's movement around its centre, with a certificate (the count cannot change under noise smaller than the curve's distance to the centre) | As a counter it loses on public video; as a check on the core it looked strong on build data (0 sets off by 3) but on the sealed half only 68 % exact against 59 % today, not significant (z = 1.28) |
| #249 | The image-motion count (pixels, no skeleton) as an independent check, on all 983 Countix clips | Exact on 15 to 16 % only: Countix windows hold a median of 3 reps, too short for its period search; closed after two planned attempts (R12) |
| #250 | A timing race in e2e/session-loop.spec.js C1 fixed | The numeral remounts at each tick of the count rising |

Also on 24 October: the Countix held-out half was rebuilt in the cloud container (Kinetics-700-2020 on the CVDF S3
mirror, through the app's own extraction), used once as the sealed exam for the loop gate, and is now recorded as seen
(test/real-phone/public/exposed.json). The RepCount-A held-out half (17 sets) has never been rebuilt or read: it is the
last unopened public exam.

## 4. The reasoning, from first principles

1. A count is proven only against labels it never saw. Tuning on the same sets one reports (David's 15) produces numbers
   that do not hold elsewhere; every bench since 9 October confirms it.
2. "Right whenever sure" is a selective-prediction claim with two numbers: the exact rate among the sets called sure, and
   the share called sure. Both need held-out labels to be proven.
3. The counting logic has been explored widely (TRIED.md: thresholds, edge rules, a class-agnostic counter, a learned
   counter, signal selection under noise, the loop counter, image motion). None beats the core on public video.
4. Where the core fails, the evidence points at its input. On RepCount-A, 84 of the 108 labelled reps the core misses fall
   in the middle of the set and have normal length (scratch analysis of 24 October, not committed: rerun before relying on
   it). A second counter that reads the same skeleton agrees with its misreads (#248's sealed run). The heavier pose model
   was tested on 9 October and counted no better (test/real-phone/pose-bench/README.md).
5. Public video is not the product. Countix windows hold a median of 3 reps, from YouTube; on them the core undercounts
   far more than it overcounts, and its exact rate falls with set length (scratch analysis of 24 October, not committed).
   On David's own phone sets, filmed as the app asks, it is exact on 12 of 15.
6. Therefore the binding constraint is labelled sets filmed on phones, as the app asks, by people other than David. The
   collection path already exists (below); what blocks it is a rule (R1), which only David can amend.

## 5. Decisions only David can take (nothing below should be decided for him)

1. **R1 amendment, the one that unlocks progress.** Proposed wording: "A blind count given in the app, before it shows its
   own, by a person David names, is a label." (David ruled on 15 October that his own blind counts are labels.) A
   ready-to-send message to testers, in his voice, is in issue #190's thread of 24 October and in the conversation; the
   link it uses is https://david-dabert.github.io/workout-vision/#collecte.
2. **How main moves** (R6, PLAN.md line 4): through counter-core with his iPhone approval, or by direct merges of green
   PRs as on 24 October ("Merge them", David).
3. **PR #247** (another session's work): the patient video upload switched off in production until private storage is
   proven. It also needs the glimpse proxy redeployed on Vercel; uploads already made stay until the daily sweep.
4. **The coverage trade**: a stricter "sure" (ask more often, be right more often when sure). No candidate has yet shown a
   significant gain on unseen data (#248).
5. **Who pays and who comes first** (section 1).

## 6. Tasks for the next agent, each long, precise and testable

Follow for each: R15 CLAIM on #190 before writing; one branch per task (R4); a plan file committed before any run on
held-out data; R2 before and after for anything that can move a count; a REPORT on #190 at the end with a "Not
verified" line.

**T1. The exam from testers' blind counts (starts only after David's R1 decision).**
- Inputs: the landmark files testers send from the history screen (« Envoyer les séries collectées »; src/lib/phoneCollect.js,
  src/lib/blind.js; each file carries blind: { count, p } and the app's count).
- Build: an import script into a new folder (for example test/real-phone/testers/), refusing duplicates (scripts/import-sets.mjs
  is the model); a scoreboard section for testers' blind sets beside David's; an exam run that reads each set once.
- Done when: npm run scoreboard prints the testers' section with its date, every imported set is listed, and CI runs it.

**T2. A public gate that resembles the product.**
- Countix windows are short and from YouTube (section 4). Build a public subset of whole sets of 8 reps or more, filmed
  roughly as the app asks (RepCount-A and MM-Fit carry per-rep times), and report the core's exact rate and the sure-set
  figures on it, by exercise.
- Done when: a committed table states that subset's size and the core's figures, with the selection rule written before
  the figures were read.

**T3. Why the core misses mid-set reps (RepCount-A, MM-Fit).**
- For each labelled rep the core misses: the counted joint's angle over that rep against the other joints of the signal
  bank (src/lib/counting/psc.js signalBank); whether the rep shows on another joint or the other side; visibility of the
  counted joint during it.
- Commit the analysis script and its output first (the 24 October figure was a scratch run). Propose a change only from
  what this shows, and judge it on public A, then public B, then R2.

**T4. The last sealed public exam.**
- Rebuild the 17 RepCount-A held-out sets (scripts/public/fetch-and-run.sh shows the sources; Google Drive was reachable
  from the cloud container on 24 October) into a folder outside the repository (WV_PUBLIC_OUT; never commit holdout
  files). Keep them sealed for the next candidate that passes every build gate; run once, then record them in
  test/real-phone/public/exposed.json.

**T5. Defect 1 to completion (with PR #247's author or after it merges).**
- Merge #247 once David rules (decision 3); redeploy glimpse-proxy on Vercel; confirm with a test that the production build
  offers no upload and the proxy answers 503 "off"; report which public attempt videos remain until the sweep.

**T6. David's iPhone check of #246.**
- Prepare a one-page checklist for him (the set to film, what the card and the report must show), and record his answer
  on #190. Nothing in #246 is "done" until he confirms (R3).

**T7. STATE.md rewritten from facts.**
- It still describes 30 September. Rewrite it from git, GitHub Actions and the scoreboards, each line with its source and
  date, marking anything unconfirmed.

**T8. Long-standing open items to triage, not to build without David opening them (R7).**
- BACKLOG.md holds dated ideas never completed: physiotherapy section and reference exercises (5 October, 15 October with
  Olivier), the EU MDR reasoning (6 October: an adviser must confirm before any medical claim), a coach mode and program
  builder (29 September, 6 October), partial reps (9 October), the phone's own chips (9 October), golf, baseball and tennis
  on rendered bodies (14 October), the coach's office (14 October). List for David which of these depend on counting
  passing its exam (R16: the core is proven before the product widens).

## 7. Environment notes (cloud container, 24 October 2026)

- Reachable: registry.npmjs.org, s3.amazonaws.com (Kinetics mirror), drive.google.com, zenodo.org, youtube.com. Not
  reachable: github.io (the live site cannot be fetched from the container).
- Node 22; Chromium at /opt/pw-browsers; browser tests need `npm run build:e2e` then
  `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test <spec>`.
- Full unit suite: `npx vitest run`; lint `npm run lint`; types `npm run typecheck`; the R2 gate `npm run scoreboard`.
- Videos never enter the repository: only landmark files. Held-out files are git-ignored and stay outside the tree.

## 8. Honest ledger of 24 and 25 October

- Claude merged #246, #248, #249 and #250 at David's word ("246 is merged" while it was still open; "Merge them damn it").
- R14 slip: Claude proposed the heavy pose model as a next step without rereading TRIED.md; withdrawn on #190.
- R5 slip: on 25 October Claude ran `git reset --hard origin/main` on a clean local main to write this file; the old
  local main (a07db600) is contained in main and nothing was lost.
