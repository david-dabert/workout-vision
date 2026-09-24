# BACKLOG

Per DIRECTIVES.md R7 (scope freeze) : new ideas land here with a date. They are not built until the current phase is complete.

## Open

### 2026-09-24 — Benchmark threshold drift

The `--ci` gate thresholds in `benchmark/replay-benchmark.mjs` (lines 469-471) were calibrated against the 2026-09-09 baseline : 80% accuracy, 70% OBO, MAE 1.40. Current baseline is 76% accuracy, 66% OBO, MAE 1.61. The 5% / 10% / 0.6 tolerance windows have been absorbing that drift silently. The gate reports PASS on a regressed scoreboard.

Two options to consider after Phase 0.6 ships :
- Recalibrate thresholds to today's honest baseline (76 / 66 / 1.61) with fresh tolerance windows.
- Treat the drift as a regression to investigate (which change between 2026-09-09 and today moved these numbers, and whether it was intentional).

Blocked until : Phase 0.7 (green baseline established).

### 2026-09-24 — Two Countix clips fail landmark extraction

Surfaced by Fix B in commit c2d0689 :
- `bench_press_gWszV_R2qsk_6reps.mp4` — 9 frames extracted for 6 reps (needs ≥18)
- `sit_up_9bIwX1vZrXg_5reps.mp4` — 3 frames extracted for 5 reps (needs ≥15)

Options : re-download source clips at higher fps, adjust extraction settings, or remove from the manifest as unscoreable. Not touched in 0.6 (R7).

Blocked until : Phase 0.7 (green baseline).
