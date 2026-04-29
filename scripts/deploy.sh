#!/bin/bash
# Production Deployment Script for EvoMap Hub
# Usage: ./scripts/deploy.sh [development|staging|production]

set -e

ENVIRONMENT=${1:-development}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="logs/deploy_${TIMESTAMP}.log"

mkdir -p logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting deployment for environment: $ENVIRONMENT"

# Check prerequisites
command -v docker >/dev/null 2>&1 || { log "ERROR: Docker is required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { log "ERROR: docker-compose is required"; exit 1; }

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    log "Loading environment from .env.${ENVIRONMENT}"
    export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    log "Loading environment from .env"
    export $(cat .env | grep -v '^#' | xargs)
else
    log "WARNING: No .env file found"
fi

# Validate required environment variables
required_vars=("DATABASE_URL" "POSTGRES_PASSWORD" "NODE_SECRET" "SESSION_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        log "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

log "Required environment variables validated"

# Build TypeScript
log "Building TypeScript..."
npm run build >> "$LOG_FILE" 2>&1 || { log "ERROR: Build failed"; exit 1; }
log "Build successful"

# Build Docker images
log "Building Docker images..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build >> "$LOG_FILE" 2>&1
else
    docker-compose build >> "$LOG_FILE" 2>&1
fi
log "Docker images built"

# Stop existing containers
log "Stopping existing containers..."
docker-compose down >> "$LOG_FILE" 2>&1 || true

# Start services
log "Starting services..."
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d >> "$LOG_FILE" 2>&1
else
    docker-compose up -d >> "$LOG_FILE" 2>&1
fi

# Wait for services to be healthy
log "Waiting for services to be healthy..."
sleep 10

# Health check
log "Performing health check..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    log "Backend is healthy (HTTP $BACKEND_HEALTH)"
else
    log "WARNING: Backend health check returned HTTP $BACKEND_HEALTH"
fi

FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ] || [ "$FRONTEND_HEALTH" = "304" ]; then
    log "Frontend is accessible (HTTP $FRONTEND_HEALTH)"
else
    log "WARNING: Frontend check returned HTTP $FRONTEND_HEALTH"
fi

# Show running containers
log "Running containers:"
docker-compose ps

log "Deployment completed successfully!"
log "Log file: $LOG_FILE"
log ""
log "Endpoints:"
log "  Backend API: http://localhost:3001"
log "  Frontend:    http://localhost:3000"
log "  Swagger UI:  http://localhost:3001/docs"
log ""
log "To view logs: docker-compose logs -f"
log "To stop:     docker-compose down"
