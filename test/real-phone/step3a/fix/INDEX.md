# Step 3a fix evidence — 25 September 2026

Production build screenshots, WebKit iPhone 14 profile.

## Library views (local build)

- `01-dark-library.png` — Exercise library grid, dark mode, 304 cards with visible white-stroke figures
- `01-light-library.png` — Exercise library grid, light mode, 304 cards with visible dark (inverted) figures
- `01-dark-en-library.png` — Library grid, dark mode, English locale
- `01-light-en-library.png` — Library grid, light mode, English locale
- `01-dark-fr-library.png` — Library grid, dark mode, French locale
- `01-light-fr-library.png` — Library grid, light mode, French locale

## Detail cards (local build)

- `02-dark-detail-{1,2,3}.png` — Detail cards, dark mode, animated figures visible
- `02-light-detail-{1,2,3}.png` — Detail cards, light mode, inverted figures visible
- `02-dark-en-detail-{1,2,3}.png` — Detail cards, dark mode, English locale (card 1: "Not counted by the app yet")
- `02-light-en-detail-{1,2,3}.png` — Detail cards, light mode, English locale
- `02-dark-fr-detail-{1,2,3}.png` — Detail cards, dark mode, French locale (card 1: "Pas encore compté par l'app")
- `02-light-fr-detail-{1,2,3}.png` — Detail cards, light mode, French locale

## Live site (GitHub Pages after deploy)

- `live-dark-library.png` — Live site exercise library, dark mode, 304 cards
- `live-light-library.png` — Live site exercise library, light mode, 304 cards
- `live-dark-detail.png` — Live site detail card, dark mode, animated figure visible
- `live-light-detail.png` — Live site detail card, light mode, inverted figure visible

## Console output

- `03-dark-console.txt` — Console output, dark mode run
- `03-light-console.txt` — Console output, light mode run
- `03-dark-en-console.txt` — Console output, dark mode English
- `03-light-en-console.txt` — Console output, light mode English
- `03-dark-fr-console.txt` — Console output, dark mode French
- `03-light-fr-console.txt` — Console output, light mode French

## Commits on main

- `c32eacd` — CSS: removed dark-mode filter, added light-mode invert(1), light-mode detail text overrides
- `dd19de2` — JS: hidden 14 exercises with 404 frames (906 at 200, 42 at 404), fixed guide_only raw key
- `b02a0d9` — Bilingual detail card text, replaced misleading meta descriptions
