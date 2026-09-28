# Step: count the set, not the clip

Base: counter-core at c3681b8.
Files: branch count-the-set-files on GitHub, one commit on c3681b8, for transfer only.
It holds each file at its path in the repository, and transfer/count-the-set/MANIFEST.txt gives the sha256 of every file.
Take each file from that branch with git checkout origin/count-the-set-files -- <path>, in the order below.
Check them with git show origin/count-the-set-files:transfer/count-the-set/MANIFEST.txt | sha256sum -c -
Apply the files exactly as they are, and do not retype any number from them.
Do not merge the branch, do not commit the transfer folder, and do not delete the branch.

## Why

The filming screen asks for one set, then stop recording.
A phone clip therefore also holds walking in, picking the weights up and putting them down.
MM-Fit's labelled segments start and end on the set itself, so our MM-Fit results never measured this.
Claude replayed the counter on MM-Fit's own 3D poses, which cover whole sessions, with 3 s and 6 s either side of each admitted set.
The results are in test/real-phone/mmfit-context/table.md, produced on my Mac by scripts/mmfit-context.mts.
Three mechanisms account for most of the loss.
Each is now a synthetic test in src/lib/counting/__tests__/context.test.ts that fails on c3681b8.

1. An excursion that leaves the rest and comes back without reaching the working threshold leaves the rep open from that point. A small move more than 8 s before the first rep then makes the first rep too long, and it is discarded.
2. The thresholds are percentiles of every sample. A long hold outside the set, such as the arms hanging before an overhead press, moves them past the lockouts.
3. The elbow is as straight with the arms hanging as at lockout. Lowering the weights to the sides after an overhead press counts as a rep.

## What changes in src/lib/counting/core.ts

1. In detectReps, an excursion that returns to the rest without reaching the working threshold ends there, and the state machine waits for the next departure. No parameter.
2. The percentiles are taken over the clip less its still head and tail: the samples before the angle first moves MIN_ROM_DEGREES from where the clip starts, and after it last moves that much from where it ends. No new parameter.
3. LIFTS.overhead_press gains lockoutOverhead. A return to the rest angle counts as a rep only when the wrist is above the shoulder in world coordinates, read from the nearest sample within BRIDGE_GAP_SEC where both are seen. No parameter.

The synthetic press tests in core.test.ts drew a hanging arm, which no press has.
They now draw a press arm, pressFrame in synthetic.ts, with the same angles and the same expectations.
The known failure stays it.fails.

## Order of work

1. Take the three test files first, with core.ts unchanged: src/lib/counting/__tests__/context.test.ts, core.test.ts and synthetic.ts. Run the counting tests.
   The first three tests of context.test.ts must fail, reading 9, 0 and 11.
   Nothing else may change.
   Keep that output for the STOP report.
2. Take src/lib/counting/core.ts.
   Its sha256 must be d5dafb6eee3f627d860204fa9c18d4554ce09611db6d7b326d299f5e12f116d1, the file the evidence was produced from.
3. Run lint, typecheck, the unit tests and the build.
   All must pass.
4. Take scripts/mmfit-context.mts, test/real-phone/mmfit-context/results.json and test/real-phone/mmfit-context/table.md.
   The manifest check must then pass for all seven files.
   The script runs only on my Mac, where MM-Fit is kept.
   Do not run it.
5. Reviewer, with this goal only: "Count the reps of the set, not the moves around it that a phone clip also holds."
   Fix each finding with a test that fails first, or list it as open.
6. Commit, staging each file by path, then push.
7. Verifier, with the step name, the commit range, and the folders test/real-phone/mmfit-context and src/lib/counting.
8. STOP report: the fail-first output, the verifier's table and verdict unchanged, and the table that core.test.ts prints for my five clips.

## What the evidence shows, for the reviewer

On the 237 admitted sets with 3 s either side, exact counts rise from 167 to 218.
With 6 s either side, they rise from 136 to 166.
On the exact cuts with MediaPipe, they fall from 190 to 185.
The overhead press accounts for that fall, from 49 to 43, and dumbbell rows gain one set.
The fall comes entirely from change 3, as the middle core in table.md shows.
In each of those overhead press sets, the segment starts after the first press has begun, so that press is lost.
The unchanged counter counted the lowering at the end of the segment in its place.
Change 3 stops counting that lowering.
On my five clips, only the bench press moves, from 2 to 3 of 7.
The overhead press stays at 9 of 10.

## Out of scope

- Rep 9 of my overhead press clip went about 70 % as deep as the others. Whether such a rep counts is my decision, and it is not part of this step.
- The bench press may need the same lockout check. That waits for its build sets.
- With 6 s either side, the overhead press still reaches only 18 of 60. The next step addresses it.
- The same MM-Fit run through the app's own pose pipeline, with context, follows on my Mac.
