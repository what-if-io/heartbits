// ---------------------------------------------------------------------------
// /api/v1/me — current user profile management + GDPR endpoints
//
// POST   /api/v1/me/init            — idempotent first-login bootstrap
// GET    /api/v1/me                 — return decrypted profile
// PATCH  /api/v1/me                 — update profile fields (re-encrypts PII)
// DELETE /api/v1/me                 — GDPR Art. 17 right to erasure
// GET    /api/v1/me/export          — GDPR Art. 20 data portability (rate: 1/24h)
// POST   /api/v1/me/consent         — grant consent (biometric_relay | marketing)
// DELETE /api/v1/me/consent/:type   — withdraw consent; biometric_relay evicts relay keys
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { authPlugin } from '../auth'
import { sql, withUser } from '../db'
import { encryptIfPresent, decryptField } from '../crypto'
import { redis, rateLimit } from '../redis'
import { isValidGeohash } from '../types'

// ---------------------------------------------------------------------------
// JWT verification for /me/init (user may not exist in DB yet)
// ---------------------------------------------------------------------------

const JWKS_CACHE_KEY = 'hb:jwks:raw'

async function verifyTokenForInit(token: string): Promise<string> {
  const jwksUrl = process.env['ZITADEL_JWKS_URL']
  if (!jwksUrl) throw new Error('ZITADEL_JWKS_URL is required')

  const cached = await redis.get(JWKS_CACHE_KEY).catch(() => null)
  let jwksUri: string

  if (cached) {
    jwksUri = cached
  } else {
    const res = await fetch(jwksUrl)
    if (!res.ok) throw new Error(`OIDC discovery fetch failed: ${res.status}`)
    const doc = (await res.json()) as { jwks_uri: string }
    jwksUri = doc.jwks_uri
    await redis.set(JWKS_CACHE_KEY, jwksUri, 'EX', 3600).catch(() => {/* non-fatal */})
  }

  const jwks = createRemoteJWKSet(new URL(jwksUri))
  // SECURITY: enforce issuer + audience so a token from a different Zitadel
  // project or a different service cannot bootstrap a HeartBits account.
  const issuer = process.env['ZITADEL_ISSUER']
  const audience = process.env['ZITADEL_CLIENT_ID']
  const { payload } = await jwtVerify(token, jwks, {
    issuer: issuer ?? undefined,
    audience: audience ?? undefined,
  })
  if (!payload.sub) throw new Error('JWT missing sub claim')
  return payload.sub
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive integer age from date_of_birth string (YYYY-MM-DD). */
function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/** Build avatar URL from avatar_media_id. */
function buildAvatarUrl(mediaId: string | null): string | null {
  if (!mediaId) return null
  const bucket = process.env['MINIO_BUCKET'] ?? 'heartbits-media'
  // Placeholder — real implementation generates a pre-signed MinIO URL
  return `https://${process.env['MEDIA_DOMAIN'] ?? 'media.heartbits.example.com'}/${bucket}/${mediaId}`
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

export const meRoutes = new Elysia({ prefix: '/api/v1' })

  // ── POST /api/v1/me/init ─────────────────────────────────────────────────
  .post(
    '/me/init',
    async ({ request, set }) => {
      const header = request.headers.get('authorization')
      if (!header?.startsWith('Bearer ')) {
        set.status = 401
        return { error: 'Missing Authorization header' }
      }

      let sub: string
      try {
        sub = await verifyTokenForInit(header.slice(7).trim())
      } catch (err) {
        set.status = 401
        return {
          error: `JWT verification failed: ${err instanceof Error ? err.message : String(err)}`,
        }
      }

      // Upsert user row
      const [user] = await sql<{ id: string; created: boolean }[]>`
        WITH ins AS (
          INSERT INTO app.users (id, zitadel_sub, created_at, last_seen_at)
          VALUES (gen_random_uuid(), ${sub}, NOW(), NOW())
          ON CONFLICT (zitadel_sub) DO UPDATE
            SET last_seen_at = NOW()
          RETURNING id,
            (xmax = 0) AS created
        )
        SELECT id, created FROM ins
      `

      if (!user) {
        set.status = 500
        return { error: 'Failed to initialise user' }
      }

      // Upsert profile row (no PII set yet — client calls PATCH to fill in)
      await sql`
        INSERT INTO app.profiles (id)
        VALUES (${user.id})
        ON CONFLICT (id) DO NOTHING
      `

      set.status = user.created ? 201 : 200
      return {
        user_id: user.id,
        created: user.created,
        message: user.created ? 'Account created' : 'Account already exists',
      }
    },
    {
      detail: {
        summary: 'Initialise user account (idempotent)',
        tags: ['me'],
      },
    },
  )

  // ── GET /api/v1/me ───────────────────────────────────────────────────────
  .use(authPlugin)
  .get(
    '/me',
    async ({ auth, set }) => {
      return withUser(auth.userId, async (tx) => {
        const rows = await tx<{
          id: string
          display_name: Buffer | null
          date_of_birth: Buffer | null
          bio: Buffer | null
          gender: string | null
          seeking: string[] | null
          age_min: number | null
          age_max: number | null
          location_geohash6: string | null
          avatar_media_id: string | null
        }[]>`
          SELECT
            p.id,
            p.display_name,
            p.date_of_birth,
            p.bio,
            p.gender,
            p.seeking,
            p.age_min,
            p.age_max,
            p.location_geohash6,
            p.avatar_media_id
          FROM app.profiles p
          WHERE p.id = ${auth.userId}
          LIMIT 1
        `

        const profile = rows[0]
        if (!profile) {
          set.status = 404
          return { error: 'Profile not found — call POST /api/v1/me/init first' }
        }

        const [display_name, date_of_birth, bio] = await Promise.all([
          decryptField(profile.display_name),
          decryptField(profile.date_of_birth),
          decryptField(profile.bio),
        ])

        const age = date_of_birth ? ageFromDob(date_of_birth) : null

        return {
          id: profile.id,
          display_name,
          age,
          date_of_birth,
          bio,
          gender: profile.gender,
          seeking: profile.seeking,
          age_min: profile.age_min,
          age_max: profile.age_max,
          location_geohash6: profile.location_geohash6,
          avatar_url: buildAvatarUrl(profile.avatar_media_id),
        }
      })
    },
    {
      detail: {
        summary: 'Get current user profile',
        tags: ['me'],
      },
    },
  )

  // ── PATCH /api/v1/me ─────────────────────────────────────────────────────
  .patch(
    '/me',
    async ({ auth, body, set }) => {
      // Validate geohash if provided
      if (body.location_geohash6 !== undefined && body.location_geohash6 !== null) {
        if (!isValidGeohash(body.location_geohash6)) {
          set.status = 400
          return {
            error:
              'location_geohash6 must be 1–6 characters from the geohash alphabet. GPS coordinates are not accepted.',
          }
        }
      }

      // Validate age bounds
      if (
        body.age_min !== undefined &&
        body.age_max !== undefined &&
        body.age_min !== null &&
        body.age_max !== null &&
        body.age_min > body.age_max
      ) {
        set.status = 400
        return { error: 'age_min must be ≤ age_max' }
      }

      return withUser(auth.userId, async (tx) => {
        // Encrypt PII fields
        const display_name = await encryptIfPresent(body.display_name)
        const date_of_birth = await encryptIfPresent(body.date_of_birth)
        const bio = await encryptIfPresent(body.bio)

        // Build dynamic update — only patch fields that were provided
        const updates: string[] = []
        const values: unknown[] = []
        let paramIdx = 1

        const addField = (col: string, val: unknown) => {
          if (val !== undefined) {
            updates.push(`${col} = $${paramIdx++}`)
            values.push(val)
          }
        }

        if (body.display_name !== undefined) addField('display_name', display_name)
        if (body.date_of_birth !== undefined) addField('date_of_birth', date_of_birth)
        if (body.bio !== undefined) addField('bio', bio)
        if (body.gender !== undefined) addField('gender', body.gender)
        if (body.seeking !== undefined) addField('seeking', body.seeking)
        if (body.age_min !== undefined) addField('age_min', body.age_min)
        if (body.age_max !== undefined) addField('age_max', body.age_max)
        if (body.location_geohash6 !== undefined)
          addField('location_geohash6', body.location_geohash6)

        if (updates.length === 0) {
          set.status = 400
          return { error: 'No fields to update' }
        }

        values.push(auth.userId)

        // postgres.js doesn't support fully dynamic queries via template literals,
        // so we use the unsafe() escape hatch here.
        //
        // SECURITY NOTE: `updates` contains only server-defined column name strings
        // (e.g. "display_name = $1") assembled by `addField()` above.  User-supplied
        // values go into the `values` array and are sent as parameterised bindings —
        // they are NEVER interpolated into the SQL string.  This is safe from SQL
        // injection, but must be kept that way: addField() must never accept
        // caller-supplied column names.
        //
        // Allowed columns whitelist (defence-in-depth):
        const ALLOWED_COLUMNS = new Set([
          'display_name', 'date_of_birth', 'bio', 'gender',
          'seeking', 'age_min', 'age_max', 'location_geohash6',
        ])
        for (const update of updates) {
          const col = update.split(' ')[0]
          if (!ALLOWED_COLUMNS.has(col ?? '')) {
            throw new Error(`[me] unsafe(): unexpected column in update: ${col}`)
          }
        }

        await tx.unsafe(
          `UPDATE app.profiles SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
          values,
        )

        // Audit log
        await tx`
          INSERT INTO app.audit_log (id, actor_id, action, target_type, target_id, created_at)
          VALUES (gen_random_uuid(), ${auth.userId}, 'profile.update', 'profile', ${auth.userId}, NOW())
        `

        set.status = 200
        return { message: 'Profile updated' }
      })
    },
    {
      body: t.Object({
        display_name: t.Optional(t.Union([t.String({ minLength: 1, maxLength: 50 }), t.Null()])),
        date_of_birth: t.Optional(
          t.Union([t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }), t.Null()]),
        ),
        bio: t.Optional(t.Union([t.String({ maxLength: 500 }), t.Null()])),
        gender: t.Optional(
          t.Union([
            t.Union([
              t.Literal('man'),
              t.Literal('woman'),
              t.Literal('nonbinary'),
              t.Literal('other'),
            ]),
            t.Null(),
          ]),
        ),
        seeking: t.Optional(t.Union([t.Array(t.String()), t.Null()])),
        age_min: t.Optional(t.Union([t.Integer({ minimum: 18, maximum: 99 }), t.Null()])),
        age_max: t.Optional(t.Union([t.Integer({ minimum: 18, maximum: 99 }), t.Null()])),
        location_geohash6: t.Optional(
          t.Union([t.String({ minLength: 1, maxLength: 6 }), t.Null()]),
        ),
      }),
      detail: {
        summary: 'Update current user profile',
        tags: ['me'],
      },
    },
  )

  // ── DELETE /api/v1/me — GDPR Art. 17 Right to Erasure ───────────────────────
  //
  // Erasure procedure (in order, inside one transaction):
  //   1. Overwrite all PII BYTEA fields with a tombstone ciphertext (so the
  //      column is not NULL — which would make re-encryption transparent in
  //      length, but an attacker who gains DB access cannot recover plaintext).
  //   2. NULL-out non-encrypted PII: gender, seeking, age_min, age_max,
  //      location_geohash6, avatar_media_id.
  //   3. Set app.users.deleted_at = NOW() (soft-delete keeps FK integrity).
  //   4. Anonymise audit_log rows: actor_id → NULL (retain action for compliance
  //      but unlink from identity).
  //   5. Withdraw all active consents (set withdrawn_at).
  //   6. Write audit entry with actor_id = NULL and target_id = user_id before
  //      the user row is soft-deleted.
  //
  // Media deletion (MinIO objects) is handled asynchronously by the worker —
  // it polls for users where deleted_at IS NOT NULL AND avatar_media_id IS NULL.
  // Matches and swipes rows are CASCADE-deleted by the FK when the user row is
  // hard-deleted; for now we leave them in place (soft-delete) and exclude them
  // from discovery and bond access via `deleted_at IS NULL` checks.
  //
  // SECURITY TODO: Add a scheduled worker job to hard-delete users soft-deleted
  // more than 30 days ago (purge matches, swipes, messages via CASCADE).
  .delete(
    '/me',
    async ({ auth, set, request }) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

      // Tombstone value: encrypt the literal string "GDPR_ERASED" so the field
      // is non-NULL and non-empty but contains no recoverable PII.
      const tombstone = await encryptIfPresent('GDPR_ERASED')

      await sql.begin(async (tx) => {
        // 1. Overwrite PII fields in profile
        await tx`
          UPDATE app.profiles
          SET
            display_name      = ${tombstone}::bytea,
            date_of_birth     = ${tombstone}::bytea,
            bio               = ${tombstone}::bytea,
            gender            = NULL,
            seeking           = '{}',
            age_min           = 18,
            age_max           = 99,
            location_geohash6 = NULL,
            avatar_media_id   = NULL
          WHERE id = ${auth.userId}
        `

        // 2. Soft-delete the user row
        await tx`
          UPDATE app.users
          SET deleted_at = NOW()
          WHERE id = ${auth.userId}
        `

        // 3. Anonymise audit_log rows (unlink identity, keep action history)
        await tx`
          UPDATE app.audit_log
          SET actor_id = NULL
          WHERE actor_id = ${auth.userId}
        `

        // 4. Withdraw all active consents
        await tx`
          UPDATE app.consents
          SET withdrawn_at = NOW()
          WHERE user_id = ${auth.userId}
            AND withdrawn_at IS NULL
        `

        // 5. Write final audit entry (actor_id = NULL — user is being erased)
        await tx`
          INSERT INTO app.audit_log
            (id, actor_id, action, target_type, target_id, ip_address, created_at)
          VALUES
            (gen_random_uuid(), NULL, 'account.delete', 'user', ${auth.userId},
             ${ip}::inet, NOW())
        `
      })

      // Signal worker to delete MinIO objects for this user
      await redis
        .lpush('hb:worker:media_delete', auth.userId)
        .catch((e) => console.error('[me/delete] redis media_delete push failed:', e))

      set.status = 200
      return {
        message:
          'Your account and all associated personal data have been scheduled for deletion. ' +
          'Media files will be permanently removed within 24 hours.',
      }
    },
    {
      detail: {
        summary: 'Delete account and erase all personal data (GDPR Art. 17)',
        tags: ['me'],
      },
    },
  )

  // ── GET /api/v1/me/export — GDPR Art. 20 Right to Data Portability ──────────
  //
  // Returns all personal data we hold about the current user in a single JSON
  // document, decrypted to plaintext.  Rate-limited to 1 export per 24 hours
  // via Redis (prevents bulk harvesting).
  //
  // SECURITY TODO: For production, consider emailing a download link instead of
  // responding inline — large match histories would be slow synchronous DB work.
  .get(
    '/me/export',
    async ({ auth, set }) => {
      // Rate limit: 1 export per 24 hours per user
      const rl = await rateLimit(
        `rl:export:${auth.userId}`,
        1,
        24 * 60 * 60 * 1000,
      )
      if (!rl.allowed) {
        set.status = 429
        return { error: 'Data export can only be requested once per 24 hours.' }
      }

      return withUser(auth.userId, async (tx) => {
        // Profile + user row
        const [row] = await tx<{
          id: string
          zitadel_sub: string
          created_at: Date
          last_seen_at: Date
          display_name: Buffer | null
          date_of_birth: Buffer | null
          bio: Buffer | null
          gender: string | null
          seeking: string[] | null
          age_min: number | null
          age_max: number | null
          location_geohash6: string | null
        }[]>`
          SELECT
            u.id, u.zitadel_sub, u.created_at, u.last_seen_at,
            p.display_name, p.date_of_birth, p.bio,
            p.gender, p.seeking, p.age_min, p.age_max, p.location_geohash6
          FROM app.users u
          LEFT JOIN app.profiles p ON p.id = u.id
          WHERE u.id = ${auth.userId}
            AND u.deleted_at IS NULL
          LIMIT 1
        `

        if (!row) {
          set.status = 404
          return { error: 'User not found.' }
        }

        const [display_name, date_of_birth, bio] = await Promise.all([
          decryptField(row.display_name),
          decryptField(row.date_of_birth),
          decryptField(row.bio),
        ])

        // Swipes
        const swipes = await tx<{ swiped_id: string; direction: string; created_at: Date }[]>`
          SELECT swiped_id, direction, created_at
          FROM app.swipes
          WHERE swiper_id = ${auth.userId}
          ORDER BY created_at DESC
        `

        // Matches
        const matches = await tx<{
          id: string; user_a_id: string; user_b_id: string; matched_at: Date
        }[]>`
          SELECT id, user_a_id, user_b_id, matched_at
          FROM app.matches
          WHERE user_a_id = ${auth.userId} OR user_b_id = ${auth.userId}
          ORDER BY matched_at DESC
        `

        // Consents
        const consents = await tx<{
          consent_type: string; version: string; consented_at: Date; withdrawn_at: Date | null
        }[]>`
          SELECT consent_type, version, consented_at, withdrawn_at
          FROM app.consents
          WHERE user_id = ${auth.userId}
          ORDER BY consented_at DESC
        `

        // Audit
        await tx`
          INSERT INTO app.audit_log
            (id, actor_id, action, target_type, target_id, created_at)
          VALUES
            (gen_random_uuid(), ${auth.userId}, 'account.export', 'user', ${auth.userId}, NOW())
        `

        set.status = 200
        return {
          export_generated_at: new Date().toISOString(),
          user: {
            id: row.id,
            zitadel_sub: row.zitadel_sub,
            created_at: row.created_at.toISOString(),
            last_seen_at: row.last_seen_at.toISOString(),
          },
          profile: {
            display_name,
            date_of_birth,
            bio,
            gender: row.gender,
            seeking: row.seeking,
            age_min: row.age_min,
            age_max: row.age_max,
            location_geohash6: row.location_geohash6,
          },
          swipes: swipes.map((s) => ({
            swiped_id: s.swiped_id,
            direction: s.direction,
            created_at: s.created_at.toISOString(),
          })),
          matches: matches.map((m) => ({
            id: m.id,
            partner_id: m.user_a_id === auth.userId ? m.user_b_id : m.user_a_id,
            matched_at: m.matched_at.toISOString(),
          })),
          consents: consents.map((c) => ({
            type: c.consent_type,
            version: c.version,
            consented_at: c.consented_at.toISOString(),
            withdrawn_at: c.withdrawn_at?.toISOString() ?? null,
          })),
        }
      })
    },
    {
      detail: {
        summary: 'Export all personal data (GDPR Art. 20 — data portability)',
        tags: ['me'],
      },
    },
  )

  // ── POST /api/v1/me/consent — GDPR consent grant ─────────────────────────────
  //
  // Records explicit consent for a specific type (e.g. 'biometric_relay').
  // Biometric data (heart rate) is GDPR Article 9 special category — explicit,
  // informed, separate consent MUST be obtained before relay access is permitted.
  //
  // The client MUST present the exact consent text version (semver) that was
  // shown to the user.  The API does not store the text itself — only the version
  // identifier and timestamp.
  .post(
    '/me/consent',
    async ({ auth, body, set, request }) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

      // Validate consent_type
      const ALLOWED_CONSENT_TYPES = ['biometric_relay', 'marketing'] as const
      if (!ALLOWED_CONSENT_TYPES.includes(body.consent_type as typeof ALLOWED_CONSENT_TYPES[number])) {
        set.status = 400
        return { error: `Unknown consent_type. Allowed: ${ALLOWED_CONSENT_TYPES.join(', ')}` }
      }

      return withUser(auth.userId, async (tx) => {
        // Upsert consent — UNIQUE (user_id, consent_type, version)
        await tx`
          INSERT INTO app.consents
            (id, user_id, consent_type, version, consented_at, ip_address)
          VALUES
            (gen_random_uuid(), ${auth.userId}, ${body.consent_type}, ${body.version},
             NOW(), ${ip}::inet)
          ON CONFLICT (user_id, consent_type, version) DO UPDATE
            SET consented_at = NOW(),
                withdrawn_at = NULL,
                ip_address   = EXCLUDED.ip_address
        `

        // Audit
        await tx`
          INSERT INTO app.audit_log
            (id, actor_id, action, target_type, target_id, ip_address, created_at)
          VALUES
            (gen_random_uuid(), ${auth.userId}, ${'consent.grant.' + body.consent_type},
             'user', ${auth.userId}, ${ip}::inet, NOW())
        `

        set.status = 201
        return {
          message: `Consent recorded: ${body.consent_type} v${body.version}`,
          consent_type: body.consent_type,
          version: body.version,
        }
      })
    },
    {
      body: t.Object({
        consent_type: t.String({ minLength: 1 }),
        version: t.String({ minLength: 1, maxLength: 20 }),
      }),
      detail: {
        summary: 'Grant consent (biometric_relay | marketing)',
        tags: ['me'],
      },
    },
  )

  // ── DELETE /api/v1/me/consent/:type — GDPR consent withdrawal ────────────────
  //
  // Withdrawing biometric_relay consent MUST immediately invalidate the relay
  // room Redis key so no further heart-rate data is forwarded.  The bond itself
  // is preserved (match history is separate from biometric streaming consent).
  //
  // If the relay later supports JWT auth (Phase 1), the relay will call the API
  // to validate consent before allowing reconnect — so this endpoint is the
  // single source of truth.
  .delete(
    '/me/consent/:type',
    async ({ auth, params, set, request }) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
      const ALLOWED_CONSENT_TYPES = ['biometric_relay', 'marketing'] as const

      if (!ALLOWED_CONSENT_TYPES.includes(params.type as typeof ALLOWED_CONSENT_TYPES[number])) {
        set.status = 400
        return { error: `Unknown consent_type. Allowed: ${ALLOWED_CONSENT_TYPES.join(', ')}` }
      }

      return withUser(auth.userId, async (tx) => {
        const result = await tx`
          UPDATE app.consents
          SET withdrawn_at = NOW()
          WHERE user_id = ${auth.userId}
            AND consent_type = ${params.type}
            AND withdrawn_at IS NULL
          RETURNING id
        `

        if (result.length === 0) {
          set.status = 404
          return { error: 'No active consent of this type found.' }
        }

        // If withdrawing biometric_relay: immediately evict all relay room keys
        // for this user's active bonds so the relay stops forwarding heart-rate data.
        if (params.type === 'biometric_relay') {
          const activeBonds = await tx<{ room_id: string }[]>`
            SELECT b.room_id
            FROM app.bonds b
            JOIN app.matches m ON m.id = b.match_id
            WHERE (m.user_a_id = ${auth.userId} OR m.user_b_id = ${auth.userId})
              AND m.unmatched_at IS NULL
          `

          if (activeBonds.length > 0) {
            const pipeline = redis.pipeline()
            for (const bond of activeBonds) {
              // SECURITY: Delete the relay room key so the relay cannot forward
              // any more biometric data for this user.  The relay checks this key
              // on every connect; existing open WebSocket connections will time out
              // on the next ping cycle (20s).
              pipeline.del(`relay:room:${bond.room_id}`)
            }
            await pipeline.exec().catch((e) =>
              console.error('[me/consent] relay room eviction failed:', e),
            )
          }
        }

        // Audit
        await tx`
          INSERT INTO app.audit_log
            (id, actor_id, action, target_type, target_id, ip_address, created_at)
          VALUES
            (gen_random_uuid(), ${auth.userId}, ${'consent.withdraw.' + params.type},
             'user', ${auth.userId}, ${ip}::inet, NOW())
        `

        set.status = 200
        return {
          message: `Consent withdrawn: ${params.type}`,
          consent_type: params.type,
        }
      })
    },
    {
      params: t.Object({
        type: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Withdraw consent (biometric_relay | marketing)',
        tags: ['me'],
      },
    },
  )
