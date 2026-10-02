# Backlog

New ideas wait here, dated, until David opens them as a step (CLAUDE.md R7).

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
- Online coaches (Luc): the client films, the coach receives one report per week (29 September entry).
- Pivots worth testing with one real user each before any code: home-exercise adherence for kinés; team
  logging for S&C coaches; a privacy-first set logger for women who train alone.

## 2 October 2026: remove the dormant code (Astra's audit, FINDING-035), David's decision

`node scripts/unreachable.mjs` lists the source files no page of the app loads: on 2 October, 92 of 188 (non-test),
among them the old upload, replay, coach report, injury, badge and feedback screens, and the old counters
(SignalExtractor3D, valleyCounter, repCounter, hysteresisCounter). None reaches the bundle; 14 test files still
test them (src/lib/__tests__/benchmark, biomechanics, coach, defense, exerciseDetector, hierarchicalDetector,
hierarchicalValidation, pipeline, progressionScale, utils; counting hotfix_baseline and learned;
test/real-phone/accuracy/learned-span, agreement/counts), so a green test run says less about the app than its size suggests.

App.jsx says "Hidden, not deleted". Proposal: delete what David does not mean to bring back, keep the learned
counter (research, PLAN.md), and run the script in CI so a file no page loads is named. Nothing is deleted until
David chooses.
