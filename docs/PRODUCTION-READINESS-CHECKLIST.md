# My Evo Production Readiness Checklist

**Version**: 1.0.0  
**Date**: 2026-05-08  
**Status**: Ready for Production

---

## 1. Environment Variables Checklist

### Backend (backend/.env)

| Variable | Required | Current Status | Production Value | Notes |
|----------|----------|----------------|------------------|-------|
| `DATABASE_URL` | Yes | `file:./dev.db` | `postgresql://user:pass@host:5432/myevo` | Use PostgreSQL in production |
| `JWT_SECRET` | Yes | `test-secret-123` | Generate 64+ char random string | CRITICAL - Use secrets manager |
| `JWT_EXPIRES_IN` | Yes | `7d` | `7d` | Keep as is or adjust |
| `PORT` | Yes | `3001` | `3001` | Keep as is |
| `NODE_ENV` | Yes | `development` | `production` | Must be production |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | `https://your-domain.com` | Exact production URL |
| `RATE_LIMIT_WINDOW_MS` | Yes | `60000` | `60000` | Keep as is |
| `RATE_LIMIT_MAX_REQUESTS` | Yes | `100` | `100` | Adjust based on load |
| `GDI_API_KEY` | No | `` | `` | Optional AI service |
| `GDI_API_URL` | No | `` | `` | Optional AI service |

### Frontend (frontend/.env.local)

| Variable | Required | Current Status | Production Value | Notes |
|----------|----------|----------------|------------------|-------|
| `NEXT_PUBLIC_API_URL` | Yes | `/api/frontend` | `/api/frontend` | Keep relative path |
| `BACKEND_URL` | Yes | `http://localhost:3001` | `http://localhost:3001` | Internal backend URL |

### Verification Commands

```bash
# Check backend env variables
cd /workspace/my-evo/backend
grep -v '^#' .env | grep -v '^$'

# Verify NODE_ENV is production
grep NODE_ENV .env
# Expected: NODE_ENV="production"

# Verify JWT_SECRET is strong (min 32 chars)
awk -F'=' '/JWT_SECRET/ {print length($2)}' .env
# Expected: > 32
```

---

## 2. Secrets Management Checklist

### 2.1 Secret Generation

- [ ] Generate strong JWT_SECRET (64+ characters)
- [ ] Store DATABASE_URL credentials securely
- [ ] Generate unique CORS_ORIGIN for production domain
- [ ] Rotate any test credentials

### 2.2 Secret Storage

| Secret | Storage Location | Rotation Policy |
|--------|-----------------|-----------------|
| JWT_SECRET | HashiCorp Vault / AWS Secrets Manager | Every 90 days |
| DATABASE_URL | Environment variable from secrets manager | On credential rotation |
| GDI_API_KEY | Environment variable from secrets manager | As needed |

### 2.3 Production .env Template

Create `backend/.env.production`:

```bash
# Database - PostgreSQL recommended for production
DATABASE_URL="postgresql://PROD_USER:CHANGE_ME@localhost:5432/myevo"

# JWT - MUST be unique and strong (min 64 chars)
JWT_SECRET="YOUR_64_PLUS_CHAR_SECRET_HERE"

# Server
PORT=3001
NODE_ENV="production"

# CORS - Exact production domain
CORS_ORIGIN="https://myevo.your-domain.com"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Optional AI Services
# GDI_API_KEY=""
# GDI_API_URL=""
```

### 2.4 Secret Verification Commands

```bash
# Verify no secrets in git
git log --all --full-history -S "test-secret" -- .env

# Check for accidental commits
grep -r "secret" backend/.env --include="*.git"

# Verify .gitignore excludes .env files
grep -E "\.env$|\.env\." .gitignore
```

---

## 3. Monitoring Setup Checklist

### 3.1 Health Check Endpoints

