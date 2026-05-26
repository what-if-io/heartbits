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
                        ┌─────────────────────────────────────────┐
                        │           Caddy 2 (TLS + routing)        │
                        │  hb.what-if.io    → heartbits-relay:8765 │
                        │  api.what-if.io   → heartbits-api:3100   │
                        │  app.what-if.io   → heartbits-web:3000   │
                        │  media.what-if.io → minio:9000           │
                        │  auth.what-if.io  → zitadel:8180         │
                        └─────────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────┐
         │                              │                          │
┌────────▼────────┐        ┌────────────▼────────┐      ┌─────────▼───────┐
│ heartbits-relay │        │  heartbits-api       │      │      minio      │
│ (Node.js)       │◄───────│  (Bun + Elysia)      │      │  (S3-compat     │
│ room fanout     │        │  profiles, matches,  │      │   photo store)  │
│ JWT auth (v2)   │        │  bonds, notifs       │      └─────────────────┘
└─────────────────┘        └────────────┬─────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────┐
         │                              │                          │
┌────────▼────────┐        ┌────────────▼────────┐      ┌─────────▼───────┐
│  PostgreSQL 16  │        │     Redis 7          │      │ heartbits-worker│
│  app + billing  │        │  sessions, rate      │      │ (Bun)           │
│  schemas        │        │  limits, relay room  │      │ matching queue, │
└─────────────────┘        │  tokens              │      │ notifs, media   │
                           └─────────────────────┘      └─────────────────┘
         │
