# My Evo Deployment Runbook

**Version**: v1.0.0
**Last Updated**: 2026-05-07

---

## Overview

This runbook provides procedures for deploying, operating, and rolling back the My Evo application stack consisting of:
- **Frontend**: Next.js 14 (Port 3000)
- **Backend**: Node.js/Express (Port 3001)
- **Database**: SQLite (dev) / PostgreSQL (prod)

---

## Prerequisites

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite/PostgreSQL connection string | `file:./dev.db` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-secret-key` |
| `NODE_ENV` | Environment: development/production | `production` |
| `PORT` | Backend port | `3001` |
| `FRONTEND_PORT` | Frontend port | `3000` |

### Required Tools

- Node.js 20+
- npm or yarn
- PostgreSQL 15+ (production)
- Docker & Docker Compose (optional)

---

## Deployment Procedures

### 1. Pre-Deployment Checklist

```bash
# Verify environment variables are set
echo $DATABASE_URL
echo $JWT_SECRET

# Run database migrations
cd backend && npx prisma migrate deploy

# Run tests
cd backend && npm test

# Build applications
cd frontend && npm run build
cd backend && npm run build
```

### 2. Deploy Backend

```bash
# Using systemd (recommended for production)
sudo systemctl stop my-evo-backend
sudo cp -r backend /opt/my-evo/
sudo systemctl start my-evo-backend

# Verify
curl http://localhost:3001/health
```

### 3. Deploy Frontend

```bash
# Using systemd
sudo systemctl stop my-evo-frontend
sudo cp -r frontend /opt/my-evo/
sudo systemctl start my-evo-frontend

# Verify
curl http://localhost:3000/api/health
```

### 4. Docker Deployment

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Verify
docker-compose ps
docker-compose logs backend
docker-compose logs frontend
```

---

## Health Checks

### Backend Health

```bash
curl http://localhost:3001/health
# Expected: {"status":"healthy","timestamp":"...","services":{"api":"up","database":"up"}}
```

### Frontend Health

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"healthy","timestamp":"...","service":"frontend","version":"1.0.0"}
```

### Full Integration Check

```bash
# Test API endpoint
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test frontend
curl http://localhost:3000/ | grep -o "My Evo"
```

---

## Rollback Procedures

### Automatic Rollback (Docker Compose)

```bash
# Stop current deployment
docker-compose down

# Restore previous version
git checkout v1.0.0
docker-compose build
docker-compose up -d

# Verify rollback
curl http://localhost:3001/health
```

### Manual Rollback (Systemd)

```bash
# 1. Stop current service
sudo systemctl stop my-evo-backend
sudo systemctl stop my-evo-frontend

# 2. Restore previous binaries
sudo rm -rf /opt/my-evo/backend /opt/my-evo/frontend
sudo cp -r /opt/my-evo/backups/YYYYMMDD_HHMMSS/backend /opt/my-evo/
sudo cp -r /opt/my-evo/backups/YYYYMMDD_HHMMSS/frontend /opt/my-evo/

# 3. Restart services
sudo systemctl start my-evo-backend
sudo systemctl start my-evo-frontend

# 4. Verify
curl http://localhost:3001/health
```

### Database Rollback

**WARNING**: Only rollback database if absolutely necessary. Data loss may occur.

```bash
# 1. Create backup of current database
cp /path/to/database.db /opt/my-evo/backups/pre-rollback-$(date +%Y%m%d_%H%M%S).db

# 2. Restore previous migration
cd backend
npx prisma migrate reset --force

# 3. Restart backend
sudo systemctl restart my-evo-backend
```

### Rollback via Git Tag

```bash
# List available tags
git tag -l

# Checkout previous version
git checkout v1.0.0

# Rebuild
cd frontend && npm run build
cd ../backend && npm run build

# Redeploy
# (Follow deployment procedures above)
```

---

## Emergency Procedures

### Service Not Responding

```bash
# Check service status
sudo systemctl status my-evo-backend
sudo systemctl status my-evo-frontend

