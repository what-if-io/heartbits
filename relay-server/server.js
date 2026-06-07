// HeartBits WebSocket relay server
//
// Simple room-based fanout: every message sent by one client in a room
// is forwarded to all other clients in that room.
//
// ---------------------------------------------------------------------------
// Auth — Phase 0 / Phase 1 hybrid
// ---------------------------------------------------------------------------
//
// Phase 0 (current): static ROOM_TOKEN checked on every connection.
//   ROOM_TOKEN must be injected from environment / CI secrets — NEVER hardcoded.
//   Set ROOM_TOKEN in the environment. If unset: open mode (local dev ONLY).
//
// Phase 1 (JWT + room membership): enabled when REDIS_URL is set.
//   Connection presents a Zitadel JWT access token.
//   Relay verifies:
//     1. JWT signature via JWKS (fetched from ZITADEL_JWKS_URL, cached in memory).
//     2. Redis key relay:room:{roomId} → "{user_a}:{user_b}" written by the API.
//     3. JWT `sub` must match one of user_a or user_b (prevents room squatting).
//   If the Redis key is missing (e.g. consent was withdrawn), connection is rejected.
//
// Phase 2 (target): ROOM_TOKEN deprecated, JWT only.
//
// SECURITY RISK (Phase 0): A static token in all clients means any client can
//   connect to ANY room — room isolation is not enforced at the relay level.
//   A compromised or leaked token allows an adversary to listen to any room.
//   Phase 1 JWT+Redis membership validation closes this gap entirely.
//
// ---------------------------------------------------------------------------
// Usage:
//   npm install
//   ROOM_TOKEN=<secret> npm start                          # Phase 0
//   REDIS_URL=redis://... ZITADEL_JWKS_URL=https://... npm start  # Phase 1
//   PORT=9000 ROOM_TOKEN=<secret> npm start
//
// Room URL:  ws://localhost:8765/<roomId>
//   Alice connects to  ws://localhost:8765/alice-bob
//   Bob   connects to  ws://localhost:8765/alice-bob
//   Alice sends a beat → Bob receives it (and vice versa)

const { WebSocketServer } = require('ws')
const http  = require('http')
const fs    = require('fs')
const path  = require('path')

const PORT       = parseInt(process.env.PORT       ?? '8765', 10)
const ROOM_TOKEN = process.env.ROOM_TOKEN ?? null
const REDIS_URL  = process.env.REDIS_URL  ?? null
// Open mode (no auth at all) must be opted into explicitly — it never engages by
// accident from a misconfigured prod env. Local dev only.
const DEV_OPEN   = process.env.RELAY_DEV_OPEN === 'true'

// Phase 1: lazy-loaded Redis + JWKS clients
let redisClient   = null
let jwksCache     = null  // { keySets: Map<kid, CryptoKey>, fetchedAt: number }
const JWKS_TTL_MS = 3600 * 1000

if (!ROOM_TOKEN && !REDIS_URL && !DEV_OPEN) {
  console.error('[FATAL] No auth configured. Set REDIS_URL (Phase 1 JWT+membership) or')
  console.error('        ROOM_TOKEN (Phase 0), or RELAY_DEV_OPEN=true for local dev only.')
  process.exit(1)
}
if (DEV_OPEN && !ROOM_TOKEN && !REDIS_URL) {
  console.warn('[!] RELAY_DEV_OPEN=true — accepting UNAUTHENTICATED connections (local dev only)')
}

// ---------------------------------------------------------------------------
// Phase 1 helpers: Redis room membership + JWT validation
// ---------------------------------------------------------------------------

/**
 * Initialise ioredis client lazily (Phase 1 only).
 * Returns null if REDIS_URL is not set.
 */
function getRedis() {
  if (!REDIS_URL) return null
  if (redisClient) return redisClient
  try {
    const Redis = require('ioredis')
    redisClient = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 })
    redisClient.on('error', (e) => console.error('[redis]', e.message))
    return redisClient
  } catch (e) {
    console.error('[relay] ioredis not installed — Phase 1 disabled:', e.message)
    return null
  }
}

