#!/usr/bin/env bash
# ============================================================
# EvoMap Hub - Quick Start Script (Local Development)
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

log_info "EvoMap Hub - Local Development Setup"

# Check prerequisites
command -v node >/dev/null 2>&1 || { log_error "Node.js is required."; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm is required."; exit 1; }

# Create .env if missing
if [ ! -f .env ]; then
    log_info "Creating .env from template..."
    cp .env.example .env
    log_warn "Please edit .env and set DATABASE_URL, REDIS_URL, NODE_SECRET, SESSION_SECRET"
fi

# Install dependencies
log_info "Installing dependencies..."
npm ci

# Generate Prisma client
log_info "Generating Prisma client..."
npx prisma generate

# Start backend
log_info "Starting backend (http://localhost:3001)..."
npm run dev &
BACKEND_PID=$!

# Start frontend
log_info "Starting frontend (http://localhost:3000)..."
cd frontend && npm run dev &
FRONTEND_PID=$!

log_info "Both services are starting..."
log_info "Backend PID: $BACKEND_PID"
log_info "Frontend PID: $FRONTEND_PID"
log_info ""
log_info "Press Ctrl+C to stop all services"

# Wait for either process
wait $BACKEND_PID $FRONTEND_PID
