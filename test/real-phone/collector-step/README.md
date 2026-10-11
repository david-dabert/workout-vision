# Evidence: the collector step (cb6b8f6 to its STOP)

Saved by David's decision of 29 September 2026 (PLAN.md, GROWTH): every reviewer report and every command output quoted in the STOP report, as the tool wrote it.

## reviews/
Each sub-agent report, taken verbatim from the session transcript, with the prompt it was given (`*.prompt.txt`). The first line of each report is the header the session harness adds to every sub-agent report.

| File | Started (UTC) | Agent | Covers |
|---|---|---|---|
| 01-7db43e2-reviewer-1 | 2026-09-28 19:29 | wv-reviewer | collector, first review |
| 02-7db43e2-reviewer-2 | 2026-09-28 19:35 | wv-reviewer | collector, second review |
| 03-7db43e2-reviewer-3 | 2026-09-29 01:59 | wv-reviewer | collector, third review, scoped to the changes since the second |
| 04-7db43e2-verifier | 2026-09-29 02:02 | wv-verifier | c4ba790..7db43e2 |
| 05-f28696d-reviewer-1 | 2026-09-29 02:12 | wv-reviewer | navigation fix, first review |
| 06-f28696d-reviewer-2 | 2026-09-29 02:17 | wv-reviewer | navigation fix, second review |
| 07-fe66505-reviewer-1 | 2026-09-29 02:53 | wv-reviewer | WebKit runs, first review |
| 08-fe66505-reviewer-2 | 2026-09-29 02:58 | wv-reviewer | WebKit runs, second review |
| 09-fe66505-verifier | 2026-09-29 03:09 | wv-verifier | cb6b8f6..fe66505 |
| 10-collector-fixes-reviewer-1 | 2026-09-29 | wv-reviewer | the change committed with this folder |

The verifier's report on this change is added by the commit that follows it.

## outputs/
Command output, as written by the command.
- 01, 02: src/lib/__tests__/collector.test.js before and after the refusal-message fix. Before: the old messages of src/collect-main.js at 7db43e2, moved unchanged into `refusal()`.
- 03: e2e/collect.spec.js with the notice test, run on a build of fe66505 (the test fails there).
- 04 to 08: lint, typecheck, unit tests, build and browser tests (Chromium) on the working tree of this commit.
- 09: tactility "rail, card and transition", 10 runs in Chromium. It replaces the "10 times in 10" of f28696d's message, which had no pasted output; the "38 passed, 22 skipped" of that message is struck.
- 11, 13: the unit tests written for review 10's findings, before and after the fix (01 and 02 hold an earlier version of the same tests, run on the first fix).
- 12: the notice test with the wording review 10 asked for, before the fix (Chromium, working tree).
- 10: lines of CI run 147 on fe66505 (job "Browser tests (Chromium and WebKit)"), read through the GitHub API.

## attestation.md
The session's statement for the RULES lines that leave nothing in the repository to check.
