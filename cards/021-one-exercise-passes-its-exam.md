# 021. One exercise passes its exam
Status: blocked (on David: the exam sets are his to film, four per lift, `test/real-phone/exam/README.md`)
Executor: careful
Claim: one exercise, the biceps curl first, is offered as proven because it counted exactly four sets it had never seen.
Reference: PLAN.md ("a lift is offered only once it counts right on sets it has never seen ... four exam sets ... A lift passes only if every exam set is counted exactly"); STATE.md's promise "A tool for every exercise: offered, unproven"; `docs/FLAWS-2026-11.md` #10.
Eval: `EXAM=1 npx vitest run test/real-phone/exam/exam.test.ts`, run once on the sets David films as the README says; pass when every exam set of the lift is counted exactly. The harness exists; the sets do not.
Baseline: `test/real-phone/exam/` holds the harness and the README, no exam set; no lift has passed.
Scope: the exam run and its record (exam-result.txt, STATE.md). A pass changes the lift's label only through its own card (R8).
Stop: a miss is recorded, the seen sets become build sets, and a new exam is filmed after the fix (PLAN.md).
Needs from David: four sets of curls, filmed from the side as the app shows, counted aloud as a coach would, handed over with the batch collector (collect-batch.html).
