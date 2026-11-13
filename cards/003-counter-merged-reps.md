# 003. The counter separates reps done without returning to rest
Status: ready (attempt 1 of 2 failed, 13 November 2026)
Attempt 1 (Claude, 13 November 2026): split an overlong rep where a second signal returns. Closed at its ceiling before any change to the core (`second-signal-split.txt`): on half A it could gain at most 3 sets and would break at least 15 exact ones; on David's sets gain at most 1, break 2. Recorded in TRIED.md. One attempt left before the card's stop.
Executor: careful
Claim: a person who keeps tension through a set gets the right count.
Reference: the public build sets (`npm run scoreboard:public`, 949 that decide) and David's sets (`npm run scoreboard`).
Eval: `npm run scoreboard:public` exact count above 468 of 949 with no new error of 3 or more, and `npm run scoreboard` not below 13 of 15 and 12 of 16 (R2).
Baseline: 468 of 949 (49 %), 11 November 2026. Cause on record: `merged_no_rest_return` (`test/real-phone/midset-misses/midset-misses.txt`).
Scope: `src/lib/counting/`. Read TRIED.md first (R14): what is closed there is not tried again.
Stop: two attempts that do not pass the eval; each is written in TRIED.md.
Needs from David: nothing.
