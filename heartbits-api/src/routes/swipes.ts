// ---------------------------------------------------------------------------
// POST /api/v1/swipes — send a like / pass / superlike
//
// Rate limit: 200 swipes/user/day
// On "like" or "superlike":
//   - Check for mutual like → if yes, create match + bond (room_id = randomUUID)
//   - Write relay room key to Redis: relay:room:{room_id} = "{user_a}:{user_b}"
// Returns: { matched: boolean, match_id?, bond? }
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { rateLimit, redis } from '../redis'

const SWIPE_RATE_LIMIT = 200
const SWIPE_RATE_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Relay room Redis key TTL — 30 days (relay reads this on connect) */
const RELAY_ROOM_TTL_SEC = 30 * 24 * 60 * 60

export const swipesRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .post(
    '/swipes',
    async ({ auth, body, set }) => {
      // ── Rate limiting ────────────────────────────────────────────────────
      const rl = await rateLimit(
        `rl:swipes:${auth.userId}`,
        SWIPE_RATE_LIMIT,
        SWIPE_RATE_WINDOW_MS,
      )
      if (!rl.allowed) {
        set.status = 429
        set.headers['X-RateLimit-Limit'] = String(SWIPE_RATE_LIMIT)
        set.headers['X-RateLimit-Remaining'] = '0'
        set.headers['X-RateLimit-Reset'] = String(Math.ceil(rl.resetAt / 1000))
        return { error: 'Daily swipe limit reached (200/day).' }
      }

      set.headers['X-RateLimit-Limit'] = String(SWIPE_RATE_LIMIT)
      set.headers['X-RateLimit-Remaining'] = String(rl.remaining)

      if (body.swiped_id === auth.userId) {
        set.status = 400
        return { error: 'Cannot swipe yourself.' }
      }

      return withUser(auth.userId, async (tx) => {
        // ── Verify target user exists and is not deleted ──────────────────
        const [target] = await tx<{ id: string }[]>`
          SELECT u.id
          FROM app.users u
          WHERE u.id = ${body.swiped_id}
            AND u.deleted_at IS NULL
          LIMIT 1
        `
        if (!target) {
          set.status = 404
          return { error: 'User not found.' }
        }

        // ── Record swipe (upsert so duplicate requests are idempotent) ────
        await tx`
          INSERT INTO app.swipes (swiper_id, swiped_id, direction, created_at)
          VALUES (${auth.userId}, ${body.swiped_id}, ${body.direction}, NOW())
          ON CONFLICT (swiper_id, swiped_id) DO UPDATE
            SET direction = EXCLUDED.direction,
                created_at = EXCLUDED.created_at
        `

        // ── Audit ─────────────────────────────────────────────────────────
        await tx`
          INSERT INTO app.audit_log (id, actor_id, action, target_type, target_id, created_at)
          VALUES (
            gen_random_uuid(),
            ${auth.userId},
            ${'swipe.' + body.direction},
            'user',
            ${body.swiped_id},
            NOW()
          )
        `

        // ── Check for mutual like (only on like/superlike) ─────────────
        if (body.direction === 'pass') {
          return { matched: false }
        }

        const [mutual] = await tx<{ direction: string }[]>`
          SELECT direction
          FROM app.swipes
          WHERE swiper_id = ${body.swiped_id}
            AND swiped_id = ${auth.userId}
            AND direction IN ('like', 'superlike')
          LIMIT 1
        `

        if (!mutual) {
          return { matched: false }
        }

        // ── Match! ────────────────────────────────────────────────────────
        // Canonical ordering: user_a < user_b (prevents duplicate rows)
        const userA = auth.userId < body.swiped_id ? auth.userId : body.swiped_id
        const userB = auth.userId < body.swiped_id ? body.swiped_id : auth.userId

        // Upsert match (idempotent if this swipe was already processed)
        const [match] = await tx<{ id: string; created: boolean }[]>`
          WITH ins AS (
            INSERT INTO app.matches (id, user_a_id, user_b_id, matched_at)
            VALUES (gen_random_uuid(), ${userA}, ${userB}, NOW())
            ON CONFLICT (user_a_id, user_b_id) DO UPDATE
              SET matched_at = matches.matched_at   -- no-op to RETURNING
            RETURNING id, (xmax = 0) AS created
          )
          SELECT id, created FROM ins
        `

        if (!match) {
          set.status = 500
          return { error: 'Failed to create match.' }
        }

        // ── Create bond (room_id is ALWAYS server-generated) ──────────────
        const roomId = crypto.randomUUID()

        const [bond] = await tx<{ id: string; room_id: string }[]>`
          INSERT INTO app.bonds (id, match_id, room_id, created_at)
          VALUES (gen_random_uuid(), ${match.id}, ${roomId}, NOW())
          ON CONFLICT (match_id) DO UPDATE
            SET match_id = bonds.match_id   -- no-op; return existing
          RETURNING id, room_id
        `

        if (!bond) {
          set.status = 500
          return { error: 'Failed to create bond.' }
        }

        // ── Write relay room key to Redis ──────────────────────────────────
        // Relay reads relay:room:{room_id} → "{user_a}:{user_b}" on connect
        await redis
          .set(
            `relay:room:${bond.room_id}`,
            `${userA}:${userB}`,
            'EX',
            RELAY_ROOM_TTL_SEC,
          )
          .catch((e) => console.error('[swipes] redis relay room write failed:', e))

        // ── Match audit ────────────────────────────────────────────────────
        await tx`
          INSERT INTO app.audit_log (id, actor_id, action, target_type, target_id, created_at)
          VALUES (gen_random_uuid(), ${auth.userId}, 'match.create', 'match', ${match.id}, NOW())
        `

        set.status = 200
        return {
          matched: true,
          match_id: match.id,
          bond: {
            id: bond.id,
            room_id: bond.room_id,
          },
        }
      })
    },
    {
      body: t.Object({
        swiped_id: t.String({ minLength: 1 }),
        direction: t.Union([
          t.Literal('like'),
          t.Literal('pass'),
          t.Literal('superlike'),
        ]),
      }),
      detail: {
        summary: 'Swipe on a profile (like / pass / superlike)',
        tags: ['swipes'],
      },
    },
  )
