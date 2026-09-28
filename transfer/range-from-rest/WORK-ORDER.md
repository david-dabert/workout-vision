# Step: a rep's range is measured from its rest

Base: counter-core at 9263810.
Files: branch range-from-rest at its head, for transfer only.
It holds each file at its path in the repository, and transfer/range-from-rest/MANIFEST.txt gives the sha256 of the eight files to take.
Fetch it with git fetch origin range-from-rest:refs/remotes/origin/range-from-rest
Take each file listed in the manifest with git checkout origin/range-from-rest -- <path>.
Check them with git show origin/range-from-rest:transfer/range-from-rest/MANIFEST.txt | sha256sum -c -
Apply the files exactly as they are, and do not retype any number from them.
Do not take test/real-phone/range-from-rest/mmfit-context/: it replays an earlier core, and my Mac will replace it.
Do not merge the branch, do not commit the transfer folder, and do not delete the branch.

## Why

bf50199 checks the 20° minimum from the first sample past the rest threshold, a fifth of the set's range inside the rest.
With noise on the angle, real reps of 22 to 30° then read under 20° and are not counted.
On 6000 synthetic sets, bf50199 is right on 4775 and this core on 5365.
Sets off by 3 or more fall from 466 to 272.

## What changes in src/lib/counting/core.ts

One change, in detectReps.
A rep's range is measured from the level of the rest it left to the level of its working end.
The rest's level is the median of the last second of samples at rest before the rep, since the last cycle, or their fullest point when there is less than 0.3 s of them.
The working end's level is the mean of its most extreme third of a second of consecutive samples.
When the video starts less than 0.3 s before the first rep, the rest it comes back to stands in, over its first second, if it is fuller.
One new constant, REST_BEFORE_SEC at 1 s, status experimental, pinned from both sides by the tests.
How a counted rep's range is reported does not change.

## The tests

src/lib/counting/__tests__/min-range.test.ts is new, with 35 tests.
- The first 14 fail on bf50199; from the fourth on, each also pins a documented choice.
- The next 5 cover pauses at another level, noise and slow reps.
- The 9 guards pass on bf50199: partials that cross both thresholds must not count.
- The 7 it.fails tests are the known limits, listed at the head of the file and below.

## Order of work

1. Take the eight files from the branch head.
   Run the manifest check: all eight must match.
2. Fail first, in a separate worktree at 9263810, never a stash.
   Take min-range.test.ts only and run it with vitest.
   Expect 20 failures and 15 passes.
   The 20 are the first 19 tests and one it.fails test, "an 18° partial after 2 s held 8° fuller than the rest, then only 0.2 s back at it, does not count": bf50199 counts that partial right, so vitest reports that the test did not fail.
   Keep that output for the STOP report.
3. In the working tree, core.ts must have sha256 4d9f897e350a99a10c5f3e12c5536c24c12ec937f2bee16bffebe0e5c3ae5710, the file the evidence was produced from.
   Run lint, typecheck, the unit tests and the build.
   All must pass, and in min-range.test.ts the 28 tests pass while the 7 it.fails tests fail as expected.
   Where these files were written, the package registry was closed: the tests ran under bun, with it.fails turned into plain tests, and typecheck ran on the two counting files alone.
   Vitest, lint and the build run here for the first time.
4. Reproduce the evidence.
   Write the cores of bf50199, c3681b8 and d7f6e02 with git show <commit>:src/lib/counting/core.ts > /tmp/core-<commit>.ts.
   node scripts/range-curve.mts /tmp/core-bf50199.ts /tmp/core-c3681b8.ts src/lib/counting/core.ts must print curve.txt exactly.
   node scripts/rest-level.mts /tmp/core-bf50199.ts /tmp/core-d7f6e02.ts src/lib/counting/core.ts must print rest-level.txt exactly.
   Report any difference; do not replace either file.
   scripts/mmfit-context.mts runs only on my Mac, where MM-Fit is kept: do not run it.
5. Reviewer, with this goal only: "A rep counts only if it covers 20° from the level of the rest it left to the level of its working end."
   Fix each finding with a test that fails first, or list it as open.
6. Commit, staging each file by path, then push.
7. Verifier, with the step name, the commit range, and the folders test/real-phone/range-from-rest and src/lib/counting.
8. STOP report: the fail-first output, the verifier's table and verdict unchanged, the table that core.test.ts prints for my five clips, and the known limits below.

## Known limits, open

- A pause left less than a second before a rep still moves its rest: 0.2 s after 2 s held 8° fuller, an 18° partial measures 20.03° and counts.
- The rise out of a slow rep's rest can fill that last second: 21° reps moving 3.5 s each way measure 19.96° and none counts.
  With noise, sets of slow 21.5° reps miss a rep in about 40 % of cases.
- A partial held at the top reads a little long in noise: 18° partials held 1.5 s count in 3 to 7 sets of 200.
- A rep that turns within one sample reads 2° to 4° short.
- A turn at the rest without a pause is taken at its median: such 22° curls count 1 of 10.

The first two come from the sixth review and sit at the resolution of the measure.
d7f6e02, the draft before this one, counted both clean sets right.
With noise, it counted the partial after a 3.5° fuller pause in 18 to 22 % of sets, against 5 % here.

## What the evidence shows, for the reviewer

- curve.txt: 6000 synthetic sets.
  Right: 4775 on bf50199, 5365 on this core.
  Sets off by 3 or more: 466 and 272.
  Sets over-counted: 10 and 14.
- clips.txt: my five clips count identically to bf50199, rep by rep.
- rest-level.txt: pauses at another level and slow reps, against bf50199 and d7f6e02.
  bf50199 lets fewer partials through after a fuller pause, 3 to 5 sets of 200, because it measures every rep short.
  For the same reason it misses the 23° reps after a less full pause in 1464 to 1472 of 2400 sets, where this core misses none, and it misses slow reps up to 24°.
- MM-Fit: pending on my Mac.
  test/real-phone/range-from-rest/mmfit-context/ replays core 33300a79, an earlier draft, and is not evidence for this core.

## Next

- MM-Fit on my Mac: test/real-phone/mmfit-context/ again with the corrected script, as the verifier required of bf50199, and test/real-phone/range-from-rest/mmfit-context/ for this core.
- The browser test that failed on the first attempt of CI run 139, on 9263810: name it.
