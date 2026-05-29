# Tetris Game Deployment Guide

## Overview

This document describes how to deploy the Tetris game using Drone CI/CD.

## Prerequisites

- Docker and Docker Compose installed on deployment server
- Drone CI/CD server configured
- Git repository with `.drone.yml`

## Drone Configuration

### Repository Settings

1. Go to your Drone server
2. Click "Activate Repository"
3. Select the tetris-game repository
4. Configure secrets:
   - `staging_ssh_key`: SSH private key for deployment server
   - `staging_host`: Deployment server hostname/IP

### Environment Variables

Configure in `.drone.yml`:

```yaml
environment:
  REGISTRY: registry.example.com
  IMAGE_FRONTEND: tetris/frontend
  IMAGE_BACKEND: tetris/backend
```

### Pipeline Triggers

| Event | Branch | Action |
|-------|--------|--------|
| Push | main | Build + Deploy to staging |
| Pull Request | * | Build + Test only |

## Manual Deployment

### Build Images

```bash
cd /path/to/tetris-game
./scripts/build.sh
```

### Deploy with Docker Compose

```bash
# Deploy to staging
./scripts/deploy.sh staging deploy

# Check status
docker-compose ps

# View logs
./scripts/deploy.sh staging logs

# Stop services
./scripts/deploy.sh staging stop
```

## Server Setup

### Staging Server

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt-get install docker-compose

# Create deployment directory
mkdir -p /opt/tetris
cd /opt/tetris

# Clone repository
git clone https://github.com/your-org/tetris-game.git .

# Start services
docker-compose up -d
```

### Production Considerations

1. Use a reverse proxy (nginx) with SSL
2. Set up proper firewall rules
3. Configure log rotation
4. Set up monitoring (Prometheus, Grafana)
5. Configure backup strategy

## Health Checks

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001/health`
- WebSocket: `ws://localhost:3001/ws`

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check container status
docker-compose ps

# Restart services
docker-compose restart
```

### Build fails

```bash
# Clean rebuild
docker-compose down
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```
