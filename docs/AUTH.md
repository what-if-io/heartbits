# HeartBits — Auth Reference

Auth provider: Zitadel v4.14 at `https://auth.heartbits.what-if.io`  
Flow: PKCE Authorization Code (no client secret)  
Session: HMAC-signed cookie (`hb_session`), 7-day TTL  

---

## Flow overview

```
Browser                    heartbits-web              Zitadel
   │                            │                        │
   ├── GET /auth/initiate ──────►│                        │
   │                            ├── generate PKCE ──────►│
   │                            │   store verifier+state │
   │◄── 302 → Zitadel ─────────┤   in httpOnly cookies  │
   │                            │                        │
   ├─────────────────────────────────────── GET /oauth/v2/authorize ──►│
   │◄────────────────────────────────────────────────────── 302 + code ┤
   │                            │                        │
   ├── GET /auth/callback ──────►│                        │
   │    ?code=...&state=... ────►│                        │
   │                            ├── exchange code ───────►│
   │                            │   + PKCE verifier       │
   │                            │◄── tokens ─────────────┤
   │                            │   (access + id token)  │
   │                            ├── sign session cookie  │
   │◄── 302 /discover ─────────┤   clear PKCE cookies   │
```

### Key files

| File | Role |
|---|---|
| `src/lib/server/auth.ts` | OIDC config, session serialization/parsing, cookie helpers |
| `src/hooks.server.ts` | Reads session cookie on every request; populates `event.locals.user` |
| `src/routes/auth/initiate/+server.ts` | `GET /auth/initiate` — generates PKCE, redirects to Zitadel |
| `src/routes/auth/callback/+server.ts` | `GET /auth/callback` — exchanges code, sets session cookie |
| `src/routes/auth/login/+page.server.ts` | `GET /auth/login` — redirects if already logged in, passes `issuer` to page |
| `src/routes/auth/logout/+server.ts` | `GET /auth/logout` — clears cookie, calls Zitadel end_session |
| `src/routes/+layout.server.ts` | Exposes `user` from `locals` to all pages |

### Protected routes

Defined in `src/hooks.server.ts`:

```ts
const PROTECTED_PREFIXES = ['/discover', '/matches', '/bond', '/profile'];
```

Unauthenticated requests redirect to `/auth/login?next=<original-path>`.

### Session cookie

- Name: `hb_session`
- Value: `base64url(JSON(SessionData)).HMAC-SHA256`
- Signed with `SESSION_SECRET` (env var) — fails at startup if missing
- `httpOnly`, `secure`, `sameSite=lax`, path `/`
- Expires: 7 days (or when Zitadel token expires, whichever is sooner)

`SessionData` contains: `userId`, `email`, `name`, `accessToken`, `expiresAt`.

---

## Zitadel instance

### Admin access

URL: `https://auth.heartbits.what-if.io/ui/console`  
Login: `admin@auth.heartbits.what-if.io` / `${ZITADEL_ADMIN_PASSWORD}`

The console requires HTTP/2 (gRPC-web). Behind Caddy, this works via:
```caddyfile
transport http {
    versions h2c 2
}
```

The console also fetches `/ui/console/assets/environment.json`. Behind a TLS proxy,
Zitadel generates `"api":"http://..."` in this file even with `EXTERNALSECURE=true`.
This is intercepted by Caddy:
```caddyfile
handle /ui/console/assets/environment.json {
    header Content-Type "application/json"
    respond `{"api":"https://auth.heartbits.what-if.io","issuer":"https://auth.heartbits.what-if.io","clientid":"YOUR_ZITADEL_INSTANCE_ID"}` 200
}
```

### HeartBits app registration

The HeartBits OIDC app lives in the HeartBits project under the TreasureHunt org.

| Field | Value |
|---|---|
| Client ID | `YOUR_HEARTBITS_CLIENT_ID` (in `.env` as `HEARTBITS_CLIENT_ID`) |
| Auth method | `PKCE` (no client secret) |
| Grant type | Authorization Code |
| Redirect URIs | `https://heartbits.what-if.io/auth/callback`, `http://localhost:5173/auth/callback` |
| Post-logout URIs | `https://heartbits.what-if.io`, `http://localhost:5173` |

Managed by `bootstrap-heartbits.sh` on first run.

### Login UI

Zitadel v4 uses a separate Next.js login container (`ghcr.io/zitadel/zitadel-login:v4.14.0`).
It runs at `https://auth.heartbits.what-if.io/ui/v2/login/` and is proxied by Caddy.

