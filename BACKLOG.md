# Backlog

New ideas wait here, dated, until David opens them as a step (CLAUDE.md R7).

## 5 October 2026: a section for physiotherapists and physical trainers (rehabilitation)

Source: David's demo to a physiotherapist (prone T raise, "it's physics for most people"; he asked for a meeting), and
David's mentor: physiotherapists, physical therapists and physical trainers need their own section, for clients in
rehabilitation, after injury or surgery.

- Rehabilitation exercises in the catalogue (the prone T raise is not in it today; the demo ran under another lift).
- Reference videos of each exercise done correctly. Rights: filmed by David or a professional and validated by one;
  never the public datasets the app is measured on (their licences do not cover showing them to users, and their
  labels are counts, not correct form). Rehabilitation datasets to read for measuring only, licence checked first:
  IntelliRehabDS (CC BY 4.0, zenodo.org/records/4610859); REHAB24-6 (non-commercial research only, zenodo.org/records/13305826).
- Done now (5 October): the plain-words key to the measures under the rep table, result screen, report and PDF.

## 6 October 2026: physiotherapy and the EU MDR, the reasoning corrected

The 5 October section (rehabilitation, after injury or surgery) and the kinésithérapeute line of the 2 October
use-case map read as if patient adherence or rehabilitation follow-up stayed outside the EU MDR because it is
"not diagnosis". That reasoning is wrong. What decides is the intended purpose stated by the manufacturer, not
whether the app diagnoses:
- Regulation (EU) 2017/745, Art. 2(1): software intended by the manufacturer for a medical purpose, among them
  the monitoring or alleviation of a disease, or of an injury or disability, is a medical device. Software meant
  to follow a patient's rehabilitation exercises after injury or surgery falls under that purpose. The exact
  wording of Art. 2(1), and whether "rehabilitation" is named in it or reached through "injury or disability",
  is to be confirmed by a regulatory adviser (the text could not be retrieved from here on 6 October).
- Annex VIII, Rule 11, with MDCG 2019-11 (already cited on 1 October above): software that provides information
  used to take decisions for diagnostic or therapeutic purposes is at least class IIa. A report a kiné reads to
  adjust a patient's programme is such information. The class that would apply to a given feature is to be
  confirmed by a regulatory adviser.
