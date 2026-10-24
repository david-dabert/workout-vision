#!/bin/sh
# Local checks of PR #247 with plain Node: the proxy's upload route and glimpse.js, at main (c8219b6) and at the fix
# (37114a0), each read from git. Written on 24 October 2026 because this workspace cannot install vitest (network.txt);
# CI's run of the tests is in ../ci.txt. Usage, from the repository root:
#   sh test/real-phone/defect1-glimpse/checks/local-checks.sh
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=$(mktemp -d)
for rev in c8219b6 37114a0; do
  mkdir -p "$out/$rev/glimpse-proxy/lib" "$out/$rev/src/lib/kine"
  for f in glimpse-proxy/lib/handlers.js glimpse-proxy/lib/guard.js glimpse-proxy/lib/commentary.js src/lib/kine/glimpse.js; do
    git show "$rev:$f" > "$out/$rev/$f"
  done
  git show "$rev:src/lib/kine/attemptStorage.js" > "$out/$rev/src/lib/kine/attemptStorage.js" 2>/dev/null || true
  # Vite's import.meta.env, which plain Node lacks, read from a global the check sets.
  sed -i 's#import\.meta\.env#globalThis.__env#g' "$out/$rev/src/lib/kine/glimpse.js"
done
node "$here/proxy-upload.mjs" "$out/c8219b6" "$out/37114a0"
node "$here/glimpse-env.mjs" "$out/c8219b6" "$out/37114a0"
rm -rf "$out"
