// ---------------------------------------------------------------------------
// HeartBits background worker
//
// Same codebase as the API, different entrypoint.
// Handles: matching queue processing, notification dispatch, media cleanup.
//
// Run with: bun run worker
// ---------------------------------------------------------------------------
import { redis } from './redis'
import { sql } from './db'

console.log('[worker] HeartBits background worker starting…')

// Validate required env vars
const REQUIRED_ENV = ['DATABASE_URL', 'REDIS_URL', 'HB_FIELD_ENCRYPTION_KEY'] as const
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[worker] Missing required env var: ${key}`)
    process.exit(1)
  }
}

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
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ---------------------------------------------------------------------------
// Placeholder tasks — implement as needed
// ---------------------------------------------------------------------------

/**
 * Expire old relay room Redis keys for unmatched pairs.
 * Runs every 5 minutes.
 */
async function cleanupStaleRelayRooms() {
  // Stub: find bonds for matches where unmatched_at IS NOT NULL
  // and delete the relay:room:{room_id} key from Redis
  console.log('[worker] cleanupStaleRelayRooms — not yet implemented')
}

/**
 * Process push notification queue.
 * Runs whenever items appear in the queue.
 */
async function processNotifications() {
  console.log('[worker] processNotifications — not yet implemented')
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function run() {
  console.log('[worker] ready')

  // Simple interval-based scheduling — replace with BullMQ or similar as needed
  setInterval(() => {
    if (!shuttingDown) cleanupStaleRelayRooms().catch(console.error)
  }, 5 * 60 * 1000)

  // Keep the process alive
  setInterval(() => {
    if (!shuttingDown) {
      redis.ping().catch((e) => console.error('[worker] redis ping failed:', e))
    }
  }, 30_000)
}

run().catch((e) => {
  console.error('[worker] fatal error:', e)
  process.exit(1)
})
