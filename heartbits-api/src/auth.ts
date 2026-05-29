// ---------------------------------------------------------------------------
// Zitadel JWT authentication — Elysia plugin
//
// Flow:
//   1. Read Authorization: Bearer <token>
//   2. Fetch JWKS from ZITADEL_JWKS_URL (cached in Redis for 3600s)
//   3. Verify JWT signature + expiry with jose jwtVerify
//   4. Extract `sub` claim → look up app.users row → get internal user_id
//   5. Attach { userId, zitadelSub } to Elysia context store
//   6. Return 401 on any failure
// ---------------------------------------------------------------------------

import { Elysia } from 'elysia'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { redis } from './redis'
import { sql } from './db'
import type { AuthUser } from './types'

const JWKS_CACHE_KEY = 'hb:jwks:raw'
const JWKS_TTL_SEC = 3600

// We hold the in-process JWKS function (parsed once per cache refresh)
let _jwksUrl: string | null = null
let _remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null
let _jwksFetchedAt = 0
const JWKS_REFRESH_INTERVAL_MS = JWKS_TTL_SEC * 1000

/**
 * Return (and cache) the remote JWKS set.
 *
 * jose's createRemoteJWKSet already handles in-process caching with automatic
 * refresh on key rotation.  We add a Redis layer so that multiple API replicas
 * share the cache and minimise round-trips to Zitadel.
 */
async function getJwks(): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const jwksUrl = process.env['ZITADEL_JWKS_URL']
  if (!jwksUrl) {
    throw new Error('ZITADEL_JWKS_URL is required')
  }

  const now = Date.now()

  // Rebuild in-process instance if URL changed or first call
  if (_remoteJwks === null || _jwksUrl !== jwksUrl) {
    _jwksUrl = jwksUrl

    // Try Redis cache first — extract the actual JWKS URI from the OIDC discovery doc
    const cached = await redis.get(JWKS_CACHE_KEY).catch(() => null)

    if (cached) {
      _remoteJwks = createRemoteJWKSet(new URL(cached))
      _jwksFetchedAt = now
    } else {
      // Fetch OIDC discovery document to get jwks_uri
      const discoveryRes = await fetch(jwksUrl)
      if (!discoveryRes.ok) {
        throw new Error(`Failed to fetch OIDC discovery document: ${discoveryRes.status}`)
      }
      const discovery = (await discoveryRes.json()) as { jwks_uri: string }
      if (!discovery.jwks_uri) {
        throw new Error('OIDC discovery document missing jwks_uri')
      }

      await redis
        .set(JWKS_CACHE_KEY, discovery.jwks_uri, 'EX', JWKS_TTL_SEC)
        .catch(() => {/* non-fatal */})

      _remoteJwks = createRemoteJWKSet(new URL(discovery.jwks_uri))
      _jwksFetchedAt = now
    }
  } else if (now - _jwksFetchedAt > JWKS_REFRESH_INTERVAL_MS) {
    // Refresh Redis cache in the background (non-blocking)
    _jwksFetchedAt = now
    fetch(jwksUrl)
      .then((r) => r.json() as Promise<{ jwks_uri: string }>)
      .then((d) => {
        if (d.jwks_uri) {
          _remoteJwks = createRemoteJWKSet(new URL(d.jwks_uri))
          return redis.set(JWKS_CACHE_KEY, d.jwks_uri, 'EX', JWKS_TTL_SEC)
        }
      })
      .catch((e) => console.error('[auth] JWKS refresh error:', e))
  }

  return _remoteJwks!
}

/**
 * Look up app.users row by Zitadel sub.
 * Returns null if not found or user is soft-deleted.
 */
async function findUserBySub(sub: string): Promise<{ id: string } | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM app.users
    WHERE zitadel_sub = ${sub}
      AND deleted_at IS NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// Elysia plugin — adds `store.auth` to context on authenticated routes
// ---------------------------------------------------------------------------

/**
 * authPlugin — derive `store.auth: AuthUser` on every request.
 *
 * Usage:
 *   app
 *     .use(authPlugin)
 *     .get('/protected', ({ store }) => { ... store.auth.userId ... })
 */
export const authPlugin = new Elysia({ name: 'auth' })
  .derive({ as: 'global' }, async ({ request, set }): Promise<{ auth: AuthUser }> => {
    const header = request.headers.get('authorization')
    if (!header || !header.startsWith('Bearer ')) {
      set.status = 401
      throw new Error('Missing or malformed Authorization header')
    }

    const token = header.slice(7).trim()
    if (!token) {
      set.status = 401
      throw new Error('Empty bearer token')
    }

    let payload: JWTPayload
    try {
      const jwks = await getJwks()
      // SECURITY: verify issuer and audience to prevent token confusion attacks.
      // ZITADEL_ISSUER  = e.g. "https://auth.heartbits.what-if.io"
      // ZITADEL_CLIENT_ID = the OIDC client_id registered in Zitadel for this app.
      // Both are required env vars (validated at startup in index.ts).
      const issuer = process.env['ZITADEL_ISSUER']
      const audience = process.env['ZITADEL_CLIENT_ID']
      const { payload: p } = await jwtVerify(token, jwks, {
        issuer: issuer ?? undefined,
        audience: audience ?? undefined,
      })
      payload = p
    } catch (err) {
      set.status = 401
      throw new Error(
        `JWT verification failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const sub = payload.sub
    if (!sub) {
      set.status = 401
      throw new Error('JWT missing sub claim')
    }

    const user = await findUserBySub(sub)
    if (!user) {
      // User not yet initialised — they must call POST /api/v1/me/init first
      set.status = 401
      throw new Error('User not found — call POST /api/v1/me/init first')
    }

    return { auth: { userId: user.id, zitadelSub: sub } }
  })
