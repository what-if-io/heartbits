# HeartBits — Deployment

## Production stack

| | |
|---|---|
| **VM** | Hetzner CX33 — `root@YOUR_SERVER_IP` |
| **App** | `https://heartbits.what-if.io` |
| **Auth** | `https://auth.heartbits.what-if.io` (Zitadel v4.14) |
| **Relay** | `https://relay.heartbits.what-if.io` |
| **Compose root** | `~/deploy/` on the VM |

DNS: all three domains → `YOUR_SERVER_IP`, gray-cloud (DNS-only) in Cloudflare.

---

## Deploy from local (one command)

```bash
cd ~/Projects/Heartbits/deploy
./remote_do.sh
```

`remote_do.sh` rsyncs `deploy/` to the VM (skipping `.env` and PAT files), then SSHes in and runs `do.sh`. Safe to run again at any time — if `HEARTBITS_CLIENT_ID` is already set the bootstrap is skipped and only `docker compose up -d` runs.

To override the target VM:
```bash
VM=root@other-ip ./remote_do.sh
```

---

## Fresh VM — what do.sh does

1. Installs Docker if missing (Ubuntu/Debian/RHEL/Rocky)
2. Prompts for three domains — app, auth, relay — plus the ACME email (skipped if already in `.env`)
3. Generates secrets (Postgres incl. worker, MinIO, Zitadel, session, field-encryption, room token) and writes `.env` (skipped if `.env` already has `APP_DOMAIN`)

> **Manual `.env` additions for full functionality:** `do.sh` does not prompt for
> `MEDIA_DOMAIN`, `API_DOMAIN`, `STATUS_DOMAIN`, the `SMTP_*` mail settings, or
> `REGISTRATION_OPEN`/`REGISTRATION_ALLOWLIST`. Without `MEDIA_DOMAIN` + SMTP,
> profile photos and transactional email won't work — add them to `.env` and
> `docker compose up -d` (see the table below).
4. `docker compose up -d` — starts the full stack
5. Waits for Zitadel first-init to write `admin.pat` (up to 5 min)
6. Runs `bootstrap.sh` — creates OIDC app, applies branding, writes `HEARTBITS_CLIENT_ID`
7. `docker compose up -d --force-recreate heartbits-web heartbits-api` — picks up new client ID

If `.env` already has `HEARTBITS_CLIENT_ID`, steps 5–7 are skipped.

---

## Re-deploying after a fresh VM or `down --volumes`

A `down --volumes` wipes the Zitadel DB. Before re-running:

```bash
# On the VM — clear stale secrets so do.sh re-bootstraps
ssh root@YOUR_SERVER_IP
cd ~/deploy
sed -i 's/^HEARTBITS_CLIENT_ID=.*/HEARTBITS_CLIENT_ID=/' .env
rm -f zitadel/bootstrap/admin.pat zitadel/bootstrap/login-client.pat
```

Then from local:
```bash
./remote_do.sh
```

---

## What bootstrap.sh does

- Waits for Zitadel to be reachable
- Validates `admin.pat` (IAM_OWNER machine user, written by Zitadel first-init)
- Creates HeartBits project + PKCE OIDC app → extracts `clientId`
- Applies branding: `#FF6B6B` / `#070710` palette, uploads logo SVG + icon SVG, activates policy
- Writes `HEARTBITS_CLIENT_ID` to `.env`
- Restarts `heartbits-web` and `heartbits-api`

bootstrap.sh is idempotent: exits early if `HEARTBITS_CLIENT_ID` is already set.

---

## Deploying code changes

Each service now builds a **Docker image** from its `Dockerfile` (no install-at-boot).
Deploy = sync the source, then rebuild + recreate that service:

```bash
# Example: web (same pattern for heartbits-api / heartbits-worker / relay-server / heartbits-monitor)
rsync -avz --delete --exclude node_modules --exclude .env \
  ~/Projects/Heartbits/heartbits-web/ root@YOUR_SERVER_IP:~/heartbits-web/
ssh root@YOUR_SERVER_IP 'cd ~/deploy && docker compose up -d --build heartbits-web'
```

- `heartbits-api` and `heartbits-worker` share one image (`heartbits-api/Dockerfile`) —
  rebuild both with `docker compose up -d --build heartbits-api heartbits-worker`.
- For a fuller rollout: `docker compose up -d --build` (rebuilds everything that changed).
- **Better (recommended for prod):** build images in CI and push to a registry, then
  `docker compose pull && up -d` on the VM — avoids building on the app server.

### Deploy config only (Caddyfile, compose.yml)

```bash
./remote_do.sh   # rsyncs all deploy/ files then runs do.sh (idempotent)
```

---

## Staging gate

`STAGING_PASSWORD` in `.env` gates the app behind a simple password wall (served by the SvelteKit app itself — no browser auth dialogs). Not set → no gate.

```bash
ssh root@YOUR_SERVER_IP
cd ~/deploy
# Enable
echo "STAGING_PASSWORD=secret" >> .env
docker compose up -d heartbits-web

# Disable
sed -i '/^STAGING_PASSWORD=/d' .env
docker compose up -d heartbits-web
```

---

## Service health

