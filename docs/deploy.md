# Deployment — hb.what-if.io

Relay server runs on `what-if.io` via Docker Compose at `~/p/main/deploy/what-ifio/`.

## docker-compose service

```yaml
heartbits-relay:
  image: node:22-alpine
  working_dir: /app
  volumes:
    - ./relay-server:/app:ro
  command: node server.js
  environment:
    ROOM_TOKEN: ${ROOM_TOKEN}
  networks: [internal]
  restart: unless-stopped
```

Source files are synced from `relay-server/` in this repo:
```bash
rsync -av relay-server/ tam@what-if.io:~/p/main/deploy/what-ifio/relay-server/
```

## Caddyfile block

Add to `~/p/main/deploy/what-ifio/Caddyfile`:

```
# ── HeartBits WebSocket relay ─────────────────────────────────────────────────
hb.what-if.io {
    encode gzip
    reverse_proxy heartbits-relay:8765
}
```

## .env

```
ROOM_TOKEN=<bearer token>
```

## Reload after changes

```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```
