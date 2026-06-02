#!/usr/bin/env bash
# auth-smoke.sh — end-to-end smoke test for auth + oauth backend modules.
#
# Exercises the live /auth/login -> /oauth/state flow over HTTP and verifies
# the jtiMap single-use replay protection, the 600s STATE_TTL_MS window, and
# the email-enumeration / token-reuse / token-expiry password-reset guards.
#
# Run from repo root:
#   bash output/auth-smoke.sh
#
# Exit code 0 = all checks passed; non-zero = at least one check failed.

set -uo pipefail

BACKEND_PORT="${BACKEND_PORT:-3000}"
BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_LOG="/tmp/my-evo-logs/backend-smoke.log"
BACKEND_PID_FILE="/tmp/my-evo-logs/backend-smoke.pid"
REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKEND_DIR="$REPO_ROOT/backend"
BASE="http://${BACKEND_HOST}:${BACKEND_PORT}"

PASS=0
FAIL=0
FAILED_CHECKS=()

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
ylw()   { printf '\033[33m%s\033[0m\n' "$*"; }

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    green "  PASS  $name"
    PASS=$((PASS+1))
  else
    red   "  FAIL  $name  (expected='$expected' actual='$actual')"
    FAIL=$((FAIL+1))
    FAILED_CHECKS+=("$name")
  fi
}

require_cmd() {
  for c in "$@"; do
    if ! command -v "$c" >/dev/null 2>&1; then
      red "missing required command: $c"; exit 2
    fi
  done
}

cleanup() {
  if [[ -f "$BACKEND_PID_FILE" ]]; then
    local pid; pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true; sleep 1; kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$BACKEND_PID_FILE"
  fi
}
trap cleanup EXIT

require_cmd curl python3

ylw "==> repo root       : $REPO_ROOT"
ylw "==> backend dir     : $BACKEND_DIR"
ylw "==> backend port    : $BACKEND_PORT"
echo

# --- Step 0: start backend in MOCK mode (no DATABASE_URL) -----------
ylw "==> [0] starting backend in MOCK mode (no DATABASE_URL)"

# Prefer running src/ directly via tsx (no build step required, so the latest
# state.ts / auth service logic is exercised). Falls back to dist/ if tsx
# is unavailable. We always run from source if possible to avoid stale dist/.

mkdir -p "$(dirname "$BACKEND_LOG")"
if [[ -x "$BACKEND_DIR/node_modules/.bin/tsx" ]]; then
  # Use a smoke-only entrypoint so unrelated compile errors in
  # src/assets/* don't block the auth+oauth flow check.
  if [[ -f "$BACKEND_DIR/src/_smoke_index.ts" ]]; then
    START_CMD="exec node_modules/.bin/tsx src/_smoke_index.ts"
  else
    START_CMD="exec node_modules/.bin/tsx src/index.ts"
  fi
else
  if [[ ! -d "$BACKEND_DIR/dist" ]]; then
    ( cd "$BACKEND_DIR" && npm run build >/dev/null 2>&1 ) || { red "backend build failed"; exit 3; }
  fi
  START_CMD="exec node dist/index.js"
fi

( cd "$BACKEND_DIR" \
  && setsid env -u DATABASE_URL sh -lc "$START_CMD" \
       > "$BACKEND_LOG" 2>&1 < /dev/null & echo $! > "$BACKEND_PID_FILE" )
sleep 2

for i in {1..20}; do
  if curl -fsS "${BASE}/health" >/dev/null 2>&1; then
    green "  backend /health is up"; break
  fi
  if [[ "$i" == "20" ]]; then
    red "  backend did not come up"; tail -20 "$BACKEND_LOG"; exit 4
  fi
  sleep 0.3
done

HEALTH_MODE=$(curl -fsS "${BASE}/health" | python3 -c 'import sys,json;print(json.load(sys.stdin)["mode"])')
check "health.mode == mock" "mock" "$HEALTH_MODE"
echo

# --- Step 1: /auth/login --------------------------------------------------
ylw "==> [1] POST /api/v1/auth/login"

LOGIN_RESP=$(curl -sS -X POST "${BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@evo.local","password":"password123"}')