| Endpoint | URL | Expected Response |
|----------|-----|-------------------|
| Backend Health | `http://localhost:3001/health` | `{"status":"healthy",...}` |
| Frontend Health | `http://localhost:3000/api/health` | `{"status":"healthy",...}` |

### 3.2 Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold | Collection Method |
|--------|-------------------|-------------------|-------------------|
| Response Time (p95) | > 300ms | > 1000ms | APM tool |
| Error Rate | > 0.5% | > 2% | Log aggregation |
| CPU Usage | > 70% | > 90% | System monitoring |
| Memory Usage | > 75% | > 90% | System monitoring |
| Database Connections | > 70% | > 85% | Database monitoring |
| Request Rate | - | - | API gateway logs |

### 3.3 Log Collection

| Log Type | Location | Retention | Format |
|----------|----------|-----------|--------|
| Backend Express | stdout/stderr | 30 days | JSON |
| Frontend Next.js | stdout/stderr | 30 days | JSON |
| Database | Database server | 90 days | SQL |
| System | /var/log/syslog | 30 days | Text |

### 3.4 Monitoring Tools Recommended

- [ ] **APM**: New Relic, Datadog, or Sentry
- [ ] **Log Aggregation**: ELK Stack, Loki, or CloudWatch
- [ ] **Uptime Monitoring**: UptimeRobot, Pingdom
- [ ] **Error Tracking**: Sentry, Bugsnag
- [ ] **Database Monitoring**: pg_stat_statements, PMM

### 3.5 Health Check Script

```bash
#!/bin/bash
# health-check.sh - Run periodic health checks

BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"

# Check backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $BACKEND_URL/health)
if [ "$BACKEND_STATUS" != "200" ]; then
  echo "ALERT: Backend health check failed (HTTP $BACKEND_STATUS)"
  # Send alert here
fi

# Check frontend proxy
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $FRONTEND_URL/api/health)
if [ "$FRONTEND_STATUS" != "200" ]; then
  echo "ALERT: Frontend health check failed (HTTP $FRONTEND_STATUS)"
  # Send alert here
fi

echo "Health check completed: Backend=$BACKEND_STATUS, Frontend=$FRONTEND_STATUS"
```

---

## 4. Backup Procedures Checklist

### 4.1 Database Backup

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Full Database | Daily | 30 days | Off-site |
| Transaction Logs | Every 15 min | 7 days | Local |
| Point-in-time | Continuous | 30 days | Off-site |

### 4.2 Backup Commands

```bash
# PostgreSQL Full Backup
pg_dump -U myevo_user -d myevo_db -F c -f /backups/myevo_$(date +%Y%m%d_%H%M%S).dump

# SQLite Full Backup (development)
cp backend/prisma/dev.db /backups/myevo_$(date +%Y%m%d_%H%M%S).db

# Incremental Backup (PostgreSQL)
pg_basebackup -U replication_user -D /backups/incremental_$(date +%Y%m%d) -Ft -z -P
```

### 4.3 Backup Verification

- [ ] Automated backup schedule configured
- [ ] Backup encryption enabled
- [ ] Backup restoration tested quarterly
- [ ] Backup monitoring alerts configured
- [ ] Off-site backup replication working

### 4.4 Backup Script

```bash
#!/bin/bash
# backup.sh - Automated backup script

BACKUP_DIR="/backups"
RETENTION_DAYS=30

# Create backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/myevo_$TIMESTAMP.dump"

pg_dump -U myevo_user -d myevo_db -F c -f "$BACKUP_FILE"

# Encrypt backup
# gpg --encrypt --recipient $GPG_KEY $BACKUP_FILE

# Upload to off-site storage
# aws s3 cp "$BACKUP_FILE" s3://myevo-backups/

# Clean old backups
find $BACKUP_DIR -name "myevo_*.dump" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_FILE"
```

---

## 5. Rollback Plan Checklist

### 5.1 Pre-Deployment Rollback Preparation

- [ ] Git tags created for release versions
- [ ] Previous deployment packages archived
- [ ] Database migrations tested for reversibility
- [ ] Rollback procedure documented and tested
- [ ] Communication plan ready for stakeholders

