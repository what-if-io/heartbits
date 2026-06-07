# HeartBits — developer convenience targets.
# JS/TS use Bun (web/api/monitor), the relay uses npm, the stack uses Docker Compose.

.DEFAULT_GOAL := help
.PHONY: help install install-web install-api install-relay install-monitor \
        dev-web dev-api dev-relay dev-monitor build check \
        up down logs migrate backup deploy-check

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

check: ## Type-check API + build web (CI-style gate)
	cd heartbits-api && bunx tsc --noEmit
	cd heartbits-web && bun run build

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
