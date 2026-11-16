# 058. A client's results carry load, effort and pain back to the coach
Status: ready (behind a switch, off in production until Phase 1's gate)
Executor: fast (Antigravity)
Phase: 2 (built now, switched off)
Claim: a coach who sends a programme by link gets back, per set, the reps, the load, the effort (0 to 10) and any pain the client noted.
Reference: review panel of 16 November 2026, coach lens: results carry reps and who counted them (`programme.js:419-426`), not the load the athlete now saves, effort or pain; a programme item has no load (`programme.js:17-21`).
Eval: an e2e: a programme 3 x 10 at 60 kg is sent; the client saves with effort 7; the coach's results show 60 kg and 7. The payload stays under `MAX_PAYLOAD` at every limit. Pain is the client's own words, never turned into advice (physiotherapist lens).
Scope: `programme.js`, `Programme.jsx`, `Results.jsx`, behind `COACH_LOOP_SHOWN` (off). No counting file.
Stop: if the link exceeds its size limit, stop and report.
Needs from David: nothing until Phase 2.
