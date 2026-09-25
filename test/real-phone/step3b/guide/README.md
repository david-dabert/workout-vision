# Guide screen evidence

Playwright WebKit, iPhone 14 profile, dark mode, French locale.

## Screenshots

- `01-guide-front.png` — front body map with golden animated figure, title "Trouvez votre mouvement.", search bar, Face/Dos toggle on Face, five zone chips (Épaules 114, Pectoraux 48, Biceps 54, Abdominaux 141, Cuisses 86), "Tous les exercices" and "English" tool buttons visible at bottom
- `02-guide-back.png` — back body map, Dos toggle active, six zone chips (Dos 66, Triceps 52, Lombaires 17, Fessiers 101, Ischios 66, Mollets 21)
- `detail-*.png` — ten random exercise details showing WebP frame illustrations on dark background, French description ("Guide uniquement. Cet exercice n'est pas compté." or "Cet exercice peut être compté."), and Fermer button

## What the evidence script tests

1. All 906 guide frame images (302 exercises × 3 frames) return HTTP 200 with content-type image/webp
2. Guide screen lists all 302 exercises; all 302 have French names
3. Front and back zone chips filter correctly; every chip toggles aria-pressed and produces at least one exercise
4. Body map spots toggle aria-pressed on click (dispatched via JS to bypass touch-target overlap at mobile width)
5. Five search queries across French names, English names, and equipment terms all return results
6. "Tous les exercices" reset clears filters
7. Language toggle switches to English heading "Find your movement." and back to French
8. Ten random exercise details expand with visible frame images (complete and naturalWidth > 0)
9. "Filmer cet exercice" button on bicep_curl, lateral_raise, lat_pulldown navigates to analyze with correct lift key
10. Back navigation returns to choose screen
11. Zero console errors, zero failed network requests
