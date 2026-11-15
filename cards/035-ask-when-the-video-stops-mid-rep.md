# Card 035: Ask when the video stops on a rise the count left out

Status: built on `claude/counter-accuracy`; the question shows on David's #collecte phone only, until his product choice (below)
Lane: careful
Owner: Claude
Created: 2026-11-15

## Goal
R16: the app is right whenever it says it is sure. On the public deciding sets the app showed as sure, 227 of 608 were wrong (public scoreboard of 15 November 2026, `main` `6bc1355f`).

## Change
- `src/lib/coreAnalysis.js` `summarizeCount`: `tailOpen` marks a set whose video stops inside a rise from rest past the working threshold, after the last counted rep, that the count left out (`fitness-tests.js` `openRise`, unchanged), still past halfway on the last seen sample, read on each side of a both-sides lift. No count changes.
- `src/components/experience/Result.jsx`: on the #collecte phone, such a set is asked, with its cause (`result-copy.js` `endMidRepCause`: « Un mouvement en fin de vidéo n’a pas été compté : vérifiez le nombre. »). Every other phone shows the screen as before.
- `test/real-phone/accuracy/sure.ts`: the shipped line is unchanged; a second line measures the question.
- Tests written first and failing before the change: `src/lib/counting/__tests__/tail-open.test.ts` (5 cases), `src/components/experience/__tests__/result-tail-open.test.jsx` (4 cases).
- Reviewer (wv-reviewer, 15 November 2026): five findings, each fixed with a failing test or written here. Open: the overhead press rests at lockout, so lowering the dumbbells after the set is marked (MM-Fit: 11 marked, 10 exact); live sets (off in production) say « vidéo »; `openRise` spreads every sample into `Math.min`, a risk above about 72 minutes of video, unchecked on a device; result-choices.js records state 'counted' for an asked set, as for headRefused and doubt.

## Eval (pasted from the runs of 15 November 2026)
- Counts: public 478 of 949 deciding exact before and after, 0 newly off by 3; David's 13 of 15 before and after.
- Right when sure, public, with the question: shown as sure 608, 381 exact (63%), 5 off by 3+ -> 511, 360 exact (70%), 3 off by 3+. The 97 marked sets: 21 exact.
- Right when sure, public whole sets (full-sets.txt, primary subset): 117, 93 exact (79%), 3 off by 3+ -> 114, 92 exact (81%), 2 off by 3+.
- Right when sure, David's 15 deciding sets: 11, 9 exact (82%) -> 9, 7 exact (78%): two exact hip thrusts that end with a movement after the set are asked.

## Product choice for David
On public video, 76 wrong counts shown as sure become a question. On David's own sets, 2 exact counts become a question and no error is caught. Open it to every phone, or keep it on #collecte.
