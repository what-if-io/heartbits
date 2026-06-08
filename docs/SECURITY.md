# HeartBits — Security Reference

> Last updated: 2026-06-08. Keep this document current as the threat model evolves.

---

## Threat Model

### Who are the adversaries?

| Adversary | Motivation | Capability |
|---|---|---|
| **Curious user** | Enumerate other users' profiles, discover swipe history | Authenticated API access; can craft requests |
| **Stalker / abuser** | Locate a target user precisely; match history for harassment | Authenticated user; may create sock-puppet accounts |
| **Credential thief** | Steal JWTs to impersonate users | Network-level (MITM on non-HTTPS), phishing, XSS |
| **Database attacker** | Read PII from a stolen DB dump | Direct DB access (breach, insider threat, misconfigured backup) |
| **Relay eavesdropper** | Listen to other users' heartbeat streams | Must have ROOM_TOKEN (Phase 0) or valid JWT+room membership (Phase 1) |
| **Data broker** | Bulk-export user profiles/matches | Authenticated API access; rate-limited |
| **Payment attacker** | Access/modify Stripe subscription data | Must bypass billing schema isolation |

### What are they after?

- **Location data** — even geohash-6 (≈1.2km) is sensitive for stalking.
- **Biometric data** — heart rate is GDPR Art. 9 special category; disclosure is a high-severity breach.
- **Match/swipe history** — reveals sexual preferences, behavioural patterns; sensitive.
- **PII** — display name, date of birth, bio.
- **Photos** — must not be accessible without authentication.
- **Stripe data** — payment credentials, subscription status.

---

## What Is Encrypted and Why

| Data | Encryption | Where | Why |
|---|---|---|---|
| `display_name`, `date_of_birth`, `bio` | AES-256-GCM, app layer | `app.profiles` (BYTEA) | These are PII that would identify a person directly from a DB dump. Encrypted before INSERT, decrypted after SELECT — the database never sees plaintext. |
| Message bodies | AES-256-GCM, app layer | `app.messages` (BYTEA) | Chat is persisted (history, edits, reactions, replies, read receipts). Conversation content is among the most sensitive user data, so bodies are encrypted at rest. Currently the shared field-encryption key is used; per-match HKDF(master_key, match_id) keys are a planned hardening so a single key compromise would not expose all conversations. Access is further restricted by RLS + an active-match check to the two participants. |
| TLS everywhere | TLS 1.2+ (Caddy handles termination) | All HTTP/WS traffic | Standard transport security; Caddy auto-renews Let's Encrypt certificates. HSTS enforced with 1-year max-age. |

### Crypto implementation details

- **Algorithm:** AES-256-GCM (authenticated encryption — provides both confidentiality and integrity).
- **IV:** 96 bits, generated via `crypto.getRandomValues()` per encryption call. Never reused.
- **Auth tag:** 128 bits, stored alongside ciphertext. Verification is enforced by `SubtleCrypto.decrypt()` — any tampering throws.
- **Key:** 256-bit, loaded from `HB_FIELD_ENCRYPTION_KEY` (hex-encoded 64-char string). Validated at startup: must be exactly 64 hex chars. Key is imported as non-extractable `CryptoKey` and cached in-process.
- **Storage format:** `"<iv_b64>:<ciphertext_b64>:<tag_b64>"` stored in BYTEA columns. Printable ASCII — no binary escaping issues.
- **Key rotation:** Not yet implemented. SECURITY TODO: add a re-encryption worker that decrypts with the old key and re-encrypts with the new key, with a `key_version` column to track which key was used.

---

## Access Control — Row-Level Security (the backbone)

RLS is the primary in-database authorization control, and it is **enforced**, not
decorative:

- The API process connects as the **non-owner** `heartbits_api` role. A table owner (and
  any superuser) silently bypasses `ENABLE ROW LEVEL SECURITY`, so
  `migrations/004_force_rls.sql` adds `FORCE ROW LEVEL SECURITY` to every `app.*` table —
  the owner is now subject to its own policies too. Only superusers bypass, and only
  migrations run as the superuser.
- Each request runs inside `withUser(userId, …)` (`src/db.ts`), which opens a transaction
  and issues `SET LOCAL app.current_user_id = <id>`. Every policy keys off this setting.
- Policy model:
  - `users` / `profiles` — any authenticated user may SELECT (no PII in `users`; profile
    PII is field-encrypted), but UPDATE/DELETE are self-only (`users_self`, `profiles_write`).
  - `swipes` — own swipes are readable/writable (`swipes_self`); `swipes_inbound` lets a
    user read swipes *targeting* them, for server-side mutual-like detection only.
  - `matches` / `bonds` / `messages` / `message_reactions` — restricted to the two match
    participants.
  - `blocks` — readable when you are on either side (to enforce mutual invisibility),
    writable only as the blocker.
  - `reports` — a user sees/files only their own; moderation reads/updates run via the
    BYPASSRLS `heartbits_worker` role.
