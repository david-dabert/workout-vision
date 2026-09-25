# Watch screen evidence

Playwright WebKit, iPhone 14 profile, dark mode, French locale.

## Screenshots

- `01-film-before.png` — film screen rendered before navigating to watch (confirms film flow works)
- `02-watch-42pct.png` — watch screen at 42% progress, exercise name eyebrow, large serif percentage counter, golden gradient progress bar, privacy notice, skip button
- `03-watch-0pct.png` — watch screen at 0% (analysis start)
- `04-watch-100pct.png` — watch screen at 100% (analysis complete)
- `05-watch-en.png` — watch screen in English at 67%, "Analysed on your phone. Nothing is sent."

## What the evidence script tests

1. Film screen loads correctly from Choice (confirms prior screen still works)
2. Watch screen renders at full viewport height (no WebKit position:fixed collapse)
3. Exercise name displayed in eyebrow at top
4. Percentage counter uses serif font at 66px
5. Progress bar width matches percentage (42%)
6. Privacy notice "Analysé sur votre téléphone. Rien n'est envoyé." present with lock icon
7. Skip button visible with 44px minimum touch target
8. Layout uses flexbox space-between (eyebrow at top, controls at bottom, 200px+ gap)
9. Progress states at 0%, 42%, and 100% render correctly
10. English version renders correctly
11. Design system tokens (--ink, --bone, --lamp, etc.) are available
12. Zero console errors, zero failed network requests

## Integration notes

CoreUpload auto-starts analysis when initialFile prop is provided from the Film screen.
While busy, it renders the Watch component instead of the standard form UI.
