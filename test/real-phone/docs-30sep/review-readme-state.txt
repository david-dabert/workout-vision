Review of the uncommitted README.md and STATE.md change on claude/generate-architecture-md-inw479. It changes only documentation, so the defects below are claims that do not match the code, the scoreboard or PLAN.md. I edited nothing.

DEFECTS

1. README.md line 10: the README says only nine of the 181 exercises carry a tier. The app actually labels all 181.
- The line reads: "Nine carry a tier (src/lib/liftTiers.js) ... The others are counted by their movement pattern (src/lib/guide-families.json)."
- In /home/user/workout-vision/src/lib/offer.js, `tierOf = key => TIERS[key] || (offered.has(key) ? 'experimental' : null)`. So the other 172 are Experimental.
- Result.jsx:471 shows the Experimental label on every one of those results, and ExerciseList.jsx:34 says so on screen: "Unless marked Beta, these exercises are experimental". PLAN.md GROWTH step 2 says the same: "Experimental all the others".
- A reader of the README would think 172 exercises are offered with no warning label. That is the opposite of what the app does.
- The cited path is also wrong. src/lib/guide-families.json does not exist; the file is src/lib/counting/guide-families.json, and the app counts from src/lib/counting/guide-patterns.json.
- Check that fails today: `ls src/lib/guide-families.json` returns "No such file". Any document test comparing the README's tier count with `OFFERED.filter(k => tierOf(k))` gets 181, not 9.

2. README.md line 27 and STATE.md line 13: the accuracy sentence leaves out the refused set, and that set is the one the counter gets badly wrong.
- Both say "of 14 sets, 7 counted exactly and none off by 3 or more". Readers will take this as 14 counts, with the other 7 within 2.
- In test/real-phone/accuracy/scoreboard.txt, landmarks/bench_press_7_angle_mufhcy60 is "refused". Only 6 sets are off by 1 or 2.
- scoreboard.test.ts:15 makes a refused set neither exact nor catastrophic.
- test/real-phone/accuracy/diagnosis.txt:58 shows the counting core itself gives 3 for 7 on that set (OFF -4). "None off by 3 or more" is true only because the refusal hides it.
- The figures come from the scoreboard, as R13 requires, but the sentence says more than it does. Fix: "7 exact, 6 off by 1 or 2, 1 refused (no count shown)".
- Check that fails today: take the scoreboard's rows as source; exact + off-by-1-or-2 + refused must equal 14. The README accounts for only 7 plus an unstated remainder.

3. STATE.md: several lines are stale, against the goal that no state line is stale.
- Line 21: "PLAN.md still says the bench press counts 2 for 7 on the current core; at bf50199 it counts 3." The current scoreboard (core unchanged since e84ab32) refuses this set. The line should state the current behaviour: the core counts 3, the app refuses.
- Line 19: the verifier's FAIL on bf50199 is said to "await David's decision". bf50199 is now an ancestor of main (`git merge-base --is-ancestor bf50199 84e020a` succeeds). David has approved main twice since (e84ab32 and 84e020a, PLAN.md lines 239 onward and 297). The line needs updating, or at least a note that the work has shipped.
- Line 38: "Next step: (unconfirmed); none is named in PLAN.md or on GitHub after the parking." It contradicts line 7 of the same file, which names what is waiting (the exam sets, the fourteen blind counts, the collector test) from PLAN.md's third message of 30 September.
- Line 39: "Tester criteria (Phase 7)" is carried over unchanged. PLAN.md names no Phase 7.

4. STATE.md line 7, "Current phase: accuracy.", is not marked unconfirmed although PLAN.md names no such phase.
- `grep -n -i "phase" PLAN.md` finds no "accuracy" phase. PLAN.md's structure is GROWTH steps 1 to 5, plus David's orders of 30 September.
- Line 5 of STATE.md requires any line the repository cannot confirm to be marked (unconfirmed). This one is not marked.

5. STATE.md line 4 records the source as "git at claude/generate-architecture-md-inw479" with no commit hash. The previous version pinned bf50199 and 9263810.
- A branch name moves, so "ahead of counter-core by PLAN.md records, evidence and this file" (line 10) cannot be checked later.
- At the time of writing the branch head was 0968d2e, 3 commits ahead of counter-core 24f89fa (2007ebb, 0d00186, 0968d2e). STATE.md itself is not yet committed.

6. README.md "What it does" leaves out user-facing features that are live on main at 84e020a (no file under src/ differs between 84e020a and HEAD):
- the "Report a wrong count" email or GitHub issue (src/lib/reportLinks.js, used in Result.jsx);
- the challenge-a-friend share (Result.jsx:292);
- the overlay video export and share (Replay.jsx:34-51, "Step 4").
The overlay export matters for the README's privacy lines ("never leaves it", "No video ... is sent anywhere"). The app can now make a video of the set and hand it to the share sheet on the user's tap. That tap is the user's own act, but it goes unmentioned in a README that claims to be up to date.

CHECKED AND CORRECT
- 181 offered: counted from offer.js and guide-patterns.json; e2e/collect.spec.js:88 agrees.
- Tier lists match liftTiers.js.
- The scoreboard.txt blob exists at 84e020a with the same content.
- main = 84e020a and counter-core = 24f89fa (git ls-remote).
- Deploy run 314 succeeded at 10:17 UTC, CI run 197 was in progress, CI run 193 succeeded at 09:33 UTC (GitHub API).
- The counting core is unchanged since e84ab32; only edges.test.ts was added under src/lib/counting.
- The label watch list has 14 entries.
- The exam README exists.
- Two spreadsheet files (sets-csv.js), the levels (level.js, LevelPick), progress and personal bests (PLAN.md record of e84ab32).
- MM-Fit coverage: squat and lateral raise are admitted; no lat pulldown; no alternating curl is offered.
- The batch collector remembers only the next set number across a reload (batchCollect.js numbersUsed, collect-batch-main.js:24).
- The three sub-agent briefs exist in .claude/agents/.
- No em dash in the added lines, and no new host.

Files: /home/user/workout-vision/README.md, /home/user/workout-vision/STATE.md, /home/user/workout-vision/src/lib/offer.js, /home/user/workout-vision/test/real-phone/accuracy/scoreboard.txt, /home/user/workout-vision/test/real-phone/accuracy/diagnosis.txt, /home/user/workout-vision/src/components/experience/Replay.jsx
