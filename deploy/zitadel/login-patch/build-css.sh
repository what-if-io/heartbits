#!/usr/bin/env bash
# Rebuild login-styles.css from the current login image + HeartBits overrides.
# Run after upgrading the Zitadel login image, or whenever overrides change.
#
# Usage:  ./build-css.sh         (uses the running deploy-login-1 container)
#         ./build-css.sh <name>  (use a specific container name)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTAINER="${1:-deploy-login-1}"
ORIGINAL_PATH="/app/apps/login/.next/static/chunks/0nd7.1rw2312f.css"
OVERRIDES="$SCRIPT_DIR/heartbits-overrides.css"
OUT="$SCRIPT_DIR/login-styles.css"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "ERROR: container '$CONTAINER' is not running."
  echo "Start it first: docker compose up -d login"
  exit 1
fi

# Verify the hashed CSS path still exists in this image build
if ! docker exec "$CONTAINER" test -f "$ORIGINAL_PATH"; then
  echo "ERROR: $ORIGINAL_PATH not found in container."
  echo "The Zitadel login image may have been upgraded — find the new hashed path with:"
  echo "  docker exec $CONTAINER find /app/apps/login/.next/static/chunks -name '*.css'"
  echo "Then update ORIGINAL_PATH here AND the volume mount in compose.yml."
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

docker exec "$CONTAINER" cat "$ORIGINAL_PATH" > "$TMP"
cat "$TMP" "$OVERRIDES" > "$OUT"
echo "✓ Wrote $OUT ($(wc -c < "$OUT") bytes = $(wc -c < "$TMP") original + $(wc -c < "$OVERRIDES") overrides)"
echo "  Restart login container to pick up: docker compose restart login"
