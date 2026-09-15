# Phase D — Retention & Product Loop

## Fixes applied

| # | File | What | Why |
|---|------|------|-----|
| 1 | sw.js | Added `periodicsync` handler + `notificationclick` handler | The notification opt-in UI existed but the SW never handled the periodic sync event; weekly reminders were inert. Also added click-to-open so tapping the notification opens the app. |
| 2 | manifest.json | Added `shortcuts` field (Analyze Video, Workout History) | Android long-press on home screen icon now shows quick actions. PWA checklist item. |
| 3 | Dashboard.jsx, index.css, en.json, fr.json | Inactive-streak nudge when streak is 0 and last workout >= 2 days ago | The streak badge disappeared exactly when re-engagement was most needed. Now shows "Xd ago — time to train!" in amber instead of vanishing. |

## Verification

- **Tests:** 194 passed (0 new tests needed; changes are SW/manifest/UI)
- **Build:** 727ms, clean
- **Regressions:** none
