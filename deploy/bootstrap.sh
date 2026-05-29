#!/usr/bin/env bash
# HeartBits Zitadel bootstrap
# Run ONCE after first `docker compose up -d` to create the HeartBits OIDC app.
# Uses the bootstrap-admin PAT (written by Zitadel on first init) — no browser needed.
# The bootstrap-admin machine user is created with IAM_OWNER role via
# ZITADEL_FIRSTINSTANCE_ORG_MACHINE_* env vars in docker-compose.yml.
#
# Usage: ./bootstrap.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run ./do.sh first."
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"

if [ -n "${HEARTBITS_CLIENT_ID:-}" ]; then
  echo "HEARTBITS_CLIENT_ID already set — bootstrap already ran. Exiting."
  exit 0
fi

AUTH_URL="https://${AUTH_DOMAIN}"
CALLBACK_URL="https://${APP_DOMAIN}/auth/callback"
PAT_FILE="$SCRIPT_DIR/zitadel/bootstrap/admin.pat"

# ── Wait for Zitadel ─────────────────────────────────────────────────────────
echo "Waiting for Zitadel to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${AUTH_URL}/.well-known/openid-configuration" >/dev/null 2>&1; then
    echo "Zitadel is up."
    break
  fi
  [ "$i" -eq 30 ] && { echo "Timeout waiting for Zitadel"; exit 1; }
  sleep 5
done

# ── Get admin token ───────────────────────────────────────────────────────────
# Use the bootstrap-admin PAT written by Zitadel on first init.
# This machine user has IAM_OWNER role and can call the management API.
if [ ! -f "$PAT_FILE" ]; then
  echo "ERROR: $PAT_FILE not found."
  echo "Make sure Zitadel has completed its first-run initialisation."
  echo "Check: docker compose -f \"$SCRIPT_DIR/docker-compose.yml\" logs zitadel | grep -i 'setup'"
  echo "The file is written by ZITADEL_FIRSTINSTANCE_PATPATH during first-init only."
  echo "If Zitadel was already initialised without that env var, run:"
  echo "  docker compose -f \"$SCRIPT_DIR/docker-compose.yml\" down -v && docker compose -f \"$SCRIPT_DIR/docker-compose.yml\" up -d"
  exit 1
fi

TOKEN=$(cat "$PAT_FILE")
if [ -z "$TOKEN" ]; then
  echo "ERROR: admin.pat is empty."
  exit 1
fi
echo "Using bootstrap-admin PAT (IAM_OWNER)."

# ── Verify token works ────────────────────────────────────────────────────────
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${AUTH_URL}/auth/v1/users/me" \
  -H "Authorization: Bearer $TOKEN")

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: bootstrap-admin PAT is not valid (HTTP $HTTP_STATUS)."
  echo "The PAT may have expired or Zitadel was restarted with wiped data."
  echo "Run: docker compose -f \"$SCRIPT_DIR/docker-compose.yml\" down -v && docker compose -f \"$SCRIPT_DIR/docker-compose.yml\" up -d  then retry."
  exit 1
fi
echo "Token valid."

# ── Get default org ID ────────────────────────────────────────────────────────
ORG_ID=$(curl -sf "${AUTH_URL}/admin/v1/orgs/default" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['org']['id'])")
echo "Default org: $ORG_ID"