- Outside the MDR: fitness logging by healthy adults (wellness use), with no medical purpose stated or implied.
  That is the intended purpose docs/SPEC-production.md sets in WP2.1 ("fitness logging for healthy adults; not
  for patients' care or monitoring") and D16 ("No patient-facing positioning or demo until a regulatory opinion
  exists"); D19 keeps patients out of any data flow.
So the physiotherapy section, the "home-exercise adherence for kinés" pivot and any patient demo stay closed until
D16 is answered and a regulatory opinion exists. The web app manifest now declares the category "fitness" only
(public/manifest.json, 6 October).

## 29 September 2026: a coach mode, one combined report per client

Source: Luc, an online coach, at the gym with David. Online video coaching is growing; clients send coaches
several videos a week, and a coach turns them into feedback.

- "Je suis coach", beside alone, with a friend, with a coach.
- The client's name; the coach analyses one video after another, each saved under that client on the phone.
- One report for the client: every exercise with its count and tempo, and the coach's note, instead of one PDF per
  video. Built from the sets the app already keeps on the phone, not by uploading PDFs back into the app.
- The report names no app (David, 29 September): the name is not final, and the tool spreads by being useful to the
  people and coaches who use it.

Before any code: David shows the one-line report to Luc and to coaches he knows, with this idea (David, 29 September).

## 1 October 2026: design review of the live app (Astra, relayed by David), proposals only

Checked against the code on main (84e020a) before entry. These are proposals, not accepted requirements; each waits until David opens it. Proposed wording is editorial judgement and needs David's approval (R10). The opening line ("Votre corps est un temple") is David's brand decision.

- Result: "Oui, c'est juste" also saves; "Non" opens the correction. Proposed: "Confirmer et enregistrer" and "Corriger".
- Result: saving starts the rest clock and scrolls to it, also for a video picked from the library (Result.jsx, doSave and the step effect). Proposed: a rest clock started by the user, no automatic scroll.
- Result, saved: the report and "Défier un ami" are more prominent than "Nouvelle série". Proposed: "Nouvelle série" first; the challenge off this screen.
- Result: the count rises before the question can be answered. Proposed: the final count and the actions at once.
- Correction: only a stepper (7 to 34 takes 27 taps). Proposed: direct entry beside it, and "Je ne suis pas sûr" without a forced label.
- Refused set: no manual route to keep a completed set. Proposed: replay and an optional count entered by hand.
- Exercise choice: search sits below the carousel. Proposed: search at the top, recent exercises under it, one catalogue.
- Filming screen: at 390 x 664 px, "Choisir une vidéo" falls below the first screen. Proposed: both actions in view; the full guide on demand for returning users.
- Rep marks: narrow targets for a thumb. Proposed: "Répétition 3 sur 12" with large previous and next controls.
- Report: the form comes before the preview; a single set is called "Rapport de séance". Proposed: preview first, options under "Personnaliser", "Bilan de la série".
- Level question after saving. Proposed: an optional "Afficher les détails" instead.
- First visit: the Enter button appears after 2.9 s (Entry.css), skippable by a tap; returning users never see it. A design choice, not a defect.
- Accessibility to test on the iPhone: contrast in bright light, text at 200 %, VoiceOver, small uppercase metadata.
- Not entered as defects: the report's zero peak and mean speeds and "Durée : 0,0 s" seen under Astra's injected test data, which may explain them.

## 1 October 2026 (David): users and requests, not built in this phase
- Users named: physiotherapists (kinésithérapeutes), online and in-person coaches, gym newcomers,
  intermediates, experts, sport scientists, strength and conditioning coaches. One engine serves them all.
- Invoicing for physiotherapists: not to be built. Reimbursed care is billed by electronic care sheet through
  SESAM-Vitale approved software every practice already owns (Ordre des MK; Caducée, 1 September 2026 reform).
- Medical use (EU MDR Rule 11, MDCG 2019-11): software that informs a care decision is class IIa or higher.
  No reading may be framed as informing care until that route is decided.
  (6 October: monitoring a patient's rehabilitation is a medical purpose too, informing a decision or not;
  see "6 October 2026: physiotherapy and the EU MDR".)

## 2 October 2026
- Fit a five-rep session report on one A5 page with its opener (report-pdf.js): today it spills onto a second.
- Name the joint in the per-rep table and the CSV headings, as the result screen now does.
- Count from the side: synthetic curls and squats filmed from the side are exact on 4 of 6 each (synth.txt);
  look into the armoured body's hidden elbow and the over-counted squats before trusting either.
- Accessibility (axe, WCAG 2.1 AA, smoke run of 2 October): every screen of the journey passes except the
  filming screen's two buttons, labels with role=button that hold the hidden file input (nested-interactive,
  serious). The input sits under the finger on purpose, so iOS opens the camera from a real tap; rebuild it
  only with an iPhone to check the camera and library still open.

## 2 October 2026: one instrument, every user (use-case map)
What each user needs, what the engine measures today, and the smallest build that serves them. "Today" means
measured (scoreboard, synth.txt); anything else waits for its measurement (R8, R13).
- Everyone first: the count. Real-phone exact 7/14, public 30 %; the counter is the product's floor, not a feature.
- Women (David, 2 October: they adopt tools fastest and are readiest to pay; UNSOURCED here):
  - Privacy as a feature: video never leaves the phone, landmarks only; say it once, plainly, where the camera opens.
  - Lower-body and glute lifts first in measurement order: hip thrust, Romanian deadlift, squat, lunge, glute bridge,
    abduction. Today hip thrust and RDL are Experimental and exact on David's sets (1 each): they need exam sets.
  - Figures and copy that do not assume a male body or a bodybuilding goal; no weight, no body measures asked.
