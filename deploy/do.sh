#!/usr/bin/env sh
# shellcheck disable=SC2129,SC1091,SC1090,SC2086
#
# HeartBits one-line deployment script.
# Usage (from the deploy/ directory):
#   ./do.sh
#   ./do.sh --app-domain heartbits.example.com --auth-domain auth.heartbits.example.com \
#           --relay-domain relay.heartbits.example.com --acme-email admin@example.com
#
# One-liner (once the script is published):
#   sh -c "$(curl -fsSL https://raw.githubusercontent.com/.../do.sh)"
#
set -e

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat <<EOF
Usage: $0 [options]

Options:
  --app-domain    APP_DOMAIN  (e.g. heartbits.example.com)
  --auth-domain   AUTH_DOMAIN (e.g. auth.heartbits.example.com)
  --relay-domain  RELAY_DOMAIN (e.g. relay.heartbits.example.com)
  --acme-email    ACME_EMAIL  (e.g. admin@example.com)
  --help          Show this help and exit

You can also pre-set the above as environment variables.

After this script finishes, run:
  ./bootstrap.sh
to create the Zitadel OIDC app and write HEARTBITS_CLIENT_ID to .env.
EOF
    exit 0
fi

##################################################################################################
# Resolve script location (handles piped execution by self-downloading)
##################################################################################################
_SCRIPT_PATH=""
if [ -f "$0" ] && [ -s "$0" ]; then
    _SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
fi

_MY_DIR=""
if [ -n "$_SCRIPT_PATH" ]; then
    _MY_DIR="$(dirname "$_SCRIPT_PATH")"
else
    _MY_DIR="$(pwd -P)"
fi

##################################################################################################
# Parse CLI arguments
##################################################################################################
APP_DOMAIN="${APP_DOMAIN:-}"
AUTH_DOMAIN="${AUTH_DOMAIN:-}"
RELAY_DOMAIN="${RELAY_DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-}"

while [ $# -gt 0 ]; do
    case "$1" in
        --app-domain)   APP_DOMAIN="$2";   shift 2 ;;
        --auth-domain)  AUTH_DOMAIN="$2";  shift 2 ;;
        --relay-domain) RELAY_DOMAIN="$2"; shift 2 ;;
        --acme-email)   ACME_EMAIL="$2";   shift 2 ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

##################################################################################################
# OS detection
##################################################################################################
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_ID="$(printf "%s" "$ID" | tr '[:upper:]' '[:lower:]')"
        OS_NAME="${PRETTY_NAME}"
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        OS_ID="$(printf "%s" "${DISTRIB_ID}" | tr '[:upper:]' '[:lower:]')"
        OS_NAME="${DISTRIB_DESCRIPTION}"
    else
        echo "Could not detect OS."
        exit 1
    fi
    echo "Detected OS: ${OS_NAME} (${OS_ID})"
}
detect_os

##################################################################################################
# Package installation helpers
##################################################################################################
do_install() {
    packages="$*"
    case "$OS_ID" in
        ubuntu|debian)
            sudo apt-get update -qq
            sudo apt-get install -y $packages
            ;;
        centos|rhel|rocky|fedora)
            sudo dnf install -y $packages || sudo yum install -y $packages
            ;;
        *)
            echo "Unsupported OS: ${OS_ID}"
            exit 1
            ;;
    esac
}

##################################################################################################
# Ensure sudo exists
##################################################################################################
if ! command -v sudo >/dev/null 2>&1; then
    case "$OS_ID" in
        ubuntu|debian) apt-get update -qq && apt-get install -y sudo ;;
        centos|rhel|rocky|fedora) yum install -y sudo || dnf install -y sudo ;;
    esac
fi

##################################################################################################
# Base packages
##################################################################################################
do_install curl ca-certificates openssl python3

##################################################################################################
# Docker
##################################################################################################
install_docker_deb() {
    do_install ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-${VERSION_CODENAME}}")"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/${OS_ID} ${codename} stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    do_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}
install_docker_rpm() {
    do_install dnf-plugins-core
    repo_id="${OS_ID}"
    [ "$OS_ID" = "rocky" ] && repo_id="rhel"
    if command -v dnf-3 >/dev/null 2>&1; then
        sudo dnf-3 config-manager --add-repo "https://download.docker.com/linux/${repo_id}/docker-ce.repo"
    elif command -v dnf >/dev/null 2>&1; then
        sudo dnf config-manager --add-repo "https://download.docker.com/linux/${repo_id}/docker-ce.repo"
    else
        sudo yum-config-manager --add-repo "https://download.docker.com/linux/${repo_id}/docker-ce.repo"
    fi
    do_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
}

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not found. Installing..."
    case "$OS_ID" in
        ubuntu|debian)      install_docker_deb ;;
        fedora|centos|rocky|rhel) install_docker_rpm ;;
        *)
            echo "Unsupported OS for Docker installation: $OS_ID"
            exit 1
            ;;
    esac