### 5.2 Rollback Triggers

| Scenario | Trigger Condition | Automatic Rollback |
|----------|-------------------|-------------------|
| Health Check Failure | 3 consecutive failures | Yes (if configured) |
| Error Rate Spike | > 5% errors for 5 min | No |
| Performance Degradation | p99 > 5s for 10 min | No |
| Database Connection Failure | 5 consecutive failures | No |

### 5.3 Rollback Procedures

#### Quick Rollback (Git Tag)

```bash
# 1. Identify current and previous versions
git tag -l | sort -V

# 2. Checkout previous version
git checkout v1.0.0

# 3. Rebuild backend
cd backend && npm install && npm run build

# 4. Rebuild frontend  
cd ../frontend && npm install && npm run build

# 5. Restart services
sudo systemctl restart my-evo-backend
sudo systemctl restart my-evo-frontend

# 6. Verify
curl http://localhost:3001/health
```

#### Database Rollback (if needed)

```bash
# WARNING: Data loss may occur

# 1. Stop backend
sudo systemctl stop my-evo-backend

# 2. Backup current database
pg_dump -U myevo_user -d myevo_db -f /backups/pre-rollback-$(date +%Y%m%d).sql

# 3. Restore previous backup
pg_restore -U myevo_user -d myevo_db -c /backups/myevo_previous.dump

# 4. Restart backend
sudo systemctl start my-evo-backend
```

### 5.4 Feature Flag Rollback

For granular control, implement feature flags:

```typescript
// frontend/src/config/featureFlags.ts
export const featureFlags = {
  enableNewMapRenderer: process.env.NEXT_PUBLIC_FLAG_NEW_MAP === 'true',
  enableGDIPreview: process.env.NEXT_PUBLIC_FLAG_GDI === 'true',
};
```

---

## 6. Security Checklist

### 6.1 Authentication & Authorization

- [ ] JWT_SECRET strong (64+ chars) and stored securely
- [ ] JWT expiration set appropriately (7d recommended)
- [ ] Password hashing uses bcrypt (cost factor 12+)
- [ ] Rate limiting configured and tested
- [ ] CORS properly configured for production domain

### 6.2 Data Protection

- [ ] Database credentials not in version control
- [ ] Sensitive data encrypted at rest (PostgreSQL)
- [ ] TLS/SSL configured for all connections
- [ ] API keys and secrets use environment variables
- [ ] CSRF protection enabled

### 6.3 API Security

- [ ] Input validation on all endpoints (Zod schemas)
- [ ] SQL injection prevention (Prisma ORM)
- [ ] XSS protection (helmet middleware)
- [ ] Rate limiting on auth endpoints
- [ ] API versioning in place

### 6.4 Security Headers (helmet)

```typescript
// backend/src/index.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
}));
```

---

## 7. Deployment Checklist

### 7.1 Pre-Deployment

- [ ] All tests passing (`npm test` in backend)
- [ ] Build successful (`npm run build` in both packages)
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Secrets loaded from secrets manager
- [ ] Backup completed
- [ ] Monitoring dashboards accessible

### 7.2 Deployment Steps

```bash
# 1. Create deployment tag
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0

# 2. Pull on production server
cd /opt/my-evo
git pull origin main
git checkout v1.1.0

# 3. Install dependencies
cd backend && npm install --production
cd ../frontend && npm install --production

# 4. Build
cd backend && npm run build
cd ../frontend && npm run build

# 5. Run migrations
cd backend && npx prisma migrate deploy

# 6. Restart services
sudo systemctl restart my-evo-backend
sudo systemctl restart my-evo-frontend

# 7. Health check
curl http://localhost:3001/health
curl http://localhost:3000/api/health
```

### 7.3 Post-Deployment

