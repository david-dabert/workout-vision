# Evidence: GROWTH step 1 (feedback and sharing)

- outputs/01: unit tests written first, run before the code (the sheet's tests fail on the old sheet; the link tests fail on a missing module).
- outputs/02: the report browser tests on the build of the previous commit (they fail: the old screen names a coach).
- outputs/09 to 12: the tests written for the review's findings, before and after the fix.
- outputs/13, 14: CI run 149's overlap, reproduced by holding the partner field's animation at 20 ms, before and after the fix (a fade in place of a rise).
- outputs/15: the press test of 9299f0f with main.jsx's scroll scoping removed (it failed).
- outputs/16, 17: the press test after CI run 150, run in Chromium with the iPhone's touch settings: 10 times with main.jsx as committed, and once each with a part of main.jsx's scroll handling removed for the run (each fails; the diff heads each file). WebKit itself runs in CI.
- outputs/03 to 08: build, report browser tests, lint, typecheck, unit tests and all browser tests (Chromium) on the step's code.
- outputs/22, 23: the tests written for review 05 (the challenge after a correction gives both numbers; which report a result offers), before and after.
- outputs/18, 19: the tests written for the verifier's findings (a refused set's report; "analysed", not "filmed"), before and after.
- outputs/20: the links on each result screen shot by harness/shoot.mjs, as the page carries them.
- outputs/21: CI run 151's browser tests on 958006a.
- screens/: Chromium at 390×664, 2x, shot on the working tree just before the commit that adds them, so the app version in outputs/20 names that commit's parent.
  - result-*.png: shot by harness/shoot.mjs, which renders the result screen alone from harness/result-harness.jsx (a saved card needs a real analysis). Every number on them comes from that file: 8 reps of 80° to 87°, each 2.0 s, in a 26 s set.
  - report-*.png: shot by harness/report-shot.pw.js on the production build, from a saved set of 7 curls entered in the history.
- french-copy.md: the new French copy, for David's approval.
- reviews/: the reviewers' and the verifier's reports, as the tool wrote them. The verifier's report 04 says collector-step/reviews/10 does not exist: it does (`ls test/real-phone/collector-step/reviews/` lists it; `git log --oneline -- test/real-phone/collector-step/reviews/10-collector-fixes-reviewer-1.report.txt` gives 366271a).

Not tested here: the share sheet (headless Chromium has none; the copy fallback ran) and the mail app. Both are for David's iPhone.

## Open
- No screenshot shows the result after a failed save; which report it offers is tested in reportFor (src/lib/__tests__/reportLinks.test.js), and the retry that clears "not saved" is untested (Result is not rendered by any test).
- The analysis error and interrupted screens offer no report: they have no count. Whether PLAN.md's "every result" includes them is David's call.
- Nothing tests the result screen's new buttons in the app itself: a saved card needs a real analysis, and the clips are not in CI. The link and share logic is tested as functions (src/lib/__tests__/reportLinks.test.js). The tour in CI, after this step, is where it belongs.
- test/real-phone/step3b/report/evidence.mjs and step3b/result/evidence.mjs, a past step's evidence scripts, still name the old fields; tour.mjs and pdf-race.mjs follow the new ones but need David's clips to run.
