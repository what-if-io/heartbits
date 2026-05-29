// ---------------------------------------------------------------------------
// Redis connection via ioredis
// ---------------------------------------------------------------------------
import Redis from 'ioredis'

if (!process.env['REDIS_URL']) {
  throw new Error('REDIS_URL is required')
}

export const redis = new Redis(process.env['REDIS_URL'], {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
})

redis.on('error', (err) => {
  // Log but don't crash — rate-limit calls will fail gracefully
  console.error('[redis] connection error:', err.message)
})

redis.on('connect', () => {
  console.log('[redis] connected')
})

// ---------------------------------------------------------------------------
// Redis sliding-window rate limiter
// ---------------------------------------------------------------------------

/**
 * Sliding-window rate limiter using a sorted set per key.
 *
 * @param key    Redis key (e.g. `rl:discover:{userId}`)
 * @param limit  Max requests allowed in the window
 * @param windowMs  Window size in milliseconds
 * @returns `{ allowed: boolean, remaining: number, resetAt: number }`
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const windowStart = now - windowMs

  // Lua script for atomicity — expire old entries, count, add new entry
  const script = `
    local key = KEYS[1]
    local now = tonumber(ARGV[1])
    local window_start = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local window_ms = tonumber(ARGV[4])

    -- Remove entries outside the window
    redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

    -- Count remaining
    local count = redis.call('ZCARD', key)

    if count < limit then
      -- Add current request
      redis.call('ZADD', key, now, now .. '-' .. math.random(1e9))
      -- Set expiry to window size (auto-cleanup)
      redis.call('PEXPIRE', key, window_ms)
      return {1, limit - count - 1}
    else
      return {0, 0}
    end
  `

  const result = (await redis.eval(
    script,
    1,
    key,
    String(now),
    String(windowStart),
    String(limit),
    String(windowMs),
  )) as [number, number]

  const allowed = result[0] === 1
  const remaining = result[1] ?? 0
  const resetAt = now + windowMs

  return { allowed, remaining, resetAt }
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  await redis.quit()
}
