# The exam: what to film

A lift is offered as reliable only once it counts right on sets it has never seen (PLAN.md). These are
those sets. Four per lift, each counted exactly, or the lift fails and a new exam is filmed after the fix.

## First: the four lifts on offer as Beta

Curl, lateral raise, lat pulldown, squat. Four sets each: 16 sets.

## How to film each set

1. The phone as the app's filming screen shows for that lift (side or front), steady, the whole body or
   head to hips in the frame as it says.
2. Start recording at rest, before the first rep. Stop once the last rep is back at rest.
3. Vary what a real session varies: 6 to 15 reps, a lighter and a heavier set, one set taken close to
   failure (slower, shallower last reps), one with a short pause mid-set.
4. Count the reps as a coach would, out loud or on a note, while filming. That count is the label.

## How to hand them over

Open the batch collector (collect-batch.html), pick the session's videos, and for each set choose the
lift and the view and enter your count; then collect, and share the files. Each is a .json.gz file of
landmarks only; no video leaves the phone. A label counts the reps the video shows whole, from rest back
to rest (PLAN.md, 30 September). The files are placed by their names alone, unopened, and the import
stops if a name cannot be read or one video comes twice, here or already in a sets- folder or the exam.
The five build clips of 25 September (test/real-phone/landmarks/) carry no fingerprint: never use those
videos for the exam.

    node scripts/import-sets.mjs <folder of the files> --exam --write

Only the exam script reads them:

    EXAM=1 npx vitest run test/real-phone/exam/exam.test.ts

The result is written to exam-result.txt, with its date. Nothing is tuned on these sets.
