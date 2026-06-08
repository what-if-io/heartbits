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
                        │  relay.heartbits.what-if.io → relay:8765    │
                        │  heartbits.what-if.io → heartbits-web:3000  │
                        │  auth.heartbits.what-if.io → zitadel:8180   │
                        │  api.heartbits.what-if.io → heartbits-api   │
                        │  media.heartbits.what-if.io → minio:9000    │
                        └─────────────────────────────────────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────┐
         │                              │                          │
┌────────▼────────┐        ┌────────────▼────────┐      ┌─────────▼───────┐
│ heartbits-relay │        │  heartbits-api       │      │      minio      │
│ (Node.js)       │◄───────│  (Bun + Elysia)      │      │  (S3-compat     │
│ room fanout +   │        │  profiles, matches,  │      │   photo store)  │
│ live BPM +      │        │  bonds, chat,        │      └─────────────────┘
│ realtime chat   │        │  safety, notifs      │
│ Phase 0: token  │        │  connects as the     │
│ Phase 1: JWT    │        │  non-owner           │
└─────────────────┘        │  heartbits_api role  │
                           │  → RLS enforced      │
                           └────────────┬─────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────┐
         │                              │                          │
┌────────▼────────┐        ┌────────────▼────────┐      ┌─────────▼───────┐
│  PostgreSQL 16  │        │     Redis 7          │      │ heartbits-worker│
│  app + billing  │        │  rate limits, relay  │      │ (Bun)           │
│  schemas        │        │  room keys, JWKS     │      │ media deletion, │
│  FORCE RLS      │        │  cache, worker queues│      │ GDPR hard-delete│
└─────────────────┘        └─────────────────────┘      │ relay cleanup,  │
                                                          │ email dispatch  │
                                                          └─────────────────┘
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
| `relay.heartbits.what-if.io` | WebSocket relay | Live |
| `heartbits.what-if.io` | SvelteKit web app / PWA | Live |
| `auth.heartbits.what-if.io` | Zitadel OIDC + login UI | Live |
| `api.heartbits.what-if.io` | REST API (heartbits-api) | Live |
| `status.heartbits.what-if.io` | Status page redirect | Live |
| `media.heartbits.what-if.io` | Signed photo URLs via MinIO | Live |

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| API | Bun + Elysia | Native Bun, first-class TS, built-in OpenAPI, Eden Treaty for client type-safety |
| Web frontend | SvelteKit | Lighter and more expressive for animation-heavy UI than Next.js |
| Auth | Zitadel (existing) | OIDC, PKCE-native, already deployed |
| Database | PostgreSQL 16 (existing) | Two schemas: `app` + `billing`. The API connects as a non-owner role so RLS is enforced (FORCE ROW LEVEL SECURITY) |
| Cache / rate limiting | Redis 7 (existing) | Sliding window counters, relay room keys, JWKS cache, worker queues |
| Photo storage | MinIO | S3-compatible, runs in Docker, zero egress cost; migrate to R2 later trivially |
| Background jobs | Bun worker process | Same codebase as API, different entrypoint |

---

## Auth Flow

PKCE Authorization Code flow via Zitadel (`https://auth.heartbits.example.com`):

