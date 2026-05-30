#!/bin/bash
# ============================================================
# Build and Push Docker Images to Remote Registry
# ============================================================

set -e

REGISTRY="45.77.246.72:5000"
PROJECT_DIR="/workspace/my-evo/tetris-game"

echo "=========================================="
echo "Building Docker Images"
echo "=========================================="

# Build backend
echo "[1/4] Building backend image..."
docker build -t tetris-backend:latest \
  -f $PROJECT_DIR/backend/Dockerfile \
  $PROJECT_DIR/backend

# Build frontend
echo "[2/4] Building frontend image..."
docker build -t tetris-frontend:latest \
  -f $PROJECT_DIR/frontend/Dockerfile \
  $PROJECT_DIR/frontend

# Tag images
echo "[3/4] Tagging images..."
docker tag tetris-backend:latest $REGISTRY/tetris-backend:latest
docker tag tetris-frontend:latest $REGISTRY/tetris-frontend:latest

# Push to registry
echo "[4/4] Pushing to registry..."
docker push $REGISTRY/tetris-backend:latest
docker push $REGISTRY/tetris-frontend:latest

echo ""
echo "=========================================="
echo "Images pushed to $REGISTRY"
echo "=========================================="
