# Phase 0.6 — Make CI honest

Per `DIRECTIVES.md` phase 0.6 : the benchmark job must fail when any clip is excluded or scored as `Unknown exercise`, and when the scored count differs from the manifest ; typecheck must run against a real `tsconfig.json` or be renamed.

## Changes

**Fix A — `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`**
Removed `continue-on-error: true` from the `npm run test:benchmark` step. A benchmark exit non-zero now fails the workflow.

**Fix B — `benchmark/replay-benchmark.mjs`**
Extended the `--ci` gate to fail when :
- `excluded.length > 0` (any clip silently dropped for extraction failure, missing landmarks, etc.)
- any scored result reports `method === 'Unknown exercise'` (manifest label not recognised by the scoring path)

The old gate reported `PASS` at accuracy=76% while dropping two clips from the denominator. Those clips were scored 0/6 and 0/5 in the results file but hidden from the summary.

**Fix C — typecheck**
No change. `tsconfig.json` is honest ; `tsc --noEmit` already runs against `src/**/*.{ts,tsx,js,jsx}` under strict mode.

## Proof (R3)

Local runs before push :

```
Before (baseline, main state):
  CI GATE PASSED: accuracy=76% OBO=66% MAE=1.61
  exit=0

After (Fix B active):
  CI GATE FAILED: 2 clip(s) excluded from scoring:
    bench_press_gWszV_R2qsk_6reps.mp4 (extraction failure: 9 frames for 6 reps, need ≥18)
    sit_up_9bIwX1vZrXg_5reps.mp4      (extraction failure: 3 frames for 5 reps, need ≥15)
  exit=1
```

## Adjacent findings (not fixed in this PR ; recorded in BACKLOG.md per R7)

- Gate thresholds still calibrated to 2026-09-09 baseline (80% / 70% / MAE 1.40). Today's baseline is 76% / 66% / 1.61. Tolerance windows have been absorbing that drift silently.
- Two Countix clips fail landmark extraction (bench_press_gWszV_R2qsk, sit_up_9bIwX1vZrXg). Deferred to Phase 0.7.

## What this PR does NOT do

Does not fix the two extraction failures. Does not recalibrate thresholds. The point of « make CI honest » is to surface the state, not to hide it. Both items belong to Phase 0.7.

## Verification of the gate itself

Companion branch `ci-honesty-broken-proof` (temporary) deliberately breaks the gate by raising `CI_MIN_ACCURACY` to 95 to demonstrate CI failing. That branch will be deleted after the red CI run is observed.

## Merge criteria (R6)

- CI green on this PR (or CI red on the two known-excluded clips, which is the honest state ; in that case Phase 0.7 fixes them before merge).
- Real-phone gate confirmed by David on iPhone.
