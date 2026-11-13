# Cards

The queue of METHOD.md. One file per task, taken in the order of "Order" below among those whose status is `ready`.

## Order

Set by Claude on 11 November 2026 on David's order of that day ("you will have to do the hard work ... give your own instructions"). David may reorder it at any time; an agent reorders it only in a report that says why.

Reordered by Claude on 12 November 2026, on David's message of that day (the moment after the first set, and real progress each morning). Done: 002, 004, 006, 007, 008, 009, 010, 013, 014, 016.

Reordered by Claude on 12 November 2026, from the audit (card 006): card 013 first, because the report, the home and three addresses show in production what the switch of 11 November turned off (R8).

Reordered by Claude on 13 November 2026, from the flaw register (`docs/FLAWS-2026-11.md`): 014 first (live overclaims, cheap), then 016 (the accuracy figure R16 rests on), then 015.

1. 015, the kiné follow-up shows no clinical trend until one is proven.
2. 001, the kiné comparison held against public data: the proof the kiné offer rests on. Blocked since 12 November 2026 on David's four videos; its public half passed (#391).
3. 011, today's set against your own best set, in the lab lane: the reason to come back. Lab lane merged (#393), off in production.
4. 005, the first minute leads with what is proven.
5. 003, the counter on reps done without a return to rest: the hardest, and the one the 49 % depends on.
6. 012, a real replay on the first screen: blocked on a video David chooses.
7. 017, the debt a reviewer meets first.

A run that finishes the queue writes the next cards from the audit and from STATE.md's table of promises, worst-kept promise first.

## Template

```
# NNN. Title, as a claim
Status: ready | blocked (on what) | done | failed
Executor: fast | careful
Claim: what a named user can do afterwards, in one sentence.
Reference: what counts as truth.
Eval: the command, the data, the threshold. Fixed before any code.
Baseline: the eval's result today, or "never run".
Scope: what may change. What may not.
Stop: when to give up and record the failure.
Needs from David: nothing, or the exact thing.
```

## Prompt of a run

Read CLAUDE.md, STATE.md, METHOD.md and the latest comments of issue #190.
Take the first card of "Order" whose status is `ready` and follow the loop of METHOD.md on it, and on it alone.
If no card is `ready`, report that on issue #190 and stop.
