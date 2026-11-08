# Testers' blind counts: moved

Since 8 November 2026 (Phase 6 of David's order of 6 November 2026, `PLAN.md`), a tester's sets live in `test/real-phone/blind/<tester>/`.
`test/real-phone/blind/README.md` describes the file a phone writes, the import (`scripts/import-sets.mjs --tester`) and the gate (`npm run scoreboard:blind`).

This folder keeps `exposed.json`: the sets `scripts/tester-exam.mjs --record` has read, so none is scored twice as an unseen exam.
