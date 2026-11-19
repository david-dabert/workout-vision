# Card 063, track C: the plan, written before any render is read (19 November 2026, Claude)

This file is committed before `analyse.mjs` reads any render; its commit is the pre-registration.

## The question
Does the kiné comparison (`src/lib/reference/compare.js`, as the app ships it) say « À revoir » on a repetition with a known fault, and « Conforme » on a correct one?

## The renders (`matrix.mjs`; the renderer is `test/real-phone/synth/synth.js`)
- Bodies: Michelle and Soldier (three.js examples, Mixamo rigs). Exercises: bicep curl, lateral raise, overhead press, squat, at their synthetic peaks (130, 90, 170, 100 degrees), both sides equal. Views: front (0) and 30 degrees. That is 16 cells.
- Per cell, 3 repetitions each:
  - one reference;
  - two correct attempts (other seeds: the renderer's jitter of phases and amplitude);
  - one attempt per planted fault:
    1. `range70`: both peaks at 70 %;
    2. `lateRight`: the right side 0.5 s behind the left;
    3. `lean20`: the trunk leaning 20 degrees about the shoulders' axis;
    4. `pause2s`: each repetition held 2 s longer at its working end.
- Every frame goes through the app's own pose detection; the comparison reads the world landmarks, with its default options (arms and hips; no legs).

## Fixed now
- Verdict: `compareAttempt(buildReference(reference), attempt)`; `revise` = « À revoir », `match` = « Conforme », `refused` = no verdict, reported apart.
- False alarms: « À revoir » on the 32 correct attempts. Pass: at most 5 % of the judged correct attempts (the card, UNSOURCED).
- A fault is found when its attempt reads « À revoir ». Pass for a fault: found on at least 90 % of its judged attempts (UNSOURCED, fixed now).
- Track C passes when the false-alarm bar and every fault's bar pass. Each result is reported per fault, per exercise and per view, pass or fail.

## Limits, said before the result
- Synthetic bodies are not people and these faults are cartoons of real ones.
- A pass shows that the comparison sees faults of these sizes in clean conditions; it says nothing of a physiotherapist's agreement, which track A measures.
- A fault the comparison does not read by design (the trunk alone, when no measured joint moves with it) failing is a result, not an error.