┌────────▼────────┐
│    Zitadel      │
│  OIDC provider  │
└─────────────────┘
```

---

## Domains

| Subdomain | Service | Notes |
|---|---|---|
| `hb.what-if.io` | WebSocket relay | EXISTS — stays |
| `api.what-if.io` | REST API | NEW |
| `app.what-if.io` | Web app / PWA | NEW |
| `media.what-if.io` | Signed photo URLs via MinIO | NEW |
| `auth.what-if.io` | Zitadel OIDC | EXISTS |

`limen-os.io` is reserved for the Synapse OS / Limen OS product family — not used here.

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

PKCE Authorization Code flow via Zitadel:

```
App (mobile/web)
  │
  ├─1─► PKCE auth request → https://auth.what-if.io/oauth/v2/authorize
  ├─2─◄ Authorization code (redirect to heartbits://auth/callback or app.what-if.io/auth/callback)
  ├─3─► Token exchange → access_token + refresh_token + id_token
  └─4─► API calls: Authorization: Bearer <access_token>
        Relay WS:   ?token=<access_token>  (or Authorization header on upgrade)
```

`access_token` is a Zitadel-signed JWT. Both the API and the relay verify it locally
via JWKS — no Zitadel round-trip per request. JWKS is cached with a 1-hour TTL.

On first API call after login: `POST /api/v1/me/init` creates a profile row keyed to
the Zitadel `sub` claim (stable UUID, never changes).

---

## Database Schema

### Two PostgreSQL schemas

- `app` — all application data; row-level security enabled
- `billing` — Stripe IDs only; separate role, isolated from app queries

### Core tables (`app` schema)

**`users`** — identity anchor
```
id              UUIDv7  PK
zitadel_sub     TEXT    UNIQUE NOT NULL
created_at      TIMESTAMPTZ
last_seen_at    TIMESTAMPTZ
deleted_at      TIMESTAMPTZ          -- soft delete for GDPR erasure
```

**`profiles`** — ⚠ PII fields encrypted at rest (AES-256-GCM, app layer)
```
id              UUIDv7  PK  FK→users.id
display_name    BYTEA       🔒 encrypted
date_of_birth   BYTEA       🔒 encrypted (derive age band only, never expose exact)
bio             BYTEA       🔒 encrypted
gender          TEXT        from controlled enum; used in matching
seeking         TEXT[]      gender preferences
age_min         INT
age_max         INT
location_geohash6 TEXT      6-char geohash ≈ 1.2km; client converts GPS→geohash
                            GPS coords NEVER stored server-side
avatar_media_id UUIDv7  FK→media.id
```

**`media`** — profile photos (private bucket, signed URLs only)
```
id              UUIDv7  PK
user_id         UUIDv7  FK→users.id
bucket          TEXT    "heartbits-media"
object_key      TEXT    {user_id}/{uuid}.webp  — not guessable
purpose         TEXT    'avatar' | 'gallery'
sort_order      INT
sha256          TEXT    integrity check
```

**`swipes`**
```
swiper_id       UUIDv7  FK→users.id
swiped_id       UUIDv7  FK→users.id
direction       TEXT    'like' | 'pass' | 'superlike'
created_at      TIMESTAMPTZ
```

**`matches`**
```
id              UUIDv7  PK
user_a_id       UUIDv7  FK→users.id   -- enforced: user_a < user_b (dedup)
user_b_id       UUIDv7  FK→users.id
matched_at      TIMESTAMPTZ
unmatched_at    TIMESTAMPTZ
```

**`bonds`** — relay room assignment for a match
```
id              UUIDv7  PK
match_id        UUIDv7  FK→matches.id  UNIQUE
room_id         TEXT    UNIQUE NOT NULL  -- UUID4 generated by API (not client)
created_at      TIMESTAMPTZ
```

**`messages`** — ⚠ encrypted per-match
```
id              UUIDv7  PK
match_id        UUIDv7  FK→matches.id
sender_id       UUIDv7  FK→users.id
body_encrypted  BYTEA   🔒 AES-256-GCM, key = HKDF(master_key, match_id)
sent_at         TIMESTAMPTZ
read_at         TIMESTAMPTZ
```

**`consents`** — GDPR Article 9 (biometric data = special category, explicit consent required)
```
id              UUIDv7  PK
user_id         UUIDv7  FK→users.id
consent_type    TEXT    'biometric_relay' | 'marketing'
version         TEXT    semver of consent text shown
consented_at    TIMESTAMPTZ
ip_address      INET
withdrawn_at    TIMESTAMPTZ
```

**`audit_log`** — INSERT-only, never deleted (GDPR erasure anonymises actor_id → NULL)
```
id              UUIDv7  PK
actor_id        UUIDv7  NULLABLE
action          TEXT    'profile.update' | 'bond.create' | 'match.unmatch' | 'account.delete' …
target_type     TEXT
target_id       TEXT
ip_address      INET
created_at      TIMESTAMPTZ
```

### Billing schema (`billing`)

Isolated from `app` queries. `heartbits_api` role can read `plan` only.
`stripe_customer_id` / `stripe_subscription_id` visible to `heartbits_billing` role only.

```
billing.customers:
  user_id                 UUIDv7  FK→app.users.id
  stripe_customer_id      TEXT    NULL until payments enabled
  stripe_subscription_id  TEXT    NULL until payments enabled
  plan                    TEXT    DEFAULT 'free'
```

---

## Security Decisions

| Area | Decision |
|---|---|
| PII encryption | AES-256-GCM at application layer (not pgcrypto CBC) before INSERT |
| Message encryption | Per-match key via HKDF(master_key, match_id) |
| Location | Geohash-6 only (≈1.2km). GPS coords rejected at API boundary. Discovery returns distance bands, never geohash |
| Photos | Private MinIO bucket. Pre-signed GET URLs, 15-min TTL. Object keys non-guessable |
| Row-level security | Enabled on all `app.*` tables. `SET LOCAL app.current_user_id` per request |
| Rate limiting | Redis sliding window: 200 swipes/user/day, 60 discovery/user/hour, 1000 req/IP/min (Caddy) |
| Audit log | INSERT-only role. Erasure anonymises actor, retains action |
| Biometric consent | `consents` table required before relay connects. Heart rate = GDPR Art. 9 special category |
| GDPR erasure | Soft delete → re-encrypt PII fields with tombstone key → schedule MinIO deletion → anonymise audit_log.actor_id |
| PCI scope | `billing` schema isolated. Stripe tokens never visible to `heartbits_api` role |

---

## Relay Security — Migration Phases

The current relay uses a single static token hardcoded in all clients and committed to the repo.

**Phase 0 (now):** Rotate token. Inject via CI secrets / build config, never hardcoded.

**Phase 1 (with login):** Relay accepts both static token (backward compat) AND Zitadel JWTs.
JWT validation: JWKS verify + Redis lookup `relay:room:{room_id}` → `"{user_a}:{user_b}"`.
The API writes this Redis key when creating a bond. No DB call per WebSocket connection.

**Phase 2 (new client versions):** Static token deprecated. JWT only.
Room IDs become UUID4 generated by the API (replacing client-generated 8-char codes).

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
    ZITADEL_JWKS_URL: https://auth.what-if.io/.well-known/openid-configuration
    HB_FIELD_ENCRYPTION_KEY: ${HB_FIELD_ENCRYPTION_KEY}
    MINIO_ENDPOINT: minio:9000
    MINIO_BUCKET: heartbits-media
    PORT: 3100
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

New Caddyfile blocks: `api.what-if.io`, `app.what-if.io`, `media.what-if.io` (GET-only proxy to MinIO).

---

## Mobile / Watch Integration Path

**Now:** all three clients have `RELAY_TOKEN` hardcoded in source. Rotate immediately.
Use Xcode build settings (`RELAY_TOKEN = $(RELAY_TOKEN)` from CI) and Android `buildConfigField`.

**With Phase 1 API:**
- New `BondStore` fetches `room_id` from `POST /api/v1/bonds` instead of generating locally
- Relay URL constructed from API response, not hardcoded
- Watch receives `access_token` via WatchConnectivity from iPhone (iPhone holds refresh token)

**Deep link update:**
`heartbits://bond/<code>` → `heartbits://bond/join?code=<code>` validated server-side.

---

## Key Risks

1. **Hardcoded relay token in VCS** — rotate before any public repo access
2. **Relay room IDs are client-generated 8-char codes** — guessable in theory; fix in Phase 2 with server-generated UUID4 room IDs
3. **Biometric data is GDPR Article 9** — explicit consent UI + `consents` table must ship before any public user can connect to the relay
4. **No media CDN yet** — MinIO on the same VPS as the API means photo serving competes with API CPU; acceptable for launch, add Cloudflare in front of `media.what-if.io` when traffic warrants
