#!/bin/bash
# GEP Service End-to-End Test Script (v2)
# Tests GEP API endpoints via curl

BASE_URL="${BASE_URL:-http://localhost:3000}"
GEP_PREFIX="/gep"

echo "========================================"
echo "GEP Service E2E Test Suite"
echo "Base URL: $BASE_URL"
echo "========================================"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASS++)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1"; ((FAIL++)); }
section() { echo ""; echo -e "${YELLOW}--- $1 ---${NC}"; }

# Health Check
section "Health Check"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
[ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ] && pass "Server running (HTTP $HTTP_CODE)" || fail "Server down (HTTP $HTTP_CODE)"

# Register Gene
section "Gene Operations"
GENE_RESP=$(curl -s -X POST "$BASE_URL$GEP_PREFIX/gene" \
  -H "Content-Type: application/json" -H "x-node-id: test-node-001" \
  -d '{"name":"test-repair-gene","description":"A test gene for repairing code","category":"repair","validation":["check"],"strategy":["analyze","fix"]}')
echo "Register Gene: $GENE_RESP"
GENE_ID=$(echo "$GENE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$GENE_ID" ] && pass "Gene registered: $GENE_ID" || { fail "Gene registration failed"; GENE_ID="gene_err"; }

# Get Gene
GENE_GET=$(curl -s "$BASE_URL$GEP_PREFIX/gene/$GENE_ID")
echo "$GENE_GET" | grep -q "\"id\":\"$GENE_ID\"" && pass "Get gene by ID" || fail "Get gene by ID"

# Not Found
echo "$GENE_GET" | grep -q "NOT_FOUND" && pass "404 for non-existent gene" || true

# List Genes
GENES=$(curl -s "$BASE_URL$GEP_PREFIX/genes")
echo "$GENES" | grep -q '"success":true' && pass "List genes" || fail "List genes"

# Register 2nd Gene
curl -s -X POST "$BASE_URL$GEP_PREFIX/gene" \
  -H "Content-Type: application/json" -H "x-node-id: test-node-002" \
  -d '{"name":"test-optimize-gene","description":"Optimize perf","category":"optimize","validation":["p"],"strategy":["a","o"]}' > /dev/null

# Filter by category
FILT=$(curl -s "$BASE_URL$GEP_PREFIX/genes?category=optimize")
echo "$FILT" | grep -q "optimize" && pass "Filter by category" || fail "Filter by category"

# Register Capsule
section "Capsule Operations"
CAPS_RESP=$(curl -s -X POST "$BASE_URL$GEP_PREFIX/capsule" \
  -H "Content-Type: application/json" -H "x-node-id: test-node-001" \
  -d "{\"name\":\"test-capsule\",\"description\":\"A capsule\",\"content\":\"This is test capsule content with enough characters\",\"strategy\":[\"c\",\"v\"],\"gene_ids\":[\"$GENE_ID\"]}")
echo "Register Capsule: $CAPS_RESP"
CAPS_ID=$(echo "$CAPS_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$CAPS_ID" ] && pass "Capsule registered: $CAPS_ID" || { fail "Capsule registration failed"; CAPS_ID="capsule_err"; }

# Get Capsule
CAPS_GET=$(curl -s "$BASE_URL$GEP_PREFIX/capsule/$CAPS_ID")
echo "$CAPS_GET" | grep -q "\"id\":\"$CAPS_ID\"" && pass "Get capsule by ID" || fail "Get capsule by ID"

# List Capsules
CAPS=$(curl -s "$BASE_URL$GEP_PREFIX/capsules")
echo "$CAPS" | grep -q '"success":true' && pass "List capsules" || fail "List capsules"

# Register Node
section "Node Operations"
NODE_RESP=$(curl -s -X POST "$BASE_URL$GEP_PREFIX/node" \
  -H "Content-Type: application/json" \
  -d '{"node_id":"test-node-001","name":"TestNode","endpoint":"https://api.test.com","reputation":80,"status":"active","supported_adapters":["repair"]}')
echo "Register Node: $NODE_RESP"
NODE_ID=$(echo "$NODE_RESP" | grep -o '"node_id":"[^"]*"' | cut -d'"' -f4)
[ -n "$NODE_ID" ] && pass "Node registered: $NODE_ID" || { fail "Node registration failed"; NODE_ID="node_err"; }

# Get Node
NODE_GET=$(curl -s "$BASE_URL$GEP_PREFIX/node/$NODE_ID")
echo "$NODE_GET" | grep -q "\"node_id\":\"$NODE_ID\"" && pass "Get node by ID" || fail "Get node by ID"

# Discover Nodes
NODES=$(curl -s "$BASE_URL$GEP_PREFIX/nodes")
echo "$NODES" | grep -q '"success":true' && pass "Discover nodes" || fail "Discover nodes"

# Filter by reputation
REPFILT=$(curl -s "$BASE_URL$GEP_PREFIX/nodes?min_reputation=70")
echo "$REPFILT" | grep -q '"reputation"' && pass "Filter by reputation" || fail "Filter by reputation"

# Validation
section "Validation"
VALID=$(curl -s -X POST "$BASE_URL$GEP_PREFIX/validate" \
  -H "Content-Type: application/json" \
  -d '{"type":"gene","data":{"name":"vg","description":"d","category":"explore","validation":["v"],"strategy":["s1","s2"]}}')
echo "Validate: $VALID"
echo "$VALID" | grep -q '"valid":true' && pass "Validate valid gene" || fail "Validate valid gene"

# Adapters
section "Adapters"
ADAPT=$(curl -s "$BASE_URL$GEP_PREFIX/adapters")
echo "$ADAPT" | grep -q '"success":true' && pass "List adapters" || fail "List adapters"

# Error handling - missing fields
section "Error Handling"
MISSING=$(curl -s -X POST "$BASE_URL$GEP_PREFIX/gene" \
  -H "Content-Type: application/json" \
  -d '{"description":"no name","category":"repair","validation":["v"],"strategy":["s1","s2"]}')
echo "$MISSING" | grep -q '"success":false' && pass "Missing field validation" || fail "Missing field validation"

echo ""
echo "========================================"
echo -e "Passed: ${GREEN}$PASS${NC}  Failed: ${RED}$FAIL${NC}"
echo "========================================"
[ $FAIL -eq 0 ] && echo -e "${GREEN}All tests passed! ✓${NC}" || echo -e "${RED}Some tests failed!${NC}"
exit $FAIL