- [ ] Smoke tests passed
- [ ] Error rates normal
- [ ] Response times acceptable
- [ ] Logs reviewed for warnings/errors
- [ ] Monitoring alerts verified
- [ ] Stakeholders notified

---

## 8. Verification Commands Summary

```bash
# Environment Check
grep NODE_ENV backend/.env  # Should be production
[ ${#JWT_SECRET} -ge 64 ] && echo "JWT_SECRET OK" || echo "JWT_SECRET TOO SHORT"

# Build Check
cd backend && npm run build && echo "Backend build OK"
cd ../frontend && npm run build && echo "Frontend build OK"

# Health Check
curl -s http://localhost:3001/health | jq .status  # Should be "healthy"
curl -s http://localhost:3000/api/health | jq .status  # Should be "healthy"

# Test Suite
cd backend && npm test -- --passWithNoTests

# Security Check
npx npm-audit  # Check for vulnerabilities
```

---

## Appendix: Quick Reference Card

| Item | Command/Location |
|------|------------------|
| Backend Health | `curl http://localhost:3001/health` |
| Frontend Health | `curl http://localhost:3000/api/health` |
| Backend Logs | `journalctl -u my-evo-backend -f` |
| Frontend Logs | `journalctl -u my-evo-frontend -f` |
| Restart Backend | `sudo systemctl restart my-evo-backend` |
| Restart Frontend | `sudo systemctl restart my-evo-frontend` |
| Database Connect | `psql $DATABASE_URL` |
| Rollback (Git) | `git checkout <tag> && npm run build && systemctl restart` |

---

**Document Owner**: DevOps Team  
**Review Schedule**: Monthly  
**Last Review**: 2026-05-08


## 1. Environment Variables

### 1.1 Required Environment Variables

| Variable | Required | Default | Description | Security Level |
|----------|----------|---------|-------------|---------------|
| `DATABASE_URL` | Yes | - | SQLite/PostgreSQL connection string | **Critical** |
| `JWT_SECRET` | Yes | - | Secret key for JWT signing (min 32 chars) | **Critical** |
| `NODE_ENV` | Yes | development | Runtime environment | Non-sensitive |
| `PORT` | No | 3001 | Backend API port | Non-sensitive |

### 1.2 Optional Environment Variables

| Variable | Required | Default | Description | Security Level |
|----------|----------|---------|-------------|---------------|
| `CORS_ORIGIN` | No | * | Allowed CORS origins (comma-separated) | Sensitive |
| `RATE_LIMIT_WINDOW` | No | 15 | Rate limit window in minutes | Non-sensitive |
| `RATE_LIMIT_MAX` | No | 100 | Max requests per window | Non-sensitive |
| `LOG_LEVEL` | No | info | Logging level (debug, info, warn, error) | Non-sensitive |
| `REDIS_URL` | No | - | Redis connection for caching | Sensitive |
| `GDI_API_KEY` | No | - | GDI scoring API key | **Critical** |

### 1.3 Pre-Deployment Verification

```bash
# Verify all required env vars are set
cd backend && cat .env | grep -E "DATABASE_URL|JWT_SECRET"

# Check JWT_SECRET strength (minimum 32 characters)
openssl rand -base64 32

# Verify NODE_ENV is production
echo $NODE_ENV  # Should output: production
```

---

## 2. Secrets Management

### 2.1 Secret Classification

| Level | Description | Examples |
|-------|-------------|----------|
| **Critical** | Must never be committed or exposed | `JWT_SECRET`, `DATABASE_URL` |
| **Sensitive** | Should use secrets manager | `CORS_ORIGIN`, `REDIS_URL` |
| **Non-sensitive** | Can be in config files | `PORT`, `LOG_LEVEL` |

### 2.2 Secret Storage Options

#### Option A: Environment Files (Development/Staging)

```bash
# Create .env.production
cp backend/.env.example backend/.env.production
# Edit with production values
nano backend/.env.production
```

#### Option B: Docker Secrets (Docker Swarm)

