# Defect 1: the patient video upload off in production (PR #247, 24 October 2026)

The evidence of the step, saved as PLAN.md lines 250 and 279 require.
State map of 21 October 2026, defect 1: `src/lib/kine/glimpse.js:43` put the patient's attempt video into Vercel Blob with public access.
David, 24 October 2026: "switch the patient video upload off in production until private storage is proven on CI".

- `reviewer-2026-10-24.md`: the wv-reviewer pass on the uncommitted change, as written, and what was done with it.
- `control-2026-10-24.md`: the wv-control check of the first drafts of the REPORT and of the message to David, as written, and what was done with it.
- `control-2-2026-10-24.md`: its second pass, on the second drafts, as written, and what was done with it.
- `ci.txt`: CI's verdicts, read through the GitHub API (this workspace cannot read CI's logs). The tests alone (6f01f41) fail on main's code, five of them; the fix (37114a0) and the evidence (dd1fbf8) pass every job.
- `deploys.txt`: every GitHub Pages deploy since 17 October; 16 succeeded after the commentary landed (8f31606), none failed. Also the two deploys of 15 and 16 October that failed at `npm test` on the media address.
- `network.txt`: what this workspace could not reach (the npm registry, CI's logs, the repository variables, the live site, Azélie's Vercel scope), and what the connected Vercel account lists.
- `checks/`: `local-checks.sh` and its two scripts run the proxy's upload route and `glimpse.js` with plain Node at c8219b6 and 37114a0; `local-checks.txt` is their output.
