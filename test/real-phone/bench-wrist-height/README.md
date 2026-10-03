# Bench press counted on the wrist's height: held for David, 3 October 2026

The change in bench-wrist-height.patch finds the bench press's reps on the wrist's height above the shoulder
(world landmarks, y, in units of 1/200 m) instead of the elbow angle, and still measures each rep's range and
speeds on the elbow angle. Why: at the bottom of a bench rep the elbow sinks behind the torso and the bench and
the pose model misplaces it while it still places the wrist (Countix E9KZOVuBRfA, 11 reps counted 5;
NX5TcYEILhI, 9 counted 3). It applies with git apply to the commit that adds this file.

Measured on the integrated core of 3 October before the lunges' lagging-knee pairing, which moves no bench set
(test/real-phone/accuracy/variant-eval.test.ts and
scripts/compare-variants.mjs; public build half in two fixed halves, A chosen on, B read once after):

- public A: 167 to 171 exact, off by 3 or more (refusals included) 76 to 73, none newly off by 3;
- public B: 164 to 164 exact, off by 3 or more 99 to 99; ExiJ7qKakH4 (label 6), read twice, 4 to 3 in both
  readings, newly off by 3, and Yxfc0XYQI3I (label 3), read twice, 0 to 2 in both;
- David's sets: 8 to 8 exact; his side bench set 5 to 8 for 7, his angle bench set still refused; none newly
  off by 3;
- synthetic sets: unchanged (none holds a bench press).

Whole build half 331 to 335 exact, off by 3 or more 175 to 172.

Why it is not applied:

1. The public gate (test/real-phone/accuracy/public-scoreboard.test.ts) fails any set newly off by 3 or more,
   David's rule of 30 September, and ExiJ7qKakH4 becomes one. The patch also rewrites that gate to the net rule
   of 3 October (exact may not fall, sets off by 3 or more may not rise). A change that rewrites the gate it
   would fail needs David's own word that the CI gate, not only the experiment comparison, follows the net rule
   (CLAUDE.md R12). The review also found the rewrite's McNemar check can never fire (exact not falling already
   implies it), and that the gate pools halves A and B where scripts/compare-variants.mjs judges each.
2. Blocking under R8 (review of 3 October): reps the elbow angle missed are now counted, but each is still given
   a range and speeds from that misread elbow, then marked shorter in the set's account. On NX5TcYEILhI the
   ranges read 24, 35, 30, 19, 43, 18 and 52 degrees and the account says "Reps 4 and 6 were shorter than the
   others"; on the patch's own synthetic test (true range 85 degrees) every set reads 39 to 48 degrees on
   average. The replay's sentence "In gold, the joint whose angle counts the reps" also becomes false for the
   bench press. Before it ships, a rep found on the wrist's height must show no range or speed the elbow cannot
   measure, and the replay must say what counted it.
3. Not blocking, from the same review: filmed from nearly above, the wrist's height barely moves on screen and
   the count is 0 where the elbow angle counted every rep, without a refusal.

What David decides: whether the public CI gate follows the net rule. If it does, the R8 fix in point 2 comes
first, then the change is measured again on the integrated core.
