// ---------------------------------------------------------------------------
// /api/v1/bonds — relay room management
//
// GET  /api/v1/bonds       — list all bonds for current user
// GET  /api/v1/bonds/:id   — get bond detail (includes room_id for relay)
// POST /api/v1/bonds       — create bond for a match (idempotent)
//
// room_id is ALWAYS server-generated (crypto.randomUUID), never from client.
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { redis } from '../redis'

/** Relay room Redis TTL — 30 days */
const RELAY_ROOM_TTL_SEC = 30 * 24 * 60 * 60

export const bondsRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)

  // ── GET /api/v1/bonds ────────────────────────────────────────────────────
  .get(
    '/bonds',
    async ({ auth }) => {
      return withUser(auth.userId, async (tx) => {
        const rows = await tx<{
          id: string
          match_id: string
          room_id: string
          created_at: Date
          user_a_id: string
          user_b_id: string
          matched_at: Date
          unmatched_at: Date | null
        }[]>`
          SELECT
            b.id,
            b.match_id,
            b.room_id,
            b.created_at,
            m.user_a_id,
            m.user_b_id,
            m.matched_at,
            m.unmatched_at
          FROM app.bonds b
          JOIN app.matches m ON m.id = b.match_id
          WHERE (m.user_a_id = ${auth.userId} OR m.user_b_id = ${auth.userId})
            AND m.unmatched_at IS NULL
          ORDER BY b.created_at DESC
        `

        const bonds = rows.map((row) => ({
          id: row.id,
          match_id: row.match_id,
          room_id: row.room_id,
          created_at: row.created_at.toISOString(),
          partner_id: row.user_a_id === auth.userId ? row.user_b_id : row.user_a_id,
          matched_at: row.matched_at.toISOString(),
        }))

        return { bonds, count: bonds.length }
      })
    },
    {
      detail: {
        summary: 'List all bonds for current user',
        tags: ['bonds'],
      },
    },
  )

  // ── GET /api/v1/bonds/:id ────────────────────────────────────────────────
  .get(
    '/bonds/:id',
    async ({ auth, params, set }) => {
      return withUser(auth.userId, async (tx) => {
        // ── GDPR Art. 9 — Biometric consent gate ─────────────────────────
        // Heart-rate data is a special category under GDPR Art. 9.  The relay
        // room_id is the credential that lets a client connect to the relay and
        // stream biometric data.  We MUST NOT return room_id (or relay_url) to
        // any user who has not given active, explicit biometric_relay consent.
        //
        // "Active" = consented_at IS NOT NULL AND withdrawn_at IS NULL
        // The version check is intentionally omitted here — the consent UI
        // enforces the current version at grant time; re-prompting for version
        // bumps is handled by the client before calling this endpoint.
        const [consent] = await tx<{ id: string }[]>`
          SELECT id
          FROM app.consents
          WHERE user_id   = ${auth.userId}
            AND consent_type = 'biometric_relay'
            AND withdrawn_at IS NULL
          LIMIT 1
        `

        if (!consent) {
          set.status = 403
          return {
            error:
              'Biometric consent required. You must grant biometric_relay consent ' +
              'before accessing relay room credentials. ' +
              'POST /api/v1/me/consent with consent_type="biometric_relay".',
          }
        }

        const [row] = await tx<{
          id: string
          match_id: string
          room_id: string
          created_at: Date
          user_a_id: string
          user_b_id: string
          matched_at: Date
          unmatched_at: Date | null
        }[]>`
          SELECT
            b.id,
            b.match_id,
            b.room_id,
            b.created_at,
            m.user_a_id,
            m.user_b_id,
            m.matched_at,
            m.unmatched_at
          FROM app.bonds b
          JOIN app.matches m ON m.id = b.match_id
          WHERE b.id = ${params.id}
            AND (m.user_a_id = ${auth.userId} OR m.user_b_id = ${auth.userId})
          LIMIT 1
        `

        if (!row) {
          set.status = 404
          return { error: 'Bond not found.' }
        }

        if (row.unmatched_at !== null) {
          set.status = 410
          return { error: 'This match has ended.' }
        }

        return {
          id: row.id,
          match_id: row.match_id,
          room_id: row.room_id,
          created_at: row.created_at.toISOString(),
          partner_id: row.user_a_id === auth.userId ? row.user_b_id : row.user_a_id,
          matched_at: row.matched_at.toISOString(),
          // Relay connection hint
          relay_url: `wss://hb.what-if.io?room=${row.room_id}`,
        }
      })
    },
    {
      params: t.Object({
        id: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Get bond details including relay room_id',
        tags: ['bonds'],
      },
    },
  )

  // ── POST /api/v1/bonds ───────────────────────────────────────────────────
  .post(
    '/bonds',
    async ({ auth, body, set }) => {
      return withUser(auth.userId, async (tx) => {
        // ── GDPR Art. 9 — Biometric consent gate ─────────────────────────
        // Creating a bond writes a relay room key to Redis and returns the
        // room_id — do not proceed without active biometric_relay consent.
        const [consent] = await tx<{ id: string }[]>`
          SELECT id
          FROM app.consents
          WHERE user_id   = ${auth.userId}
            AND consent_type = 'biometric_relay'
            AND withdrawn_at IS NULL
          LIMIT 1
        `

        if (!consent) {
          set.status = 403
          return {
            error:
              'Biometric consent required. You must grant biometric_relay consent ' +
              'before creating a relay bond. ' +
              'POST /api/v1/me/consent with consent_type="biometric_relay".',
          }
        }

        // Verify match exists and current user is a participant
        const [match] = await tx<{
          id: string
          user_a_id: string
          user_b_id: string
          unmatched_at: Date | null
        }[]>`
          SELECT id, user_a_id, user_b_id, unmatched_at
          FROM app.matches
          WHERE id = ${body.match_id}
            AND (user_a_id = ${auth.userId} OR user_b_id = ${auth.userId})
          LIMIT 1
        `

        if (!match) {
          set.status = 404
          return { error: 'Match not found.' }
        }

        if (match.unmatched_at !== null) {
          set.status = 410
          return { error: 'This match has ended — cannot create bond.' }
        }

        // Check if bond already exists (idempotent)
        const [existing] = await tx<{ id: string; room_id: string; created_at: Date }[]>`
          SELECT id, room_id, created_at
          FROM app.bonds
          WHERE match_id = ${match.id}
          LIMIT 1
        `

        if (existing) {
          set.status = 200
          return {
            id: existing.id,
            match_id: match.id,
            room_id: existing.room_id,
            created_at: existing.created_at.toISOString(),
            relay_url: `wss://hb.what-if.io?room=${existing.room_id}`,
            created: false,
          }
        }

        // Create new bond with server-generated room_id
        const roomId = crypto.randomUUID()

        const [bond] = await tx<{ id: string; room_id: string; created_at: Date }[]>`
          INSERT INTO app.bonds (id, match_id, room_id, created_at)
          VALUES (gen_random_uuid(), ${match.id}, ${roomId}, NOW())
          RETURNING id, room_id, created_at
        `

        if (!bond) {
          set.status = 500
          return { error: 'Failed to create bond.' }
        }

        // Write relay room membership key to Redis
        const userA = match.user_a_id
        const userB = match.user_b_id
        await redis
          .set(`relay:room:${bond.room_id}`, `${userA}:${userB}`, 'EX', RELAY_ROOM_TTL_SEC)
          .catch((e) => console.error('[bonds] relay room redis write failed:', e))

        // Audit
        await tx`
          INSERT INTO app.audit_log (id, actor_id, action, target_type, target_id, created_at)
          VALUES (gen_random_uuid(), ${auth.userId}, 'bond.create', 'bond', ${bond.id}, NOW())
        `

        set.status = 201
        return {
          id: bond.id,
          match_id: match.id,
          room_id: bond.room_id,
          created_at: bond.created_at.toISOString(),
          relay_url: `wss://hb.what-if.io?room=${bond.room_id}`,
          created: true,
        }
      })
    },
    {
      body: t.Object({
        match_id: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Create (or retrieve existing) bond for a match',
        tags: ['bonds'],
      },
    },
  )
