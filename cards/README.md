# Cards

The queue of METHOD.md. One file per task, taken in the order of "Order" below among those whose status is `ready`.

## Order

Set by Claude on 11 November 2026 on David's order of that day ("you will have to do the hard work ... give your own instructions"). David may reorder it at any time; an agent reorders it only in a report that says why.

Reordered by Claude on 12 November 2026, on David's message of that day (the moment after the first set, and real progress each morning). Done: 002, 004, 005, 006, 007, 008, 009, 010, 013, 014, 015, 016, 017, 019.

Reordered by Claude on 12 November 2026, from the audit (card 006): card 013 first, because the report, the home and three addresses show in production what the switch of 11 November turned off (R8).

Reordered by Claude on 13 November 2026, on David's order of that day ("Fix the remaining problems and issues"): 018 before 003, because R16 asks the app to be right when sure before it counts more, and TRIED.md closes every threshold on recount agreement; 019 after 003.

Reordered by Claude on 13 November 2026, from the flaw register (`docs/FLAWS-2026-11.md`): 014 first (live overclaims, cheap), then 016 (the accuracy figure R16 rests on), then 015.

1. 001, the kiné comparison held against public data: the proof the kiné offer rests on. Blocked since 12 November 2026 on David's four videos; its public half passed (#391).
2. 011, today's set against your own best set, in the lab lane: the reason to come back. Lab lane merged (#393), off in production.
3. 018, the app says it is sure only of a set filmed whole. Failed, 13 November 2026 (85.0 % on half B against 90 %; TRIED.md): kept here as the lead for the next attempt.
4. 003, the counter on reps done without a return to rest. Failed, 13 November 2026, after two attempts (TRIED.md): the core's thresholds are not the lever; the pose input is.
5. 019, range and tempo held against a known truth. Done, 13 November 2026: 19 degrees and 0.5 s low at the median at the guided view.
6. 020, the screens show range and tempo only as far as their error allows. Blocked on David's choice (a, b or c).
7. 012, a real replay on the first screen: blocked on a video David chooses.
8. 017, the debt a reviewer meets first. Done, 13 November 2026: no leak in Chromium over 40 filming screens (+0.3 MB).

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
