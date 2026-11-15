#!/usr/bin/env bash
# Writes this GitHub event's lines (entry.mjs) on the branch `ledger`. Each attempt starts again from the branch as it
# stands, so two events written at once never conflict: the later push fails, fetches the earlier one and adds its line
# on top. Never forces a push. A push made with the workflow's token starts no workflow, so the ledger never logs itself.
set -euo pipefail
# LEDGER_REMOTE: another remote, for a test of this script; in the workflow the repository itself, with its token.
if [ -n "${LEDGER_REMOTE:-}" ]; then REMOTE="$LEDGER_REMOTE"; else
  : "${GH_TOKEN:?the workflow token is needed to push the ledger}"
  REMOTE="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
fi
TREE="${RUNNER_TEMP:-/tmp}/ledger"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/entry.mjs"
for attempt in 1 2 3 4 5 6 7 8; do
  rm -rf "$TREE"
  if ! git clone --quiet --depth 1 --branch ledger --single-branch "$REMOTE" "$TREE" 2>/dev/null; then
    # The first event ever: the branch does not exist yet, and starts with no history.
    git init --quiet --initial-branch=ledger "$TREE"
    git -C "$TREE" remote add origin "$REMOTE"
  fi
  node "$SCRIPT" --write "$TREE"
  git -C "$TREE" add -A
  if git -C "$TREE" diff --cached --quiet; then echo "nothing to record"; exit 0; fi
  git -C "$TREE" -c user.name="ledger" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" \
    commit --quiet -m "ledger: ${GITHUB_EVENT_NAME} (run ${GITHUB_RUN_ID})"
  if git -C "$TREE" push --quiet origin HEAD:refs/heads/ledger; then echo "recorded (attempt ${attempt})"; exit 0; fi
  sleep $(( attempt * 2 + RANDOM % 4 ))
done
echo "the ledger could not be written after 8 attempts" >&2
exit 1
