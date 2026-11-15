# Card 036 — Held-out check & revert of Card 034 per-exercise 15-degree floors

Status: open
Author: Antigravity
Created: 2026-11-15
Branch: antigravity/036-revert-034-floors
Blocked-on: CI `PUBLIC_BASE` (`476 < 478` on `main`, `470 < 472` post-035) and `SYNTH_BASE` (`74 < 76`) one-way baseline ratchet against `origin/main` under branch protection (`enforce_admins: true`).
Work: Held-out check of Card 034 (`d800205c`) and revert of its three `15°` floors (`squat`, `lateral_raise`, `push_up`) in `src/lib/counting/core.ts`, recorded in `TRIED.md`.

## Held-out check (`18e23857 -> d800205c`)

Official `test/real-phone/public/*/holdout/` directories are absent from local disk; held-out evaluation used `publicB` (`518`), `repcount` (`79`), `david` (`20`), and `video` (`17`):
- `david`: `14 -> 14` (`0` moved)
- `video`: `12 -> 12` (`0` moved)
- `repcount`: `27 -> 27` (`0` moved)
- `publicB`: `258 -> 260` (`+2` sets on `1` distinct clip `VCPJbiTq9YU` `0 -> 2`, `0` lost, `chi2 = 0.50` — below Card 023's `>= 5` half-B bar)
- `publicA`: `259 -> 261` (`+2`, `0` lost, `chi2 = 0.50`), `synthetic`: `74 -> 76`, `occlusion`: `27 -> 30`

Because held-out gain (`+1` distinct clip on `publicB`, `0` on `repcount`/`david`/`video`) is indistinguishable from threshold tuning already rejected by Card 023 and `TRIED.md`, all three `15°` floors are reverted.

## Files

- `src/lib/counting/core.ts` (`squat`, `lateral_raise`, `push_up` restored to pre-034 values)
- `src/lib/__tests__/batchCollect.test.js`
- `src/lib/counting/__tests__/lift.test.ts`
- `test/real-phone/synth/measures-error.test.ts`, `test/real-phone/synth/measures-error.txt`
- `TRIED.md`
- Scoreboard & snapshot files matching the reverted code (`README.md`, `synth.txt`, `occlusion.txt`, `public-scoreboard.txt`, `public-baseline.json`, `full-sets.txt`, `midset-misses.txt`)