/**
 * Fetch JWKS from Zitadel discovery and verify a JWT.
 * Returns the decoded payload or throws on failure.
 *
 * We use jose (must be installed: npm i jose) for RS256 verification.
 * SECURITY: issuer and audience are enforced (mirrors heartbits-api/src/auth.ts)
 * to prevent token-confusion — a token minted for a different OIDC app must not
 * grant relay access. ZITADEL_ISSUER + ZITADEL_CLIENT_ID are required in Phase 1.
 */
async function verifyJwt(token) {
  const jwksUrl = process.env['ZITADEL_JWKS_URL']
  if (!jwksUrl) throw new Error('ZITADEL_JWKS_URL not set')
  const issuer   = process.env['ZITADEL_ISSUER']
  const audience = process.env['ZITADEL_CLIENT_ID']
  if (!issuer || !audience) {
    // Fail closed: never verify a token without iss/aud constraints in production.
    throw new Error('ZITADEL_ISSUER and ZITADEL_CLIENT_ID must be set to verify JWTs')
  }

  // Lazy-load jose
  let jose
  try {
    jose = require('jose')
  } catch (e) {
    throw new Error('jose not installed — run: npm i jose')
  }

  const now = Date.now()
  if (!jwksCache || now - jwksCache.fetchedAt > JWKS_TTL_MS) {
    // Fetch OIDC discovery → jwks_uri
    const discovery = await fetch(jwksUrl).then((r) => {
      if (!r.ok) throw new Error(`JWKS discovery failed: ${r.status}`)
      return r.json()
    })
    jwksCache = {
      jwks: jose.createRemoteJWKSet(new URL(discovery.jwks_uri)),
      fetchedAt: now,
    }
  }

  const { payload } = await jose.jwtVerify(token, jwksCache.jwks, { issuer, audience })
  return payload
}

// ---------------------------------------------------------------------------
// authorizeConnection: returns { ok, userId, roomId } or { ok: false, reason }
// ---------------------------------------------------------------------------

async function authorizeConnection(req) {
  const url    = new URL(req.url ?? '/', 'http://x')
  const roomId = url.pathname.replace(/^\//, '') || null
  const qs     = url.searchParams

  // ── Phase 1: JWT + Redis room membership ──────────────────────────────
  const redis = getRedis()
  if (redis) {
    // Extract token from Authorization header or ?token= query param
    const authHeader = req.headers['authorization'] ?? ''
    const [scheme, headerToken] = authHeader.split(' ')
    const token = (scheme === 'Bearer' && headerToken) ? headerToken : qs.get('token')

    if (!token) {
      return { ok: false, reason: 'Missing token' }
    }

    let payload
    try {
      payload = await verifyJwt(token)
    } catch (e) {
      return { ok: false, reason: `JWT invalid: ${e.message}` }
    }

    const userId = payload.sub
    if (!userId) return { ok: false, reason: 'JWT missing sub claim' }

    if (!roomId) return { ok: false, reason: 'Missing roomId in URL path' }

    // Check Redis: relay:room:{roomId} → "{user_a}:{user_b}"
    let roomVal
    try {
      roomVal = await redis.get(`relay:room:${roomId}`)
    } catch (e) {
      return { ok: false, reason: 'Redis unavailable' }
    }

    if (!roomVal) {
      // Key missing: room doesn't exist, OR consent was withdrawn (key was deleted)
      return { ok: false, reason: 'Room not found or biometric consent withdrawn' }
    }

    const [userA, userB] = roomVal.split(':')
    if (userId !== userA && userId !== userB) {
      return { ok: false, reason: 'User not authorised for this room' }
    }

    return { ok: true, userId, roomId }
  }

  // ── Phase 0 fallback: static ROOM_TOKEN ───────────────────────────────
  if (!ROOM_TOKEN) {
    if (DEV_OPEN) {
      // Open mode — only reachable when explicitly opted in (local dev).
      console.warn('[!] open mode: accepting unauthenticated connection')
      return { ok: true, userId: null, roomId: roomId ?? 'default' }
    }
    return { ok: false, reason: 'Relay not configured for authentication' }
  }

  const authHeader = req.headers['authorization'] ?? ''
  const [scheme, headerToken] = authHeader.split(' ')
  if (scheme === 'Bearer' && headerToken === ROOM_TOKEN) {
    return { ok: true, userId: null, roomId: roomId ?? 'default' }
  }
  if (qs.get('token') === ROOM_TOKEN) {
    return { ok: true, userId: null, roomId: roomId ?? 'default' }
  }

  return { ok: false, reason: 'Invalid token' }
}

// HTTP server: /ping health check, /test page, 404 everywhere else
const httpServer = http.createServer((req, res) => {
  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }))
  } else if (req.url === '/test' || req.url === '/test.html') {
    const file = path.join(__dirname, 'test.html')
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    fs.createReadStream(file).pipe(res)
  } else {
    res.writeHead(404)
    res.end()
  }
})

