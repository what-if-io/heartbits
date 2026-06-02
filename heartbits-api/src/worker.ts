// ---------------------------------------------------------------------------
// HeartBits background worker
//
// Same codebase as the API, different entrypoint.
// Handles: relay room cleanup, media deletion, GDPR hard-delete,
//          notification dispatch (stub — push_tokens table not yet added).
//
// Run with: bun run worker
// ---------------------------------------------------------------------------
import { redis } from './redis'
import { sql, withUser } from './db'
import postgres from 'postgres'
import { minio } from './minio'
import { sendMail } from './mailer'
import { emails, type EmailName } from './emails'

console.log('[worker] HeartBits background worker starting…')

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'HB_FIELD_ENCRYPTION_KEY'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] Missing required env var: ${key}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Worker DB connection
//
// Cross-user queries (cleanupStaleRelayRooms, gdprHardDelete) need a DB role
// with BYPASSRLS.  Set WORKER_DATABASE_URL to a connection string for a role
// that has that attribute:
//
//   CREATE ROLE heartbits_worker LOGIN PASSWORD '...' BYPASSRLS;
//   GRANT SELECT ON app.bonds, app.matches TO heartbits_worker;
//   GRANT DELETE ON app.users TO heartbits_worker;
//
// If WORKER_DATABASE_URL is not set, falls back to DATABASE_URL — queries will
// silently return no rows because heartbits_api is bound by RLS.
// ---------------------------------------------------------------------------

const workerSql = postgres(
  process.env['WORKER_DATABASE_URL'] ?? process.env['DATABASE_URL']!,
  { max: 3, idle_timeout: 30, connect_timeout: 10, transform: { undefined: null } },
)

