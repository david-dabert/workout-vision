# Testers' blind-count sets (R1, 25 October 2026)

Landmark files sent from the history screen (« Envoyer les séries collectées »; `src/lib/phoneCollect.js`, `src/lib/blind.js`) by testers David names.
Each file carries `blind: { count, p }` (the count given in the app before it showed its own, or `null` for « Je ne sais pas ») and `count` (the count kept after seeing the app's).

## Import

```bash
node scripts/import-sets.mjs <folder-of-.json.gz-files> --tester <name>          # plan only
node scripts/import-sets.mjs <folder-of-.json.gz-files> --tester <name> --write  # copy into test/real-phone/testers/<name>/
```

The import script refuses duplicates across `sets-*`, `exam/*`, and `testers/*` by the 8-hex fingerprint in the file name, and verifies that each file carries `blind: { count, p }`.

## Scoreboard & One-shot Exam

- `npm run scoreboard`: prints the `Testers' blind counts` section with its date, lists every imported set, and enforces the R2 gate (`testerBlindCounts` in `test/real-phone/accuracy/scoreboard-baseline.json`).
- `npm run exam:testers -- [--record]`: runs the one-shot exam across unexposed sets in `test/real-phone/testers/<name>/` and (with `--record`) records each read set in `test/real-phone/testers/exposed.json` so it is never scored twice as an unseen exam.