- **Bootstrap exception:** login and registration run before `app.current_user_id` is set,
  so they use the `SECURITY DEFINER` functions `app.user_lookup` / `app.init_user`
  (`migrations/005`) — the only sanctioned RLS bypass, scoped to exactly those two ops and
  granted `EXECUTE` only to `heartbits_api`.

This directly mitigates the **curious user** and **stalker/abuser** adversaries: even a
crafted request cannot read another user's rows, because the database — not just the app
layer — refuses to return them.

## Trust & Safety

For a dating product, blocking and reporting are launch-critical controls
(`migrations/008`, `src/routes/safety.ts`):

- **Blocks** (`app.blocks`) are bidirectional for visibility: discover excludes blocked
  users in both directions and swiping a blocked user (either direction) returns 403.
  Blocking also severs any active match (`unmatched_at`) and immediately deletes the relay
  room key, cutting off any live biometric stream — the same eviction used for consent
  withdrawal.
- **Reports** (`app.reports`) land in a moderation queue (status `open`). Only the BYPASSRLS
  worker role has SELECT/UPDATE on reports — no end-user can read another user's reports.

## What Is NOT Encrypted and Why

| Data | Not encrypted | Rationale | Acceptable? |
|---|---|---|---|
| `room_id` | Stored in plaintext in `app.bonds` and Redis | UUID4 — 122 bits of entropy. Not guessable. The value itself is not sensitive — only possession of it (plus a valid JWT in Phase 1) grants relay access. | Yes — acceptable. |
| `gender`, `seeking`, `age_min/max` | Stored in plaintext | Used in SQL-level filtering for discovery. Encrypting would require decrypting all candidates to filter — impractical. These fields contain preference data, not identity. | Yes — acceptable. |
| `location_geohash6` | Stored in plaintext | Used in SQL prefix matching for discovery. Geohash-6 is ≈1.2km resolution — not precise enough to locate someone. Exact GPS coordinates are never stored. | Acceptable, but monitor: if geohash resolution increases, re-evaluate. |
| `matched_at`, `created_at` timestamps | Stored in plaintext | Timestamps have low sensitivity on their own. Useful for audit and debugging. | Yes — acceptable. |
| `audit_log` action strings | Stored in plaintext | Required for compliance review by admins. | Yes — acceptable. Actor anonymisation on erasure is the privacy control. |
| `zitadel_sub` | Stored in plaintext | Required for JWT→user lookup on every request. Index required. | Yes — it is a random UUID from Zitadel, not a user-facing identifier. |
| Relay biometric stream | Not stored at all | Heart-rate packets are fanned out in memory by the relay and never written to disk or database. | This is the strongest privacy control: no retention = no breach risk. |

---

## Known Limitations and Accepted Risks

### Accepted risks (documented and monitored)

1. **Phase 0 relay token provides no room isolation.**
   Any client holding the ROOM_TOKEN can connect to any room. A leaked or compromised token
   grants passive access to all biometric streams.
   - **Mitigation:** Rotate token; it is injected from CI secrets, never committed.
   - **Resolution:** Deploy Phase 1 JWT+Redis room membership validation before public launch.
   - **Status:** Phase 1 code is written; pending deployment and client update.

2. **`age_min`/`age_max` age filtering happens in the application layer, not the database.**
   Because `date_of_birth` is encrypted, SQL cannot filter by age. We fetch a 5x oversample
   and filter in JavaScript. This means more DB rows are transferred per discovery request.
   - **Impact:** Performance only; no security issue. Age filter is enforced correctly in JS.

3. **Soft-delete does not immediately break all DB sessions.**
   `deleted_at IS NOT NULL` checks prevent the user from appearing in discovery and bonds,
   but existing JWT sessions remain valid until expiry (Zitadel token lifetime).
   - **Mitigation:** On `DELETE /me`, revoke the Zitadel session via the Zitadel Management
     API. SECURITY TODO: implement this in the DELETE handler.

4. **ROOM_TOKEN transmitted as query parameter on WebSocket connect.**
   WebSocket browser clients cannot set headers on the upgrade request, so the token is
   passed as `?token=`. Query parameters may appear in server access logs.
   - **Mitigation:** Phase 1 moves auth to JWT in the Authorization header on supported clients.
     Ensure Caddy access logs do not log the `token` query parameter in production.