```yaml
# docker-compose.prod.yml
secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  database_url:
    file: ./secrets/database_url.txt
```

#### Option C: Kubernetes Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: myevo-secrets
type: Opaque
stringData:
  JWT_SECRET: "your-production-secret"
  DATABASE_URL: "postgresql://user:pass@host:5432/myevo"
```

#### Option D: Cloud Secrets Manager

| Provider | Service |
|----------|---------|
| AWS | Secrets Manager / Parameter Store |
| GCP | Secret Manager |
| Azure | Key Vault |

### 2.3 Secret Rotation Policy

| Secret | Rotation Frequency | Procedure |
|--------|--------------------|-----------|
| `JWT_SECRET` | Every 90 days | Reissue all tokens |
| `DATABASE_URL` | Every 180 days | Update connection string |
| `GDI_API_KEY` | Every 365 days | Regenerate API key |

### 2.4 Pre-Deployment Verification

```bash
# Verify .env files are in .gitignore
cat backend/.gitignore | grep -E "\.env"

# Verify no secrets in git history
git log --all --source --remotes -- .env  # Should return nothing
```

---

## 3. Monitoring Setup

### 3.1 Health Check Endpoints

| Endpoint | Method | Purpose | Expected Response |
|----------|--------|---------|------------------|
| `/health` | GET | Basic health check | `{"status":"healthy","timestamp":"..."}` |
| `/health/detailed` | GET | Deep health check | Full system status |
| `/ready` | GET | Kubernetes readiness | `{"ready":true}` |
| `/live` | GET | Kubernetes liveness | `{"alive":true}` |

### 3.2 Health Check Verification

```bash
# Basic health
curl http://localhost:3001/health

# Detailed health
curl http://localhost:3001/health/detailed

# Kubernetes probes
curl http://localhost:3001/ready
curl http://localhost:3001/live
```

### 3.3 Monitoring Metrics

| Metric | Alert Threshold | Action Required |
|--------|----------------|-----------------|
| API Response Time (p95) | > 2000ms | Scale up instances |
| API Error Rate | > 1% | Investigate errors |
| Memory Usage | > 85% | Restart pod |
| Database Latency | > 500ms | Optimize queries |
| Health Check Failures | > 0 | Page on-call |

### 3.4 Logging Configuration

| Environment | Log Format | Log Level |
|-------------|------------|-----------|
| Development | Pretty text | debug |
| Staging | JSON | info |
| Production | JSON | warn |

### 3.5 Monitoring Tools Integration

| Tool | Integration Method |
|------|-------------------|
| Prometheus | Scrape `/metrics` endpoint |
| Grafana | Import dashboard JSON |
| Datadog | Agent + custom metrics |
| CloudWatch | CloudWatch Agent |

---

## 4. Backup Procedures

### 4.1 Database Backup

#### SQLite Backup

```bash
# Create backup directory
mkdir -p /backups/myevo

# Backup SQLite database
cp backend/prisma/dev.db /backups/myevo/backup-$(date +%Y%m%d-%H%M%S).db

# Compress backup
gzip /backups/myevo/backup-$(date +%Y%m%d-%H%M%S).db
```

#### PostgreSQL Backup (Production)

```bash
# Full backup
pg_dump -Fc myevo > /backups/myevo/full-backup-$(date +%Y%m%d).dump

# Incremental backup (requires WAL)
pg_basebackup -Ft -D /backups/myevo/incremental-$(date +%Y%m%d)
```

### 4.2 Backup Schedule

| Backup Type | Frequency | Retention |
|-------------|-----------|-----------|
| Full Database | Daily | 30 days |
| Incremental | Every 6 hours | 7 days |
| Configuration | Weekly | 90 days |
| Disaster Recovery | Monthly | 1 year |

### 4.3 Backup Verification

```bash
# Verify backup integrity (SQLite)
sqlite3 /backups/myevo/backup-*.db "PRAGMA integrity_check;"

