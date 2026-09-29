# Evidence: GROWTH step 1 (feedback and sharing)

- outputs/01: unit tests written first, run before the code (the sheet's tests fail on the old sheet; the link tests fail on a missing module).
- outputs/02: the report browser tests on the build of the previous commit (they fail: the old screen names a coach).
- outputs/09 to 12: the tests written for the review's findings, before and after the fix.
- outputs/03 to 08: build, report browser tests, lint, typecheck, unit tests and all browser tests (Chromium) on the step's code.
- screens/: Chromium at 390×664, 2x, taken before the review's fixes. The report's sheet from a saved set in the history (the subtitle and the partner reset changed after it). The result screen's saved card was rendered by a temporary page that is not committed (a saved card needs a real analysis); it shows the card's buttons and links, not the screen's top.
- french-copy.md: the new French copy, for David's approval.
- reviews/: the reviewer's reports, as the tool wrote them.

Not tested here: the share sheet (headless Chromium has none; the copy fallback ran) and the mail app. Both are for David's iPhone.

## Open
- Nothing tests the result screen's new buttons in the app itself: a saved card needs a real analysis, and the clips are not in CI. The link and share logic is tested as functions (src/lib/__tests__/reportLinks.test.js). The tour in CI, after this step, is where it belongs.
- test/real-phone/step3b/report/evidence.mjs and step3b/result/evidence.mjs, a past step's evidence scripts, still name the old fields; tour.mjs and pdf-race.mjs follow the new ones but need David's clips to run.