fi

# Post-install: add current user to docker group
CURRENT_USER="$(whoami)"
sudo groupadd docker > /dev/null 2>&1 || true
sudo usermod -aG docker "${CURRENT_USER}" > /dev/null 2>&1 || true

if ! docker version > /dev/null 2>&1; then
    if [ -z "$HB_REENTERED_DOCKER" ]; then
        echo "Docker group change needs session reload. Re-executing..."
        exec sudo -iu "$CURRENT_USER" env HB_REENTERED_DOCKER=1 sh "$_SCRIPT_PATH"
    else
        echo "Docker still unavailable. Try logging out and back in, then re-run."
        exit 1
    fi
fi

# Docker log limits
_DAEMON_CFG="/etc/docker/daemon.json"
_TMP_CFG="$(mktemp)"
cat > "$_TMP_CFG" <<DAEMONCFG
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "10" }
}
DAEMONCFG
if [ ! -f "$_DAEMON_CFG" ] || ! cmp -s "$_TMP_CFG" "$_DAEMON_CFG"; then
    echo "Applying Docker daemon log config..."
    sudo mkdir -p /etc/docker
    sudo cp "$_TMP_CFG" "$_DAEMON_CFG"
    sudo systemctl restart docker
fi
rm -f "$_TMP_CFG"

##################################################################################################
# Domain prompts
##################################################################################################
prompt_if_empty() {
    var_name="$1"
    prompt_text="$2"
    eval _cur=\$$var_name
    if [ -z "$_cur" ]; then
        printf "%s: " "$prompt_text"
        read -r _val
        eval "$var_name=\"$_val\""
    fi
}

echo ""
echo "── HeartBits deployment setup ───────────────────────────────────────────────"
prompt_if_empty APP_DOMAIN   "App domain     (e.g. heartbits.example.com)"
prompt_if_empty AUTH_DOMAIN  "Auth domain    (e.g. auth.heartbits.example.com)"
prompt_if_empty RELAY_DOMAIN "Relay domain   (e.g. relay.heartbits.example.com)"
prompt_if_empty ACME_EMAIL   "ACME email     (e.g. admin@example.com)"

for _var in APP_DOMAIN AUTH_DOMAIN RELAY_DOMAIN ACME_EMAIL; do
    eval _v=\$$_var
    if [ -z "$_v" ]; then
        echo "ERROR: ${_var} is required."
        exit 1
    fi
done

##################################################################################################
# Secret generation
##################################################################################################
_gen_hex() {
    # $1 = byte count → hex string of length $1*2
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex "$1"
    else
        python3 -c "import secrets; print(secrets.token_hex($1))"
    fi
}

_ENV_FILE="${_MY_DIR}/.env"

if [ -f "$_ENV_FILE" ] && grep -q "^APP_DOMAIN=" "$_ENV_FILE"; then
    echo ""
    echo "Existing .env found. Keeping secrets already set."
    . "$_ENV_FILE"
else
    echo ""
    echo "Generating secrets..."

    POSTGRES_PASSWORD="$(_gen_hex 24)"
    MINIO_PASSWORD="$(_gen_hex 16)"
    # ZITADEL_MASTERKEY must be exactly 32 characters
    ZITADEL_MASTERKEY="$(_gen_hex 16)"
    # Must satisfy Zitadel's default policy: upper + lower + digit + special
    ZITADEL_ADMIN_PASSWORD="Hb$(_gen_hex 8)1!"
    SESSION_SECRET="$(_gen_hex 32)"
    HB_FIELD_ENCRYPTION_KEY="$(_gen_hex 32)"
    ROOM_TOKEN="$(_gen_hex 24)"

    cat > "$_ENV_FILE" <<ENVEOF
# HeartBits deployment — generated by do.sh
# Edit values below, then run: docker compose up -d

