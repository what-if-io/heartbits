// ---------------------------------------------------------------------------
// Persisted chat for a match.
//   POST   /api/v1/matches/:matchId/messages   — send (body, reply_to_id?)
//   GET    /api/v1/matches/:matchId/messages    — paginated history (?before=&limit=)
//   POST   /api/v1/matches/:matchId/read        — mark partner messages read
//   PATCH  /api/v1/messages/:id                 — edit own message
//   DELETE /api/v1/messages/:id                 — soft-delete own message
//   POST   /api/v1/messages/:id/reactions       — add reaction { emoji }
//   DELETE /api/v1/messages/:id/reactions/:emoji — remove own reaction
//
// Bodies are AES-256-GCM encrypted at rest (reuses the field-encryption key;
// per-match HKDF is a future hardening). RLS restricts everything to the two
// match participants.
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { encrypt, decryptField } from '../crypto'
import type postgres from 'postgres'

const PAGE_DEFAULT = 50
const PAGE_MAX = 100

type Row = {
  id: string
  sender_id: string
  body_encrypted: Buffer | null
  reply_to_id: string | null
  sent_at: Date
  edited_at: Date | null
  deleted_at: Date | null
  read_at: Date | null
  attachment_media_id: string | null
}

/** Verify the current user is in an active (non-unmatched) match. */
async function activeMatch(tx: postgres.TransactionSql, matchId: string, userId: string) {
  const [m] = await tx<{ id: string }[]>`
    SELECT id FROM app.matches
    WHERE id = ${matchId}
      AND unmatched_at IS NULL
      AND (user_a_id = ${userId} OR user_b_id = ${userId})
    LIMIT 1
  `
  return m ?? null
}

async function serialize(tx: postgres.TransactionSql, rows: Row[], me: string) {
  const ids = rows.map((r) => r.id)
  const reactions = ids.length
    ? await tx<{ message_id: string; emoji: string; count: string; mine: boolean }[]>`
        SELECT message_id, emoji, count(*) AS count, bool_or(user_id = ${me}) AS mine
        FROM app.message_reactions
        WHERE message_id = ANY(${ids}::text[])
        GROUP BY message_id, emoji
      `
    : []
  const byMsg = new Map<string, { emoji: string; count: number; mine: boolean }[]>()
  for (const r of reactions) {
    const arr = byMsg.get(r.message_id) ?? []
    arr.push({ emoji: r.emoji, count: Number(r.count), mine: r.mine })
    byMsg.set(r.message_id, arr)
  }
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      sender_id: r.sender_id,
      mine: r.sender_id === me,
      body: r.deleted_at ? null : await decryptField(r.body_encrypted),
      deleted: r.deleted_at !== null,
      reply_to_id: r.reply_to_id,
      attachment_media_id: r.attachment_media_id,
      sent_at: r.sent_at.toISOString(),
      edited_at: r.edited_at?.toISOString() ?? null,
      read_at: r.read_at?.toISOString() ?? null,
      reactions: byMsg.get(r.id) ?? [],
    })),
  )
}

