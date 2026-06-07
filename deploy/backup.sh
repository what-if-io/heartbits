#!/usr/bin/env bash
# HeartBits backup — Postgres (all DBs + roles) + MinIO objects + monitor history.
# Run from the deploy/ directory (the Compose project dir):  ./backup.sh
#
# Env:
#   BACKUP_DIR      where to write backups        (default /root/backups)
#   RETENTION_DAYS  delete backups older than N   (default 14)
#   BACKUP_REMOTE   optional rsync target for off-box copies, e.g.
#                   user@host:/srv/heartbits-backups  (STRONGLY recommended —
#                   a backup on the same VM does not survive losing the VM)
#
# Restore: see docs/backup.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "${SCRIPT_DIR}"

BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TS="$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# ── Postgres: pg_dumpall captures every database (heartbits + zitadel) plus
#    roles/globals, so a restore recreates the cluster faithfully. ────────────
log "Dumping Postgres (all databases + globals)…"
docker compose exec -T postgres pg_dumpall -U heartbits \
  | gzip > "${BACKUP_DIR}/postgres-${TS}.sql.gz"
log "  → postgres-${TS}.sql.gz ($(du -h "${BACKUP_DIR}/postgres-${TS}.sql.gz" | cut -f1))"

# ── MinIO: tar the object volume via a throwaway container (no need to know the
#    volume name; --volumes-from mounts the live minio container's /data). ─────
log "Archiving MinIO objects…"
MINIO_CID="$(docker compose ps -q minio)"
if [ -n "${MINIO_CID}" ]; then
  docker run --rm --volumes-from "${MINIO_CID}" -v "${BACKUP_DIR}":/backup alpine \
    tar czf "/backup/minio-${TS}.tgz" -C /data .
  log "  → minio-${TS}.tgz ($(du -h "${BACKUP_DIR}/minio-${TS}.tgz" | cut -f1))"
else
  log "  ! minio container not running — skipped"
fi

# ── Monitor SQLite uptime history (small, best-effort). ─────────────────────
MON_CID="$(docker compose ps -q heartbits-monitor || true)"
if [ -n "${MON_CID}" ]; then
  docker run --rm --volumes-from "${MON_CID}" -v "${BACKUP_DIR}":/backup alpine \
    tar czf "/backup/monitor-${TS}.tgz" -C /data . || true
fi

# ── Retention. ──────────────────────────────────────────────────────────────
log "Pruning backups older than ${RETENTION_DAYS} days…"
find "${BACKUP_DIR}" -maxdepth 1 -type f \
  \( -name 'postgres-*.sql.gz' -o -name 'minio-*.tgz' -o -name 'monitor-*.tgz' \) \
  -mtime +"${RETENTION_DAYS}" -print -delete || true

# ── Optional off-box copy. ──────────────────────────────────────────────────
if [ -n "${BACKUP_REMOTE:-}" ]; then
  log "Syncing to off-box target ${BACKUP_REMOTE}…"
  rsync -az --delete "${BACKUP_DIR}/" "${BACKUP_REMOTE}/"
fi

log "Backup complete → ${BACKUP_DIR}"
