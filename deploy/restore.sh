#!/usr/bin/env bash
# HeartBits restore — DESTRUCTIVE. Restores Postgres (all DBs/roles) and,
# optionally, the MinIO object store from files produced by backup.sh.
#
# Usage (from deploy/):
#   ./restore.sh --force <postgres-YYYYMMDD-HHMMSS.sql.gz> [minio-YYYYMMDD-HHMMSS.tgz]
#
# Best practice: restore into a FRESH stack. For a full disaster recovery:
#   docker compose down -v && docker compose up -d postgres minio   # empty volumes
#   ./restore.sh --force /root/backups/postgres-*.sql.gz /root/backups/minio-*.tgz
#   docker compose up -d                                            # bring up the rest
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

if [ "${1:-}" != "--force" ]; then
  echo "Refusing to run without --force (this OVERWRITES the database and objects)."
  echo "Usage: ./restore.sh --force <postgres.sql.gz> [minio.tgz]"
  exit 1
fi
shift

PG_FILE="${1:?Provide the postgres-*.sql.gz file}"
MINIO_FILE="${2:-}"

[ -f "${PG_FILE}" ] || { echo "Postgres backup not found: ${PG_FILE}"; exit 1; }

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ── Postgres: pipe the pg_dumpall script into psql (connect to the maintenance
#    'postgres' db; the dump (re)creates roles + databases). ──────────────────
log "Restoring Postgres from ${PG_FILE}…"
gunzip -c "${PG_FILE}" | docker compose exec -T postgres psql -U heartbits -d postgres
log "  Postgres restore complete."

# ── MinIO: extract the object archive back into the volume. ──────────────────
if [ -n "${MINIO_FILE}" ]; then
  [ -f "${MINIO_FILE}" ] || { echo "MinIO backup not found: ${MINIO_FILE}"; exit 1; }
  MINIO_CID="$(docker compose ps -q minio)"
  [ -n "${MINIO_CID}" ] || { echo "minio container not running"; exit 1; }
  log "Restoring MinIO objects from ${MINIO_FILE}…"
  # Copy archive into a throwaway container that shares minio's /data, extract it.
  docker run --rm --volumes-from "${MINIO_CID}" -v "$(cd "$(dirname "${MINIO_FILE}")" && pwd)":/backup \
    alpine sh -c "tar xzf /backup/$(basename "${MINIO_FILE}") -C /data"
  log "  MinIO restore complete (restart minio to be safe: docker compose restart minio)."
fi

log "Restore finished."
