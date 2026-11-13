# 003. The counter separates reps done without returning to rest
Status: failed (13 November 2026: two attempts, both in TRIED.md)
Attempt 1 (Claude, 13 November 2026): split an overlong rep where a second signal returns. Closed at its ceiling before any change to the core (`second-signal-split.txt`): on half A it could gain at most 3 sets and would break at least 15 exact ones; on David's sets gain at most 1, break 2. Recorded in TRIED.md. Attempt 2 (Claude, 13 November 2026): SPLIT_LONG swept on half A from 1.4 to 2.0; flat at 259 exact and 20 off by 3 or more up to 1.8, lower beyond. No gain to choose; half B not read. The card stops here, as its stop rule says. What the two attempts show: the merged reps the core misses are held back neither by their length nor by a lack of a second signal, but by returns that stop short of the rest, which the swept return share already bounds (the edges rule of 30 September). The next lever named by the record is the pose input (TRIED.md, 8 October), not the core's thresholds.
Executor: careful
Claim: a person who keeps tension through a set gets the right count.
Reference: the public build sets (`npm run scoreboard:public`, 949 that decide) and David's sets (`npm run scoreboard`).
Eval: `npm run scoreboard:public` exact count above 468 of 949 with no new error of 3 or more, and `npm run scoreboard` not below 13 of 15 and 12 of 16 (R2).
Baseline: 468 of 949 (49 %), 11 November 2026. Cause on record: `merged_no_rest_return` (`test/real-phone/midset-misses/midset-misses.txt`).
Scope: `src/lib/counting/`. Read TRIED.md first (R14): what is closed there is not tried again.
Stop: two attempts that do not pass the eval; each is written in TRIED.md.
Needs from David: nothing.