```bash
ssh root@YOUR_SERVER_IP 'cd ~/deploy && docker compose ps'

# Logs
ssh root@YOUR_SERVER_IP 'cd ~/deploy && docker compose logs -f heartbits-web'
ssh root@YOUR_SERVER_IP 'cd ~/deploy && docker compose logs -f zitadel'

# OIDC discovery
curl -s https://auth.heartbits.what-if.io/.well-known/openid-configuration | python3 -m json.tool | head -10

# Login CSP check (should show img-src with https://auth.heartbits.what-if.io)
curl -sI https://auth.heartbits.what-if.io/ui/v2/login/login | grep content-security
```

---

## Zitadel admin

Console: `https://auth.heartbits.what-if.io/ui/console`  
Login: `admin` / `ZITADEL_ADMIN_PASSWORD` (in `.env`)

### Getting a management API token

`admin.pat` (in `~/deploy/zitadel/bootstrap/admin.pat`) is the IAM_OWNER machine user PAT.
Valid until 2099. Use it directly:

```bash
TOKEN=$(cat ~/deploy/zitadel/bootstrap/admin.pat)
curl -sf https://auth.heartbits.what-if.io/admin/v1/policies/label \
  -H "Authorization: Bearer $TOKEN"
```

### Re-applying branding

```bash
ssh root@YOUR_SERVER_IP
cd ~/deploy
# Re-run only the branding section (bootstrap exits early if CLIENT_ID set)
# Workaround: call the API directly with admin.pat
TOKEN=$(cat zitadel/bootstrap/admin.pat)
bash bootstrap.sh   # no-op if CLIENT_ID already set; run after clearing it to re-apply
```

To force-reapply branding without re-bootstrapping the OIDC app:

```bash
TOKEN=$(cat ~/deploy/zitadel/bootstrap/admin.pat)
AUTH=https://auth.heartbits.what-if.io
curl -sf -X PUT "$AUTH/admin/v1/policies/label" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"primaryColor":"#FF6B6B","backgroundColor":"#070710","warnColor":"#FF6B6B",
       "fontColor":"#FFFFFF","primaryColorDark":"#FF6B6B","backgroundColorDark":"#070710",
       "warnColorDark":"#FF6B6B","fontColorDark":"#FFFFFF","disableWatermark":true}'
curl -sf -X POST "$AUTH/admin/v1/policies/label/_activate" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{}'
```

### Fixing opaque access tokens on a live instance

If the API rejects access tokens with `JWT verification failed: Invalid Compact JWS`,
Zitadel is issuing opaque tokens instead of JWTs. Fresh deploys via `bootstrap.sh` set
the correct type, but earlier installs need a one-shot patch:

```bash
ssh root@YOUR_SERVER_IP
cd ~/deploy
./fix-jwt-tokens.sh   # finds the heartbits-web app, switches accessTokenType → JWT, restarts api+web
```

---

## Environment variables reference

### `deploy/.env`

| Variable | Description |
|---|---|
| `APP_DOMAIN` | your app domain, e.g. `heartbits.example.com` |
| `AUTH_DOMAIN` | your auth domain, e.g. `auth.heartbits.example.com` |
| `RELAY_DOMAIN` | your relay domain, e.g. `relay.heartbits.example.com` |
| `ACME_EMAIL` | Let's Encrypt contact |
| `POSTGRES_PASSWORD` | PostgreSQL password (generated) |
| `WORKER_POSTGRES_PASSWORD` | Password for the BYPASSRLS worker role (generated) |
| `MINIO_USER` | `heartbits` |
| `MINIO_PASSWORD` | MinIO password (generated) |
| `ZITADEL_MASTERKEY` | Exactly 32 hex chars (generated) |
| `ZITADEL_ADMIN_PASSWORD` | Zitadel admin password (generated, complexity required) |
| `HEARTBITS_CLIENT_ID` | OIDC client ID — set by bootstrap.sh |
| `HEARTBITS_CLIENT_SECRET` | Empty (PKCE flow, no secret) |
| `SESSION_SECRET` | 64 hex chars — SvelteKit session signing |
| `STAGING_PASSWORD` | Optional gate password |
| `HB_FIELD_ENCRYPTION_KEY` | 64 hex chars — API field encryption |
| `ROOM_TOKEN` | WebSocket relay bearer token |
| `MEDIA_DOMAIN` | Media CDN subdomain (MinIO via Caddy), e.g. `media.heartbits.example.com` — **required for photos** |
| `API_DOMAIN` | Optional `api.` subdomain vhost (the app also serves `/api/*` same-origin) |
| `STATUS_DOMAIN` | Optional `status.` subdomain for the status page |
| `REGISTRATION_OPEN` | `true` = open signups; `false` (default) = invite-only (waitlist) |
| `REGISTRATION_ALLOWLIST` | Comma-separated emails allowed to register when invite-only |
| `SMTP_HOST` / `SMTP_PORT` | Mail server (transactional + Zitadel email) |
| `SMTP_USER` / `SMTP_PASSWORD` | Mail credentials |
| `SMTP_FROM` / `SMTP_FROM_NAME` | From address + display name |

### Backups

Nightly `pg_dumpall` + MinIO + monitor backups via `deploy/backup.sh`
(`make backup`); restore with `deploy/restore.sh`. Set `BACKUP_REMOTE` for
off-box copies. Full procedure: [`backup.md`](backup.md).
