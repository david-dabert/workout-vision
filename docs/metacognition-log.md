# Metacognition log

One line per run of `wv-metacognition` (`.claude/agents/wv-metacognition.md`), at the start of each task and before its report.
From 19 November 2026 each line is the agent's own line (f), appended verbatim by Claude, never reworded; `wv-control` may compare a line with the #190 REPORT that quotes its verdict.
The lines dated before that rule are backfilled by Claude from its #190 reports and its own session, say so, and may read "not recorded"; a check Claude skipped is logged as "NOT RUN".
Each month, Claude counts the failure modes and the share of tasks that fixed one of the three problems, under "Monthly count" below; a mode that does not fall is the next thing to fix in the loop.

Columns: date, moment, task, branch and head, which of the three problems it fixes, failure modes found, whether Claude framed the call, verdict.

| Date | Moment | Task | Branch@head | Fixes | Failure modes | Framed | Verdict |
|---|---|---|---|---|---|---|---|
| 2026-11-19 | report | Card B, lifter by motion (backfilled from #190, issuecomment-7007046486) | claude/lifter-by-motion@6ed8b65f | Fixes: person | F: not recorded | FRAMED: not recorded | FIX FIRST twice, acted on (stored test of the 4-pose change; single-pose reads returned as they are; card B kept open) |
| 2026-11-19 | report | Card B, default gate (backfilled from #190, issuecomment-7008214286) | claude/lifter-default-gate@6d927b5f | Fixes: person | F: not recorded | FRAMED: not recorded | FIX FIRST, acted on (card B kept open; the nearest-torso rule also gives 10) |
| 2026-11-19 | start | David's product decision recorded in PLAN.md (backfilled) | claude/product-decision-19-nov@460fcb4 | Fixes: none | F: F11, F9, F6/F1 risk | FRAMED: yes (Claude listed the tensions to judge) | FIX FIRST: decision cited as relayed; precedence on PLAN.md's rule of 30 September; 701 as a goal; card B first |
| 2026-11-19 | report | David's product decision recorded in PLAN.md (backfilled) | claude/product-decision-19-nov, uncommitted on 460fcb4 (committed as 681ebf4 after the fix) | Fixes: none | F: F11, F9 | FRAMED: yes (Claude described what to check) | FIX FIRST: coach screens' status stated; card 063's order rests on the decision, not on an agent |
| 2026-11-19 | start | Card 064, per-exercise reliability (backfilled) | claude/reliability-table | Fixes: none | F: F1 (start check not run) | FRAMED: - | NOT RUN: Claude skipped the start check |
| 2026-11-19 | report | Card 064, per-exercise reliability (backfilled) | claude/reliability-table@021995f plus uncommitted (committed as cdc63c0 after the fix) | Fixes: none | F: F1, F11 | FRAMED: yes (Claude named what to check) | FIX FIRST: card marked measured, not done, with its next change; fitness tests out of the count; video sure columns on the built app's count; README's hip thrust corrected |
| 2026-11-19 | start | metacognition made independent | claude/metacognition-log | Fixes: none | F: F1 (start check not run) | FRAMED: - | NOT RUN: Claude skipped the start check |
| 2026-11-19 | report | metacognition made independent | claude/metacognition-log@c349248 | Fixes: none | F: F1, F11, F9 | FRAMED: no | FIX FIRST: third task in a row with none; start check not logged; avoidance rule exempts itself; STATE.md Now not updated |

## Monthly count
November 2026 (from 19 November): 8 lines; 2 tasks fixed one of the three problems (card B), 3 fixed none (the decision record, card 064, this log); two start checks not run; every call before this log was framed by Claude, the first unframed call found the avoidance rule exempting its own task.
The avoidance rule binds now. This log's task fixed none; its written reason is David's direct order of 19 November 2026. The next task changes a count, a person detection or the kiné verdict, with no further exemption: card 064's next change (the sure check asks on the 11 sets shown as sure and off by 3 or more; the right-count problem), since card 063 track A waits on KIMORE's licence, which this session cannot read.
