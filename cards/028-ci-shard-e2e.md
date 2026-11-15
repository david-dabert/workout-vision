# 028. Shard CI browser tests across four parallel runners
Status: done (14 November 2026, Antigravity: PR #430 merged at c1dc4429; the browser tests run on four shards, about 6 to 12 minutes each against 29 minutes before). Status set by the nightly run of 15 November 2026, which found it still marked ready.
Executor: fast
Claim: Pull request and main CI runs the `Browser tests (Chromium and WebKit)` gate across 4 parallel `--workers=1` Playwright shards while keeping the exact required check context name `Browser tests (Chromium and WebKit)`.
Reference: `docs/FLAWS-2026-11.md` (#28: CI runs spend ~25-29 minutes waiting on a single sequential Playwright job); GitHub main branch protection required check context `Browser tests (Chromium and WebKit)`.
Eval: CI workflow `.github/workflows/ci.yml` triggers `e2e-shard` (`shard: [1, 2, 3, 4]`, `--shard=${{ matrix.shard }}/4 --project=core --retries=1 --workers=1`), `e2e` (`name: Browser tests (Chromium and WebKit)`, `needs: [e2e-shard]`, `if: always()`) passes only when all 4 shards succeed, and all 4 required checks turn green on the pull request faster than baseline (`29m31s`).
Baseline: Run `43635227561` (`Browser tests (Chromium and WebKit)` single runner): `29m28s`.
Scope: `.github/workflows/ci.yml`, `cards/028-ci-shard-e2e.md`. Zero edits to `src/`, `e2e/`, or counting parameters.
Stop: Revert if any Playwright test depends on cross-spec sequential execution across shards.
Needs from David: nothing.
