# Backups & restore

HeartBits keeps all state in Docker volumes: **Postgres** (`heartbits` app DB +
`zitadel` auth DB), **MinIO** (profile photos / media), and the **monitor**
SQLite uptime history. `deploy/backup.sh` captures all three; `deploy/restore.sh`
restores them.

## What gets backed up

| Source | How | File |
|---|---|---|
| Postgres (all DBs + roles/globals) | `pg_dumpall` → gzip | `postgres-<ts>.sql.gz` |
| MinIO objects | `tar` of the live volume | `minio-<ts>.tgz` |
| Monitor history | `tar` of the volume | `monitor-<ts>.tgz` |

Heart-rate biometric data is **never** persisted (it only transits the relay), so
it is intentionally not in scope.

## Running a backup

From the `deploy/` directory on the server:

```bash
./backup.sh
# or: make backup   (from repo root)
```

Environment overrides:

- `BACKUP_DIR` — output directory (default `/root/backups`)
- `RETENTION_DAYS` — prune older backups (default `14`)
- `BACKUP_REMOTE` — **off-box** rsync target, e.g. `user@host:/srv/hb-backups`.
  **Strongly recommended** — a backup on the same VM does not survive losing the VM.

## Scheduling (nightly cron)

```bash
# Run nightly at 03:30, log to /var/log/heartbits-backup.log
( crontab -l 2>/dev/null; \
  echo "30 3 * * * cd /root/deploy && BACKUP_REMOTE=user@host:/srv/hb-backups ./backup.sh >> /var/log/heartbits-backup.log 2>&1" \
) | crontab -
```

Verify with `crontab -l`.

## Restoring

`restore.sh` is **destructive** and requires `--force`. The clean path (full DR):

```bash
cd /root/deploy
docker compose down -v                 # wipe volumes
docker compose up -d postgres minio    # empty cluster + object store
./restore.sh --force /root/backups/postgres-<ts>.sql.gz /root/backups/minio-<ts>.tgz
docker compose restart minio           # ensure minio re-reads restored data
docker compose up -d                   # bring up the rest of the stack
```

To restore only Postgres, omit the MinIO argument. For a partial/in-place restore
into a running cluster, expect role/database-already-exists noise — restoring into
a fresh cluster (above) is the supported procedure.

## Test your backups

A backup you haven't restored is a hope, not a backup. Periodically restore the
latest archive into a throwaway stack and confirm the app boots and data is present.
