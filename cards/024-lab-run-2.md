# 024. The overnight lab keeps only what holds on real video
Status: withdrawn (14 November 2026, review board): guarding the search with the real videos and RepCount turns the only real test sets into tuning data, and card 023 showed variant-eval's exact counts miss the sure set, the synthetic set by set and the range. A next lab run must score every gate CI runs, not exact counts alone.
Executor: careful
Claim: David wakes to a counter change the lab found and the real videos already confirm, not a value that only fits half A.
Reference: TRIED.md, the overnight lab's first run (13 November 2026): nine values kept on half A gained 14 exact on half B but lost 2 of 16 real videos and 5 of 79 RepCount sets.
Eval: fixed 14 November 2026. `scripts/autoresearch.mjs` keeps a value only if half A gains and David's sets, the synthetic sets, the real videos and RepCount lose no exact count and gain no set off by 3 or more; half B stays unread until the end. Then the motion library's rendered sets (`motion-library.yml`, about 1,850) join the guards when they are on disk. Pass: one run of at least 90 minutes ends with half B gaining at least 5 exact over the counter of that day, the guards unchanged or better. Any kept value then ships only through its own card and R2.
Baseline: the counter after card 023, read by the script's first line.
Scope: `scripts/autoresearch.mjs`, `test/real-phone/autoresearch/`, TRIED.md. No file under `src/` changes in this card.
Stop: if the run keeps nothing, or half B gains fewer than 5, record it and close the card as failed; the constants are then not the lever, as card 003 found, and the next card is the pose input.
Needs from David: nothing.
