# HeartBits — Architecture Reference

> Living document. Update when decisions change, not after the fact.

---

## Vision

A dating app whose core differentiator is real-time biometric heartbeat sharing.
No other dating app does this. The "like" is sending your heartbeat.
The moment two people match, their hearts sync live for the first time.

---

## Service Map

```
                        ┌─────────────────────────────────────────────┐
                        │           Caddy 2 (TLS + routing)            │
                        │  hb.what-if.io       → heartbits-relay:8765 │
                        │  heartbits.what-if.io → heartbits-web:3000  │
                        │  account.what-if.io  → zitadel:8180         │
                        │  (planned) api.what-if.io → heartbits-api   │
                        │  (planned) media.what-if.io → minio:9000    │
                        └─────────────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────┐
         │                              │                          │
┌────────▼────────┐        ┌────────────▼────────┐      ┌─────────▼───────┐
│ heartbits-relay │        │  heartbits-api       │      │      minio      │
│ (Node.js)       │◄───────│  (Bun + Elysia)      │      │  (S3-compat     │
│ room fanout     │        │  profiles, matches,  │      │   photo store)  │
│ Phase 0: token  │        │  bonds, notifs       │      └─────────────────┘
│ Phase 1: JWT+RLS│        └────────────┬─────────┘
└─────────────────┘                     │
                                        │
         ┌──────────────────────────────┼──────────────────────────┐
         │                              │                          │
┌────────▼────────┐        ┌────────────▼────────┐      ┌─────────▼───────┐
│  PostgreSQL 16  │        │     Redis 7          │      │ heartbits-worker│
│  app + billing  │        │  sessions, rate      │      │ (Bun)           │
│  schemas        │        │  limits, relay room  │      │ matching queue, │
└─────────────────┘        │  tokens, JWKS cache  │      │ notifs, media   │
                           └─────────────────────┘      └─────────────────┘
         │
┌────────▼────────┐
│    Zitadel      │
│  OIDC provider  │
└─────────────────┘
```

---

## Domains

| Subdomain | Service | Status |
|---|---|---|
| `hb.what-if.io` | WebSocket relay | Live |
| `heartbits.what-if.io` | SvelteKit web app / PWA | Live (basic-auth gated) |
| `account.what-if.io` | Zitadel OIDC + login UI | Live |
| `api.what-if.io` | REST API (heartbits-api) | Planned |
| `media.what-if.io` | Signed photo URLs via MinIO | Planned |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| API | Bun + Elysia | Native Bun, first-class TS, built-in OpenAPI, Eden Treaty for client type-safety |
| Web frontend | SvelteKit | Lighter and more expressive for animation-heavy UI than Next.js |
| Auth | Zitadel (existing) | OIDC, PKCE-native, already deployed |
| Database | PostgreSQL 16 (existing) | Two schemas: `app` + `billing` |
| Cache / rate limiting | Redis 7 (existing) | Sliding window counters, relay room tokens |
| Photo storage | MinIO | S3-compatible, runs in Docker, zero egress cost; migrate to R2 later trivially |
| Background jobs | Bun worker process | Same codebase as API, different entrypoint |

---

## Auth Flow

PKCE Authorization Code flow via Zitadel (`https://account.what-if.io`):

```
App (mobile/web)
  │
  ├─1─► PKCE auth request → https://account.what-if.io/oauth/v2/authorize
  ├─2─◄ Authorization code (redirect to heartbits://auth/callback or heartbits.what-if.io/auth/callback)
  ├─3─► Token exchange → access_token + id_token
  └─4─► API calls: Authorization: Bearer <access_token>
        Relay WS:   ?token=<access_token>  (Phase 1) or ROOM_TOKEN (Phase 0)
```

`access_token` is a Zitadel-signed JWT. Both the API and the relay verify it locally
via JWKS — no Zitadel round-trip per request. JWKS is cached in Redis with a 1-hour TTL.

JWT validation enforces `iss` (ZITADEL_ISSUER) and `aud` (ZITADEL_CLIENT_ID) claims
to prevent token-confusion attacks across projects.

Web app sessions are stored in an HMAC-signed cookie (`hb_session`). See `docs/AUTH.md`
for the full web auth flow and Zitadel setup details.

On first API call after login: `POST /api/v1/me/init` creates a profile row keyed to
the Zitadel `sub` claim (stable UUID, never changes).

---

## API Routes

