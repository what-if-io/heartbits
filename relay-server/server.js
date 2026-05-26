// HeartBits WebSocket relay server
//
// Simple room-based fanout: every message sent by one client in a room
// is forwarded to all other clients in that room.
//
// Auth: every connection must present a Bearer token in the
//   Authorization: Bearer <ROOM_TOKEN>  HTTP upgrade header.
//   Set ROOM_TOKEN in the environment (or .env). If unset the server
//   starts in open mode (local dev only — never deploy without a token).
//
// Usage:
//   npm install
//   ROOM_TOKEN=<secret> npm start      # listens on ws://localhost:8765
//   PORT=9000 ROOM_TOKEN=<secret> npm start
//
// Room URL:  ws://localhost:8765/<roomId>
//   Alice connects to  ws://localhost:8765/alice-bob
//   Bob   connects to  ws://localhost:8765/alice-bob
//   Alice sends a beat → Bob receives it (and vice versa)

const { WebSocketServer } = require('ws')
const http = require('http')
const fs   = require('fs')
const path = require('path')

const PORT       = parseInt(process.env.PORT       ?? '8765', 10)
const ROOM_TOKEN = process.env.ROOM_TOKEN ?? null

if (!ROOM_TOKEN) {
  console.warn('[!] ROOM_TOKEN not set — running in open mode (local dev only)')
}

// Validate auth. Accepts either:
//   Authorization: Bearer <token>   (native clients)
//   ?token=<token> query param      (browser WebSocket — can't set headers)
function authorized(req) {
  if (!ROOM_TOKEN) return true
  const header = req.headers['authorization'] ?? ''
  const [scheme, headerToken] = header.split(' ')
  if (scheme === 'Bearer' && headerToken === ROOM_TOKEN) return true
  const qs = new URL(req.url, 'http://x').searchParams
  return qs.get('token') === ROOM_TOKEN
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
  verifyClient({ req }, cb) {
    if (authorized(req)) {
      cb(true)
    } else {
      console.warn(`[!] rejected unauthenticated connection from ${req.socket.remoteAddress}`)
      cb(false, 401, 'Unauthorized')
    }
  },
})

// roomId → Set<WebSocket>
const rooms = new Map()

// Ping every 20s so NAT/proxy idle timeouts don't kill sleeping Watch connections
const PING_INTERVAL_MS = 20_000

wss.on('connection', (ws, req) => {
  const roomId = new URL(req.url ?? '/', 'http://x').pathname.replace(/^\//, '') || 'default'

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
