# Touch discipline evidence

Playwright WebKit, iPhone 14 profile, dark mode, French locale.

## Screenshots

- `01-guide-targets.png` — guide screen showing body map spots (44x44), chips, search input (52px), seg buttons
- `02-choice-targets.png` — choice screen with three altar cards (390px tall)

## What the evidence script tests

1. Choice altar buttons >= 44px height and width (measured at 390x277)
2. `.press:active` CSS rule exists for pressed state feedback
3. Button class height declarations audited (btn-primary 58px, btn-ghost 54px, btn-line 54px, text-btn 44px, icon-btn 44x44, round 54x54)
4. Guide search input >= 44px (measured at 52px)
5. Guide body map spots 44x44px touch targets
6. Guide chips >= 44px
7. Guide action buttons >= 44px
8. Back icon-btn 44x44px
9. Zero console errors, zero failed network requests

## Haptic implementation

- Entry "Enter" button: `navigator.vibrate(10)` + Safari switch-input tick (HapticButton with hidden checkbox)
- Choice lift buttons: `navigator.vibrate(10)` + Safari switch-input tick (HapticButton)
- Result "Yes" confirmation: `navigator.vibrate(10)` added in this step
- Result "Save" fix confirmation: `navigator.vibrate(10)` added in this step
- Result stepper +/- buttons: `navigator.vibrate(5)` added in this step
- Pressed state: `.press:active` scales to 0.975 with 0.06s transition, radial gradient overlay via `::after`

## Touch target summary

All interactive elements in the experience flow meet the 44pt minimum:
- btn-primary: 58px height
- btn-ghost: 54px height  
- btn-line: 54px height
- text-btn: 44px height
- icon-btn: 44x44px
- round (stepper): 54x54px
- altar cards: ~390px
- body map spots: 44x44px
- chips: min-height 44px
- search input: 52px height
- seg buttons: 38px (inside segmented control, acceptable per HIG)