- Beginners: is my rep a rep? Show each counted rep on the replay, the range it reached, and say when a rep was
  shallower than the set's others (relative, never a verdict, R8). Filming guide that cannot be misread.
- Intermediates: progress over weeks for the same exercise filmed from the same spot: reps, tempo, range trend.
  Needs the history to group by exercise and the "same spot" tip (shipped in #51).
- Experts and sport scientists: per-rep table, CSV with joint names and units, method page with dated accuracy,
  open definitions (rest band, phase timing). The honesty is the selling point to this group.
- Strength and conditioning coaches: many athletes, one phone: athlete name on each set, one combined report per
  athlete (the 29 September coach mode), CSV for the team sheet. Velocity-based training is out of reach: speed
  change is within timing noise today (measures.js).
- Kinésithérapeutes: home-exercise adherence, not diagnosis (MDR Rule 11): the patient films the prescribed
  exercise at home; the report shows what was done (sets, reps, tempo, range as recorded) for the kiné to read.
  Prescribed targets (reps, tempo) entered by the kiné on the patient's phone; no reading framed as clinical.
  Range is underestimated 20-30 % on synthetic bodies: shown only as "as recorded", never as a measurement of
  mobility, until a goniometer comparison exists.
  (Corrected 6 October: "adherence, not diagnosis" does not keep this outside the MDR; following a patient's
  rehabilitation is a medical purpose. Closed until D16; see "6 October 2026: physiotherapy and the EU MDR".)
- Online coaches (Luc): the client films, the coach receives one report per week (29 September entry).
- Pivots worth testing with one real user each before any code: home-exercise adherence for kinés; team
  logging for S&C coaches; a privacy-first set logger for women who train alone.

## 2 October 2026: remove the dormant code (Astra's audit, FINDING-035), David's decision

`node scripts/unreachable.mjs` lists the source files no page of the app loads: on 2 October, 92 of 188 (non-test),
among them the old upload, replay, coach report, injury, badge and feedback screens, and the old counters
(SignalExtractor3D, valleyCounter, repCounter, hysteresisCounter). None of their code reaches the bundle, but their
strings and styles do (third audit, C50, 3 October 2026; `npm run build` that day): LanguageContext.jsx imports the
whole en.json into the entry (i18n chunk 83.8 kB, 29.0 kB gzip) and loads the whole fr.json at once on a French phone
(109.7 kB, 37.1 kB gzip), while the live screens read about 130 keys (six err_* in ErrorBoundary, the ex.* names
as a last fallback in Choice and History); index.css, render-blocking, imports every partial (111.2 kB, 20.9 kB gzip),
most of _landing, _dashboard, _features and _views serving only dormant screens. Splitting them goes with this
decision, and needs a check by eye that the live screens look the same. 14 test files still
test them (src/lib/__tests__/benchmark, biomechanics, coach, defense, exerciseDetector, hierarchicalDetector,
hierarchicalValidation, pipeline, progressionScale, utils; counting hotfix_baseline and learned;
test/real-phone/accuracy/learned-span, agreement/counts), so a green test run says less about the app than its size suggests.

App.jsx says "Hidden, not deleted". Proposal: delete what David does not mean to bring back, keep the learned
counter (research, PLAN.md), and run the script in CI so a file no page loads is named. Nothing is deleted until
David chooses.

## 2 October 2026: tennis pro comparison from public skeleton data (David, relayed from another model), assessed, not opened

The proposal: bundle skeleton sequences of professional tennis strokes (said to come from pwang724's "Tennis
Skeleton Quiz"), compare a user's stroke to them by dynamic time warping, and say "your forehand matches 84 % with
Federer".

Assessment (2 October):
- Out of scope: WorkoutVision counts gym reps; a tennis stroke is not a rep, and no current phase covers it (R7).
- The source is unverified: the repository was not found by search and could not be opened from this session;
  its data, labels and licence are unknown. The per-player "signatures" in the proposal carry no source (R9).
- "84 % with Federer" is a number the app cannot measure reliably (R8): a match score against one player's
  stroke has no ground truth and no validated meaning.
- Already in place: joint angles from MediaPipe's world landmarks do not depend on the distance to the camera, so
  the normalisation step adds nothing to counting.
- Worth keeping, apart from tennis: dynamic time warping against a template of the user's own first rep, as a
  second opinion on the count. It would be a counting change: synthetic test first, scoreboard, synth and
  public gates (PLAN.md).

## 3 October 2026: four floor exercises withdrawn until a view is shown to count them (third audit, C21)

Dead bug, banded dead bug, bird dog and glute bridge march are counted on both sides, and the guide said to film
them in profile. A both-sides count needs each side seen on half the samples or more (coreAnalysis.js,
FINDING-012); lying or on all fours in profile, the body hides the far arm and leg, so a set filmed as told is
refused. From the front or the feet, the hip angle lies along the camera's depth, where the pose model is weakest.
They are withdrawn from the app (src/lib/offer.js, WITHDRAWN) and keep their guide entry, their names in History
and their place in the set collectors.
- They come back when exam sets (PLAN.md patterns 14, 16 and 17 name them) show a view that counts them: sets
  labelled by David, filmed in profile, from the front and in three-quarter view, run through the count, with
  neither side refused and no error of 3 or more. The view that works becomes their guide-families.json "view".
- Not measured: no labelled set holds them. The reasoning is by anatomy, status experimental.

## 3 October 2026: HYROX stations the app does not count

Added the same day (experimental, measured on no set): the behind-the-neck press, the barbell jump squat and the
wall ball, counted by existing patterns; the sandbag lunge has a guide entry only, as a walking lunge it leaves a
fixed frame (src/lib/offer.js, NOT_FILMABLE). Not added, and why:
- SkiErg, rowing, sled push, sled pull, farmers carry and running: HYROX scores them in distance or time, which a
  phone filming joint angles cannot measure. Showing a rep count for them would display a number the app cannot
  measure (R8).
- Burpee broad jumps: the body goes flat on the floor and travels forward out of a fixed frame; the knee or elbow
  cycle is not one repeated joint pattern seen from one place.
- They could come back only with a measure the app can take (for example, a station timer the user starts and
  stops), which is a new feature, not a counting pattern.

## 3 October 2026: PLAN.md's tier list is stale

PLAN.md (LIFT TIERS, 28 September) still lists lateral raise as Beta and hip thrust and Romanian deadlift as
Experimental with "no clip". David's sets of 29 September changed the evidence: lateral_raise_9 counts 8,
hip_thrust_6 counts 6 and romanian_deadlift_8 counts 8 (npm run scoreboard). On David's order of 3 October the
tiers now follow the evidence, and test/real-phone/accuracy/tiers.test.ts enforces it on every npx vitest run: a
lift is Beta iff it is not a press (bench, overhead) and every one of David's labelled sets of it counts exactly
(none off, none refused); a lift with no set of David's may be Beta on dataset evidence recorded in the test
(squat: MM-Fit). Today: Beta are biceps curl, lat pulldown, squat, hip thrust and Romanian deadlift; lateral
raise, leg press, bench and overhead press are Experimental (tiers.txt). The Beta lifts are pinned first on the
cards and in the list. PLAN.md's list is for David to update.

## 3 October 2026: live counting, what was left out of the first build

Live counting (Film screen, "En direct"; src/components/experience/Live.jsx) was built on 3 October. Left for later:

- Stop on stillness: end the set by itself after some seconds without movement, so the person need not walk to the
  phone. Not built: the walk to the phone is already in every recorded video, and a pause between reps (a lifter
  resting at the top of a curl) would end a set too early; needs a measured threshold (R9).
- Usage counts that tell a live set from a video: today a live set sends film_start and the analysis_* events, as a
  video. A live_start event needs the worker's list changed and deployed first (feedback-worker/usage-schema.js): a
  batch with a name the deployed worker does not know is refused whole.
- A pose model in VIDEO mode for live: the core's landmarks come from IMAGE mode (corePoseWorker.js), on which every
  real-phone set was counted; VIDEO mode would track between frames and change the landmarks, so the count. Measure
  before switching (R2).
- The provisional count can run ahead of the final one: on David's overhead press (Experimental) it reached 10 before
  the whole set settled on 9 (src/lib/__tests__/liveCounter.test.js). The result says so when they differ; a
  provisional count that waits for the next rep before it shows one may be steadier. Measure on the real-phone sets.
- Live replay is the skeleton alone; keeping a short low-resolution clip on the phone for the replay would need the
  person's yes and a memory budget.

## 6 October 2026: a reference movement beside the person's own (David; raised by the physiotherapist and Christopher)

- The idea: for each exercise, a short (about 3 s) animated figure drawn by the app, not filmed, showing the reference
  execution: range of motion, the order of the phases, and a tempo. Shown beside the replay with the skeleton overlay,
  or below it, so the person compares the two. No third-party video, so no licence question.
- What exists: the nine card lifts already have animated figures (lift-poses.json, lift-scenes.js,
  scripts/make-lift-poses.mjs); the guide's 182 exercises have still drawings, and some have none (noDrawing).
- Before building:
  - Every reference range and tempo needs a source and a status (R9). Write "reference execution", never "optimal" or
    "correct for you": the right range depends on the person, the goal and any injury, and a rehabilitation claim
    reaches the MDR (BACKLOG, 6 October note).
  - The comparison is only as honest as the measure: on synthetic sets the app reads range about 30% low and phase
    times about 45 to 54% short (synth.txt, 6 October). A person shown "your range: 60%" against a reference would be
    misled. Fix or calibrate the measures first (review of 6 October, action 9).
- Cheapest first step, after that: draw the reference range as a band on the existing per-rep wave (RepWave), for the
  five Beta lifts, from a sourced range per joint. Then the animated figures, Beta lifts first.

## 6 October 2026: collecting David's sets without the collector (priority for the next run)

- Collecting nine labelled sets took David over an hour on 6 October: the batch collector refused reads one or two
  samples short (fixed, #112), the chat takes no video, GitHub's upload page refuses files over 25 MB, and exported
  replays are not valid sets (overlay drawn on the body, about 10 frames a second).
- Build it into the app, for David's phone only: when he keeps or corrects a count on the result screen, the app
  saves that set's landmark file with its lift, view and his count, in the collector's format, and a "Send the day's
  sets" action shares them all at once (one share sheet, one message). No retyping, no second reading of the video.
  Reuse src/lib/contribute.js and collectSet's file format; switched on by a flag only David's phone carries.
- Labels typed after seeing the app's count are "after-app" (contribute.js, FINDING-008): mark them so, and keep a
  blind recount for the sets the scoreboard publishes (R1, R13).
- Built 6 October 2026 (branch claude/generate-architecture-md-inw479, not yet confirmed on David's iPhone, R3):
  opening the app at #collecte (or ?collecte=1) switches it on for that phone, #collecte-off (or ?collecte=0) off,
  with one line of confirmation on the first screen; no screen shows the switch (src/lib/phoneCollect.js). With it
  on, a video set whose count is kept or corrected on the result screen also keeps, in IndexedDB (store "collected"),
  the collector's file (setPayload, setFileName, gzip) with the kept count, labelKind 'after-app', the app's count,
  the video's SHA-256 (the landmarks' hash when the video cannot be read) and, as view, the view the app asks the lift
  to be filmed from (viewSource 'app-guide'). Live sets are not kept (no video, not read at the collector's settings).
  The history then shows "Envoyer les séries collectées (N)": one share sheet with every file (downloads where the
  sheet takes no files), then "Effacer" or "Garder". Nothing is sent by itself; without the flag nothing changes.
  Words for David's approval: test/real-phone/swarm/copy-collect.md. Tests: src/lib/__tests__/phoneCollect.test.js,
  e2e/collect-phone.spec.js. Open: whether after-app sets enter the scoreboard stays David's decision (R1, R13).

## 6 October 2026: a program builder for coaches and physiotherapists (Zine, coach; David)

- Market: coach platforms (Trainerize, 400 000+ coaches; TrueCoach; Hexfit) build programs with sets, reps, tempo
  and rest, and add messaging, payments, nutrition. Consumer apps (Nike Training Club, Decathlon Coach, FitOn,
  Freeletics) ship ready-made programs and videos. None of them, as far as their public pages say, counts the
  client's reps from a phone video.
- The loop only WorkoutVision can close: the coach writes the program; the client receives it on their phone; each
  set is filmed and counted; the client sends back the session report PDF with counts, so the coach sees what was
  done, not what was ticked.
- First version, no server, no account (keeps "nothing leaves the phone"): a Pro section where the coach picks
  exercises from the 182 of the catalogue, sets per exercise, reps, rest, a note; the app makes a PDF in the report's
  design and a link that opens the program in the client's app (program encoded in the link). The client's session
  follows the program and its report shows planned against counted.
- Physiotherapists: same builder, wellness wording only until the MDR question is settled (6 October note).
- Order: after collection from the result screen (above). The reference movement (animated figure, 6 October) comes
  after the range measure is within 10 % of truth (reference band, behind its flag).
- Built 6 October (first version, branch claude/generate-architecture-md-inw479, not yet on David's iPhone): "Espace
  pro" from the choice (`#pro`, `Pro.jsx`): title, for whom, general note; exercises from the counted catalogue (the
  choice's searchable list), each with sets, reps, rest in seconds and a cue, reordered and removed; drafts kept in
  localStorage on the coach's phone. Two outputs: a PDF in the report's design (`programme-pdf.js` on `pdf-kit.js`, the
  report's jsPDF setup), shared like the report; and a link, `#programme=<payload>` (`programme.js`: compact JSON, gzip
  where the browser has CompressionStream, base64url; every field checked, 8,000 characters at most, unpacking stopped
  at 16 kB). The client's phone shows the programme (`Programme.jsx`), keeps it, starts the usual filming of an
  exercise, and shows each set saved from it today beside its target; the set keeps the target (`planned`), and its
  session report prints "Prévu : 3 × 10" beside the count. Words in `pro-copy.js`, for David's approval
  (`test/real-phone/swarm/copy-pro.md`). Not built: tempo per exercise, a QR code on the PDF, several days in one
  programme, the client sending results back other than by the report's PDF.

## 6 October 2026: smaller downloaded videos (idea from Azélie, through David)

- Idea: compress the video a user downloads, as the shrink page does (public/shrink.html: 720 px, 1 Mbit/s).
- Today the download is already a re-recording, not the original: at most 1280 px, 2 Mbit/s, about 15 MB a minute
  (`video-export.js`, `exportSize`, `EXPORT_BITS_PER_SECOND`). 720 px and about 1.2 Mbit/s would halve it, about 4 to
  7 MB saved on a set of 30 to 60 seconds, for a slightly softer image.
- The space that matters is the original filming in Photos (60 to 170 MB a minute), which a web app cannot shrink or
  delete.
- Not built: no user has reported the size; David judged on 6 October that it is not progress for now. Revisit if a
  user asks for smaller files.

## 7 October 2026: motion count as a confirm prompt on the result screen (proposal, not built)

- Measured on the bench only (TRIED.md, 7 October; `src/lib/counting/motionRhythm.js`, `test/real-phone/motion/motion.txt`):
  a count from image motion alone disagrees with the skeleton on 7 of its 9 misses and on 4 of its 9 exact sets
  (18 sets: David's 5, MM-Fit w19 8, synthetic 5; David's 5 were used to set the method).
- Proposal: when the two counts differ, the result screen shows no grade and asks the user to confirm the count
  (R8), offering both numbers; where the pose covers under 90 % of the set, the motion count is the one offered first.
- Before building: more real videos held out from the method (the exam sets), a rule for alternating lifts (the motion
  count is half), the cost measured on an iPhone, and David's approval of the screen and its French (R10).
- 7 October, later: a rule for alternating lifts is on the bench (TRIED.md, 7 October; front views counted in full,
  side views still half). On occluded synthetic sets the motion count held where the skeleton failed (plate: 6 of 6
  against 0 of 6; test/real-phone/occlusion/). Still to do before building: held-out real videos, iPhone cost, R10.

## 8 October 2026: MuscleMimic, a muscle-driven body that reproduces a motion (David, from X)

- What it is (read in the repository, github.com/amathislab/musclemimic, Apache-2.0, preprint arXiv 2603.25544):
  reinforcement-learning policies that make a simulated full body of 354 muscles (MuJoCo, JAX) reproduce
  motion-capture recordings (AMASS and KIT motions, C3D markers fitted to SMPL). Training needs an NVIDIA GPU. It reads
  no video: the repository has no path from a phone video to its body.
- For counting: nothing now. It starts where the app's problem ends: it needs clean 3D motion, and the app's limit is
  reading that motion from a phone video (TRIED.md, Pose detection; the plates of 7 and 8 October, the prone raises of
  8 October).
- Later, two pieces: (1) for the physiotherapists (Christophe, shoulders), which muscles a movement uses and how hard,
  an estimate on a generic body, never shown as a measure (R8), and worth it only once the motion read from video is
  reliable; (2) its body's anatomical joint ranges, as a check that flags poses no body can take (the invented ankles
  of anatomy-8oct.md), without its learning machinery.

## 9 October 2026: counting partial reps (David)

- David: "it will be interesting and valuable to count partials too in the future."
- What it would mean: beside the full reps, the reps that do not reach the set's working range (lengthened partials,
  a last rep that fails half-way), shown as their own number, never added to the count.
- Why not now: the core counts a rep only when it crosses both of the set's thresholds and spans the per-rep floor
  (core.ts, detectReps, MIN_ROM_DEGREES): a partial is the rep it is built to drop. Telling a partial from a tracking wobble needs the landmarks to be trustworthy first (the pose pipeline
  test of 9 October, `test/real-phone/accuracy/pose-pipeline-9oct.md`). No label of a partial exists yet: David's
  labels count full reps, and a last rep cut by the end of the video counts as full (his convention of 9 October).
- Data it would need: sets with partials counted by David, blind (R1).

## 9 October 2026: the phone's own chips beyond the browser's GPU (pillar 4, David)

- WebGPU: MediaPipe offers no WebGPU pose path. The cheapest test would run the same model files on a WebGPU runtime
  (LiteRT.js or ONNX Runtime Web, to verify), speed first, on the iPhone; it is a new engine under the full R2 gate.
- Native iOS, PoseBench: a small Xcode app that reads David's 14 videos at 15 samples a second with Apple's body pose
  (2D and 3D) and MediaPipe Tasks for iOS, times each and writes landmark files in the shape of sets-07oct-video
  (docs/IPHONE-CHIPS.md, section 4). Needs David's Mac and iPhone.
- Why not now: the browser's GPU is measurable on his iPhone from the check page first, at no cost.

## 10 October 2026: re-read the public sets with today's pose path (stability study)

- The stored Countix build reads date from 30 September. Read again today, 37 of 438 counts differ (exact 177 -> 179, off
  by 3 or more 71 -> 59), and 9 stored sets fail the whole-read rule of 2 October (TRIED.md, Data, 10 October).
- The step: re-read every public build set (Countix, Countix whole, MM-Fit) with `run-public.mjs`, keep the image
  landmarks, record the nine as failed with their reason, and make the new reads the public baseline in one commit, with
  the scoreboard's before and after (R2) and every public number re-cited from it (R13).
- Why not now: it moves the baseline every public claim cites; David decides when.

