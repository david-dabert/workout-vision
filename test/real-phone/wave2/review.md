# wv-reviewer

Goal: Coach report and PDF, history, short-screen Film, service-worker update and clip-collector fixes, with their tests.

## Initial findings

1. P1: A slow read hides access to saved history. sets.js discards a result that arrives after 300 ms, leaving Choice without a history link.
2. P2: Manually logged sets receive a false automatic-count claim. History did not pass source to Report.
3. The PDF race test checked only the filename and PDF header, allowing stale document contents to pass.

## Follow-up verdict (unchanged)

NONE in the follow-up changes.

Checked:

- Late storage results now expose history after the timeout.
- Manual origin reaches the report and produces French and English manual-entry wording.
- The PDF race test now extracts and checks the client name and notes.
- Added history tests cover slow IndexedDB opening and manual reports in both languages.
- Rechecked input handling, share guards, async completion, unmount cleanup, and the changed strings.

Runtime tests and physical iPhone behavior remain unverified by this review.
