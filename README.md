# HeartBits

> A dating app where the "like" is sending your heartbeat.

HeartBits is an open-source, self-hostable intimacy app built around real-time biometric sharing. When two people match, their live heart rates sync — you feel each other's pulse before you ever meet.

---

## How it works

1. **Discover** — browse profiles; each card shows the user's resting BPM captured by their wearable
2. **Like** — tap the heart; your phone sends your live BPM over the relay for a few seconds
3. **Match** — if they like back, a persistent bond is created
4. **Bond** — open the bond screen at any time to feel each other's live heartbeat in real time

---

## Architecture at a glance

```
Mobile (iOS / Android)
  └── Apple Watch / Wear OS → BPM → relay WebSocket

Web (SvelteKit)
  └── bond page → relay WebSocket → live BPM visualization + chat

relay-server (Node.js)   — WebSocket room fanout, JWT-authenticated
heartbits-api (Bun)      — profiles, matches, bonds, notifications
Zitadel                  — OIDC auth (PKCE, no client secret)
PostgreSQL               — app + billing schemas, field-encrypted PII
Redis                    — rate limiting, relay room membership, JWKS cache
MinIO                    — S3-compatible photo storage
Caddy                    — TLS termination, reverse proxy
```

Full details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

---

## Self-hosting

HeartBits is designed to run on a single VM with Docker Compose. All services — auth, relay, API, web, monitoring — start with one command.

**Requirements:** a Linux VM (Ubuntu / Debian / RHEL / Rocky), Docker, and three subdomains pointed at it.

```bash
git clone https://github.com/what-if-io/heartbits
cd heartbits/deploy
./do.sh
```

`do.sh` installs Docker if missing, prompts for your domains and email, generates all secrets, starts the stack, bootstraps Zitadel OIDC, and prints the live URLs.

See [`docs/deploy.md`](docs/deploy.md) for the full deployment guide.

---

## Project structure

| Directory | What it is |
|---|---|
| `heartbits-web/` | SvelteKit web app + PWA (Svelte 5, adapter-node, Bun) |
| `heartbits-api/` | REST API — profiles, matches, bonds, notifications (Bun + Elysia) |
| `relay-server/` | WebSocket relay for live BPM streams (Node.js) |
| `heartbits-monitor/` | Uptime monitor with SQLite history, feeds the `/status` page (Bun) |
| `deploy/` | Docker Compose stack, Caddyfile, bootstrap scripts |
| `docs/` | Architecture, auth flow, security model, deployment guide |
| `Heartbits/` | iOS app (SwiftUI) |
| `Heartbits Vision App/` | visionOS companion |
| `Heartbits Watch App/` | watchOS heart rate capture |
| `HeartbitsAndroid/` | Android app (Kotlin) |

> **Mobile apps are an early Phase‑0 prototype.** iOS / watchOS / visionOS / Android currently do live heartbeat relay only — they do **not** yet implement the auth, profiles, discovery, matching, or bonds flows described below. The **web app + API are the reference implementation**; migrating the mobile clients to the authenticated API is on the roadmap.

---

## Running locally

### Web app

```bash
cd heartbits-web
cp .env.example .env.local   # fill in PUBLIC_ZITADEL_ISSUER, PUBLIC_ZITADEL_CLIENT_ID
bun install
bun run dev
```

### API

```bash
cd heartbits-api
cp .env.example .env
# requires: postgres + redis running locally
bun install
bun run src/index.ts
```

### Relay

```bash
cd relay-server
npm install
ROOM_TOKEN=dev node server.js
```

### Monitor

```bash
cd heartbits-monitor
bun run monitor.ts
```

Demo mode is built into the web app — load it without credentials and you get a fully interactive walkthrough with no real data.

---

## Tech stack

| Layer | Choice |
|---|---|
| Web frontend | SvelteKit 2 + Svelte 5 runes |
| API | Bun + Elysia |
| Auth | Zitadel v4 (OIDC/PKCE) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Photo storage | MinIO (S3-compatible) |
| Relay | Node.js WebSocket server |
| Monitor | Bun + SQLite |
| Proxy | Caddy 2 (auto-TLS) |
| iOS / watchOS | SwiftUI |
| Android | Kotlin |

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Security

Biometric data (heart rate) flows directly between devices via the relay and is never stored by the API. Profile PII (name, bio, date of birth) is field-encrypted at the application layer before reaching the database.

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full threat model, encryption details, and vulnerability reporting.

---

## License

[AGPL-3.0](LICENSE) — you can self-host, study, and modify HeartBits freely. If you deploy a modified version publicly, you must open-source your changes under the same license.
