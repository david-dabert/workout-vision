# 002. CI refuses a reading that has no eval
Status: ready
Claim: an agent cannot put a new reading on a screen without the proof METHOD.md asks for.
Reference: the readings hidden on 11 November 2026 (`measures.js`, `UNVALIDATED_BIOMECHANICS_SHOWN`) and the measurement of that day on David's 20 stored sets (STATE.md).
Eval: a test that runs each analyzer rendered by a screen on David's labelled sets and fails when a verdict fires on more than 80 % of them or on none, unless the analyzer is behind a switch that is off. It must fail on main with the switch forced on, and pass with it off.
Baseline: no such test. `no-unmeasured-metrics.test.jsx` checks a list of words.
Scope: tests and `ci.yml` only. No screen changes.
Stop: if the analyzers cannot be listed from the code without a hand-kept list, keep the hand-kept list and say so.
Needs from David: nothing.