// minio client imported from ./minio (shared with API routes)

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[worker] ${signal} received — shutting down gracefully`)
  await redis.quit().catch(() => {/* ignore */})
  await sql.end().catch(() => {/* ignore */})
  await workerSql.end().catch(() => {/* ignore */})
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ---------------------------------------------------------------------------
// Task: clean up stale relay room keys
//
// relay:room:{room_id} keys are written by the API when a bond is created and
// carry a 30-day TTL, so most expire automatically.  This job explicitly deletes
// keys for bonds whose match was unmatched (e.g. consent withdrawn) so the relay
// denies reconnections immediately instead of waiting for the TTL.
//
// Requires BYPASSRLS on the worker DB role (see WORKER_DATABASE_URL note above).
// ---------------------------------------------------------------------------

async function cleanupStaleRelayRooms(): Promise<void> {
  const rows = await workerSql<{ room_id: string }[]>`
    SELECT b.room_id
    FROM   app.bonds   b
    JOIN   app.matches m ON m.id = b.match_id
    WHERE  m.unmatched_at IS NOT NULL
  `
  if (rows.length === 0) return

  const keys = rows.map((r) => `relay:room:${r.room_id}`)
  // redis.del accepts a spread of keys; filter out any empty strings for safety
  const deleted = await redis.del(...keys.filter(Boolean))
  if (deleted > 0) {
    console.log(`[worker] cleanupStaleRelayRooms — deleted ${deleted} stale key(s)`)
  }
}

// ---------------------------------------------------------------------------
// Task: delete MinIO objects queued by DELETE /me
//
// Queue key: hb:worker:media_delete
// Queue payload: userId (string)
//
// Flow:
//   1. BRPOP userId from queue (blocks up to 5s)
//   2. Fetch media rows for that user (using their RLS context)
//   3. Delete each object from MinIO
//   4. Remove media rows from DB
//   5. Re-queue userId on partial failure so objects are retried next run
//
// Note: if the user is hard-deleted (30-day GDPR sweep) before this runs,
// media rows are gone via CASCADE — but MinIO objects may be orphaned.
// Ensure this job processes the queue well within the 30-day window.
// ---------------------------------------------------------------------------

async function processMediaDeletion(): Promise<void> {
  // BRPOP returns null after the timeout when the queue is empty
  const result = await redis.brpop('hb:worker:media_delete', 5)
  if (!result) return

  const [, userId] = result

  type MediaRow = { id: string; bucket: string; object_key: string }
  const mediaRows = await withUser(userId, (tx) =>
    tx<MediaRow[]>`SELECT id, bucket, object_key FROM app.media WHERE user_id = ${userId}`,
  )

  if (mediaRows.length === 0) return

  if (!minio) {
    console.warn(`[worker] media_delete: MinIO not configured — removing DB rows only for user ${userId}`)
    await withUser(userId, (tx) => tx`DELETE FROM app.media WHERE user_id = ${userId}`)
    return
  }

  const succeeded: string[] = []

  for (const row of mediaRows) {
    try {
      await minio.removeObject(row.bucket, row.object_key)
      succeeded.push(row.id)
    } catch (e: unknown) {
      const code = (e as { code?: string }).code
      if (code === 'NoSuchKey' || code === 'NotFound') {
        // Already gone — clean up the DB row
        succeeded.push(row.id)
      } else {
        console.error(
          `[worker] media_delete: failed to remove ${row.bucket}/${row.object_key}:`,
          e instanceof Error ? e.message : e,
        )
      }
    }
  }

  if (succeeded.length > 0) {
    await withUser(userId, (tx) => tx`DELETE FROM app.media WHERE id = ANY(${succeeded})`)
    console.log(`[worker] media_delete: removed ${succeeded.length}/${mediaRows.length} object(s) for user ${userId}`)
  }

  // Re-queue if any objects failed so they are retried next run
  if (succeeded.length < mediaRows.length) {
    await redis.rpush('hb:worker:media_delete', userId)
  }
}

// ---------------------------------------------------------------------------
// Task: GDPR hard-delete (Art. 17)
//
// Permanently removes user rows soft-deleted more than 30 days ago.
// ON DELETE CASCADE propagates to profiles, media, swipes, matches,
// bonds, messages, consents, and billing.customers.
//
// Requires BYPASSRLS on the worker DB role (see WORKER_DATABASE_URL note above).
// ---------------------------------------------------------------------------

async function gdprHardDelete(): Promise<void> {
  const deleted = await workerSql<{ id: string }[]>`
    DELETE FROM app.users
    WHERE  deleted_at < NOW() - INTERVAL '30 days'
    RETURNING id
  `
  if (deleted.length > 0) {
    console.log(`[worker] gdprHardDelete — permanently erased ${deleted.length} user(s)`)
  }
}

// ---------------------------------------------------------------------------
// Task: email notification dispatch
//
// Drains hb:worker:notifications and sends a branded transactional email.
// Payload: JSON { to: string, type: EmailName, data: object }
//   e.g. { "to": "a@b.com", "type": "newMatch", "data": { "matchName": "Sam" } }
//
// `type` selects a template from src/emails; `data` is passed straight to it.
// (Push notifications via APNs/FCM remain a future addition — they need a
// push_tokens table; this path is email only.)
// ---------------------------------------------------------------------------

async function processNotifications(): Promise<void> {
  const popped = await redis.brpop('hb:worker:notifications', 5)
  if (!popped) return
  const [, raw] = popped

  let job: { to?: string; type?: string; data?: Record<string, unknown> }
  try {
    job = JSON.parse(raw)
  } catch {
    console.error('[worker] notifications: invalid JSON payload')
    return
  }

  if (!job.to || !job.type) {
    console.error('[worker] notifications: payload missing "to" or "type"')
    return
  }

  const template = emails[job.type as EmailName] as
    | ((d: Record<string, unknown>) => { subject: string; html: string; text: string })
    | undefined
  if (typeof template !== 'function') {
    console.error(`[worker] notifications: unknown email type "${job.type}"`)
    return
  }

  const { subject, html, text } = template(job.data ?? {})
  try {
    await sendMail({ to: job.to, subject, html, text })
    console.log(`[worker] email sent: ${job.type} → ${job.to}`)
  } catch (e) {
    console.error(`[worker] email failed (${job.type} → ${job.to}):`, e instanceof Error ? e.message : e)
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function run() {
  console.log('[worker] ready')

  // Continuous media-deletion loop — blocks on BRPOP so it's efficient at idle
  const mediaDeletionLoop = async () => {
    while (!shuttingDown) {
      await processMediaDeletion().catch((e) =>
        console.error('[worker] media_delete error:', e instanceof Error ? e.message : e),
      )
    }
  }

  // Scheduled jobs — run immediately on startup then every 5 minutes
  const runScheduled = () => {
    if (shuttingDown) return
    cleanupStaleRelayRooms().catch(console.error)
    gdprHardDelete().catch(console.error)
  }

  runScheduled()
  setInterval(runScheduled, 5 * 60 * 1000)

  // Redis keepalive
  setInterval(() => {
    if (!shuttingDown) redis.ping().catch((e) => console.error('[worker] redis ping failed:', e))
  }, 30_000)

  // Continuous email-notification loop — blocks on BRPOP, efficient at idle
  const notificationsLoop = async () => {
    while (!shuttingDown) {
      await processNotifications().catch((e) =>
        console.error('[worker] notifications error:', e instanceof Error ? e.message : e),
      )
    }
  }

  mediaDeletionLoop()
  notificationsLoop()
}

run().catch((e) => {
  console.error('[worker] fatal error:', e)
  process.exit(1)
})
