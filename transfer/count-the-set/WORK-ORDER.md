# Step: count the set, not the clip (third version)

Base: counter-core at c3681b8.
Files: branch count-the-set-files at its head, one commit after dfaa390, for transfer only.
It holds each file at its path in the repository, and transfer/count-the-set/MANIFEST.txt gives the sha256 of every file.
Fetch it with git fetch origin count-the-set-files:refs/remotes/origin/count-the-set-files
Take each file with git checkout origin/count-the-set-files -- <path>, in the order below.
Check them with git show origin/count-the-set-files:transfer/count-the-set/MANIFEST.txt | sha256sum -c -
Apply the files exactly as they are, and do not retype any number from them.
Do not merge the branch, do not commit the transfer folder, and do not delete the branch.

## What changed since the second version

The reviewer's two overhead press findings stand: a press whose wrist sits at the shoulder at the bottom, and one glitched wrist sample.
Both come from reading the arm's posture, which only the overhead press needed.
A third attempt at that rule could only be judged on MM-Fit's own poses.
Those place the arm poorly overhead: their lockouts read about 115°, while MediaPipe reads my lockouts at about 155°.
So this step keeps only the change that concerns every lift.
The overhead press gets its own step, judged on MediaPipe landmarks with context, which my Mac will produce.

## What changes in src/lib/counting/core.ts

One change, in detectReps.
An excursion that returns to the rest without reaching the working threshold ends there, and the state machine waits for the next departure.
Before, the rep stayed open from that point, so a small move more than 8 s before the first rep made the first rep too long, and it was discarded.
No parameter.

## The tests

In context.test.ts:
- The first test, "a small move long before the first rep does not cost the first rep", fails on c3681b8, reading 9, and passes now.
- Three it.fails tests record the overhead press's known failures with context. The overhead press step must turn them into passing tests.
- Five guards pass on c3681b8 and on this core. Two of them are press guards written from the second review's findings.

Add the reviewer's own two tests from the second review to context.test.ts as guards, unchanged.
They read 10 on c3681b8 and must read 10 on this core.
The overhead press step must keep them passing.

In core.test.ts and synthetic.ts, the synthetic presses draw a press arm, as in the first two versions, with the same angles and the same expectations.

## Order of work

1. Take all seven files again from the branch head, over the files you hold.
   Run the manifest check: all seven must match.
2. Fail first, in a separate worktree at c3681b8, never a stash.
   Take the three test files there and run the counting tests.
   The first test of context.test.ts must fail, reading 9, the three it.fails tests must count as expected failures, and everything else must pass.
   Keep that output for the STOP report.
3. In the working tree, core.ts must have sha256 5514f77b2b570a824e01d22425a29008d34ce8f2a36b5b3174394743f9f5d5d3, the file the evidence was produced from.
   Add the reviewer's two tests.
   Run lint, typecheck, the unit tests and the build.
   All must pass.
4. The script scripts/mmfit-context.mts runs only on my Mac, where MM-Fit is kept.
   Do not run it.
5. Reviewer, with this goal only: "A move that returns to rest without reaching the working end must not hold the next rep open."
   Fix each finding with a test that fails first, or list it as open.
6. Commit, staging each file by path, then push.
7. Verifier, with the step name, the commit range, and the folders test/real-phone/mmfit-context and src/lib/counting.
8. STOP report: the fail-first output, the verifier's table and verdict unchanged, and the table that core.test.ts prints for my five clips.

## What the evidence shows, for the reviewer

table.md compares c3681b8 and this core on the 237 admitted sets.
On the exact cuts, with MediaPipe and with MM-Fit's poses, no set changes.
With 3 s either side, 3 sets become exact and none is lost, from 167 to 170.
With 6 s either side, 12 sets become exact and 4 are lost, from 136 to 144.
The 4 are alternating curl sets, now one over.
Every real rep is counted in them, plus one curl-like move before or after the set.
At c3681b8 they were exact only because a lost first rep, or the joining of the two arms, cancelled that move.
Sets off by 3 or more fall from 32 to 30 with 3 s and from 46 to 44 with 6 s, and none is new in any column.
On my five clips, only the bench press moves, from 2 to 3 of 7, and every threshold is unchanged.

## Next

- The overhead press step: the three it.fails tests and the reviewer's two guards, judged on MediaPipe with context.
- The same MM-Fit run through the app's own pose pipeline, with context, on my Mac. The overhead press step needs it.
- Moves around the set that look like a curl: with 6 s either side, the alternating curl counts 13 sets over.
- Rep 9 of my overhead press clip: my decision.
