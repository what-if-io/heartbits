#!/usr/bin/env bash
# One-shot: switch the existing Zitadel OIDC app from opaque to JWT access tokens.
# Run from the deploy/ directory on the server: ./fix-jwt-tokens.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi
# shellcheck disable=SC1090
. "$ENV_FILE"

PAT_FILE="$SCRIPT_DIR/zitadel/bootstrap/admin.pat"
if [ ! -f "$PAT_FILE" ]; then
  echo "ERROR: $PAT_FILE not found."
  exit 1
fi

TOKEN=$(cat "$PAT_FILE")
AUTH_URL="https://${AUTH_DOMAIN}"

echo "→ Fetching default org..."
ORG_ID=$(curl -sf "${AUTH_URL}/admin/v1/orgs/default" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['org']['id'])")
echo "  Org: $ORG_ID"

echo "→ Finding HeartBits project..."
PROJECT_ID=$(curl -sf -X POST "${AUTH_URL}/management/v1/projects/_search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-zitadel-orgid: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"queries":[{"nameQuery":{"name":"HeartBits","method":"TEXT_QUERY_METHOD_EQUALS"}}]}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['id'])")
echo "  Project: $PROJECT_ID"

echo "→ Finding heartbits-web app..."
APP_ID=$(curl -sf -X POST "${AUTH_URL}/management/v1/projects/${PROJECT_ID}/apps/_search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-zitadel-orgid: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"queries":[{"nameQuery":{"name":"heartbits-web","method":"TEXT_QUERY_METHOD_EQUALS"}}]}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result'][0]['id'])")
echo "  App: $APP_ID"

echo "→ Updating accessTokenType to JWT..."
# Zitadel v4 path: /apps/{appId}/oidc_config  (not /apps/oidc/{appId})
curl -sf -X PUT "${AUTH_URL}/management/v1/projects/${PROJECT_ID}/apps/${APP_ID}/oidc_config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-zitadel-orgid: $ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUris": ["'"${CALLBACK_URL}"'","http://localhost:5173/auth/callback"],
    "responseTypes": ["OIDC_RESPONSE_TYPE_CODE"],
    "grantTypes": ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    "appType": "OIDC_APP_TYPE_USER_AGENT",
    "authMethodType": "OIDC_AUTH_METHOD_TYPE_NONE",
    "postLogoutRedirectUris": ["https://'"${APP_DOMAIN}"'","http://localhost:5173"],
    "accessTokenType": "OIDC_TOKEN_TYPE_JWT",
    "clockSkew": "0s"
  }' > /dev/null

echo "✓ Done. Restarting API + web..."
docker compose -f "$SCRIPT_DIR/compose.yml" restart heartbits-api heartbits-web
echo "✓ Restarted."
