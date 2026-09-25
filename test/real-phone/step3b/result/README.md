# Result screen evidence

Playwright WebKit, iPhone 14 profile, dark mode, French locale.

## Screenshots

- `01-result-counted-ask.png` — counted result with giant golden numeral "8", rep bars (8 lit), "Nous avons compté 8. Est-ce juste?" ask card with Oui/Non buttons, arm and view metadata
- `02-result-fix-stepper.png` — correction stepper with "Combien en avez-vous fait?" question, round -/+ buttons (54px), large serif stepper number, Enregistrer button
- `03-result-saved.png` — saved confirmation with "Série enregistrée sur votre téléphone" message, "Rapport pour mon coach" button with document icon, "Nouvelle série" text button
- `04-result-refused.png` — refused state with "Nous n'avons pas pu compter cette série" title, "bras droit est sorti du cadre" explanation, fix note with correction instructions, Refilmer and Choisir une autre vidéo buttons

## What the evidence script tests

1. Result screen renders at full viewport height (no WebKit collapse), 688px+
2. Giant numeral uses serif font at clamp(170px, 56vw, 260px) — measured at 218px on iPhone 14
3. Golden gradient text on numeral (background-clip: text)
4. Rep bars: 8 bars rendered, all 8 lit for 8-rep result
5. Ask card with glass morphism background, serif question text at 31px
6. Yes/No button row with grid layout
7. Exercise name in eyebrow, arm + view metadata in monospace
8. Close button (X icon) in topbar with "Version de test" pill
9. Fix stepper: round buttons at 54px (44px+ touch targets), serif number at 74px
10. Saved state: confirmation message, coach report button with icon, new set text button
11. Refused state: title, body text explanation, fix note with correction, refilm/pick buttons
12. Four complete states tested: ask, fix, saved, refused
13. Zero console errors, zero failed network requests

## Integration notes

CoreUpload renders the Result component when initialFile is set and analysis completes.
Result handles saving workouts to storage (not CoreUpload in experience mode).