```
App (mobile/web)
  │
  ├─1─► PKCE auth request → https://auth.heartbits.example.com/oauth/v2/authorize
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

### RLS bootstrap (login + registration)

The API connects as the non-owner `heartbits_api` role, so every query is subject to
RLS — but login (resolve `sub` → internal user id) and registration (create the user
row) happen *before* any user context (`app.current_user_id`) exists. These two narrow
operations run through `SECURITY DEFINER` functions that bypass RLS for exactly those
bootstrap ops and nothing else (see `migrations/005_auth_bootstrap_funcs.sql`):

- `app.user_lookup(sub)` → `{ id, deleted }` — used by the auth plugin's `findUserBySub`
  (`src/auth.ts`) and by `/me/init`'s "is this account deleted?" check.
- `app.init_user(sub)` → `{ id, created }` — idempotent upsert that reactivates a paused
  account and ensures a profile row (`src/routes/me.ts`).

Once `findUserBySub` resolves the internal user id, every subsequent query runs inside
`withUser(userId, …)` (`src/db.ts`), which opens a transaction and issues
`SET LOCAL app.current_user_id = <id>` so RLS policies apply.

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

### Chat (persisted messages)

Chat is now persisted (it was previously relay-only / ephemeral). The relay still
carries realtime delivery and live BPM; the API persists message history, reactions,
replies, edits, soft-deletes, and read receipts. Bodies are AES-256-GCM encrypted at
rest. The web client reaches these endpoints through a server-side authed bridge —
`heartbits-web`'s `/chat-api/<path>` route forwards to `/api/v1/<path>` with the
session's access token (`heartbits-web/src/routes/chat-api`).

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/matches/:matchId/messages` | JWT + DB user | Send message (`body`, optional `reply_to_id`) |
| GET | `/api/v1/matches/:matchId/messages` | JWT + DB user | Paginated history (`?before=&limit=`, max 100) |
| POST | `/api/v1/matches/:matchId/read` | JWT + DB user | Mark partner's messages read |
| PATCH | `/api/v1/messages/:id` | JWT + DB user | Edit own message (sets `edited_at`) |
| DELETE | `/api/v1/messages/:id` | JWT + DB user | Soft-delete own message |
| POST | `/api/v1/messages/:id/reactions` | JWT + DB user | Add reaction `{ emoji }` |
| DELETE | `/api/v1/messages/:id/reactions/:emoji` | JWT + DB user | Remove own reaction |

All routes verify (via RLS + an active-match check) that the caller is one of the two
match participants and the match is not unmatched.

### Trust & Safety (blocks + reports)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/blocks` | JWT + DB user | Block a user — severs any active match (`unmatched_at`) + deletes the relay room key |
| DELETE | `/api/v1/blocks/:userId` | JWT + DB user | Unblock |
| GET | `/api/v1/blocks` | JWT + DB user | List users I've blocked |
| POST | `/api/v1/reports` | JWT + DB user | Report a user → moderation queue (`reason`, optional `details`) |

Blocking is bidirectional for visibility: discover excludes blocked users in both
directions and swiping a blocked user (either direction) returns 403. Reports land in
`app.reports` (status `open`); the BYPASSRLS worker role has SELECT/UPDATE grants for
moderation — no end-user can read another user's reports.

### Waitlist (public, pre-auth)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/waitlist` | None | 18+ attestation is server-enforced (`age_confirmed`); signups without it are rejected |

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

- `app` — all application data; row-level security **enforced** (FORCE RLS — the API
  connects as the non-owner `heartbits_api` role, so policies apply to it)
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

**`messages`** — persisted chat, bodies encrypted at rest
```
id                  TEXT    PK
match_id            TEXT    FK→matches.id
sender_id           TEXT    FK→users.id
body_encrypted      BYTEA   AES-256-GCM (field-encryption key; per-match HKDF is future hardening)
reply_to_id         TEXT    FK→messages.id (nullable) — threaded reply
attachment_media_id TEXT    nullable
sent_at             TIMESTAMPTZ
edited_at           TIMESTAMPTZ   -- set on edit
deleted_at          TIMESTAMPTZ   -- soft-delete; body cleared
read_at             TIMESTAMPTZ   -- read receipt
```

**`message_reactions`** — emoji reactions
```
id          TEXT    PK
message_id  TEXT    FK→messages.id
user_id     TEXT    FK→users.id
emoji       TEXT
created_at  TIMESTAMPTZ
UNIQUE (message_id, user_id, emoji)
```

**`blocks`** — Trust & Safety
```
id          TEXT    PK
blocker_id  TEXT    FK→users.id
blocked_id  TEXT    FK→users.id
created_at  TIMESTAMPTZ
UNIQUE (blocker_id, blocked_id)  -- CHECK blocker <> blocked
```