# ── Domains ───────────────────────────────────────────────────────────────────
APP_DOMAIN=${APP_DOMAIN}
AUTH_DOMAIN=${AUTH_DOMAIN}
RELAY_DOMAIN=${RELAY_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# ── MinIO media storage ───────────────────────────────────────────────────────
MINIO_USER=heartbits
MINIO_PASSWORD=${MINIO_PASSWORD}

# ── Zitadel ───────────────────────────────────────────────────────────────────
# Exactly 32 characters
ZITADEL_MASTERKEY=${ZITADEL_MASTERKEY}
ZITADEL_ADMIN_PASSWORD=${ZITADEL_ADMIN_PASSWORD}

# ── HeartBits OIDC (filled by bootstrap.sh) ───────────────────────────────────
HEARTBITS_CLIENT_ID=
HEARTBITS_CLIENT_SECRET=

# ── Web app ───────────────────────────────────────────────────────────────────
SESSION_SECRET=${SESSION_SECRET}
# Optional: set to enable a password wall before the app goes public
STAGING_PASSWORD=

# ── API ───────────────────────────────────────────────────────────────────────
HB_FIELD_ENCRYPTION_KEY=${HB_FIELD_ENCRYPTION_KEY}

# ── Relay ─────────────────────────────────────────────────────────────────────
ROOM_TOKEN=${ROOM_TOKEN}
ENVEOF
    chmod 600 "$_ENV_FILE"
    echo "Written: ${_ENV_FILE}"
fi

##################################################################################################
# Prepare directories Zitadel needs to write into
##################################################################################################
mkdir -p "${_MY_DIR}/zitadel/bootstrap"
chmod 777 "${_MY_DIR}/zitadel/bootstrap"

##################################################################################################
# Start the stack
##################################################################################################
echo ""
echo "── Starting HeartBits stack ─────────────────────────────────────────────────"
cd "${_MY_DIR}"
docker compose -f compose.yml up -d

##################################################################################################
# If already bootstrapped, just show status and exit
##################################################################################################
# Re-source .env so HEARTBITS_CLIENT_ID is visible even if we just loaded an existing .env
. "$_ENV_FILE"
if [ -n "${HEARTBITS_CLIENT_ID:-}" ]; then
    echo ""
    echo "── Already bootstrapped (HEARTBITS_CLIENT_ID set) ───────────────────────────"
    echo "Containers brought up-to-date above. Nothing else to do."
    echo ""
    docker compose -f compose.yml ps
    echo ""
    echo "┌─────────────────────────────────────────────────────────────────────────┐"
    echo "│  HeartBits is live.                                                     │"
    echo "│                                                                         │"
    echo "│  App:   https://${APP_DOMAIN}"
    echo "│  Auth:  https://${AUTH_DOMAIN}"
    echo "│  Relay: https://${RELAY_DOMAIN}"
    echo "│                                                                         │"
    echo "│  Admin: admin / (ZITADEL_ADMIN_PASSWORD in .env)                       │"
    echo "└─────────────────────────────────────────────────────────────────────────┘"
    exit 0
fi

##################################################################################################
# Wait for Zitadel first-init to write admin.pat
##################################################################################################
echo ""
echo "── Waiting for Zitadel first-init to complete ────────────────────────────────"
_PAT_FILE="${_MY_DIR}/zitadel/bootstrap/admin.pat"
_waited=0
until [ -s "$_PAT_FILE" ]; do
    sleep 5
    _waited=$((_waited + 5))
    echo "  waiting for Zitadel init... (${_waited}s)"
    if [ "$_waited" -ge 300 ]; then
        echo "ERROR: Zitadel did not complete init within 5 minutes."
        echo "Check: docker compose -f ${_MY_DIR}/compose.yml logs zitadel"
        exit 1
    fi
done
echo "Zitadel init complete. admin.pat written."

# Give Zitadel a moment to finish starting up its HTTP server
sleep 5

##################################################################################################
# Run bootstrap — creates Zitadel project + OIDC app, writes HEARTBITS_CLIENT_ID
##################################################################################################
echo ""
echo "── Running bootstrap ────────────────────────────────────────────────────────"
"${_MY_DIR}/bootstrap.sh"

##################################################################################################
# Force-recreate app containers to pick up HEARTBITS_CLIENT_ID
##################################################################################################
echo ""
echo "── Reloading app containers with new client ID ───────────────────────────────"
docker compose -f compose.yml up -d --force-recreate heartbits-web heartbits-api

echo ""
docker compose -f compose.yml ps

echo ""
echo "┌─────────────────────────────────────────────────────────────────────────┐"
echo "│  HeartBits is live.                                                     │"
echo "│                                                                         │"
echo "│  App:   https://${APP_DOMAIN}"
echo "│  Auth:  https://${AUTH_DOMAIN}"
echo "│  Relay: https://${RELAY_DOMAIN}"
echo "│                                                                         │"
echo "│  Admin: admin / (ZITADEL_ADMIN_PASSWORD in .env)                       │"
echo "└─────────────────────────────────────────────────────────────────────────┘"
echo ""
echo "Useful commands:"
echo "  docker compose -f ${_MY_DIR}/compose.yml logs -f heartbits-web"
echo "  docker compose -f ${_MY_DIR}/compose.yml logs -f zitadel"
echo "  docker compose -f ${_MY_DIR}/compose.yml down"
echo "  docker compose -f ${_MY_DIR}/compose.yml down --volumes  # ⚠ destroys data"
