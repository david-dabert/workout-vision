# Report screen evidence

Playwright WebKit, iPhone 14 profile, dark mode, French locale.

## Screenshots

- `01-report-filled.png` — full report with client/coach names, notes, paper sheet with rep table, share button
- `02-report-corrected.png` — corrected report showing "Compté par l'app : 8. Corrigé : 10." line

## What the evidence script tests

1. Report screen renders at full viewport height (no WebKit collapse), 500px+
2. Title "Rapport pour votre coach"
3. Form grid with two side-by-side fields (client + coach)
4. Input fields at 50px height (44px+ touch targets)
5. Notes textarea visible
6. Paper sheet with warm background (--paper token)
7. Sheet title "Rapport de séance" in serif font
8. People grid with client and coach names
9. Count numeral at 58px serif font, golden colour (#8A6630)
10. Rep table with 8 rows, 5 columns (Rép./Durée/Amplitude/Montée/Descente)
11. Notes section on paper sheet
12. Footer with disclaimer text
13. Share PDF button
14. Back button (chevron left) in topbar
15. Corrected state: correction line with original and corrected counts
16. Zero console errors, zero failed network requests

## Integration notes

CoreUpload renders Report when user taps "Rapport pour mon coach" on the saved Result screen.
Report receives the result data, lift, and trueN (corrected count if different from app count).
