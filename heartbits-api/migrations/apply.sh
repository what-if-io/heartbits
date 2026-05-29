#!/usr/bin/env bash
# Usage: DATABASE_URL=postgres://... ./migrations/apply.sh
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL must be set}"

echo "Applying 001_initial_schema.sql..."
psql "$DB" -f "$(dirname "$0")/001_initial_schema.sql"
echo "Done."