All authenticated routes require `Authorization: Bearer <access_token>`.

### Health

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| GET | `/health` | None | — |

### Me (current user)

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| POST | `/api/v1/me/init` | JWT (token only — no DB user required) | — | Idempotent bootstrap |
| GET | `/api/v1/me` | JWT + DB user | — | Returns decrypted profile |
| PATCH | `/api/v1/me` | JWT + DB user | — | Re-encrypts PII fields |
| DELETE | `/api/v1/me` | JWT + DB user | — | GDPR Art. 17 — erases all PII, soft-deletes user |
| GET | `/api/v1/me/export` | JWT + DB user | 1/24h per user | GDPR Art. 20 — full data export decrypted |
| POST | `/api/v1/me/consent` | JWT + DB user | — | Grant consent (biometric_relay \| marketing) |
| DELETE | `/api/v1/me/consent/:type` | JWT + DB user | — | Withdraw consent; biometric_relay immediately evicts relay room keys |

### Discover

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| GET | `/api/v1/discover` | JWT + DB user | 60/user/hour | Returns max 20 profiles. Never returns geohash or exact age. |

### Swipes

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| POST | `/api/v1/swipes` | JWT + DB user | 200/user/day | like \| pass \| superlike. Creates match+bond on mutual like. |

### Matches

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| GET | `/api/v1/matches` | JWT + DB user | — | List active matches |
| GET | `/api/v1/matches/:id` | JWT + DB user | — | Match detail |
| DELETE | `/api/v1/matches/:id` | JWT + DB user | — | Unmatch |

### Bonds (relay rooms)

| Method | Path | Auth | Rate limit | Notes |
|---|---|---|---|---|
| GET | `/api/v1/bonds` | JWT + DB user | — | List bonds (no room_id in list — use /:id) |
| GET | `/api/v1/bonds/:id` | JWT + DB user + **biometric consent** | — | Returns room_id + relay_url. Requires active `biometric_relay` consent. |
| POST | `/api/v1/bonds` | JWT + DB user + **biometric consent** | — | Create bond for match. Requires active `biometric_relay` consent. |

### Billing (stubs — return 501 until activated)

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/billing/checkout` | JWT + DB user |
| GET | `/api/v1/billing/portal` | JWT + DB user |
| POST | `/api/v1/billing/webhook` | Stripe signature |
| GET | `/api/v1/billing/subscription` | JWT + DB user |

---

## Database Schema

### Two PostgreSQL schemas

- `app` — all application data; row-level security enabled
- `billing` — Stripe IDs only; separate role, isolated from app queries

### Core tables (`app` schema)

**`users`** — identity anchor
```
id              TEXT    PK (UUID format)
zitadel_sub     TEXT    UNIQUE NOT NULL
created_at      TIMESTAMPTZ
last_seen_at    TIMESTAMPTZ
deleted_at      TIMESTAMPTZ          -- soft delete for GDPR erasure
```

**`profiles`** — PII fields encrypted at rest (AES-256-GCM, app layer)
```
id              TEXT    PK  FK→users.id
display_name    BYTEA       encrypted
date_of_birth   BYTEA       encrypted (derive age band only, never expose exact)
bio             BYTEA       encrypted
gender          TEXT        from controlled enum; used in matching
seeking         TEXT[]      gender preferences
age_min         INT
age_max         INT
location_geohash6 TEXT      6-char geohash ≈ 1.2km; client converts GPS→geohash
                            GPS coords NEVER stored server-side
