# The tour in CI

tour.mjs runs in the "Tour" job of .github/workflows/ci.yml: every screen the app reaches without a
video, on the production build, in WebKit with the iPhone profile, in French, at 390×664, 390×745 and
375×548, and at 390×664 with Reduce Motion and with the light appearance. Each change of screen is
shot 150 ms after the tap; every shot is checked for a blank or white frame and every settled screen
for its layout (test/real-phone/checks.mjs); at 390×664 and 390×745 the main action must be in view.
A console error, a page error, a request that never loads or any fault fails the job.

The shots and each setting's results.json (with the srcHash of the code shot) are the run's
artifacts, kept five days; the results are also printed in the job's log. The analysis, result and
replay screens need David's clips and run on the Mac (test/real-phone/step3b/tour/tour.mjs).

Locally, where WebKit is missing: WV_BROWSER=chromium PW_CHROMIUM=… node test/real-phone/tour-ci/tour.mjs,
with the build served by npx vite preview --port 4175.

film-button.mjs opens the filming screen of all 181 offered exercises at 390×664, 390×745 and 375×548
and writes film-button-after.txt: where "Filmer ma série" ends on each. It runs in the same job, after
the tour, and fails when the button is out of view at 664 px or taller, or when it did not open 181
exercises. The committed file is a local Chromium run (its first line names the browser); the WebKit
file is in the job's artifact. At 375×548 some exercises still need a short scroll.
