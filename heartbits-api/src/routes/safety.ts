// ---------------------------------------------------------------------------
// Trust & Safety — blocks + reports
//   POST   /api/v1/blocks          — block a user (severs any match/bond + relay)
//   DELETE /api/v1/blocks/:userId  — unblock
//   GET    /api/v1/blocks          — list users I've blocked
//   POST   /api/v1/reports         — report a user (moderation queue)
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { redis } from '../redis'

const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'fake_profile',
  'underage',
  'other',
] as const

export const safetyRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)

  .post(
    '/blocks',
    async ({ auth, body, set }) => {
      if (body.user_id === auth.userId) {
        set.status = 400
        return { error: 'You cannot block yourself.' }
      }
      return withUser(auth.userId, async (tx) => {
        const [target] = await tx<{ id: string }[]>`
          SELECT id FROM app.users WHERE id = ${body.user_id} AND deleted_at IS NULL LIMIT 1
        `
        if (!target) {
          set.status = 404
          return { error: 'User not found.' }
        }

        await tx`
          INSERT INTO app.blocks (blocker_id, blocked_id)
          VALUES (${auth.userId}, ${body.user_id})
          ON CONFLICT (blocker_id, blocked_id) DO NOTHING
        `

        // Sever any active match between the two + drop the relay room key so the
        // biometric stream stops immediately (same handling as consent withdrawal).
        const a = auth.userId < body.user_id ? auth.userId : body.user_id
        const b = auth.userId < body.user_id ? body.user_id : auth.userId
        const severed = await tx<{ room_id: string | null }[]>`
          WITH m AS (
            UPDATE app.matches SET unmatched_at = NOW()
            WHERE user_a_id = ${a} AND user_b_id = ${b} AND unmatched_at IS NULL
            RETURNING id
          )
          SELECT bd.room_id FROM app.bonds bd JOIN m ON bd.match_id = m.id
        `
        for (const row of severed) {
          if (row.room_id) await redis.del(`relay:room:${row.room_id}`).catch(() => {})
        }

        await tx`
          INSERT INTO app.audit_log (id, actor_id, action, target_type, target_id, created_at)
          VALUES (gen_random_uuid(), ${auth.userId}, 'user.block', 'user', ${body.user_id}, NOW())
        `

        set.status = 201
        return { ok: true, severed: severed.length }
      })
    },
    { body: t.Object({ user_id: t.String({ minLength: 1 }) }) },
  )

  .delete(
    '/blocks/:userId',
    async ({ auth, params }) => {
      return withUser(auth.userId, async (tx) => {
        await tx`DELETE FROM app.blocks WHERE blocker_id = ${auth.userId} AND blocked_id = ${params.userId}`
        return { ok: true }
      })
    },
    { params: t.Object({ userId: t.String({ minLength: 1 }) }) },
  )

  .get('/blocks', async ({ auth }) => {
    return withUser(auth.userId, async (tx) => {
      const rows = await tx<{ blocked_id: string; created_at: Date }[]>`
        SELECT blocked_id, created_at FROM app.blocks
        WHERE blocker_id = ${auth.userId}
        ORDER BY created_at DESC
      `
      return {
        blocks: rows.map((r) => ({ user_id: r.blocked_id, created_at: r.created_at.toISOString() })),
        count: rows.length,
      }
    })
  })

  .post(
    '/reports',
    async ({ auth, body, set }) => {
      if (body.user_id === auth.userId) {
        set.status = 400
        return { error: 'You cannot report yourself.' }
      }
      return withUser(auth.userId, async (tx) => {
        const [target] = await tx<{ id: string }[]>`
          SELECT id FROM app.users WHERE id = ${body.user_id} AND deleted_at IS NULL LIMIT 1
        `
        if (!target) {
          set.status = 404
          return { error: 'User not found.' }
        }
        await tx`
          INSERT INTO app.reports (reporter_id, reported_id, reason, details)
          VALUES (${auth.userId}, ${body.user_id}, ${body.reason}, ${body.details ?? null})
        `
        set.status = 201
        return { ok: true, message: 'Report received. Our team will review it.' }
      })
    },
    {
      body: t.Object({
        user_id: t.String({ minLength: 1 }),
        reason: t.Union(REPORT_REASONS.map((r) => t.Literal(r))),
        details: t.Optional(t.String({ maxLength: 1000 })),
      }),
    },
  )