# ── Create HeartBits project ──────────────────────────────────────────────────
PROJECT_RESP=$(curl -sf -X POST "${AUTH_URL}/management/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-zitadel-orgid: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"HeartBits","projectRoleAssertion":false,"projectRoleCheck":false,"hasProjectCheck":false,"privateLabelingSetting":"PRIVATE_LABELING_SETTING_UNSPECIFIED"}')
PROJECT_ID=$(echo "$PROJECT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "Project: $PROJECT_ID"

# ── Create PKCE OIDC app ──────────────────────────────────────────────────────
APP_RESP=$(curl -sf -X POST "${AUTH_URL}/management/v1/projects/${PROJECT_ID}/apps/oidc" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-zitadel-orgid: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"heartbits-web\",
    \"redirectUris\": [\"${CALLBACK_URL}\", \"http://localhost:5173/auth/callback\"],
    \"postLogoutRedirectUris\": [\"https://${APP_DOMAIN}\", \"http://localhost:5173\"],
    \"responseTypes\": [\"OIDC_RESPONSE_TYPE_CODE\"],
    \"grantTypes\": [\"OIDC_GRANT_TYPE_AUTHORIZATION_CODE\"],
    \"appType\": \"OIDC_APP_TYPE_USER_AGENT\",
    \"authMethodType\": \"OIDC_AUTH_METHOD_TYPE_NONE\",
    \"version\": \"OIDC_VERSION_1_0\",
    \"devMode\": false,
    \"accessTokenType\": \"OIDC_TOKEN_TYPE_BEARER\",
    \"idTokenRoleAssertions\": false,
    \"idTokenUserinfoAssertion\": false,
    \"clockSkew\": \"0s\",
    \"skipNativeAppSuccessPage\": false
  }")

CLIENT_ID=$(echo "$APP_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['clientId'])")
echo "Client ID: $CLIENT_ID"

# ── Apply HeartBits branding to Zitadel ──────────────────────────────────────
echo "Applying Zitadel branding..."

# Set label policy colors
curl -sf -X PUT "${AUTH_URL}/admin/v1/policies/label" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor":          "#FF6B6B",
    "backgroundColor":       "#070710",
    "warnColor":             "#FF6B6B",
    "fontColor":             "#FFFFFF",
    "primaryColorDark":      "#FF6B6B",
    "backgroundColorDark":   "#070710",
    "warnColorDark":         "#FF6B6B",
    "fontColorDark":         "#FFFFFF",
    "hideLoginNameSuffix":   false,
    "errorMsgPopup":         false,
    "disableWatermark":      true
  }' > /dev/null
echo "  colors set."

# Upload logo — compact 44 px tall mark+wordmark, no background rect (card bg shows through)
_LOGO_FILE="$(mktemp /tmp/hb-logo.XXXXXX.svg)"
cat > "$_LOGO_FILE" << 'LOGOEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 44" width="220" height="44">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="55%" stop-color="#E81F8C"/>
      <stop offset="100%" stop-color="#7B35DE"/>
    </linearGradient>
    <linearGradient id="ecg" x1="0" y1="0" x2="54" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="100%" stop-color="#7B35DE"/>
    </linearGradient>
  </defs>
  <!-- ECG mark -->
  <polyline points="2,22 11,22 14,15 17,29 20,22 23,12 26,32 29,22 38,22"
    fill="none" stroke="url(#ecg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Heart -->
  <path d="M43,20 C43,17.5 45,15.5 47,15.5 C48,15.5 49,16.2 49.8,17.3 C50.6,16.2 51.6,15.5 52.6,15.5 C54.6,15.5 56.6,17.5 56.6,20 C56.6,23.5 49.8,27.5 49.8,27.5 C49.8,27.5 43,23.5 43,20Z"
    fill="url(#ecg)"/>
  <!-- Wordmark -->
  <text x="64" y="30" font-family="Georgia,serif" font-size="24" font-weight="400"
    fill="url(#g)" letter-spacing="-0.5">HeartBits</text>
</svg>
LOGOEOF

curl -sf -X POST "${AUTH_URL}/assets/v1/instance/policy/label/logo/dark" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${_LOGO_FILE};type=image/svg+xml" > /dev/null && echo "  dark logo uploaded."

curl -sf -X POST "${AUTH_URL}/assets/v1/instance/policy/label/logo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${_LOGO_FILE};type=image/svg+xml" > /dev/null && echo "  light logo uploaded."

# Upload icon (favicon mark)
_ICON_FILE="$(mktemp /tmp/hb-icon.XXXXXX.svg)"
cat > "$_ICON_FILE" << 'ICONEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#070710"/>
  <polyline points="1,16 4,16 5.5,13 7,19 8.5,16 10,10 11.5,22 13,16 15,16"
    fill="none" stroke="url(#ecg)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M18.5,17.8 C18.5,16.5 19.5,15.5 20.8,15.5 C21.5,15.5 22.1,15.85 22.5,16.4 C22.9,15.85 23.5,15.5 24.2,15.5 C25.5,15.5 26.5,16.5 26.5,17.8 C26.5,20.1 22.5,22.5 22.5,22.5 C22.5,22.5 18.5,20.1 18.5,17.8Z"
    fill="url(#hg)"/>
  <line x1="15" y1="16" x2="18" y2="16" stroke="url(#ecg)" stroke-width="1.7" stroke-linecap="round"/>
  <defs>
    <linearGradient id="ecg" x1="0" y1="0" x2="20" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF6B6B"/>
      <stop offset="100%" stop-color="#C94AAF"/>
    </linearGradient>
    <linearGradient id="hg" x1="18" y1="15" x2="27" y2="23" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#E03E8C"/>
      <stop offset="100%" stop-color="#7B35DE"/>
    </linearGradient>
  </defs>
</svg>
ICONEOF

curl -sf -X POST "${AUTH_URL}/assets/v1/instance/policy/label/icon/dark" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${_ICON_FILE};type=image/svg+xml" > /dev/null && echo "  dark icon uploaded."

curl -sf -X POST "${AUTH_URL}/assets/v1/instance/policy/label/icon" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@${_ICON_FILE};type=image/svg+xml" > /dev/null && echo "  light icon uploaded."

rm -f "$_LOGO_FILE" "$_ICON_FILE"

# Activate the label policy
curl -sf -X POST "${AUTH_URL}/admin/v1/policies/label/_activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null
echo "  branding activated."

# ── Write to .env ─────────────────────────────────────────────────────────────
sed -i '/^HEARTBITS_CLIENT_ID=/d' "$ENV_FILE"
sed -i '/^HEARTBITS_CLIENT_SECRET=/d' "$ENV_FILE"
echo "HEARTBITS_CLIENT_ID=${CLIENT_ID}" >> "$ENV_FILE"
echo "HEARTBITS_CLIENT_SECRET=" >> "$ENV_FILE"

echo ""
echo "✓ Bootstrap complete."
echo "  HEARTBITS_CLIENT_ID=${CLIENT_ID}"
echo ""
echo "Restarting heartbits-web and heartbits-api to pick up the new client ID..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" restart heartbits-web heartbits-api
echo "Done."
