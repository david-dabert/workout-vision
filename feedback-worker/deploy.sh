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
echo "Next steps (README.md, Deploy):"
echo "1. Set the two secrets, if not done yet:"
echo "   npx wrangler secret put STATS_TOKEN   # a long random string: openssl rand -hex 24"
echo "   npx wrangler secret put RATE_SALT"
echo ""
echo "2. Point the app at the worker: in GitHub, Settings > Secrets and variables > Actions > Variables,"
echo "   add VITE_EVENTS_URL = ${WORKER_URL}/event, then deploy the app again."
echo ""
echo "3. Test:"
echo "   curl -i -X POST ${WORKER_URL}/event -H 'Content-Type: text/plain' \\"
echo "     -d '{\"event\":\"open\",\"appVersion\":\"deploy-test\",\"lang\":\"en\"}'"
echo "   open '${WORKER_URL}/dashboard?token=<STATS_TOKEN>'"