5. **MinIO object URLs are not truly pre-signed yet.**
   `avatarUrl()` (`src/minio.ts`) returns a direct `https://${MEDIA_DOMAIN}/...` path URL.
   SECURITY TODO: replace with MinIO `presignedGetObject()` calls with 15-minute TTL
   before enabling public access.

6. **No SSRF protection on OIDC discovery fetch.**
   `verifyTokenForInit` and `getJwks()` fetch the JWKS URL from environment, which is
   operator-controlled — not user-supplied. Low risk but worth noting.

### Non-accepted risks (must fix before public launch)

See the pre-launch checklist below.

---

## How to Report a Vulnerability

HeartBits is a pre-launch application. Security reports should be sent to:

**Email:** security@what-if.io  
**Subject prefix:** `[SECURITY] HeartBits — <brief description>`

Please include:
- Description of the vulnerability
- Steps to reproduce
- Affected component (API endpoint, relay, migration, etc.)
- Potential impact

We aim to acknowledge reports within 48 hours and provide an initial assessment within 7 days.

Do not publicly disclose vulnerabilities until they have been fixed or we have agreed on a disclosure timeline.

---

## Pre-Launch Security Checklist

The following MUST be completed before any public user can create an account.

### Critical (blocker)

- [ ] **Rotate ROOM_TOKEN.** Ensure it is not in any commit history. Inject from CI secret.
- [ ] **Deploy Phase 1 relay auth** (JWT + Redis room membership). ROOM_TOKEN alone is insufficient for public launch.
- [ ] **Implement Zitadel session revocation** on `DELETE /api/v1/me` (call Zitadel Management API to invalidate tokens).
- [ ] **Implement MinIO pre-signed URLs** in `avatarUrl()` (`src/minio.ts`). Direct MinIO paths must never be public.
- [ ] **Set `ZITADEL_ISSUER` and `ZITADEL_CLIENT_ID`** in all deployment environments. JWT validation fails open if these are missing (the env check at startup prevents starting without them, but verify this is enforced in staging).
- [ ] **Replace `'changeme'` DB passwords** with strong random secrets before running the migration anywhere non-local.
- [ ] **Ship consent UI** — users must be shown the versioned biometric_relay consent text and explicitly accept before the app calls `POST /api/v1/me/consent`. The backend gate is live; the frontend gate must match.

### High (should be done before public launch)

- [x] **Hard-delete worker** — done; `src/worker.ts` hard-deletes users where `deleted_at < NOW() - INTERVAL '30 days'` via the BYPASSRLS `heartbits_worker` pool (`WORKER_DATABASE_URL`), satisfying the GDPR Art. 17 30-day deadline.
- [x] **Media deletion worker** — done; `src/worker.ts` consumes the `hb:worker:media_delete` Redis queue, calls MinIO `removeObject` for the user's media, then deletes the media rows.
- [ ] **audit_log partitioning** — implement pg_partman monthly partitions with 7-year retention per the migration comment.
- [ ] **Caddy security headers** — apply the config from `docs/Caddyfile.heartbits` to the production Caddyfile.
- [x] **Add `api.heartbits.what-if.io` Caddy block** — done; proxies to heartbits-api:3100 with CORS headers.
- [ ] **Log sanitisation** — verify Caddy does not log `?token=` query parameter in access logs (rotate any logs that may contain it).
- [ ] **CSP nonce for SvelteKit** — replace `'unsafe-inline'` in the web app CSP with nonce-based CSP using SvelteKit's adapter-node CSP hook.
- [ ] **Rate limit on `POST /api/v1/me/init`** — currently unlimited. A bot could create unlimited Zitadel accounts and call init repeatedly. Add IP-based rate limiting at Caddy level.

### Medium (can be done post-launch with monitoring)

- [ ] **Key rotation infrastructure** — add `key_version` column to encrypted fields; implement re-encryption worker.
- [ ] **HKDF message key derivation** — implement per-match message keys in the messages route.
- [ ] **Consent version re-prompt** — client logic to detect when the consent text version has changed and re-prompt the user.
- [ ] **Audit log SELECT restriction** — create a separate `audit_log_writer` DB role for INSERT+UPDATE(actor_id) only; remove UPDATE from `heartbits_api` grant to enforce column-level restriction.
- [ ] **DPA agreement** — execute a Data Processing Agreement if using any sub-processors (MinIO hosted externally, Stripe, etc.).
- [ ] **Privacy policy** — publish a GDPR-compliant privacy policy before accepting any real users.
- [ ] **Penetration test** — conduct a third-party pentest before launch or at reasonable user scale.
