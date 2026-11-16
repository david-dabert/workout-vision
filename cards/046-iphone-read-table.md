# 046. The iPhone's read of the bundled clips, set beside the computer's, in one committed table
Status: done (the tool); the table waits on David's run
Executor: fast (Antigravity)
Phase: 1 (its gate's first condition, PLAN.md)
Claim: when David runs « Run all 15 » on check.html on his iPhone and sends the copied result, one command turns it into a committed table that sets each clip's iPhone read beside the computer's read of the same file, and says for each clip whether the counts agree.
Reference: PLAN.md, Phase 1: "every clip of that table counts the same on the iPhone as on the computer". The macOS runners cannot reproduce the iPhone read (TRIED.md, 14 November 2026): the phone's own read is the proof. check.html copies one JSON entry per clip (`src/lib/check.js` `formatDemoEntry`: id, file, lift, label, count, samplesRead, decoderPath, rotationDecision, poseCoverage, notDecodable, fingerprint).
Eval: `scripts/iphone-read-table.mjs <phone.json>` writes `test/real-phone/iphone-read/table.md` (one row per clip of `DEMO_CLIPS`: label, iPhone count, computer count, agree yes or no, decoder, samples read, pose coverage) and exits 1 when any clip disagrees or is missing. The computer's read: Chromium where it decodes the file (`e2e/check-inject.spec.js`), macOS WebKit where it does not (`.github/workflows/safari-readings.yml`; the HEVC `.mov` clips); a clip with no computer read is listed as such, never dropped. Unit tests on a fixture payload: agreeing, disagreeing, missing and not-decodable clips.
Baseline: never run; no iPhone payload committed.
Scope: the script, its tests, the table folder. No counting file, no screen.
Stop: if a clip's computer read cannot be produced, list it in the table with the reason and report on #190.
Needs from David: one run of « Run all 15 » on check.html on his iPhone, the copied result sent (about 5 minutes).