export const messagesRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)

  .post(
    '/matches/:matchId/messages',
    async ({ auth, params, body, set }) => {
      return withUser(auth.userId, async (tx) => {
        if (!(await activeMatch(tx, params.matchId, auth.userId))) {
          set.status = 404
          return { error: 'Match not found.' }
        }
        const enc = Buffer.from(await encrypt(body.body), 'utf8')
        const [row] = await tx<Row[]>`
          INSERT INTO app.messages (match_id, sender_id, body_encrypted, reply_to_id)
          VALUES (${params.matchId}, ${auth.userId}, ${enc}, ${body.reply_to_id ?? null})
          RETURNING id, sender_id, body_encrypted, reply_to_id, sent_at, edited_at, deleted_at, read_at, attachment_media_id
        `
        set.status = 201
        return (await serialize(tx, [row!], auth.userId))[0]
      })
    },
    {
      params: t.Object({ matchId: t.String({ minLength: 1 }) }),
      body: t.Object({
        body: t.String({ minLength: 1, maxLength: 4000 }),
        reply_to_id: t.Optional(t.String()),
      }),
    },
  )

  .get(
    '/matches/:matchId/messages',
    async ({ auth, params, query, set }) => {
      const limit = Math.min(Number(query.limit) || PAGE_DEFAULT, PAGE_MAX)
      return withUser(auth.userId, async (tx) => {
        if (!(await activeMatch(tx, params.matchId, auth.userId))) {
          set.status = 404
          return { error: 'Match not found.' }
        }
        const before = query.before ?? null
        const rows = await tx<Row[]>`
          SELECT id, sender_id, body_encrypted, reply_to_id, sent_at, edited_at, deleted_at, read_at, attachment_media_id
          FROM app.messages
          WHERE match_id = ${params.matchId}
            AND (${before}::timestamptz IS NULL OR sent_at < ${before}::timestamptz)
          ORDER BY sent_at DESC
          LIMIT ${limit}
        `
        const messages = await serialize(tx, rows.reverse(), auth.userId)
        return { messages, count: messages.length }
      })
    },
    {
      params: t.Object({ matchId: t.String({ minLength: 1 }) }),
      query: t.Object({ before: t.Optional(t.String()), limit: t.Optional(t.String()) }),
    },
  )

  .post(
    '/matches/:matchId/read',
    async ({ auth, params }) => {
      return withUser(auth.userId, async (tx) => {
        const res = await tx`
          UPDATE app.messages SET read_at = NOW()
          WHERE match_id = ${params.matchId} AND sender_id != ${auth.userId} AND read_at IS NULL
        `
        return { ok: true, marked: res.count }
      })
    },
    { params: t.Object({ matchId: t.String({ minLength: 1 }) }) },
  )

  .patch(
    '/messages/:id',
    async ({ auth, params, body, set }) => {
      return withUser(auth.userId, async (tx) => {
        const enc = Buffer.from(await encrypt(body.body), 'utf8')
        const [row] = await tx<Row[]>`
          UPDATE app.messages
          SET body_encrypted = ${enc}, edited_at = NOW()
          WHERE id = ${params.id} AND sender_id = ${auth.userId} AND deleted_at IS NULL
          RETURNING id, sender_id, body_encrypted, reply_to_id, sent_at, edited_at, deleted_at, read_at, attachment_media_id
        `
        if (!row) {
          set.status = 404
          return { error: 'Message not found.' }
        }
        return (await serialize(tx, [row], auth.userId))[0]
      })
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      body: t.Object({ body: t.String({ minLength: 1, maxLength: 4000 }) }),
    },
  )

  .delete(
    '/messages/:id',
    async ({ auth, params, set }) => {
      return withUser(auth.userId, async (tx) => {
        const [row] = await tx<{ id: string }[]>`
          UPDATE app.messages SET deleted_at = NOW(), body_encrypted = ${Buffer.from('')}
          WHERE id = ${params.id} AND sender_id = ${auth.userId} AND deleted_at IS NULL
          RETURNING id
        `
        if (!row) {
          set.status = 404
          return { error: 'Message not found.' }
        }
        return { ok: true }
      })
    },
    { params: t.Object({ id: t.String({ minLength: 1 }) }) },
  )

  .post(
    '/messages/:id/reactions',
    async ({ auth, params, body, set }) => {
      return withUser(auth.userId, async (tx) => {
        // RLS message_reactions_read requires the message be in my match; verify
        // the message is visible (and not deleted) before reacting.
        const [msg] = await tx<{ id: string }[]>`
          SELECT id FROM app.messages WHERE id = ${params.id} AND deleted_at IS NULL LIMIT 1
        `
        if (!msg) {
          set.status = 404
          return { error: 'Message not found.' }
        }
        await tx`
          INSERT INTO app.message_reactions (message_id, user_id, emoji)
          VALUES (${params.id}, ${auth.userId}, ${body.emoji})
          ON CONFLICT (message_id, user_id, emoji) DO NOTHING
        `
        set.status = 201
        return { ok: true }
      })
    },
    {
      params: t.Object({ id: t.String({ minLength: 1 }) }),
      body: t.Object({ emoji: t.String({ minLength: 1, maxLength: 16 }) }),
    },
  )

  .delete(
    '/messages/:id/reactions/:emoji',
    async ({ auth, params }) => {
      return withUser(auth.userId, async (tx) => {
        await tx`
          DELETE FROM app.message_reactions
          WHERE message_id = ${params.id} AND user_id = ${auth.userId} AND emoji = ${params.emoji}
        `
        return { ok: true }
      })
    },
    { params: t.Object({ id: t.String({ minLength: 1 }), emoji: t.String({ minLength: 1 }) }) },
  )
