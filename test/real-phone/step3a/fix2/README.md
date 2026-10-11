# Step 3a fix2 evidence

Collected 2026-09-25 via `evidence-3a-fix2.mjs` (WebKit iPhone 14, both dark and light mode).

## Fixes verified

- `getExerciseFrames` / `getSlug` lookup order reversed: GUIDE_EXERCISES (canonical) checked before KEY_TO_SLUG (legacy). Fixes Squat mapping to `barbell-back-squat` (404).
- Light mode: readable search placeholder and filter chip colors.
- TestBanner uses CSS custom properties for both color schemes.

## Results

- 304 exercise cards (14 hidden slugs filtered)
- Zero failed requests (status >= 400) after full library scroll in both modes
- Zero console errors in both modes
- Squat detail card renders correctly with animated frames

## Screenshots

- `01-{dark,light}-library-top.png` — top of exercise library
- `02-{dark,light}-library-bottom.png` — bottom after full scroll
- `03-{dark,light}-squat-detail.png` — Squat exercise detail card
- `04-{dark,light}-detail-{1,2}.png` — additional detail cards
- `05-{dark,light}-console.txt` — console output
- `05-{dark,light}-failed-requests.json` — empty arrays (zero failures)
