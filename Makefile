# HeartBits — developer convenience targets.
# JS/TS use Bun (web/api/monitor), the relay uses npm, the stack uses Docker Compose.

.DEFAULT_GOAL := help
.PHONY: help install install-web install-api install-relay install-monitor \
        dev-web dev-api dev-relay dev-monitor build check \
        test-db test-integration up down logs migrate backup

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

## ── Dependencies ───────────────────────────────────────────────────────────
install: install-web install-api install-relay install-monitor ## Install all deps

install-web: ## Install web deps
	cd heartbits-web && bun install
install-api: ## Install API deps
	cd heartbits-api && bun install
install-relay: ## Install relay deps
	cd relay-server && npm install
install-monitor: ## Install monitor deps
	cd heartbits-monitor && bun install

## ── Local dev (run in separate terminals) ──────────────────────────────────
dev-web: ## Run the web app (Vite dev, :5173)
	cd heartbits-web && bun run dev
dev-api: ## Run the API in watch mode (:3100)
	cd heartbits-api && bun run dev
dev-relay: ## Run the relay in local open mode (:8765)
	cd relay-server && RELAY_DEV_OPEN=true node server.js
dev-monitor: ## Run the uptime monitor (:4000)
	cd heartbits-monitor && DB_PATH=/tmp/hb-monitor/heartbits.db bun run monitor.ts

## ── Build / check ──────────────────────────────────────────────────────────
build: ## Build the web app
	cd heartbits-web && bun run build

check: ## Type-check + test API + build web (CI-style gate; no DB needed)
	cd heartbits-api && bunx tsc --noEmit && bun test
	cd heartbits-web && bun run build

## ── Integration tests (need the local hb-postgres + hb-redis containers) ────
test-db: ## (Re)create + migrate the local heartbits_test database
	docker exec hb-postgres psql -U heartbits -d postgres -tAc "DROP DATABASE IF EXISTS heartbits_test"
	docker exec hb-postgres psql -U heartbits -d postgres -tAc "CREATE DATABASE heartbits_test"
	for m in heartbits-api/migrations/00*.sql; do docker exec -i hb-postgres psql -q -v ON_ERROR_STOP=1 -U heartbits -d heartbits_test < "$$m"; done
	docker exec hb-postgres psql -U heartbits -d heartbits_test -c "ALTER ROLE heartbits_api PASSWORD 'password'; ALTER ROLE heartbits_worker PASSWORD 'password';"

test-integration: ## Run API unit + integration tests against heartbits_test
	cd heartbits-api && \
	  TEST_DATABASE_URL='postgres://heartbits_api:password@localhost:5432/heartbits_test' \
	  TEST_ADMIN_DATABASE_URL='postgres://heartbits:heartbits@localhost:5432/heartbits_test' \
	  TEST_REDIS_URL='redis://localhost:6379/15' \
	  bun test

## ── Docker stack (from deploy/) ────────────────────────────────────────────
up: ## Start the full stack
	cd deploy && docker compose up -d
down: ## Stop the stack
	cd deploy && docker compose down
logs: ## Tail stack logs
	cd deploy && docker compose logs -f --tail=100
migrate: ## Apply DB migrations
	cd deploy && ./migrate.sh
backup: ## Back up Postgres + MinIO
	cd deploy && ./backup.sh
