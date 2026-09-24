#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "==> Clearing any stale git locks (sandbox artefacts)..."
rm -f .git/index.lock .git/HEAD.lock 2>/dev/null || true

echo ""
echo "==> Current branch: $(git branch --show-current)"
echo "==> Status:"
git status --short
echo ""

# Ensure we're on ci-honesty
git checkout ci-honesty

# Stage and commit STATE.md + BACKLOG.md if they have changes
if git status --short | grep -qE "STATE\.md|BACKLOG\.md"; then
  echo "==> Committing STATE.md + BACKLOG.md updates..."
  git add STATE.md BACKLOG.md
  git commit -m "0.6: record baseline in STATE.md, open two BACKLOG items

STATE.md:
- baseline replay 76%/66%/1.61 with 2 clips silently excluded under old gate
- record 0.6 in-progress state

BACKLOG.md (new file per R7):
- threshold drift from 2026-09-09 baseline (80/70/1.40 -> 76/66/1.61)
- two Countix clips with landmark extraction failure"
fi

# Create the throwaway proof branch if it doesn't exist
if ! git show-ref --verify --quiet refs/heads/ci-honesty-broken-proof; then
  echo ""
  echo "==> Creating throwaway proof branch ci-honesty-broken-proof..."
  git checkout -b ci-honesty-broken-proof
  # Bump CI_MIN_ACCURACY to 95 (current baseline is 76, so gate will fail)
  sed -i.bak 's/const CI_MIN_ACCURACY = 75;/const CI_MIN_ACCURACY = 95;  \/\/ DELIBERATE BREAK for phase 0.6 proof/' benchmark/replay-benchmark.mjs
  rm benchmark/replay-benchmark.mjs.bak
  git add benchmark/replay-benchmark.mjs
  git commit -m "0.6 PROOF (throwaway): raise CI_MIN_ACCURACY to 95 to prove the gate fails

This branch exists only to demonstrate that CI now fails when the
benchmark gate does not pass. It must be deleted after the red CI run
is observed. Do NOT merge."
  git checkout ci-honesty
fi

echo ""
echo "==> Pushing ci-honesty to origin..."
git push -u origin ci-honesty

echo ""
echo "==> Pushing ci-honesty-broken-proof to origin (throwaway)..."
git push -u origin ci-honesty-broken-proof

echo ""
echo "==> Done."
echo ""
echo "Next :"
echo "  1. Open the PR on GitHub for ci-honesty."
echo "     Paste _pr-description-ci-honesty.md as the description."
echo "  2. Wait for CI on ci-honesty-broken-proof — it should turn RED."
echo "  3. Once red is confirmed, delete the throwaway :"
echo "     git push origin --delete ci-honesty-broken-proof"
echo "     git branch -D ci-honesty-broken-proof"
echo "  4. Delete the _*.command and _*.md helper files in this folder."
echo ""
echo "Close this window when finished."
