# 023. The counter counts the shallow reps it now drops, and loses none it counts today
Status: ready
Executor: careful
Claim: a person whose reps move the joint between 14 and 20 degrees gets them counted, and no set counted exactly today is counted worse.
Reference: the overnight lab, first run of 13 November 2026 (TRIED.md; `test/real-phone/autoresearch/log.jsonl`): `MIN_ROM_DEGREES` 20 to 14 alone, read on every suite against the baseline. TRIED.md, 8 October 2026: a floor of 16 broke one synthetic curl then; the counter has changed since, and the eval below decides.
Eval: fixed 14 November 2026 before any code. Run before and after the change, with the per-clip diff pasted in the pull request: `npm run scoreboard`, `npm run scoreboard:public`, `npm run synth`, and `variant-eval.test.ts` on every suite. Pass, all at once: the real-phone exact count does not decrease and no clip becomes off by 3 or more (R2); David's sets keep 14 of 20 exact; the real videos keep 12 of 16; RepCount keeps 27 of 79; half B gains at least 5 exact (the lab read 258 to 265); synthetic loses none.
Baseline: david 14/20, video 12/16, publicA 259/546, publicB 258/518, repcount 27/79, synthetic 74/96, occlusion 27/68, multisport 3/3 (variant-eval, 13 November 2026). Scoreboards: run them first and paste them.
Scope: the one constant `MIN_ROM_DEGREES` in `src/lib/counting/core.ts`, its R9 comment (source: the lab run and this card; status: validated if the eval passes), TRIED.md, the scoreboards' stored outputs. Nothing else in the counter.
Stop: if any part of the pass fails, keep 20, record the figures in TRIED.md and close the card as failed. Do not try 15 to 19 in the same card: that is a new lab run (card 024).
Needs from David: nothing.