# Verify backup integrity (PostgreSQL)
pg_restore --dbname=myevo_test /backups/myevo/full-backup-*.dump
```

### 4.4 Offsite Backup

| Provider | Service | Use Case |
|----------|---------|----------|
| AWS S3 | Cross-region replication | Critical data |
| Google Cloud Storage | Multi-region storage | Disaster recovery |
| Azure Blob | Geo-redundant storage | Compliance |

---

## 5. Rollback Plan

### 5.1 Application Rollback

#### Docker/Kubernetes

```bash
# Docker: Redeploy previous image
docker pull myevo/backend:previous-version
docker-compose -f docker-compose.prod.yml up -d

# Kubernetes: Rollback deployment
kubectl rollout undo deployment/myevo-api
kubectl rollout undo deployment/myevo-frontend

# Verify rollback
curl http://api.example.com/health
```

#### Manual Deployment

```bash
# Stop current service
pm2 stop myevo-backend

# Restore previous version
git checkout v1.2.3
npm run build
pm2 start myevo-backend

# Verify
curl http://localhost:3001/health
```

### 5.2 Database Rollback

```bash
# SQLite: Restore from backup
cp /backups/myevo/backup-20260508.db backend/prisma/dev.db

# PostgreSQL: Revert migration
npx prisma migrate revert

# PostgreSQL: Restore from backup
pg_restore --dbname=myevo /backups/myevo/full-backup-*.dump
```

### 5.3 Rollback Decision Matrix

| Scenario | Action | Time Limit |
|----------|--------|------------|
| Health check failure | Immediate rollback | 5 minutes |
| >5% error rate spike | Rollback if not resolved | 15 minutes |
| Performance degradation | Investigate first | 30 minutes |
| Data corruption | Full rollback | 1 hour |

### 5.4 Rollback Communication

```bash
# Slack notification template
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"⚠️ My Evo Rollback Initiated\nReason: <reason>\nVersion: <from> -> <to>\nStarted: <timestamp>"}' \
  $SLACK_WEBHOOK_URL
```

---

## 6. Deployment Checklist

### 6.1 Pre-Deployment (All items must be checked)

- [ ] All tests passing (`npm test` - 64/64)
- [ ] Health checks returning 200
- [ ] `/ready` endpoint returns `ready: true`
- [ ] All required env vars configured
- [ ] `JWT_SECRET` changed from default
- [ ] Database migrations applied
- [ ] No secrets in git repository
- [ ] CORS origin set correctly
- [ ] Rate limits configured
- [ ] Log level set to production
- [ ] Backup completed
- [ ] Monitoring alerts configured
- [ ] Rollback plan reviewed

### 6.2 Deployment Steps

```bash
# 1. Create backup
./scripts/backup.sh

# 2. Run database migrations
cd backend && npm run prisma:migrate

# 3. Build production assets
cd frontend && npm run build
cd backend && npm run build

# 4. Deploy backend
pm2 restart myevo-backend

# 5. Deploy frontend
pm2 restart myevo-frontend

# 6. Verify deployment
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### 6.3 Post-Deployment Verification

- [ ] All health checks pass
- [ ] User authentication working
- [ ] Core business flows tested
- [ ] Error rate normal
- [ ] Response times normal
- [ ] No new errors in logs

### 6.4 Post-Deployment Monitoring (First 24 hours)

| Time | Check |
|------|-------|
| 5 minutes | Health checks stable |
| 15 minutes | Error rate < 0.1% |
| 1 hour | Response times normal |
| 6 hours | No memory leaks |
| 24 hours | All metrics normal |

---

## 7. Sign-Off

### Pre-Production Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Lead | | | |
| DevOps | | | |
| Security | | | |
| Product Owner | | | |

### Post-Production Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| On-Call Engineer | | | |
| QA Lead | | | |
| DevOps | | | |

---

**Document Version**: 1.0
**Last Updated**: 2026-05-08
**Next Review**: Before next release
**Owner**: DevOps Team
