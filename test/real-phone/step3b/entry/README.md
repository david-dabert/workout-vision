# Entry screen evidence

Production Vite build, Playwright WebKit, iPhone 14 profile. Run `npm run build`, `npm run preview -- --host 127.0.0.1 --port 4175 --strictPort`, then `node test/real-phone/step3b/entry/evidence.mjs`.

The renderer, entry pose, copy, CSS and timing are ported from `design/experience-prototype.html`. CSS is scoped to prevent the existing app changing it. Fonts are bundled locally; Vite emits font files rather than CSP-blocked data URLs. No model request occurs on entry. The model uses a SHA-256-named service-worker cache on demand; activation deletes only superseded WorkoutVision caches.

First visit, skip, Enter, deep-link preservation, returning visit, explicit replay, local fonts and reduced-motion canvas stability are asserted in `evidence.mjs`; results and console output are in `results.json`. WASM is served as `application/wasm` by Vite preview. The physical iPhone haptic tick is unverified; the Safari switch is changed only by a real tap, and Enter calls navigator.vibrate where available.

The old landing and mandatory onboarding are bypassed. Other existing screens remain for the next screen-by-screen replacements. Counting and decoding code are unchanged. Accuracy was not remeasured for this UI change.

Screenshots were opened and visually reviewed before these captions were written:

- `01-entry-fr.png`: French entry with the golden particle figure, the prototype's three lines, Entrer and the test-version notice.
- `02-after-enter.png`: The preserved analysis deep link opens the existing upload screen after Entrer, with exercise and video inputs.
- `03-replay-skipped.png`: The replayed French entry after tapping the background to skip the introduction timing.
- `04-reduced-en.png`: The English entry with the complete figure and text held still under reduced motion.

Build and check output is saved alongside this report. BUILD FIXES CI evidence is in `../../build-fixes/ci.txt`.
