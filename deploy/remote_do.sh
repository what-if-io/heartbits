#!/usr/bin/env bash
# remote_do.sh — sync deploy files to the Hetzner VM and run do.sh there.
# Usage: ./remote_do.sh [do.sh options...]
#   VM=user@host ./remote_do.sh          override target
#   ./remote_do.sh --app-domain foo.com  pass args through to do.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VM="${VM:-root@178.105.210.108}"

echo "── Syncing deploy/ → ${VM}:~/deploy/ ─────────────────────────────────────────"
rsync -avz --checksum \
    --exclude='.env' \
    --exclude='zitadel/bootstrap/*.pat' \
    "${SCRIPT_DIR}/" "${VM}:~/deploy/"

echo ""
echo "── Running do.sh on ${VM} ────────────────────────────────────────────────────"
# -t allocates a TTY so interactive prompts (domain names) work when needed
ssh -t "${VM}" "bash ~/deploy/do.sh $*"
