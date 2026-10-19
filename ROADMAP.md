PLAN.md on counter-core prevails over this file.
# ROADMAP

The order of work, ranked (David, 18 October 2026: "Go", in reply to "one ranked roadmap of ten items replacing the backlog as the driver").
BACKLOG.md keeps every idea with its date (R7); this file decides which one is worked on next.
Work takes the first item not blocked; an item leaves this list when its gate passes, and the next idea from BACKLOG.md takes its rank only by David's decision.
Each item carries its measure (what proves it, R3), its gate (what it must not break, R2) and what it waits on.

Written 18 October 2026, on main at 1f42e60.
Scoreboard of that day: stored real-phone sets 12 of 15 exact, real video 8 of 16, public 454 of 949 deciding, synthetic 74 of 96, none newly off by 3 or more (test/real-phone/accuracy/scoreboard.txt, public-scoreboard.txt).

## 1. Right when it says it is sure (R16)

R16 defines accuracy as being right whenever the app says it is sure, saying so when it is not, and being sure more often each month.
No scoreboard line measures it today: the sensitivity check's sure and unsure counts exist only in the stability study of 10 October (stability.txt: wrong counts shown as sure 45 -> 14 on six encodings).
- Build: a headline line on every scoreboard, stored, video and public: of the sets the app shows as sure, how many are exact, off by 1 or 2, off by 3 or more; and the share shown as sure.
- Measure: the line itself, dated; the monthly series starts with it.
- Gate: no count moves (the line is a measure).
- Waits on: nothing.

## 2. The lat pulldown's first rep

IMG_2135_2 (18 October, label 11) reads 10: the first rep, cut at the head of the video, is not counted.
- Measure: the scoreboard before and after, per clip (R2); the public sets' head reps on every lift.
- Gate: R2; synthetic 74 of 96 not lower; TRIED.md's head rules of 3 October and the opening-hold rule of 6 October are read first (R14).
- Waits on: nothing.
- Measured 18 October 2026 (TRIED.md): the pull is one sample at the working end at the video's start; no head share counts it without losing public sets (0.3 and 0.2 lose on half B and put a RepCount set off by 3). Left open: asking instead of counting when a video opens at the working end, measured first on the public sets.

## 3. A steadier skeleton on the replay

David's request, still open: a steadier skeleton.
The skeleton drawn on the replay is smoothed for the eye only; the count reads its own signal, unchanged.
- Measure: frame-to-frame jitter of the drawn joints on David's 18 videos, before and after, and the lag it adds at a rep's turn (both printed by a script).
- Gate: no count moves (the counting path is not touched); the tour and the replay tests stay green.
- Waits on: David's look on his iPhone.

## 4. Still SVG figures for every exercise

The 309 animated figures of 18 October are drawn on a canvas; a still SVG of each, from the same pose data, would serve the list's thumbnails, the printed report and any document.
- Measure: one SVG per exercise of the list (183), checked by script for size and bounds.
- Gate: the tour, the list at 320 px, the service worker's size.
- Waits on: David's answer that he wants them (asked 18 October).

## 5. The presses and the lateral raise to Beta

Bench press, overhead press and lateral raise stay Experimental; PLAN.md forbids counting work on the presses until David films new press sets.
- Measure: tiers.test.ts on David's new sets.
- Gate: R2; the evidence rule of tiers.
- Waits on: David's press sets (four each, filmed as the app shows, counted by him).

## 6. The exam

PLAN.md: a lift is offered as proven only once it counts every exam set exactly; no exam set exists yet.
- Measure: the exam script's single run per lift.
- Gate: PLAN.md's exam rule.
- Waits on: David's exam sets (test/real-phone/exam/README.md).

## 7. The result screen, one number

BACKLOG.md, 11 October: one number at monumental scale, nothing before the person confirms or corrects, no number when the app is not sure.
- Measure: the share of results kept against corrected in the usage counts (result_kept, result_corrected, feedback-worker/usage-schema.js), before and after.
- Gate: the tour at every size; the approved prototype unless David approves the change.
- Waits on: David's approval of a mock-up on his iPhone, and the French copy (R10).

## 8. A guided first run

Martin, 15 October: most people skip instructions.
One short sequence on the first visit: where to put the phone, what must be in the frame, the first set.
- Measure: the share of sets refused (analysis_refused in the usage counts), before and after; the usage counts do not tell a first set from the others today.
- Gate: the tour; R8.
- Waits on: the French copy (R10).

## 9. The physiotherapist's tolerances

Olivier, 15 October: references 2 and 3 filmed again from an angle the pose model reads; the patient's attempts measured against references 1 and 4; the tolerances set with him (experimental, UNSOURCED today).
- Measure: Olivier's own judgment of each attempt against the app's verdict (R16's named reference for physiotherapy).
- Gate: R8, R9.
- Waits on: Olivier's new references and his judgments.

## 10. Partial reps

David, 9 October: count the reps that do not reach the set's working range, beside the full ones.
- Measure: sets with partials counted by David, blind (R1).
- Gate: R2 on the full count, which must not move.
- Waits on: David's labelled sets with partials.

## Watched, not ranked

- Dense4D (Imperial College London, seen by David on 18 October; BACKLOG.md): its code is not released.
- The phone's own chips: WebGPU and a native iOS read (BACKLOG.md, 9 October; docs/IPHONE-CHIPS.md).
- The public sets re-read with today's pose path (BACKLOG.md, 10 October): it moves the baseline every public claim cites; David decides when.
