// ---------------------------------------------------------------------------
// GET /health — liveness + readiness check
// ---------------------------------------------------------------------------
import { Elysia } from 'elysia'
import { sql } from '../db'
import { redis } from '../redis'

export const healthRoute = new Elysia()
  .get('/health', async ({ set }) => {
    const checks: Record<string, 'ok' | 'error'> = {
      db: 'ok',
      redis: 'ok',
    }

    // Check DB
    try {
      await sql`SELECT 1`
    } catch {
      checks['db'] = 'error'
    }

    // Check Redis
    try {
      await redis.ping()
    } catch {
      checks['redis'] = 'error'
    }

    const healthy = Object.values(checks).every((v) => v === 'ok')

    if (!healthy) {
      set.status = 503
    }

    return {
      status: healthy ? 'ok' : 'degraded',
      checks,
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    }
  })