avatar_media_id TEXT    FK→media.id
```

**`media`** — profile photos (private bucket, signed URLs only)
```
id              TEXT    PK
user_id         TEXT    FK→users.id
bucket          TEXT    "heartbits-media"
object_key      TEXT    {user_id}/{uuid}.webp  — not guessable
purpose         TEXT    'avatar' | 'gallery'
sort_order      INT
sha256          TEXT    integrity check
```

**`swipes`**
```
swiper_id       TEXT    FK→users.id
swiped_id       TEXT    FK→users.id
direction       TEXT    'like' | 'pass' | 'superlike'
created_at      TIMESTAMPTZ
```

**`matches`**
```
id              TEXT    PK
user_a_id       TEXT    FK→users.id   -- enforced: user_a < user_b (dedup)
user_b_id       TEXT    FK→users.id
matched_at      TIMESTAMPTZ
unmatched_at    TIMESTAMPTZ
```

**`bonds`** — relay room assignment for a match
```
id              TEXT    PK
match_id        TEXT    FK→matches.id  UNIQUE
room_id         TEXT    UNIQUE NOT NULL  -- UUID4 generated by API (not client)
created_at      TIMESTAMPTZ
```

**`messages`** — encrypted per-match
```
id              TEXT    PK
match_id        TEXT    FK→matches.id
sender_id       TEXT    FK→users.id
body_encrypted  BYTEA   AES-256-GCM, key = HKDF(master_key, match_id)
sent_at         TIMESTAMPTZ
read_at         TIMESTAMPTZ
```

**`consents`** — GDPR Article 9 (biometric data = special category, explicit consent required)
```
id              TEXT    PK
user_id         TEXT    FK→users.id
consent_type    TEXT    'biometric_relay' | 'marketing'
version         TEXT    semver of consent text shown
consented_at    TIMESTAMPTZ
ip_address      INET
withdrawn_at    TIMESTAMPTZ
UNIQUE (user_id, consent_type, version)
```

**`audit_log`** — INSERT-only, never deleted (GDPR erasure anonymises actor_id → NULL)
```
id          TEXT    PK
actor_id    TEXT    NULLABLE — NULL after GDPR erasure
action      TEXT    'profile.update' | 'bond.create' | 'match.unmatch' | 'account.delete'
            'account.export' | 'consent.grant.biometric_relay' | 'consent.withdraw.biometric_relay' …
target_type TEXT
target_id   TEXT
ip_address  INET
created_at  TIMESTAMPTZ
```

### Billing schema (`billing`)

Isolated from `app` queries. `heartbits_api` role can read `plan` only.
`stripe_customer_id` / `stripe_subscription_id` visible to `heartbits_billing` role only.

```
billing.customers:
  user_id                 TEXT    FK→app.users.id
  stripe_customer_id      TEXT    NULL until payments enabled
  stripe_subscription_id  TEXT    NULL until payments enabled
  plan                    TEXT    DEFAULT 'free'
