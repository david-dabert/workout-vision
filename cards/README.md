# Cards

The queue of METHOD.md. One file per task, taken in the order of "Order" below among those whose status is `ready`.

## Order

Set by Claude on 11 November 2026 on David's order of that day ("you will have to do the hard work ... give your own instructions"). David may reorder it at any time; an agent reorders it only in a report that says why.

Reordered by Claude on 12 November 2026, on David's message of that day (the moment after the first set, and real progress each morning). Done: 002, 004, 005, 006, 007, 008, 009, 010, 013, 014, 015, 016, 017, 019, 026, 027, 028, 029.

Reordered by Claude on 12 November 2026, from the audit (card 006): card 013 first, because the report, the home and three addresses show in production what the switch of 11 November turned off (R8).

Reordered by Claude on 13 November 2026, on David's order of that day ("Fix the remaining problems and issues"): 018 before 003, because R16 asks the app to be right when sure before it counts more, and TRIED.md closes every threshold on recount agreement; 019 after 003.

Reordered by Claude on 13 November 2026, from the flaw register (`docs/FLAWS-2026-11.md`): 014 first (live overclaims, cheap), then 016 (the accuracy figure R16 rests on), then 015.

Reordered by Claude on 14 November 2026, nightly run: no card was ready; 023 and 024 written from the overnight lab's first run, first because they are the only cards that can raise the count without David.

Reordered by Claude on 15 November 2026, nightly run: no card was ready (028 was merged in #430 and still marked ready; 030 is Antigravity's, #433). Three cards written, in the phases of the roadmap of 14 November 2026: 031 first because it guards a Phase 1 fix merged that night (#431), then 032 and 033, Phase 2, the promise STATE.md marks worst kept ("What to do next"). A refusal audit on public data was measured and not written as a card: it passes before any change (TRIED.md, 15 November 2026).

Reordered by Claude on 15 November 2026, on David's decision of that day ("adopt"; "Plan MD signed, governance approved"): the order follows the phases of PLAN.md's amendment of 15 November 2026, the only roadmap. Each card names its phase. A card's number is reserved on issue #190 before work starts. Until Phase 1's gate passes, no card adds a screen or an element on a screen (PLAN.md, THE FREEZE). Done since the last order: 030, 031, 032, 033, 034, 037, 039, 040, 041.

Phase 1, trust on the iPhone (open):
1. The iPhone's read beside the computer's (card 037's table): blocked on David's run of check.html's 15 clips on his iPhone, its copied result sent.
2. The hip thrust, 1 for 12 on the iPhone: blocked on its original file.
3. The sealed sets of Phase 1's gate: at least 20 of David's sets filmed after 15 November 2026, in `test/real-phone/sealed/`, read once.
4. 042, the filming screens show no figure measured on rendered bodies (a claim withdrawn, allowed by the freeze).

Parked until Phase 1's gate passes:
- 038, the estimated maximum (Antigravity, branch not pushed): returns in Phase 2 through a card with its eval and the question "How many more reps could you have done?".
- 011 (lab lane, off in production), 012 (a video David chooses), 020 (David's choice a, b or c).

Blocked on David: 001 (four videos), 021 (four curl sets).
Failed or withdrawn, kept as leads: 003, 018, 022, 023, 024. Met at baseline: 025.

The order of 15 November 2026 above replaces the numbered list below it, kept for its record.

0. 031, an arm's lift read never switches to the far arm: the exception #431 skipped.
0. 032, the load of each set, kept with its count.
0. 033, the next set to beat, by load and reps (after 032).
0. 023, the range floor from 20 to 14 degrees, through R2: the one value of the lab's first run that loses nothing on any suite.
0. 024, the lab's second run, guarded by the real videos and RepCount.
1. 001, the kiné comparison held against public data: the proof the kiné offer rests on. Blocked since 12 November 2026 on David's four videos; its public half passed (#391).
2. 011, today's set against your own best set, in the lab lane: the reason to come back. Lab lane merged (#393), off in production.
3. 018, the app says it is sure only of a set filmed whole. Failed, 13 November 2026 (85.0 % on half B against 90 %; TRIED.md): kept here as the lead for the next attempt.
4. 003, the counter on reps done without a return to rest. Failed, 13 November 2026, after two attempts (TRIED.md): the core's thresholds are not the lever; the pose input is.
5. 019, range and tempo held against a known truth. Done, 13 November 2026: 19 degrees and 0.5 s low at the median at the guided view.
6. 020, the screens show range and tempo only as far as their error allows. Blocked on David's choice (a, b or c).
7. 012, a real replay on the first screen: blocked on a video David chooses.
8. 017, the debt a reviewer meets first. Done, 13 November 2026: no leak in Chromium over 40 filming screens (+0.3 MB).
9. 022, the pages' security policy refuses code built from text. Failed, 13 November 2026: the WebCodecs path still needs `'unsafe-eval'`; its caller is not located.
10. 021, one exercise passes its exam. Blocked on David's four curl sets.

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
