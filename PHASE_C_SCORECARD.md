# Phase C — Speed & Feel

> **Historical** (third audit, C43, 3 October 2026). Written before the counting core (`src/lib/counting/core.ts`) and last changed on 25 September 2026 (commit 1f5a90d): it describes earlier code, most of it now dormant (ARCHITECTURE.md, section 5), and none of its figures is current. Current counting figures, each dated on its first line: `test/real-phone/accuracy/public-scoreboard.txt` and `test/real-phone/accuracy/scoreboard.txt`.

## Fixes applied

| # | File | What | Why |
|---|------|------|-----|
| 1 | ExercisePicker.jsx, index.css | Chip hover/active CSS feedback via `.exercise-chip` class | Tappable elements had no visual feedback; added brightness on hover, scale+brightness on active, disabled tap highlight |
| 2 | ResultCard.jsx | `prefers-reduced-motion` guard on score count-up rAF | Animation bypassed the CSS `prefers-reduced-motion` rule; JS now checks matchMedia and skips to final value |
| 3 | VideoUpload.jsx, en.json, fr.json | i18n for phase progress labels | Four hardcoded English strings replaced with `t()` calls; keys added to both locale files |

## Verification

- **Tests:** 194 passed (0 new tests needed; changes are UI/CSS/i18n)
- **Build:** 757ms, clean
- **Regressions:** none
