PLAN.md on counter-core prevails over this file.
# STATE

Written 28 September 2026 from PLAN.md and git at counter-core bf50199, and from GitHub (git ls-remote, GitHub Actions); the parking of range-from-rest added the same day, at 9263810.
A line marked (unconfirmed) could not be confirmed from the repository or from GitHub.

Current phase: "Lifts for the public" in PLAN.md (20 patterns, 155 sets to film), with lifts offered early under "LIFT TIERS" (28 September). Accuracy work runs on counter-core; its last step, "Count the set, not the clip" (bf50199), is not a step named in PLAN.md.
Last known-good commit: b4c28b9, the last commit David approved on his phone (PLAN.md: approved on 28 September on the preview built from b4c28b9).
Live commit: b4c28b9 on main (git ls-remote: refs/heads/main b4c28b95a4f9). GitHub Pages deploy run 305 on b4c28b9 concluded "success" (GitHub Actions, 28 September 2026, 06:41 UTC).
Working branch: counter-core, ahead of main by 372c877 (the record of the b4c28b9 approval), bf50199 (count the set, not the clip), 9263810 (this file) and the commit recording the parking below. CI run 138 on bf50199 concluded "success" (GitHub Actions, 28 September 2026). The counting core on counter-core is bf50199's (src/lib/counting/core.ts, sha256 5514f77b2b57).
Preview: https://workout-vision-next.vercel.app, rebuilt by David after each push (PLAN.md step 4). Commit it currently serves: (unconfirmed).
Scoreboard (date): none. No scoreboard script exists (CLAUDE.md R2). The nearest measures are David's five build clips through src/lib/counting/__tests__/core.test.ts at bf50199 (bench press 3 of 7, curl 7, lat pulldown 10, lateral raise 10, overhead press 9 of 10), and MM-Fit in test/real-phone/mmfit/results.json and test/real-phone/mmfit-context/table.md. No Countix figure is in the repository.
Launch lifts: nine, by tier (src/lib/liftTiers.js, PLAN.md "LIFT TIERS"). Beta: lateral raise, biceps curl, lat pulldown, squat. Experimental: bench press, hip thrust, Romanian deadlift, leg press, overhead press. None has passed an exam: test/real-phone/exam/ does not exist.
French register: the screens use "vous" (for example "Choisissez", "Analysé sur votre téléphone"). Whether David has decided it: (unconfirmed); DIRECTIVES.md and CLAUDE.md leave it to him.
Open problems:
- Step 3d was approved on 28 September (PLAN.md). Its open item: the count of 4 for a lateral raise of 10 on the 3d preview remains unexplained. index.html still allows 'unsafe-eval'; the other CDN hosts are gone from its policy, and the demuxer's log lines go to console.info with a [demuxer] prefix (src/lib/frameExtractor.js). Whether the Chrome inference item of 3d was completed: (unconfirmed).
- The verifier's verdict on bf50199 was FAIL, on R1 and R2 (the work also sits on the session branch claude/generate-architecture-md-inw479, and the repository is not at ~/Developer/workout-vision), R12 and M1 (test/real-phone/mmfit-context omits the 257 excluded MM-Fit sets that name a lift), and R17 (a git stash run during the step). They await David's decision. (unconfirmed: the verdict is in the session's STOP report, not in the repository or on GitHub.)
- Listed as open in bf50199: the rep reset also resets the rep's peak, so a genuine rep of a noisy set of about 22 to 30° can fail the minimum range check; the three it.fails tests for the overhead press with context in src/lib/counting/__tests__/context.test.ts.
- PLAN.md still says the bench press counts 2 for 7 on the current core; at bf50199 it counts 3.
- README.md still says the app counts three lifts and no other, from before the tiers; e2e/core-app.spec.js has never run with a clip in this environment: the clips are git-ignored.
Parked, by David's decision of 28 September 2026: "a rep's range is measured from its rest". bf50199's rule stays on counter-core; none of the step's files is committed there.
- Files: branch range-from-rest at 6f3b871 (GitHub: refs/heads/range-from-rest 6f3b87159366), second version of its work order, core.ts sha256 00c852b84fe9.
- Its reviewers' two tests: branch range-from-rest-review at 3b87772 (GitHub: refs/heads/range-from-rest-review 3b87772692af), on range-from-rest, in src/lib/counting/__tests__/min-range.test.ts.
  - First version's reviewer: an 18° partial 3 s into the clip, after the dumbbells are held 10° out and 0.1 s at rest, counted 7 for 6 on core 4d9f897e. Fixed in 00c852b8, which counts 6, as bf50199 does.
  - Second version's reviewer, open: an 18° partial after the arm hung 12° fuller and the pose was lost 0.5 s while it came back counts 7 for 6 on 00c852b8, for curl and lateral raise; bf50199 counts 6. The rest window reaches back across a pose dropout and counts the values the bridge fills in as rest. The test fails on that branch by design.
- Its seven known limits, the it.fails tests of min-range.test.ts on that branch, by name:
  - "the first test's sets with reps that turn within one sample count every rep, over 200 seeds" (such a rep reads 2° to 4° short);
  - "noisy partials of 18° held at the top after six 25° reps do not count, over 200 seeds";
  - "noisy partials of 18° after 2 s held 3.5°, 5° or 8° fuller than the rest, then 0.5 s back at it, do not count, over 200 seeds";
  - "an 18° partial after 2 s held 8° fuller than the rest, then only 0.2 s back at it, does not count";
  - "ten 21° curls and ten 21° raises moving 3.5 s each way into 1.5 s rests count 10";
  - "noisy slow curls and raises of 21.5°, moving 2 to 4 s each way, count every rep, over 200 seeds";
  - "ten 22° curls that turn at the rest without pausing, 0.8 s each way, count 10".
  Also open on that branch: no MM-Fit table measures its core, and the committed test/real-phone/mmfit-context/ predates the corrected script.
- Condition for its return: real sets show reps of 20 to 30° that bf50199 misses, from MM-Fit on David's Mac, David's own clips or the exam.
Next step: (unconfirmed); none is named in PLAN.md or on GitHub after the parking.
Tester criteria (Phase 7): (unconfirmed); PLAN.md does not define them.
