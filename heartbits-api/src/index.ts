// ---------------------------------------------------------------------------
// HeartBits API — entry point
//
// Bun + Elysia, port from PORT env var (default 3100)
// ---------------------------------------------------------------------------
import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'

import { healthRoute } from './routes/health'
import { meRoutes } from './routes/me'
import { mediaRoute } from './routes/media'
import { profilesRoute } from './routes/profiles'
import { discoverRoute } from './routes/discover'
import { swipesRoute } from './routes/swipes'
import { matchesRoute } from './routes/matches'
import { bondsRoute } from './routes/bonds'
import { billingRoute } from './routes/billing'
import { waitlistRoute } from './routes/waitlist'
import { safetyRoute } from './routes/safety'
import { messagesRoute } from './routes/messages'
import { ensureBucket } from './minio'

// Validate required env vars at startup (fail fast)
const REQUIRED_ENV = [
  'DATABASE_URL',
  'REDIS_URL',
  'ZITADEL_JWKS_URL',
  // ZITADEL_ISSUER and ZITADEL_CLIENT_ID are required for JWT iss/aud validation
  // to prevent token confusion attacks (HIGH severity if omitted).
  'ZITADEL_ISSUER',
  'ZITADEL_CLIENT_ID',
  'HB_FIELD_ENCRYPTION_KEY',
] as const

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const PORT = Number(process.env['PORT'] ?? 3100)

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Elysia()
  // ── OpenAPI / Swagger UI (disabled in production — don't expose the API map) ─
  .use(
    process.env['NODE_ENV'] === 'production'
      ? (a: Elysia) => a
      : swagger({
      documentation: {
        info: {
          title: 'HeartBits API',
          version: '0.1.0',
          description:
            'REST API for HeartBits — real-time biometric heartbeat dating. ' +
            'Auth: Zitadel OIDC. Pass `Authorization: Bearer <access_token>`.',
          contact: {
            name: 'HeartBits',
            url: `https://${process.env['API_DOMAIN'] ?? 'api.heartbits.example.com'}`,
          },
        },
        servers: [
          { url: `https://${process.env['API_DOMAIN'] ?? 'api.heartbits.example.com'}`, description: 'Production' },
          { url: `http://localhost:${PORT}`, description: 'Local development' },
        ],
        tags: [
          { name: 'health', description: 'Service health' },
          { name: 'me', description: 'Current user profile' },
          { name: 'profiles', description: 'Public profile views' },
          { name: 'discover', description: 'Candidate discovery' },
          { name: 'swipes', description: 'Swipe actions' },
          { name: 'matches', description: 'Mutual matches' },
          { name: 'bonds', description: 'Relay room bonds' },
          { name: 'billing', description: 'Subscription & payments (stubs)' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'Zitadel-signed access token',
            },
          },
        },
      },
      path: '/swagger',
    }),
  )

  // ── Global error handler ──────────────────────────────────────────────────
  .onError(({ error, set, code }) => {
    // Elysia error codes
    if (code === 'VALIDATION') {
      set.status = 400
      return {
        error: 'Validation error',
        details: error.message,
      }
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'Not found' }
    }

    // Auth errors thrown by authPlugin have set.status = 401 already
    if (set.status === 401) {
      return { error: (error instanceof Error ? error.message : null) ?? 'Unauthorized' }
    }

    if (set.status === 429) {
      return { error: (error instanceof Error ? error.message : null) ?? 'Rate limit exceeded' }
    }

    // Unexpected errors
    const isDev = process.env['NODE_ENV'] !== 'production'
    console.error('[error]', error)

    set.status = 500
    return {
      error: 'Internal server error',
      ...(isDev && { details: error instanceof Error ? error.message : String(error) }),
    }
  })

  // ── Routes ────────────────────────────────────────────────────────────────
  .use(healthRoute)
  .use(waitlistRoute)   // public — must be before authPlugin-using routes
  .use(meRoutes)
  .use(mediaRoute)
  .use(profilesRoute)
  .use(discoverRoute)
  .use(swipesRoute)
  .use(matchesRoute)
  .use(bondsRoute)
  .use(safetyRoute)
  .use(messagesRoute)
  .use(billingRoute)

  // ── Start ─────────────────────────────────────────────────────────────────
  .listen(PORT)

// Create bucket + set public-read policy (idempotent, non-fatal)
ensureBucket().catch(console.error)

console.log(
  `[heartbits-api] running at http://${app.server?.hostname}:${app.server?.port}`,
)
console.log(`[heartbits-api] swagger UI at http://localhost:${PORT}/swagger`)

export type App = typeof app