The `login-client.pat` file (at `editions/spring/zitadel/bootstrap/login-client.pat`) is a
JWE-encrypted token for internal communication between the login container and Zitadel.
It cannot be used as a Bearer token in external API calls.

---

## Bootstrap script

`deploy/bootstrap.sh`

Runs once on a fresh Zitadel instance. Idempotent: skips if `HEARTBITS_CLIENT_ID` is already
set in `.env`.

What it does:
1. Initiates a device authorization flow (browser approval required, 5-min window)
2. Creates the HeartBits org (skips if `HEARTBITS_ORG_ID` already in `.env`)
3. Creates the HeartBits project (skips if `HEARTBITS_PROJECT_ID` already in `.env`)
4. Creates the `heartbits-web` OIDC app (PKCE, public client)
5. Writes `HEARTBITS_CLIENT_ID` to `.env`
6. Restarts `heartbits-web`

**Prerequisite:** Admin email must be verified. On a fresh instance it may not be.
To verify it without waiting for an email (no SMTP configured):

```bash
docker exec -i heartbits-postgres-1 psql -U heartbits -d zitadel << 'SQL'
INSERT INTO eventstore.events2
  (instance_id, aggregate_type, aggregate_id, event_type, sequence,
   revision, created_at, payload, creator, owner, position, in_tx_order)
VALUES (
  'YOUR_ZITADEL_INSTANCE_ID', 'user', 'YOUR_ZITADEL_USER_AGGREGATE_ID',
  'user.human.email.verified',
  (SELECT MAX(sequence) + 1 FROM eventstore.events2 WHERE aggregate_id = 'YOUR_ZITADEL_USER_AGGREGATE_ID'),
  1, NOW(), '{}'::jsonb,
  'YOUR_ZITADEL_CREATOR_ID', 'YOUR_ZITADEL_OWNER_ID',
  (SELECT MAX(position) + 0.001 FROM eventstore.events2), 0
);
SQL
docker compose restart zitadel
```

---

## Local development

```bash
# Copy and fill in local values
cp .env.example .env

# Required values for local dev:
# PUBLIC_ZITADEL_ISSUER=https://auth.heartbits.what-if.io
# PUBLIC_ZITADEL_CLIENT_ID=YOUR_HEARTBITS_CLIENT_ID  (or a local test client)
# SESSION_SECRET=<any 32+ hex chars for dev>
# ORIGIN=http://localhost:5173

bun run dev   # or: npm run dev
```

The `getRedirectUri()` function in `src/lib/server/auth.ts` reads `ORIGIN` to build
`redirect_uri` dynamically — no hardcoded callback URL. Local dev uses `http://localhost:5173`
as the fallback when `ORIGIN` is not set.

For the Zitadel app to accept `http://localhost:5173/auth/callback`, it must be in the
registered redirect URIs (already added by default).

---

## Token claims

`SessionData` (stored in the session cookie) is populated from the Zitadel ID token:

| Field | Claim source |
|---|---|
| `userId` | `sub` |
| `email` | `email` |
| `name` | `name` → `preferred_username` → `email` (first truthy) |
| `accessToken` | `access_token` from token endpoint |
| `expiresAt` | `expires_in` + now, or now + 3600 if absent |

The `accessToken` is forwarded as `Authorization: Bearer` to the HeartBits API.
The API validates it independently using Zitadel's JWKS endpoint.

---

## Known Zitadel v4 quirks

| Issue | Fix |
|---|---|
| Console "Failed to fetch" | Caddy must use `h2c` transport for Zitadel proxy |
| `environment.json` returns `http://` API URL | Caddy intercepts and overrides the response |
| ROPC grant disabled | Use device authorization or authorization code flow |
| `login-client.pat` is JWE | Cannot be used as a Bearer token externally |
| Email verification required on first login | Verify directly via event store insert (see above) |
| Device code 5-min expiry | `bootstrap-heartbits.sh` must be run while browser is available |
| Opaque access tokens by default | Set `"accessTokenType": "OIDC_TOKEN_TYPE_JWT"` on app create — API uses `jwtVerify` and rejects opaque tokens with "Invalid Compact JWS" |
| OIDC config update path differs from create | Update via `PUT /management/v1/projects/{p}/apps/{a}/oidc_config` (not `/apps/oidc/{a}`); `fix-jwt-tokens.sh` patches a live instance |