**`reports`** — moderation queue
```
id           TEXT    PK
reporter_id  TEXT    FK→users.id
reported_id  TEXT    FK→users.id
reason       TEXT    spam | harassment | inappropriate | fake_profile | underage | other
details      TEXT    nullable
status       TEXT    'open' | 'reviewed' | 'actioned' | 'dismissed' (default 'open')
created_at   TIMESTAMPTZ
```

**`waitlist`** — public pre-launch signups (no user context → no RLS; accessed by the API owner role)
```
id            TEXT    PK
email         TEXT
email_norm    TEXT    UNIQUE (lowercased/trimmed, dedup)
locale        TEXT
source        TEXT
age_confirmed BOOLEAN NOT NULL DEFAULT false  -- 18+ attestation, server-enforced
created_at    TIMESTAMPTZ
confirmed_at  TIMESTAMPTZ
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
action      TEXT    'profile.update' | 'bond.create' | 'match.unmatch' | 'account.pause'
            'account.delete' | 'account.export' | 'user.block'
            'consent.grant.biometric_relay' | 'consent.withdraw.biometric_relay' …
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
| Message encryption | Chat is persisted (`app.messages`). Bodies are AES-256-GCM encrypted at rest using the field-encryption key; per-match HKDF(master_key, match_id) is a future hardening. RLS + an active-match check restrict every read/write to the two participants. |
| Location | Geohash-6 only (≈1.2km). GPS coords rejected at API boundary. Discovery returns distance bands, never geohash |
| Photos | Private MinIO bucket. Pre-signed GET URLs, 15-min TTL. Object keys non-guessable |
| Row-level security | **Enforced**, not decorative. The API connects as the non-owner `heartbits_api` role and `migrations/004_force_rls.sql` adds `FORCE ROW LEVEL SECURITY` to every app table (so even the table owner is subject to its own policies; only superusers bypass, and migrations run as superuser). `SET LOCAL app.current_user_id` per request via `withUser()`. `users_read`/`profiles_read` let any authenticated user SELECT user + profile rows (no PII in `users`; profile PII is field-encrypted); writes stay self-only. `swipes_inbound` lets a user read swipes targeting them (server-side mutual-like detection). WITH CHECK on write policies prevents cross-user INSERT/UPDATE. |
| RLS bootstrap (login/registration) | Login and registration run before any user context exists, so they use `SECURITY DEFINER` functions `app.user_lookup` / `app.init_user` (`migrations/005`) that bypass RLS for exactly those two bootstrap ops and nothing else. |
| Trust & Safety | `app.blocks` + `app.reports` (FORCE RLS). Blocking severs the match (`unmatched_at`) and deletes the relay room key; discover excludes blocked users in both directions; swiping a blocked user → 403. Reports go to a moderation queue; the BYPASSRLS worker role has SELECT/UPDATE on `app.reports` (no end-user can read others' reports). |
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
| Chat messages | PII / content | Contract performance | Persisted (`app.messages`), bodies encrypted at rest; purged with the user on hard-delete |
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
| Hard-delete worker (30 days post soft-delete) | IMPLEMENTED — `src/worker.ts` sweeps `deleted_at < NOW() - 30 days` via the BYPASSRLS worker role |  |
| Media deletion worker (MinIO) | IMPLEMENTED — `src/worker.ts` consumes the `hb:worker:media_delete` queue and removes MinIO objects + media rows |  |
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

## Build & Compose

Each HeartBits service ships its own `Dockerfile` and `deploy/compose.yml` **builds**
them (`build: { context: ../<service> }`) — there is no install-at-boot / volume-mount
pattern any more. The relevant services:

```yaml
heartbits-api:
  build: { context: ../heartbits-api }   # Dockerfile: oven/bun:1.3-alpine
  environment:
    # Connect as the non-owner role so RLS is enforced (see migrations/004).
    DATABASE_URL: postgres://heartbits_api:${POSTGRES_PASSWORD}@postgres:5432/heartbits
    REDIS_URL: redis://redis:6379
    ZITADEL_ISSUER: https://${AUTH_DOMAIN}
    ZITADEL_JWKS_URL: https://${AUTH_DOMAIN}/.well-known/openid-configuration
    ZITADEL_CLIENT_ID: ${HEARTBITS_CLIENT_ID}
    HB_FIELD_ENCRYPTION_KEY: ${HB_FIELD_ENCRYPTION_KEY}
    REGISTRATION_OPEN: ${REGISTRATION_OPEN:-false}   # invite-only by default
    REGISTRATION_ALLOWLIST: ${REGISTRATION_ALLOWLIST:-}
    MINIO_ENDPOINT: minio:9000
    MINIO_BUCKET: heartbits-media
    PORT: "3100"

