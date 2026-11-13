# 019. Range and tempo are held against a known truth
Status: ready
Executor: careful
Claim: the range and tempo the app shows under « Expérimental » are measured against a known truth, with their error stated, and the label stays until the error is small enough to name.
Reference: R8, R9, R16 (joint angles against optical motion capture); `docs/FLAWS-2026-11.md` #13; the synthetic sets, whose angles and phases are known because they are rendered (README, 6 October: ranges read 29 degrees, 30 %, below truth, phases 0.6 s short); `src/components/experience/measures.js` ("Status: none validated").
Eval: a bench over the 96 synthetic sets (`npm run synth`): per rep, the range and the lifting and lowering times the app computes (`tempo.js`, the result's `romDegrees`) against the rendered truth; median and 90th percentile error, by exercise and by camera view. The figures are written in `measures.js` beside `MEASURES_SHOWN`, and the card states plainly whether the screen's numbers can stand.
Baseline: no measure; the 6 October README figures, never turned into a test.
Scope: the bench, its output, the comment in `measures.js`. No screen changes in this card: if the error is too large, a second card hides or relabels the numbers (R8).
Stop: rendered bodies are not people; this card cannot validate the measures, only bound their error. Optical motion capture of real people stays the reference R16 names, and its absence is recorded.
Needs from David: nothing.