```

---

## Security Decisions

| Area | Decision |
|---|---|
| PII encryption | AES-256-GCM at application layer (not pgcrypto CBC) before INSERT. IV is 96-bit random per encrypt call. GCM auth tag verified on decrypt. Key: 256-bit from env, hex-encoded. |
| Message encryption | Per-match key via HKDF(master_key, match_id) — not yet implemented in routes; architecture ready |
| Location | Geohash-6 only (≈1.2km). GPS coords rejected at API boundary. Discovery returns distance bands, never geohash |
| Photos | Private MinIO bucket. Pre-signed GET URLs, 15-min TTL. Object keys non-guessable |
| Row-level security | Enabled on all `app.*` tables. `SET LOCAL app.current_user_id` per request via `withUser()`. WITH CHECK added to profiles_write to prevent cross-user INSERT. |
| Rate limiting | Redis sliding-window Lua script (atomic): 200 swipes/user/day, 60 discovery/user/hour, 1 export/user/24h. IP-level limit at Caddy layer. |
| Audit log | INSERT-only role. GDPR erasure anonymises actor_id → NULL. SELECT denied to heartbits_api (admin/DBA only). |
| Biometric consent | `consents` table required before relay room_id is returned. `GET /api/v1/bonds/:id` and `POST /api/v1/bonds` both enforce active `biometric_relay` consent. Consent withdrawal immediately evicts Redis relay room keys. |
| GDPR erasure | `DELETE /api/v1/me`: PII fields overwritten with tombstone ciphertext → user soft-deleted → audit_log actor_id anonymised → consents withdrawn → media deletion queued to worker. Hard-delete worker scheduled TODO (30 days after soft-delete). |
| GDPR portability | `GET /api/v1/me/export`: returns all data decrypted in JSON. Rate-limited to 1/24h. |
| JWT validation | `jose` jwtVerify with JWKS from Zitadel. Enforces `iss` (ZITADEL_ISSUER) and `aud` (ZITADEL_CLIENT_ID) claims. JWKS cached in Redis (1h TTL). Expiry enforced by jose. |
| PCI scope | `billing` schema isolated. Stripe tokens never visible to `heartbits_api` role |
| Security headers | Caddy sets: X-Content-Type-Options, X-Frame-Options, CSP, HSTS, Referrer-Policy, Permissions-Policy on all HeartBits endpoints |

---

## GDPR Compliance

### Data collected and legal basis

| Data | Category | Legal basis | Retention intent |
|---|---|---|---|
| Zitadel `sub` (identifier) | PII | Contract performance (Art. 6(1)(b)) | Duration of account + 30 days |
| Display name, bio | PII | Contract performance | Duration of account + 30 days |
| Date of birth | PII | Contract performance (age verification) | Duration of account + 30 days |
| Location (geohash-6) | PII | Legitimate interest / contract | Duration of account; not persisted after update |
| Gender, seeking | PII | Contract performance | Duration of account + 30 days |
| Profile photos | PII | Contract performance | Duration of account; MinIO objects deleted on erasure |
| Swipe history | Behavioural | Contract performance | Duration of account + 30 days |
| Match history | Behavioural | Contract performance | Duration of account + 30 days |
| Heart rate (biometric) | **GDPR Art. 9 special category** | **Explicit consent (Art. 9(2)(a))** | Never stored — relay fanout only, no persistence |
| Audit log entries | Compliance | Legal obligation (Art. 6(1)(c)) | 7 years (anonymised — actor_id → NULL on erasure) |
| Consent records | Compliance | Legal obligation | Duration of account + 7 years |
| IP address (consents, audit) | PII | Legitimate interest (fraud/abuse) | Follows parent table retention |

### What is implemented vs. TODO

| Right / Requirement | Status | Endpoint |
|---|---|---|
| Right to erasure (Art. 17) | IMPLEMENTED | `DELETE /api/v1/me` |
| Right to portability (Art. 20) | IMPLEMENTED (stub — synchronous) | `GET /api/v1/me/export` |
| Consent grant | IMPLEMENTED | `POST /api/v1/me/consent` |
| Consent withdrawal | IMPLEMENTED | `DELETE /api/v1/me/consent/:type` |
| Biometric consent gate on relay room access | IMPLEMENTED | `GET /api/v1/bonds/:id`, `POST /api/v1/bonds` |
| Consent UI (version-pinned text shown to user) | TODO — client-side |  |
| Hard-delete worker (30 days post soft-delete) | TODO — worker job |  |
| Media deletion worker (MinIO) | TODO — worker job reads `hb:worker:media_delete` queue |  |
| audit_log partitioning (pg_partman) | TODO — see migration comment |  |
| Consent version re-prompt on text update | TODO — client-side |  |
| DPA / Privacy policy page | TODO — legal |  |

### Consent model

`biometric_relay` consent is required before any relay room credential (`room_id`) is
issued. Withdrawal is immediate: all active relay room Redis keys for the user are
deleted, stopping any further biometric data forwarding within the next ping cycle (20s).

Consent is recorded with: user_id, consent_type, version (of the consent text shown),
timestamp, and IP address. The consent text itself is not stored — only the semver that
identifies it. This means the exact text must be retrievable by version from the app's
content system.

---

## Relay Security — Migration Phases

**Phase 0 (done):** Static ROOM_TOKEN. Rotate token — inject via CI secrets / build
config, never hardcode in source or commit to VCS.

**Current state:** Relay code supports Phase 0 and Phase 1 simultaneously.
Phase 1 activates automatically when `REDIS_URL` is set in the relay environment.

**Phase 1 (with login — PENDING):** Relay accepts Zitadel JWTs.
JWT validation: JWKS verify + Redis lookup `relay:room:{room_id}` → `"{user_a}:{user_b}"`.
The API writes this Redis key when creating a bond. No DB call per WebSocket connection.
Room membership is validated: JWT `sub` must be one of user_a or user_b.
If the Redis key is missing (consent withdrawn, or expired), connection is rejected.

**Phase 2 (new client versions — PENDING):** Static token deprecated. JWT only.
All clients must use Phase 1 JWT auth. Remove ROOM_TOKEN fallback from relay.

**SECURITY RISK of Phase 0:** Any client with ROOM_TOKEN can connect to ANY room.
Room isolation is not enforced — a compromised token allows passive listening to any room.
Priority: Deploy Phase 1 before any public users connect.

---

## Payment Readiness

`billing` schema and `heartbits_billing` DB role created at launch even though Stripe is inactive.

Stub endpoints (return 501 until activated):
```
POST /api/v1/billing/checkout    → Stripe checkout session
GET  /api/v1/billing/portal      → Stripe billing portal URL
POST /api/v1/billing/webhook     → ONLY place that writes Stripe token data
GET  /api/v1/billing/subscription
```

Feature gating: `requirePlan('premium')` middleware reads `billing.customers.plan` from
Redis cache. Flip features live without deploy by changing Redis values.

---

## Docker-Compose Additions

New services to add to `deploy/what-ifio/docker-compose.yml`:

```yaml
heartbits-api:
  image: oven/bun:1.2-alpine
  working_dir: /app
  volumes: [./heartbits-api:/app:ro]
  command: bun run start
  environment:
    DATABASE_URL: postgres://heartbits_api:${HB_API_DB_PASSWORD}@postgres:5432/heartbits
    REDIS_URL: redis://redis:6379
    ZITADEL_JWKS_URL: https://account.what-if.io/.well-known/openid-configuration
    ZITADEL_ISSUER: https://account.what-if.io     # required for JWT iss validation
    ZITADEL_CLIENT_ID: ${HEARTBITS_CLIENT_ID}      # required for JWT aud validation
    HB_FIELD_ENCRYPTION_KEY: ${HB_FIELD_ENCRYPTION_KEY}
    MINIO_ENDPOINT: minio:9000
    MINIO_BUCKET: heartbits-media
    PORT: 3100
  networks: [internal]