heartbits-worker:
  build: { context: ../heartbits-api }   # same image, different entrypoint
  command: ["bun", "run", "src/worker.ts"]
  environment:
    DATABASE_URL: postgres://heartbits_api:${POSTGRES_PASSWORD}@postgres:5432/heartbits
    # BYPASSRLS pool for cross-user sweeps (GDPR hard-delete, relay cleanup):
    WORKER_DATABASE_URL: postgres://heartbits_worker:${WORKER_POSTGRES_PASSWORD}@postgres:5432/heartbits
    REDIS_URL: redis://redis:6379
    HB_FIELD_ENCRYPTION_KEY: ${HB_FIELD_ENCRYPTION_KEY}
    # SMTP for transactional emails (notifications, waitlist)
    SMTP_HOST: ${SMTP_HOST:-}  # …

heartbits-relay:
  build: { context: ../relay-server }
  environment:
    ROOM_TOKEN: ${ROOM_TOKEN}                       # Phase 0 fallback
    REDIS_URL: redis://redis:6379                   # enables Phase 1
    ZITADEL_JWKS_URL: https://${AUTH_DOMAIN}/.well-known/openid-configuration
    ZITADEL_ISSUER: https://${AUTH_DOMAIN}          # JWT iss/aud (token-confusion defense)
    ZITADEL_CLIENT_ID: ${HEARTBITS_CLIENT_ID}

heartbits-web:
  build: { context: ../heartbits-web }   # SvelteKit adapter-node
  environment:
    PORT: "3000"
    ORIGIN: https://${APP_DOMAIN}
    PUBLIC_ZITADEL_ISSUER: https://${AUTH_DOMAIN}
    PUBLIC_ZITADEL_CLIENT_ID: ${HEARTBITS_CLIENT_ID}
    SESSION_SECRET: ${SESSION_SECRET}
    PUBLIC_API_BASE: https://${APP_DOMAIN}/api      # browser → /api (Caddy strips prefix)
    API_BASE_INTERNAL: http://heartbits-api:3100    # server-side /chat-api bridge target
```

The worker connects with two pools: the RLS-bound `heartbits_api` pool (per-user media
deletion) and the BYPASSRLS `heartbits_worker` pool (`WORKER_DATABASE_URL`) for
cross-user sweeps (GDPR hard-delete, stale relay room cleanup).

Caddy (`deploy/Caddyfile`) routes `${APP_DOMAIN}/api/*` → `heartbits-api:3100`
(prefix stripped) and also exposes a dedicated `${API_DOMAIN}` block, plus
`${AUTH_DOMAIN}`, `${RELAY_DOMAIN}`, and `${MEDIA_DOMAIN}` (GET-only proxy to MinIO
with security headers). See `docs/deploy.md`.

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
   with API CPU; acceptable for launch, add Cloudflare in front of `media.heartbits.what-if.io`
   when traffic warrants.
5. **Soft-delete vs. live sessions** — the hard-delete worker (30-day GDPR sweep) and the
   media-deletion worker are implemented (`src/worker.ts`), but soft-delete does not
   revoke existing Zitadel sessions — a valid JWT stays usable until it expires. Revoke
   the session via the Zitadel Management API on `DELETE /me` before launch.
6. **Consent text versioning** — the API records consent versions but does not store the
   text. The client must re-prompt users when the consent text version changes. This logic
   must ship in the client before any consent version bump.
