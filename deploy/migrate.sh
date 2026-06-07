#!/usr/bin/env sh
# Apply HeartBits DB migrations against the running postgres container.
# Idempotent — safe to run on every deploy.
# Usage: ./migrate.sh   (from the deploy/ directory)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

# Load .env so POSTGRES_PASSWORD / WORKER_POSTGRES_PASSWORD are available
if [ -f "${SCRIPT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${SCRIPT_DIR}/.env"
  set +a
fi

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

echo "  Postgres ready. Applying migrations..."

# Apply every migrations/*.sql in lexical order (001, 002, ...).
# Each migration must be idempotent — this runs on every deploy.
for _m in "${SCRIPT_DIR}"/../heartbits-api/migrations/*.sql; do
  echo "    → $(basename "${_m}")"
  docker compose exec -T postgres psql -U heartbits -d heartbits < "${_m}"
done

echo "  Setting role passwords from environment..."

# Set heartbits_api password from POSTGRES_PASSWORD (same creds compose uses)
if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  docker compose exec -T postgres psql -U heartbits -d heartbits \
    -c "ALTER ROLE heartbits_api PASSWORD '${POSTGRES_PASSWORD}';"
  echo "  heartbits_api password updated."
fi

# Set heartbits_worker password from WORKER_POSTGRES_PASSWORD.
# Hard-fail: the worker role has BYPASSRLS + DELETE ON app.users — it must never
# be left on the migration placeholder password ('changeme').
if [ -z "${WORKER_POSTGRES_PASSWORD:-}" ]; then
  echo "ERROR: WORKER_POSTGRES_PASSWORD is not set. Refusing to leave the BYPASSRLS"
  echo "       worker role on its placeholder password. Set it in deploy/.env"
  echo "       (do.sh generates it automatically) and re-run."
  exit 1
fi
docker compose exec -T postgres psql -U heartbits -d heartbits \
  -c "ALTER ROLE heartbits_worker PASSWORD '${WORKER_POSTGRES_PASSWORD}';"
echo "  heartbits_worker password updated."

echo "── Migrations complete ───────────────────────────────────────────────────────"
