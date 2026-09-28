PLAN.md on counter-core prevails over this file.
# STATE

Written 28 September 2026 from PLAN.md and git at counter-core bf50199, and from GitHub (git ls-remote, GitHub Actions).
A line marked (unconfirmed) could not be confirmed from the repository or from GitHub.

Current phase: "Lifts for the public" in PLAN.md (20 patterns, 155 sets to film), with lifts offered early under "LIFT TIERS" (28 September). Accuracy work runs on counter-core; its last step, "Count the set, not the clip" (bf50199), is not a step named in PLAN.md.
Last known-good commit: b4c28b9, the last commit David approved on his phone (PLAN.md: approved on 28 September on the preview built from b4c28b9).
Live commit: b4c28b9 on main (git ls-remote: refs/heads/main b4c28b95a4f9). GitHub Pages deploy run 305 on b4c28b9 concluded "success" (GitHub Actions, 28 September 2026, 06:41 UTC).
Working branch: counter-core at bf50199, two commits ahead of main: 372c877 (the record of the b4c28b9 approval) and bf50199 (count the set, not the clip). CI run 138 on bf50199 concluded "success" (GitHub Actions, 28 September 2026).
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
Next step: the next counting step, on branch range-from-rest (GitHub: refs/heads/range-from-rest 16faae5), once its review is complete. Its content and whether its review is complete: (unconfirmed).
Tester criteria (Phase 7): (unconfirmed); PLAN.md does not define them.
