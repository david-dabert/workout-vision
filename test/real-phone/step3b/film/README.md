# Film screen evidence

Playwright WebKit, iPhone 14 profile, dark mode, French locale.

## Screenshots

- `lateral_raise.png` — film screen for lateral raise, "Filmé de face" eyebrow, reference pose canvas with corner marks and scan line, 3 instruction steps, "Filmer ma série" golden CTA, "Choisir une vidéo" ghost button, privacy notice
- `bicep_curl.png` — film screen for bicep curl, "Filmé de profil" eyebrow, side-view reference pose
- `lat_pulldown.png` — film screen for lat pulldown, "Filmé de face" eyebrow, front-view reference pose
- `full-scroll.png` — full page scroll capture of lateral raise film screen

## What the evidence script tests

1. Tapping each of the 3 lifts on the Choice screen navigates to the Film screen
2. Eyebrow shows correct filming direction (face/profil) per lift view configuration
3. Title displays the French lift name
4. Reference pose canvas renders inside the phone-shaped frame
5. Corner marks SVG and animated scan line are visible
6. Caption text "Le cadrage de la série de référence" is present
7. Three numbered instruction steps are displayed
8. Primary CTA "Filmer ma série" has a file input with capture="environment" and accept="video/*,.mov"
9. Ghost button "Choisir une vidéo" has a file input with accept="video/*,.mov"
10. Privacy notice "La vidéo reste sur votre téléphone" with lock icon is visible
11. "Version de test" pill is present
12. Back button returns to Choice screen for each lift
13. Film screen height exceeds 500px (no WebKit position:fixed collapse)
14. Primary button height >= 44px (touch target compliance)
15. Ghost button height >= 44px (touch target compliance)
16. Zero console errors, zero failed network requests
