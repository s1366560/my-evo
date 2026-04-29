#!/bin/bash
# ============================================================
# GEP & GEPX E2E curl test script
# ============================================================

set -e

BASE_URL="${BASE_URL:-http://localhost:3001}"
GEP_PREFIX="$BASE_URL/gep"
GEPX_PREFIX="$BASE_URL/api/v2/gepx"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAILED++)); }
log_section() { echo ""; echo -e "${YELLOW}=== $1 ===${NC}"; }

# Helper to test endpoint
test() {
    local name="$1"
    local expected="$2"
    local cmd="$3"
    
    echo -n "  $name ... "
    resp=$(eval "$cmd" 2>&1) || true
    status=$(echo "$resp" | tail -1)
    
    if [[ "$status" == "$expected" ]]; then
        log_pass "$name (HTTP $status)"
    else
        log_fail "$name - Expected $expected, got $status"
    fi
}

# ============================================================
log_section "GEP Endpoints"

test "Health check" "200" \
    "curl -s -w '\n%{http_code}' '$BASE_URL/health'"

test "Version endpoint" "200" \
    "curl -s -w '\n%{http_code}' '$BASE_URL/version'"

test "GET /genes" "200" \
    "curl -s -w '\n%{http_code}' '$GEP_PREFIX/genes'"

test "GET /capsules" "200" \
    "curl -s -w '\n%{http_code}' '$GEP_PREFIX/capsules'"

test "GET /nodes" "200" \
    "curl -s -w '\n%{http_code}' '$GEP_PREFIX/nodes'"

test "GET /adapters" "200" \
    "curl -s -w '\n%{http_code}' '$GEP_PREFIX/adapters'"

# Test POST /gene
GENE_DATA='{"name":"test-gene-e2e","category":"capability","code":"function test(){return true;}","metadata":{"version":"1.0.0"}}'
GENE_RESP=$(curl -s -w '\n%{http_code}' -X POST "$GEP_PREFIX/gene" \
    -H "Content-Type: application/json" -H "x-node-id: test-node-e2e" -d "$GENE_DATA" 2>&1 || echo -e "\n000")
GENE_STATUS=$(echo "$GENE_RESP" | tail -1)
echo -n "  POST /gene ... "
if [[ "$GENE_STATUS" == "201" ]]; then
    log_pass "POST /gene (HTTP 201)"
    GENE_ID=$(echo "$GENE_RESP" | head -n -1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "  Created gene ID: ${GENE_ID:-N/A}"
else
    log_fail "POST /gene - Expected 201, got $GENE_STATUS"
    GENE_ID=""
fi

# Test POST /capsule
CAP_DATA='{"name":"test-cap-e2e","version":"1.0.0","executable":"console.log(1)","entry_point":"index.js"}'
CAP_RESP=$(curl -s -w '\n%{http_code}' -X POST "$GEP_PREFIX/capsule" \
    -H "Content-Type: application/json" -H "x-node-id: test-node-e2e" -d "$CAP_DATA" 2>&1 || echo -e "\n000")
CAP_STATUS=$(echo "$CAP_RESP" | tail -1)
echo -n "  POST /capsule ... "
if [[ "$CAP_STATUS" == "201" ]]; then
    log_pass "POST /capsule (HTTP 201)"
    CAP_ID=$(echo "$CAP_RESP" | head -n -1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "  Created capsule ID: ${CAP_ID:-N/A}"
else
    log_fail "POST /capsule - Expected 201, got $CAP_STATUS"
    CAP_ID=""
fi

# Test GET /gene/:id
if [[ -n "$GENE_ID" ]]; then
    test "GET /gene/:id" "200" \
        "curl -s -w '\n%{http_code}' '$GEP_PREFIX/gene/$GENE_ID'"
fi

# Test GET /capsule/:id
if [[ -n "$CAP_ID" ]]; then
    test "GET /capsule/:id" "200" \
        "curl -s -w '\n%{http_code}' '$GEP_PREFIX/capsule/$CAP_ID'"
fi

# Test 404
test "GET /gene/:id (404)" "404" \
    "curl -s -w '\n%{http_code}' '$GEP_PREFIX/gene/nonexistent-xyz-123'"

# Test POST /validate gene
VAL_GENE='{"type":"gene","data":{"name":"val-gene","category":"capability","code":"x=1"}}'
test "POST /validate (gene)" "200" \
    "curl -s -w '\n%{http_code}' -X POST '$GEP_PREFIX/validate' -H 'Content-Type: application/json' -d '$VAL_GENE'"

# Test POST /validate capsule
VAL_CAP='{"type":"capsule","data":{"name":"val-cap","version":"1.0.0","executable":"x","entry_point":"i.js"}}'
test "POST /validate (capsule)" "200" \
    "curl -s -w '\n%{http_code}' -X POST '$GEP_PREFIX/validate' -H 'Content-Type: application/json' -d '$VAL_CAP'"

# Test POST /validate invalid type
test "POST /validate (invalid type)" "400" \
    "curl -s -w '\n%{http_code}' -X POST '$GEP_PREFIX/validate' -H 'Content-Type: application/json' -d '{\"type\":\"invalid\"}'"

# ============================================================
log_section "GEPX Endpoints"

test "GET /gepx/bundles" "200" \
    "curl -s -w '\n%{http_code}' '$GEPX_PREFIX/bundles'"

# Test validate with payload
VAL_PLD='{"payload":{"gepx_version":"1.0.0","bundle_name":"test","assets":[]}}'
test "POST /gepx/validate" "200" \
    "curl -s -w '\n%{http_code}' -X POST '$GEPX_PREFIX/validate' -H 'Content-Type: application/json' -d '$VAL_PLD'"

# Test validate with base64
VAL_B64='{"base64":"ewogICJnZXB4X3ZlcnNpb24iOiAiMS4wLjAiCn0="}'
test "POST /gepx/validate (base64)" "200" \
    "curl -s -w '\n%{http_code}' -X POST '$GEPX_PREFIX/validate' -H 'Content-Type: application/json' -d '$VAL_B64'"

# Auth required tests (expect 401)
test "POST /gepx/bundles (auth)" "401" \
    "curl -s -w '\n%{http_code}' -X POST '$GEPX_PREFIX/bundles' -H 'Content-Type: application/json' -d '{\"name\":\"t\",\"desc\":\"d\",\"bundle_type\":\"G\",\"asset_ids\":[]}'"

test "POST /gepx/export (auth)" "401" \
    "curl -s -w '\n%{http_code}' -X POST '$GEPX_PREFIX/export' -H 'Content-Type: application/json' -d '{\"bundle_name\":\"t\",\"description\":\"d\",\"asset_ids\":[]}'"

test "GET /gepx/bundle/:id (404)" "404" \
    "curl -s -w '\n%{http_code}' '$GEPX_PREFIX/bundle/invalid-xyz-123'"

# ============================================================
log_section "Summary"

TOTAL=$((PASSED + FAILED))
echo ""
echo "=========================================="
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}, $TOTAL total"
echo "=========================================="

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
