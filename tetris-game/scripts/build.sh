#!/bin/bash
# ============================================================
# Tetris Game - Build Script
# ============================================================

set -e

echo "🎮 Building Tetris Game..."

# Build frontend
echo "Building frontend..."
cd frontend
docker build -t tetris-frontend:latest .
cd ..

# Build backend
echo "Building backend..."
cd backend
docker build -t tetris-backend:latest .
cd ..

echo "✅ Build complete!"
echo "Images: tetris-frontend:latest, tetris-backend:latest"
