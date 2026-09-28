# Step: count the set, not the clip (second version)

Base: counter-core at c3681b8.
Files: branch count-the-set-files at its head, one commit after 91cc462, for transfer only.
It holds each file at its path in the repository, and transfer/count-the-set/MANIFEST.txt gives the sha256 of every file.
Fetch it with git fetch origin count-the-set-files:refs/remotes/origin/count-the-set-files
Take each file with git checkout origin/count-the-set-files -- <path>, in the order below.
Check them with git show origin/count-the-set-files:transfer/count-the-set/MANIFEST.txt | sha256sum -c -
Apply the files exactly as they are, and do not retype any number from them.
Do not merge the branch, do not commit the transfer folder, and do not delete the branch.

## What changed since the first version

The reviewer was right.
With 6 s either side, six overhead press sets became off by 3 or more.
The cause was the second change of the first version.
Taking the clip less its still head and tail kept the arms hanging after the set whenever the clip ended on another move, and that lifted the thresholds above real lockouts.
The second change is now narrower, and it applies to the overhead press only.
Every other lift keeps its thresholds exactly as at c3681b8.
A new test in context.test.ts models the finding: the arms hang after the press, then another move comes before the clip ends.
It fails on c3681b8 and on the first version, reading 0 on both, and passes now.
With this version, no admitted set becomes off by 3 or more in any column of table.md, which now counts those sets.

## Why

The filming screen asks for one set, then stop recording.
A phone clip therefore also holds walking in, picking the weights up and putting them down.
MM-Fit's labelled segments start and end on the set itself, so our MM-Fit results never measured this.
Claude replayed the counter on MM-Fit's own 3D poses, which cover whole sessions, with 3 s and 6 s either side of each admitted set.
The results are in test/real-phone/mmfit-context/table.md, produced on my Mac by scripts/mmfit-context.mts.
Each mechanism below is a synthetic test in src/lib/counting/__tests__/context.test.ts that fails on c3681b8.

1. An excursion that leaves the rest and comes back without reaching the working threshold leaves the rep open from that point. A small move more than 8 s before the first rep then makes the first rep too long, and it is discarded.
2. The thresholds are percentiles of every sample. Arms hanging before, after or between the moves of an overhead press lift them past the lockouts.
3. The elbow is as straight with the arms hanging as at lockout. Lowering the weights to the sides after an overhead press counts as a rep.

## What changes in src/lib/counting/core.ts

1. In detectReps, an excursion that returns to the rest without reaching the working threshold ends there, and the state machine waits for the next departure. No parameter.
2. For a lift that locks out overhead, the percentiles are taken over the samples with the wrist above the shoulder, wherever the arms hang in the clip. No parameter.
3. LIFTS.overhead_press gains lockoutOverhead. A return to the rest angle counts as a rep only when the wrist is above the shoulder in world coordinates, read from the nearest sample within BRIDGE_GAP_SEC where both are seen. No parameter.

The synthetic press tests in core.test.ts drew a hanging arm, which no press has.
They now draw a press arm, pressFrame in synthetic.ts, with the same angles and the same expectations.
The known failure stays it.fails.

## Order of work

1. Take all seven files again from the branch head, over the first version's files.
   Run the manifest check: all seven must match.
2. Fail first, in a separate worktree at c3681b8, never a stash.
   Take the three test files there and run the counting tests.
   The first four tests of context.test.ts must fail, reading 9, 0, 11 and 0, and nothing else may change.
   Then take core.ts from 91cc462, the first version, into that worktree.
   The fourth test must fail, reading 0, and the other six must pass.
   Keep both outputs for the STOP report.
3. In the working tree, core.ts must have sha256 4430a351f9460e574fc501ea24f8b17632b5669825b991a61166b59627a874f4, the file the evidence was produced from.
   Run lint, typecheck, the unit tests and the build.
   All must pass.
4. The script scripts/mmfit-context.mts runs only on my Mac, where MM-Fit is kept.
   Do not run it.
5. Reviewer, with this goal only: "Count the reps of the set, not the moves around it that a phone clip also holds."
   Fix each finding with a test that fails first, or list it as open.
6. Commit, staging each file by path, then push.
7. Verifier, with the step name, the commit range, and the folders test/real-phone/mmfit-context and src/lib/counting.
8. STOP report: both fail-first outputs, the verifier's table and verdict unchanged, and the table that core.test.ts prints for my five clips.

## What the evidence shows, for the reviewer

table.md compares three cores: c3681b8, the first version and this one.
On the 237 admitted sets with 3 s either side, exact counts rise from 167 to 225.
With 6 s either side, they rise from 136 to 198.
Sets off by 3 or more fall from 32 to 4 with 3 s, and from 46 to 7 with 6 s, and no set becomes off by 3 or more in any column.
The overhead press goes from 2 of 60 to 57 with 3 s, and from 2 to 56 with 6 s.
On the exact cuts with MediaPipe, exact counts fall from 190 to 184, all of it the overhead press, from 49 to 43, and all of it change 3.
In each of those sets, the segment starts after the first press has begun, so that press is lost.
The unchanged counter counted the lowering at the end of the segment in its place, and change 3 stops counting that lowering.
Measured apart from table.md, changes 2 and 3 work only together.
Without change 3, the overhead press with context counts the lowering after the set, one over in 59 of 60 sets.
On my five clips, only the bench press moves, from 2 to 3 of 7.
The other four keep their counts, and only the overhead press clip's thresholds move, by less than one degree.

## Out of scope

- Rep 9 of my overhead press clip went about 70 % as deep as the others. Whether such a rep counts is my decision, and it is not part of this step.
- The bench press may need the same lockout check. That waits for its build sets.
- With 6 s either side, the alternating curl still counts 13 sets over. The moves around the set that look like a curl are the next step.
- The same MM-Fit run through the app's own pose pipeline, with context, follows on my Mac.