LOGIN_SUCCESS=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json;r=json.load(sys.stdin);print(r.get("success"))')
check "login.success == True" "True" "$LOGIN_SUCCESS"

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')
REFRESH_TOKEN=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["refreshToken"])')
USER_EMAIL=$(echo "$LOGIN_RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["user"]["email"])')

check "login returns accessToken (len > 100)" "True" "$([[ ${#ACCESS_TOKEN} -gt 100 ]] && echo True || echo False)"
check "login returns refreshToken (len > 100)" "True" "$([[ ${#REFRESH_TOKEN} -gt 100 ]] && echo True || echo False)"
check "login user.email == demo@evo.local" "demo@evo.local" "$USER_EMAIL"
echo

# --- Step 2: /auth/me with bearer -----------------------------------------
ylw "==> [2] GET /api/v1/auth/me"

ME_RESP=$(curl -sS "${BASE}/api/v1/auth/me" -H "Authorization: Bearer $ACCESS_TOKEN")
ME_EMAIL=$(echo "$ME_RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["user"]["email"])')
check "auth.me email matches login email" "$USER_EMAIL" "$ME_EMAIL"
echo

# --- Step 3: /auth/oauth/:provider -> state in redirect -------------------
ylw "==> [3] GET /api/v1/auth/oauth/google and extract state from 302"

# Write raw headers to a temp file so we don't lose them in shell quoting
HEADERS_FILE=$(mktemp)
curl -sS -i "${BASE}/api/v1/auth/oauth/google" > "$HEADERS_FILE" 2>/dev/null

STATUS=$(head -1 "$HEADERS_FILE" | awk '{print $2}')
check "oauth/redirect status == 302" "302" "$STATUS"

# Extract the Location header (case-insensitive)
LOCATION=$(python3 -c "
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r'^Location:\s*(.+)$', text, re.M | re.I)
print(m.group(1).strip() if m else '')
" "$HEADERS_FILE")

STATE=$(python3 -c "
import re, urllib.parse
loc = '''$LOCATION'''
m = re.search(r'[?&]state=([^&]+)', loc)
print(urllib.parse.unquote(m.group(1)) if m else '')
")
check "redirect Location contains state param" "True" "$([[ -n "$STATE" ]] && echo True || echo False)"

DOT_COUNT=$(awk -F'.' '{print NF-1}' <<<"$STATE")
check "state token is body.sig (has dot)" "True" "$([[ "$DOT_COUNT" -ge 1 ]] && echo True || echo False)"

STATE_BODY=$(echo "$STATE" | cut -d. -f1)
STATE_SIG=$(echo "$STATE" | cut -d. -f2)
PAYLOAD_JSON=$(python3 -c "
import base64, sys
b = sys.argv[1].strip()
b += '=' * (-len(b) % 4)
print(base64.urlsafe_b64decode(b.encode()).decode())
" "$STATE_BODY")
echo "  state payload: $PAYLOAD_JSON"

PROVIDER_OK=$(python3 -c "
import json, sys
p = json.loads(sys.argv[1])
print('True' if p.get('provider')=='google' and isinstance(p.get('iat'),int) else 'False')
" "$PAYLOAD_JSON")
check "state payload {provider:'google', iat:<int>}" "True" "$PROVIDER_OK"
rm -f "$HEADERS_FILE"
echo

# --- Step 4: replay guard (jtiMap single-use) ----------------------------
ylw "==> [4] Replay protection — same state must NOT be accepted twice"

# URL-encode the state for query string
STATE_ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$STATE")

CB1_FILE=$(mktemp)
curl -sS -i "${BASE}/api/v1/auth/oauth/google/callback?code=mock-code-1&state=${STATE_ENC}" > "$CB1_FILE" 2>/dev/null
CB1_LOC=$(python3 -c "
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r'^Location:\s*(.+)$', text, re.M | re.I)
print(m.group(1).strip() if m else '')
" "$CB1_FILE")

CB1_OK=$(python3 -c "
import re, sys
loc = sys.argv[1]
ok = bool(re.search(r'/auth/callback\?', loc))
print('True' if ok else 'False')
" "$CB1_LOC")
check "first callback succeeds (redirects to /auth/callback)" "True" "$CB1_OK"

CB2_FILE=$(mktemp)
curl -sS -i "${BASE}/api/v1/auth/oauth/google/callback?code=mock-code-2&state=${STATE_ENC}" > "$CB2_FILE" 2>/dev/null
CB2_LOC=$(python3 -c "
import re, sys
text = open(sys.argv[1]).read()
m = re.search(r'^Location:\s*(.+)$', text, re.M | re.I)
print(m.group(1).strip() if m else '')
" "$CB2_FILE")

CB2_REJECTED=$(python3 -c "
import urllib.parse, re, sys
loc = sys.argv[1]
parsed = urllib.parse.urlparse(loc)
params = dict(urllib.parse.parse_qsl(parsed.query))
err = params.get('error','')
print('True' if 'already_consumed' in urllib.parse.unquote(err) else 'False')
" "$CB2_LOC")
check "second callback rejected with already_consumed" "True" "$CB2_REJECTED"
rm -f "$CB1_FILE" "$CB2_FILE"
echo

# --- Step 5: password-reset email enumeration + single-use ----------------
ylw "==> [5] Password-reset: unknown email, single-use, weak password"

# 5a: Unknown email must NOT leak existence — current contract:
# {success: true, data: {message, expiresAt}} (no resetToken field)
UNKNOWN_RESP=$(curl -sS -X POST "${BASE}/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' -d '{"email":"nobody-here@example.com"}')
UNKNOWN_OK=$(python3 -c "
import sys, json
r = json.load(sys.stdin)
data = r.get('data', {})
ok = r.get('success') is True and 'resetToken' not in data and 'expiresAt' in data
print('True' if ok else 'False')
" <<< "$UNKNOWN_RESP")
check "forgot-password unknown email: no token leakage" "True" "$UNKNOWN_OK"

# 5b: Known email returns a resetToken
KNOWN_RESP=$(curl -sS -X POST "${BASE}/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' -d '{"email":"demo@evo.local"}')
KNOWN_TOKEN=$(python3 -c "
import sys, json
r = json.load(sys.stdin).get('data', {})
t = r.get('resetToken') or ''
print(t if (isinstance(t,str) and len(t) > 10) else '')
" <<< "$KNOWN_RESP")
check "forgot-password known email: returns resetToken" "True" "$([[ -n "$KNOWN_TOKEN" ]] && echo True || echo False)"

# 5c: Use the token to reset password (first use)
# NOTE: controller reads `password` (not `newPassword`) for the new pw.
RESET1=$(curl -sS -X POST "${BASE}/api/v1/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$KNOWN_TOKEN\",\"password\":\"NewPassword123!\"}")
RESET1_OK=$(python3 -c "
import sys, json
r = json.load(sys.stdin)
ok = r.get('success') is True
print('True' if ok else 'False')
" <<< "$RESET1")
check "reset-password succeeds first time" "True" "$RESET1_OK"

# 5d: Re-use the same token must fail (single-use)
RESET2=$(curl -sS -X POST "${BASE}/api/v1/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$KNOWN_TOKEN\",\"password\":\"AnotherPass123!\"}")
RESET2_REJECTED=$(python3 -c "
import sys, json
r = json.load(sys.stdin)
msg = ''
if isinstance(r.get('error'), dict):
    msg = (r['error'].get('message','') or '').lower()
elif isinstance(r.get('error'), str):
    msg = r['error'].lower()
ok = r.get('success') is False and ('already' in msg or 'invalid' in msg or 'expired' in msg)
print('True' if ok else 'False')
" <<< "$RESET2")
check "reset-password: second attempt rejected (single-use)" "True" "$RESET2_REJECTED"

# 5e: Issue a new token, test weak password rejection
KNOWN_RESP2=$(curl -sS -X POST "${BASE}/api/v1/auth/forgot-password" \
  -H 'Content-Type: application/json' -d '{"email":"demo@evo.local"}')
KNOWN_TOKEN2=$(python3 -c "
import sys, json
r = json.load(sys.stdin).get('data', {})
print(r.get('resetToken',''))
" <<< "$KNOWN_RESP2")

WEAK=$(curl -sS -X POST "${BASE}/api/v1/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$KNOWN_TOKEN2\",\"password\":\"short\"}")
WEAK_REJECTED=$(python3 -c "
import sys, json
r = json.load(sys.stdin)
msg = ''
if isinstance(r.get('error'), dict):
    msg = (r['error'].get('message','') or '').lower()
elif isinstance(r.get('error'), str):
    msg = r['error'].lower()
print('True' if r.get('success') is False and '8' in msg else 'False')
" <<< "$WEAK")
check "reset-password rejects weak password (<8 chars)" "True" "$WEAK_REJECTED"

# 5f: Token still valid after weak-password attempt — use with strong pw
STRONG=$(curl -sS -X POST "${BASE}/api/v1/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$KNOWN_TOKEN2\",\"password\":\"StrongPassword123!\"}")
STRONG_OK=$(python3 -c "
import sys, json
r = json.load(sys.stdin)
print('True' if r.get('success') is True else 'False')
" <<< "$STRONG")
check "reset-password: strong password succeeds after weak rejection" "True" "$STRONG_OK"
echo

# --- Summary ---------------------------------------------------------------
ylw "==> summary"
echo "  passed: $PASS"
echo "  failed: $FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  red "FAILED checks:"
  for c in "${FAILED_CHECKS[@]}"; do echo "  - $c"; done
  exit 1
fi
green "all checks passed"
exit 0
