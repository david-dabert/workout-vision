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
