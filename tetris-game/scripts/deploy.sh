#!/bin/bash
# ============================================================
# Remote Deployment Script for Tetris Game
# ============================================================

set -e

# Configuration
REMOTE_HOST="${SSH_HOST:-45.77.246.72}"
REMOTE_USER="${SSH_USER:-root}"
REMOTE_PATH="/opt/tetris"
REGISTRY="45.77.246.72:5000"

echo "=========================================="
echo "Tetris Game - Remote Deployment"
echo "=========================================="
echo "Host: $REMOTE_HOST"
echo "Path: $REMOTE_PATH"
echo ""

# Step 1: Setup remote server
echo "[1/5] Setting up remote server..."
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_PATH && mkdir -p /etc/docker/certs.d/$REGISTRY"

# Step 2: Copy docker-compose.yml to remote
echo "[2/5] Copying docker-compose.yml..."
scp /workspace/my-evo/tetris-game/docker-compose.yml $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# Step 3: Pull images from registry
echo "[3/5] Pulling images from registry..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && docker compose pull"

# Step 4: Stop existing containers
echo "[4/5] Stopping existing containers..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && docker compose down"

# Step 5: Start new containers
echo "[5/5] Starting services..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_PATH && docker compose up -d"

# Wait for services
echo ""
echo "Waiting for services to be healthy..."
sleep 15

# Health check
echo ""
echo "=========================================="
echo "Health Check"
echo "=========================================="
echo -n "Backend: "
ssh $REMOTE_USER@$REMOTE_HOST "curl -sf http://localhost:3001/health" || echo "FAILED"
echo -n "Frontend: "
ssh $REMOTE_USER@$REMOTE_HOST "curl -sf http://localhost:8080 >/dev/null && echo 'OK' || echo 'FAILED'"

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Frontend: http://$REMOTE_HOST:8080"
echo "Backend:  http://$REMOTE_HOST:3001"
