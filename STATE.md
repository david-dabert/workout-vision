PLAN.md on counter-core prevails over this file.
# STATE

Written 30 September 2026 from PLAN.md and git at claude/generate-architecture-md-inw479 0968d2e, and from GitHub (git ls-remote, GitHub Actions).
A line marked (unconfirmed) could not be confirmed from the repository or from GitHub.

Current phase: accuracy (unconfirmed: PLAN.md names no such phase; its last steps are GROWTH 1 to 5 and David's orders of 30 September). The work runs without waiting on David's other session (PLAN.md, David's second message of 30 September). Waiting on David: the exam sets, filmed from rest back to rest with the batch collector (test/real-phone/exam/README.md); with them, the fourteen blind counts of test/real-phone/accuracy/label-watch.txt and his test of the batch collector (PLAN.md, third message of 30 September). Bench press and overhead press stay offered as Experimental; no counting work on either until David films new press sets.
Last known-good commit: 84e020a, approved by David on his iPhone on 30 September (PLAN.md).
Live commit: 84e020a on main (git ls-remote: refs/heads/main 84e020a000e7). GitHub Pages deploy run 314 on 84e020a concluded "success" (GitHub Actions, 30 September 2026, 10:17 UTC). CI run 197 on 84e020a (push to main) was in progress when this was written; CI run 193 on 84e020a (pull request) concluded "success" at 09:33 UTC.
Working branch: claude/generate-architecture-md-inw479; counter-core at 24f89fa (git ls-remote), moved there by David's order of 30 September. At 0968d2e the branch was ahead of counter-core by 2007ebb, 0d00186 and 0968d2e (PLAN.md records and evidence), and then by the commit of this file.
Preview: https://workout-vision-next.vercel.app, built by David's other session; it does not rebuild on a push (PLAN.md).
Scoreboard (30 September 2026): of the 14 labelled build sets, 7 exact, 6 off by 1 or 2, 1 refused (landmarks/bench_press angle, where the core alone counts 3 for 7) (npm run scoreboard; test/real-phone/accuracy/scoreboard.txt). No exam set yet. The counting core is unchanged since e84ab32.
Offered: 181 exercises (e2e/collect.spec.js). Tiers (src/lib/liftTiers.js): Beta: lateral raise, biceps curl, lat pulldown, squat. Experimental: bench press, hip thrust, Romanian deadlift, leg press, overhead press. None has passed an exam.
Sub-agents: wv-reviewer, wv-verifier and wv-control (.claude/agents/), whose briefs change only by David's order.
French register: the screens use "vous". Whether David has decided it: (unconfirmed).

Open problems:
- Diagnosis of 30 September (test/real-phone/accuracy/diagnosis.txt): the misses on David's sets are at the edges of the video, a set starting or ending inside a rep, and in the presses. Three edge rules were tried and withdrawn at review, each counting a movement before or after the set; edges.test.ts pins the current behaviour.
- The batch collector remembers only the next set number across a reload; a video collected twice across a reload is not caught on the page.
- Step 3d was approved on 28 September (PLAN.md). Its open item: the count of 4 for a lateral raise of 10 on the 3d preview remains unexplained. index.html still allows 'unsafe-eval'; the other CDN hosts are gone from its policy, and the demuxer's log lines go to console.info with a [demuxer] prefix (src/lib/frameExtractor.js). Whether the Chrome inference item of 3d was completed: (unconfirmed).
- The verifier's verdict on bf50199 was FAIL, on R1 and R2 (the work also sits on the session branch claude/generate-architecture-md-inw479, and the repository is not at ~/Developer/workout-vision), R12 and M1 (test/real-phone/mmfit-context omits the 257 excluded MM-Fit sets that name a lift), and R17 (a git stash run during the step). They await David's decision. (unconfirmed: the verdict is in the session's STOP report, not in the repository or on GitHub.) bf50199 has since shipped: it is an ancestor of main, which David approved at e84ab32 and 84e020a.
- Listed as open in bf50199: the rep reset also resets the rep's peak, so a genuine rep of a noisy set of about 22 to 30° can fail the minimum range check; the three it.fails tests for the overhead press with context in src/lib/counting/__tests__/context.test.ts.
- PLAN.md still says the bench press counts 2 for 7 on the current core. The core counts 3 for 7 on the build clip, and the app refuses it (scoreboard of 30 September).
- e2e/core-app.spec.js has never run with a clip in this environment: the clips are git-ignored.
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
Next step: the exam sets from David (PLAN.md, third message of 30 September); until then, work that needs neither his iPhone nor his approval.
