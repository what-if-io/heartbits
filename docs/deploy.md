# HeartBits — Deployment

## Production stack

| | |
|---|---|
| **VM** | Hetzner CX33 — `root@178.105.210.108` |
| **App** | `https://heartbits.what-if.io` |
| **Auth** | `https://auth.heartbits.what-if.io` (Zitadel v4.14) |
| **Relay** | `https://relay.heartbits.what-if.io` |
| **Compose root** | `~/deploy/` on the VM |

DNS: all three domains → `178.105.210.108`, gray-cloud (DNS-only) in Cloudflare.

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
2. Prompts for the four domains (skipped if already in `.env`)
3. Generates all secrets and writes `.env` (skipped if `.env` already has `APP_DOMAIN`)
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
ssh root@178.105.210.108
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

### heartbits-web

```bash
# Local — rebuild
cd ~/Projects/Heartbits/heartbits-web
bun run build

# Sync and restart (bun install runs inside the container on start)
rsync -avz --delete ~/Projects/Heartbits/heartbits-web/ root@178.105.210.108:~/deploy/../heartbits-web/
ssh root@178.105.210.108 'cd ~/deploy && docker compose restart heartbits-web'
```

### heartbits-api

```bash
rsync -avz ~/Projects/Heartbits/heartbits-api/ root@178.105.210.108:~/deploy/../heartbits-api/
ssh root@178.105.210.108 'cd ~/deploy && docker compose restart heartbits-api'
```

### relay-server

```bash
rsync -avz ~/Projects/Heartbits/relay-server/ root@178.105.210.108:~/deploy/../relay-server/
ssh root@178.105.210.108 'cd ~/deploy && docker compose restart heartbits-relay'
```

### Deploy config only (Caddyfile, compose.yml)

```bash
./remote_do.sh   # rsyncs all deploy/ files then runs do.sh (idempotent)
```

---

## Staging gate

`STAGING_PASSWORD` in `.env` gates the app behind a simple password wall (served by the SvelteKit app itself — no browser auth dialogs). Not set → no gate.

```bash
ssh root@178.105.210.108
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
ssh root@178.105.210.108 'cd ~/deploy && docker compose ps'

# Logs
ssh root@178.105.210.108 'cd ~/deploy && docker compose logs -f heartbits-web'
ssh root@178.105.210.108 'cd ~/deploy && docker compose logs -f zitadel'

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
ssh root@178.105.210.108
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

---

## what-if.io VM (legacy)

The `tam@what-if.io` VM still runs PhD landing, Spring hunt, and Zitadel (`account.what-if.io`)
for those services. HeartBits has moved to the Hetzner VM above.

Compose root: `~/p/main/deploy/what-ifio/`  
Auth: `https://account.what-if.io`

```bash
ssh tam@what-if.io
cd ~/p/main/deploy/what-ifio
docker compose ps
```

---

## Environment variables reference

### `deploy/.env`

| Variable | Description |
|---|---|
| `APP_DOMAIN` | `heartbits.what-if.io` |
| `AUTH_DOMAIN` | `auth.heartbits.what-if.io` |
| `RELAY_DOMAIN` | `relay.heartbits.what-if.io` |
| `ACME_EMAIL` | Let's Encrypt contact |
| `POSTGRES_PASSWORD` | PostgreSQL password (generated) |
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
