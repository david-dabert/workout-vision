#!/bin/bash
# Deploy the feedback worker to Cloudflare in one shot.
# Prerequisites: npm install -g wrangler && npx wrangler login
set -euo pipefail
cd "$(dirname "$0")"

echo "=== Step 1: Create D1 database ==="
DB_OUTPUT=$(npx wrangler d1 create workout-vision-feedback 2>&1 || true)
DB_ID=$(echo "$DB_OUTPUT" | grep -o 'database_id = "[^"]*"' | head -1 | cut -d'"' -f2)

if [ -z "$DB_ID" ]; then
  # Database may already exist, try to get its ID
  DB_ID=$(npx wrangler d1 list 2>&1 | grep workout-vision-feedback | awk '{print $1}')
fi

if [ -z "$DB_ID" ]; then
  echo "ERROR: Could not create or find D1 database. Run 'npx wrangler login' first."
  exit 1
fi

echo "Database ID: $DB_ID"

# Patch wrangler.toml with the database ID
sed -i.bak "s/database_id = .*/database_id = \"$DB_ID\"/" wrangler.toml
rm -f wrangler.toml.bak

echo "=== Step 2: Initialize schema ==="
npx wrangler d1 execute workout-vision-feedback --file=schema.sql --remote

echo "=== Step 3: Deploy worker ==="
DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract the worker URL
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*\.workers\.dev' | head -1)
echo ""
echo "=== Done ==="
echo "Worker URL: $WORKER_URL"
echo ""
echo "Next steps:"
echo "1. Set the GitHub Actions secret:"
echo "   gh secret set VITE_FEEDBACK_URL --body '${WORKER_URL}'"
echo ""
echo "2. Add to deploy.yml env (or rebuild):"
echo "   env:"
echo "     VITE_FEEDBACK_URL: \${{ secrets.VITE_FEEDBACK_URL }}"
echo ""
echo "3. Test:"
echo "   curl -X POST ${WORKER_URL}/ingest -H 'Content-Type: application/json' \\"
echo "     -d '{\"v\":1,\"kind\":\"rating\",\"message\":\"deploy test\"}'"
echo "   curl ${WORKER_URL}/dashboard"