const wss = new WebSocketServer({
  server: httpServer,
  // verifyClient runs synchronously — async auth happens after upgrade via
  // a per-connection authResult attached to the request object.
  verifyClient({ req }, cb) {
    authorizeConnection(req)
      .then((result) => {
        if (result.ok) {
          // Attach result so the 'connection' handler can read it without re-checking
          req._authResult = result
          cb(true)
        } else {
          console.warn(`[!] rejected connection from ${req.socket.remoteAddress}: ${result.reason}`)
          cb(false, 401, 'Unauthorized')
        }
      })
      .catch((e) => {
        console.error('[!] verifyClient error:', e.message)
        cb(false, 500, 'Internal error')
      })
  },
})

// roomId → Set<WebSocket>
const rooms = new Map()

// Ping every 20s so NAT/proxy idle timeouts don't kill sleeping Watch connections
const PING_INTERVAL_MS = 20_000

wss.on('connection', (ws, req) => {
  // Auth result was attached by verifyClient — use it directly
  const authResult = req._authResult ?? {}
  const rawPath = new URL(req.url ?? '/', 'http://x').pathname.replace(/^\//, '')
  const roomId = (authResult.roomId ?? rawPath) || 'default'

  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  const room = rooms.get(roomId)
  room.add(ws)

  console.log(`[+] ${roomId}  (${room.size} in room)`)

  // Keepalive: server-initiated ping so the OS doesn't kill idle sockets
  const pingTimer = setInterval(() => {
    if (ws.readyState === 1 /* OPEN */) ws.ping()
  }, PING_INTERVAL_MS)

  ws.on('message', (data, isBinary) => {
    let forwarded = 0
    for (const peer of room) {
      if (peer !== ws && peer.readyState === 1 /* OPEN */) {
        peer.send(data, { binary: isBinary })
        forwarded++
      }
    }
    // Uncomment to log beat traffic:
    // console.log(`[→] ${roomId}  forwarded to ${forwarded} peer(s)`)
  })

  ws.on('close', (code, reason) => {
    clearInterval(pingTimer)
    room.delete(ws)
    if (room.size === 0) rooms.delete(roomId)
    console.log(`[-] ${roomId}  (${room.size} remaining)  code=${code} reason=${reason || '-'}`)
  })

  ws.on('error', (err) => {
    clearInterval(pingTimer)
    console.error(`[!] ${roomId}  ${err.message}`)
    room.delete(ws)
  })
})

httpServer.listen(PORT, () => {
  console.log(`HeartBits relay  ws://localhost:${PORT}`)
  console.log(`Test page        http://localhost:${PORT}/test`)
  console.log(`Auth: ${ROOM_TOKEN ? 'Bearer token required' : 'OPEN (no token)'}`)
})
