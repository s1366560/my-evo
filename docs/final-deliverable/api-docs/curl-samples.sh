#!/bin/bash
# My Evo API Verification - curl samples
# Generated: 2026-05-07

set -e

BASE_URL_BACKEND="http://127.0.0.1:3001"
BASE_URL_FRONTEND="http://127.0.0.1:3000"

echo "=============================================="
echo "My Evo API Contract Verification - curl samples"
echo "=============================================="

# ============================================
# 1. HEALTH CHECKS
# ============================================

echo ""
echo "--- 1. Health Checks ---"

echo "Backend health:"
curl -s "$BASE_URL_BACKEND/health"

echo ""
echo "Frontend API health:"
curl -s "$BASE_URL_FRONTEND/api/health"

# ============================================
# 2. USER AUTHENTICATION (Frontend API)
# ============================================

echo ""
echo "--- 2. User Authentication ---"

echo "Register user:"
curl -s -X POST "$BASE_URL_FRONTEND/api/frontend/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456","username":"testuser"}'

echo ""
echo "Login user:"
curl -s -X POST "$BASE_URL_FRONTEND/api/frontend/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'

# ============================================
# 3. A2A PROTOCOL (Backend API)
# ============================================

echo ""
echo "--- 3. A2A Protocol ---"

echo "Node registration (hello):"
curl -s -X POST "$BASE_URL_BACKEND/a2a/hello" \
  -H "Content-Type: application/json" \
  -d '{"name":"TestNode","description":"Test Node","capabilities":["test"],"version":"1.0.0","endpoint":"http://test.com"}'

echo ""
echo "Get node directory:"
curl -s "$BASE_URL_BACKEND/a2a/nodes"

echo ""
echo "Node heartbeat:"
NODE_ID="node_423e13982f7ce319"  # Use actual node ID
curl -s -X POST "$BASE_URL_BACKEND/a2a/heartbeat" \
  -H "Content-Type: application/json" \
  -H "x-node-id: $NODE_ID" \
  -d '{"node_id":"'"$NODE_ID"'","status":"active","active_tasks":[],"load":0.5}'

# ============================================
# 4. MAP ENDPOINTS (Backend API)
# ============================================

echo ""
echo "--- 4. Map Endpoints ---"

echo "Get map nodes:"
curl -s "$BASE_URL_BACKEND/map/nodes"

echo ""
echo "Get map edges:"
curl -s "$BASE_URL_BACKEND/map/edges"

# ============================================
# 5. BOUNTY ENDPOINTS (Backend API)
# ============================================

echo ""
echo "--- 5. Bounty Endpoints ---"

echo "Get bounty list:"
curl -s "$BASE_URL_BACKEND/bounty/list"

# ============================================
# 6. MARKETPLACE (Frontend API)
# ============================================

echo ""
echo "--- 6. Marketplace ---"

echo "Get marketplace stats:"
curl -s "$BASE_URL_FRONTEND/api/frontend/marketplace/stats"

# ============================================
# 7. PROTECTED ENDPOINTS (Requires Auth)
# ============================================

echo ""
echo "--- 7. Protected Endpoints ---"

# Get token first
TOKEN=$(curl -s -X POST "$BASE_URL_FRONTEND/api/frontend/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}' | jq -r '.token')

echo "User profile (with auth):"
curl -s "$BASE_URL_FRONTEND/api/frontend/user/profile" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "User maps (with auth):"
curl -s "$BASE_URL_FRONTEND/api/frontend/maps" \
  -H "Authorization: Bearer $TOKEN"

echo ""
echo "=============================================="
echo "API Verification Complete"
echo "=============================================="
