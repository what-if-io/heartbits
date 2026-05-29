#!/usr/bin/env sh
# Apply HeartBits DB migrations against the running postgres container.
# Idempotent — safe to run on every deploy.
# Usage: ./migrate.sh   (from the deploy/ directory)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

echo "── HeartBits DB migrations ──────────────────────────────────────────────────"

# Wait until postgres is accepting connections
_waited=0
until docker compose exec -T postgres pg_isready -U heartbits -d heartbits >/dev/null 2>&1; do
  sleep 2
  _waited=$((_waited + 2))
  if [ "$_waited" -ge 60 ]; then
    echo "ERROR: Postgres did not become ready within 60 seconds."
    exit 1
  fi
done

echo "  Postgres ready. Applying 001_initial_schema.sql..."

docker compose exec -T postgres psql -U heartbits -d heartbits \
  < "${SCRIPT_DIR}/../heartbits-api/migrations/001_initial_schema.sql"

echo "── Migrations complete ───────────────────────────────────────────────────────"