heartbits-relay:
  # Phase 1: set REDIS_URL to activate JWT + room membership validation
  environment:
    ROOM_TOKEN: ${RELAY_ROOM_TOKEN}               # Phase 0 fallback
    REDIS_URL: redis://redis:6379                 # enables Phase 1
    ZITADEL_JWKS_URL: https://account.what-if.io/.well-known/openid-configuration
    PORT: 8765
  networks: [internal]

heartbits-worker:
  # Same image/source as API, different entrypoint
  command: bun run worker
  # ... same env, networks: [internal]

heartbits-web:
  image: oven/bun:1.2-alpine
  working_dir: /app
  volumes: [./heartbits-web:/app:ro]
  command: bun run preview  # or node build for SvelteKit
  environment:
    PORT: 3000
    PUBLIC_API_URL: https://api.what-if.io
    PUBLIC_RELAY_URL: wss://hb.what-if.io
  networks: [internal]

minio:
  image: quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z
  command: server /data --console-address ":9001"
  volumes: [minio-data:/data]
  networks: [internal]
```

New Caddyfile blocks: see `docs/Caddyfile.heartbits` for the full security-hardened
Caddy config for `api.what-if.io`, `heartbits.what-if.io`, `hb.what-if.io`,
and `media.what-if.io` (GET-only proxy to MinIO with security headers).

---

## Mobile / Watch Integration Path

**Now:** all three clients have `RELAY_TOKEN` hardcoded in source. Rotate immediately.
Use Xcode build settings (`RELAY_TOKEN = $(RELAY_TOKEN)` from CI) and Android `buildConfigField`.

**With Phase 1 API:**
- New `BondStore` fetches `room_id` from `GET /api/v1/bonds/:id` instead of generating locally
- Client must call `POST /api/v1/me/consent` with `consent_type="biometric_relay"` before
  calling the bonds endpoint — consent UI must show the versioned consent text first
- Relay URL constructed from API response, not hardcoded
- Watch receives `access_token` via WatchConnectivity from iPhone (iPhone holds refresh token)

**Deep link update:**
`heartbits://bond/<code>` → `heartbits://bond/join?code=<code>` validated server-side.

---

## Key Risks

1. **Relay Phase 0 token** — static ROOM_TOKEN provides no room isolation. Rotate before
   any public access; deploy Phase 1 JWT+Redis auth as first priority before public launch.
2. **Relay room IDs are server-generated UUID4** — guessing is computationally infeasible.
   Phase 2 removes the ROOM_TOKEN fallback entirely.
3. **Biometric data is GDPR Article 9** — explicit consent UI + `consents` table ships
   before any public user can connect to the relay. Consent gate is enforced at the bond
   endpoint. Heart-rate data is NEVER stored — relay fanout only.
4. **No media CDN yet** — MinIO on the same VPS as the API means photo serving competes
   with API CPU; acceptable for launch, add Cloudflare in front of `media.what-if.io`
   when traffic warrants.
5. **Hard-delete worker not implemented** — soft-deleted users must be hard-deleted within
   30 days per GDPR Art. 17. Implement before launch.
6. **Consent text versioning** — the API records consent versions but does not store the
   text. The client must re-prompt users when the consent text version changes. This logic
   must ship in the client before any consent version bump.
