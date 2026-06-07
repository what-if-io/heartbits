# Contributing to HeartBits

Thanks for your interest. This document covers how to get your environment running, how the project is structured, and what we look for in pull requests.

---

## Before you start

- Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — especially the service map and relay security phases. Changes that touch the relay or auth flow have wide blast radius.
- Open an issue first for anything non-trivial. A short description of what you want to change and why saves everyone time.
- Security issues: **do not open a public issue.** See [`docs/SECURITY.md`](docs/SECURITY.md) for the private reporting process.

---

## Local development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- Node.js 22 (relay-server only)
- Docker + Compose (for postgres + redis + zitadel)
- Xcode 16+ (iOS / watchOS, macOS only)
- Android Studio (Android)

From the repo root, `make help` lists convenience targets — e.g. `make install`
(all deps), `make dev-web` / `make dev-api` / `make dev-relay`, `make check`
(API type-check + web build), `make up` / `make down` (Docker stack), and
`make backup`.

### Full stack (Docker)

```bash
cd deploy
./do.sh   # prompts for domains, starts everything
```

Use `localhost` variants and `http://localhost:5173` as redirect URI in Zitadel for local Zitadel.

### Web only (demo mode, no backend needed)

```bash
cd heartbits-web
bun install
bun run dev
```

Navigate to `http://localhost:5173` — the app boots in demo mode automatically when no session cookie is present.

### Web + API + relay (no Zitadel)

You need postgres and redis. The easiest path:

```bash
docker compose -f deploy/compose.yml up -d postgres redis
```

Then copy and fill the env files:

```bash
# heartbits-api
cd heartbits-api && cp .env.example .env
# set DATABASE_URL, REDIS_URL, skip ZITADEL vars for local testing

# heartbits-web
cd heartbits-web && cp .env.example .env.local
# set PUBLIC_ZITADEL_ISSUER, PUBLIC_ZITADEL_CLIENT_ID

# relay
cd relay-server && ROOM_TOKEN=dev node server.js
```

---

## Code style

- **TypeScript everywhere** — no `any` unless genuinely unavoidable, prefer `unknown` + narrowing.
- **Svelte 5 runes** — use `$state`, `$derived`, `$props()`. No legacy Svelte 4 syntax.
- **No comments explaining what the code does.** Add a comment only when the *why* would surprise a future reader (a hidden constraint, a workaround for a specific bug, a non-obvious invariant).
- **No unused variables** — strict TypeScript; keep `make check` clean.
- **Bun** for JS/TS tooling, not npm/yarn (except relay-server which uses Node.js).
- **No new dependencies** without a good reason and discussion in the issue.

---

## Database changes

Add a new numbered migration file to `heartbits-api/migrations/`:

```
heartbits-api/migrations/
  001_initial_schema.sql   ← existing
  002_your_change.sql      ← new
```

Migrations must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, etc.). The `deploy/migrate.sh` script pipes them sequentially to postgres — it does not track which have run, so idempotency is the contract.

---

## Pull requests

- **One concern per PR.** A bug fix and a refactor in the same PR will be asked to split.
- **Fill in the description.** What changed, why, how to test it manually.
- **No force-pushing to `main`.**
- **Run `make check` before pushing** (API type-check + web build). CI on push
  builds the web and API, syntax-checks the relay, and runs CodeQL. Lint and
  unit-test gates (targeting high coverage) are on the roadmap, not yet enforced.

For mobile PRs (iOS, Android), include screenshots or a screen recording in the description.

---

## Project areas and who touches what

| Area | Key files |
|---|---|
| Auth flow | `heartbits-web/src/lib/server/auth.ts`, `src/routes/auth/` |
| Bond + relay | `heartbits-web/src/routes/bond/`, `relay-server/server.js` |
| API routes | `heartbits-api/src/routes/` |
| Discover / matching | `heartbits-api/src/routes/discover.ts`, `heartbits-web/src/routes/discover/` |
| Status page | `heartbits-web/src/routes/status/`, `heartbits-monitor/monitor.ts` |
| Deployment | `deploy/` |
| iOS heart rate | `Heartbits Watch App/HeartbitsApp.swift` |
| Android heart rate | `HeartbitsAndroid/app/src/main/java/io/whatif/heartbits/MainActivity.kt` |

---

## Commit messages

Use the imperative mood in the subject line (`Add`, `Fix`, `Remove`, not `Added`, `Fixed`). Keep it under 72 characters. The body is for *why*, not *what*.

```
Fix relay URL format in bonds route

The relay expects /{roomId} path routing, not ?room= query params.
The old format connected but the room fanout never fired.
```
