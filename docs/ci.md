# CI / CD

HeartBits uses **GitHub Actions**. Workflows live in `.github/workflows/`.

## Workflows

### `ci.yml` — build & checks (on push to `main` + every PR)

| Job | What it does |
|---|---|
| `web` | `bun install --frozen-lockfile` + `bun run build` (SvelteKit / adapter-node) |
| `api` | `bun install --frozen-lockfile` + bundle the entrypoints (`bun build`) to catch import/syntax errors |
| `relay` | `npm ci` + `node --check server.js` |

Fast, deterministic checks — they need no database or secrets.

### `codeql.yml` — security scanning (push, PR, weekly)

- **javascript-typescript** — `build-mode: none` (analyses source directly). Covers the web + API, the real attack surface.
- **java-kotlin** — `build-mode: manual`: sets up JDK 21 and runs `./gradlew :app:compileDebugKotlin` (the Android SDK is preinstalled on the runner; `local.properties` is gitignored and read with defaults). `build-mode: none` does **not** work for Kotlin/Swift — they need a real build.

> **Swift / iOS:** not scanned yet — it would need a `macos-latest` + Xcode build, and the iOS/watchOS/visionOS apps are an early Phase-0 prototype, so it's deferred.

## Deployment

Deployment is **not** run from CI. The stack is deployed to the VM via `deploy/remote_do.sh` (rsync + `docker compose up -d`). See [`docs/deploy.md`](deploy.md).

## Running checks locally

```bash
# web
cd heartbits-web && bun install && bun run build
# relay
cd relay-server && npm ci && node --check server.js
```

Replay a workflow locally with [act](https://github.com/nektos/act).

## Code-scanning setup

`codeql.yml` is an **advanced** code-scanning setup. If GitHub's *default* CodeQL setup is enabled on the repo, switch it off (Settings → Code security → CodeQL analysis → advanced) so the workflow runs.
