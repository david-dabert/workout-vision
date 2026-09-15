# Phase B Scorecard — Accuracy & Resilience

**Date**: 2026-09-15
**Scope**: Phase B of the 10/10 push. Accuracy bugs in scoring, form checks, and coaching report.

## Commands Run

```
npx vitest run --reporter=verbose   # 194 tests pass (191 from Phase A + 3 new)
npx vite build                      # Production build clean, 728ms
```

---

## Fix 1: Coach null-score inflation (coach.js)

**Bug**: When `repHistory` contained entries with all `null` scores (common when form checks don't apply to an exercise), the coach averaged them as zeros and counted the set as "scored at 0." This inflated `totalScoredSets` and pulled the workout grade toward F instead of treating the set as unscored.

**Root cause** (`coach.js:188-193`): `(r.score || 0)` converts null to 0, then `!isNaN(0)` is true, so `totalScoredSets++` fires even when no real scores exist.

**Fix**: Filter `repHistory` to only reps with `r.score != null` before averaging. If no scored reps exist, the set is not counted toward the grade. Falls through to the `totalScoredSets === 0` default of 50 (grade D).

**Test coverage**: 2 tests — "does not count all-null-score sets toward grade" (grade != F), "correctly scores sets with mixed null and real scores" (grade in A-/B+/B range for avg 87.5).

---

## Fix 2: Form check visibility consistency (exerciseDefinitions.js)

**Bug**: Seven custom form check `check` functions used raw `Math.max(angles.leftX, angles.rightX)` while their paired `quality` functions used `bestSideMax()` with visibility weighting. When one side was occluded (visibility < 0.1), `Math.max` would pick the occluded side's noisy value, potentially passing the check on garbage data while the quality function correctly ignored it.

**Affected exercises** (7 form checks across 6 exercises):
- Bicep curl — "Full extension" (elbow > 145)
- Leg extension — "Full extension" (knee > 165)
- Upright row — "Elbows high" (shoulder > 75)
- Lateral raise — "Height" (shoulder > 80)
- Jumping jack — "Arm height" (shoulder > 80)
- Turkish get-up — "Arm vertical" (shoulder > 90)
- Lying leg curl — "Full contraction" (knee < 50)

**Fix**: Replaced all 7 `Math.max(angles.*)` calls with `bestSideMax(angles, ...)` to match the quality function. `bestSideMax` selects the value from the side with higher landmark visibility, ignoring the occluded side.

**Test coverage**: 1 test — "bestSideMax prefers the visible side over the occluded side" (verifies that with left occluded at 0.01 and right visible at 0.95, the right side's value is returned).

---

## Audited and confirmed safe

| Area | Finding |
|------|---------|
| ROM consistency formula | Linear mapping `100 - CV` is coherent. CV 30% = consistency 70/100. Reasonable, not inflated. |
| Pull-up phase labels | `phase: 'bottom'` = tracking signal valley = arms most flexed = chin above bar. Correct. |
| Division by zero in biomechanics | All guarded: asymmetry by `> 5`, tempo by `\|\| 1`, ROM by `>= 2`. |
| RepCounter finalize on short videos | Exits with 0 reps on < 6 frames. Correct safe behavior. |
| Abort mid-pipeline | Returns partial result with zeroed metrics (not crash). Edge case, acceptable. |

---

## Summary

| Fix | Location | Tests Added |
|-----|----------|-------------|
| Null-score inflation | coach.js:188-193 | 2 |
| Form check visibility (7 checks) | exerciseDefinitions.js (7 lines) | 1 |

**Total**: 194 tests pass, production build green (728ms).

**Phase B status**: Complete. Scoring pipeline is resilient to null scores. Form checks respect landmark visibility across all exercises. No division-by-zero or NaN propagation paths found.

**Next phases**: C (Speed & Feel), D (Retention), E (Closeout).