# Check logs
sudo journalctl -u my-evo-backend -n 100
sudo journalctl -u my-evo-frontend -n 100

# Check ports
lsof -i :3001
lsof -i :3000

# Restart services
sudo systemctl restart my-evo-backend
sudo systemctl restart my-evo-frontend
```

### Database Connection Failure

```bash
# Check database file/connection
ls -la backend/prisma/*.db
psql $DATABASE_URL -c "SELECT 1"

# Restart database if using Docker
docker-compose restart db

# Run migrations
cd backend && npx prisma migrate deploy
```

### High CPU/Memory Usage

```bash
# Identify process
top -o %CPU
ps aux | grep node

# Restart affected service
sudo systemctl restart my-evo-backend
```

---

## Monitoring

### Log Locations

| Service | Log Path |
|---------|----------|
| Backend (systemd) | `journalctl -u my-evo-backend` |
| Frontend (systemd) | `journalctl -u my-evo-frontend` |
| Docker | `docker-compose logs -f` |

### Metrics to Monitor

- Response time: < 500ms p95
- Error rate: < 1%
- CPU usage: < 80%
- Memory usage: < 85%
- Database connections: < 80% of pool

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | > 300ms | > 1000ms |
| Error rate | > 0.5% | > 2% |
| CPU | > 70% | > 90% |
| Memory | > 75% | > 90% |

---

## Backup & Recovery

### Database Backup

```bash
# SQLite
cp backend/prisma/dev.db /opt/my-evo/backups/$(date +%Y%m%d_%H%M%S).db

# PostgreSQL
pg_dump $DATABASE_URL > /opt/my-evo/backups/$(date +%Y%m%d_%H%M%S).sql
```

### Full Backup

```bash
tar -czf /opt/my-evo/backups/full-backup-$(date +%Y%m%d).tar.gz \
  /opt/my-evo/backend \
  /opt/my-evo/frontend \
  /opt/my-evo/database
```

### Recovery from Backup

```bash
# Stop services
sudo systemctl stop my-evo-backend
sudo systemctl stop my-evo-frontend

# Restore files
tar -xzf /opt/my-evo/backups/full-backup-YYYYMMDD.tar.gz -C /

# Restart services
sudo systemctl start my-evo-backend
sudo systemctl start my-evo-frontend
```

---

## Service Management Commands

### Systemd Units

```bash
# Start services
sudo systemctl start my-evo-backend
sudo systemctl start my-evo-frontend

# Stop services
sudo systemctl stop my-evo-backend
sudo systemctl stop my-evo-frontend

# Restart services
sudo systemctl restart my-evo-backend
sudo systemctl restart my-evo-frontend

# Check status
sudo systemctl status my-evo-backend
sudo systemctl status my-evo-frontend

# View logs
sudo journalctl -u my-evo-backend -f
sudo journalctl -u my-evo-frontend -f
```

### Docker Compose

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Scale
docker-compose up -d --scale backend=3
```

---

## Version Information

| Component | Version | Dockerfile |
|-----------|---------|------------|
| Node.js | 20+ | - |
| Next.js | 14+ | frontend/Dockerfile |
| Express | 4.x | - |
| Prisma | 5.x | - |
| TypeScript | 5.x | - |
| PostgreSQL | 15+ | - |

---

## Contact & Escalation

| Role | Contact |
|-------|---------|
| On-Call Engineer | [See PagerDuty schedule] |
| DevOps Lead | [See team directory] |
| Engineering Manager | [See team directory] |

---

## Appendix: Quick Reference

```bash
# Deploy
cd /opt/my-evo && git pull && docker-compose build && docker-compose up -d

# Rollback
git checkout <previous-tag> && docker-compose build && docker-compose up -d

# Health check
curl http://localhost:3001/health && curl http://localhost:3000/api/health

# View logs
docker-compose logs -f --tail=100

# SSH tunnel for debugging
ssh -L 3001:localhost:3001 user@server
```
