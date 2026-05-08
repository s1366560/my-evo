# My Evo Operations Guide

**Version**: 1.0.0  
**Date**: 2026-05-08  
**Applicable To**: My Evo v1.x (Backend + Frontend)

---

## Table of Contents

1. [Overview](#overview)
2. [Daily Operations](#daily-operations)
3. [Weekly Operations](#weekly-operations)
4. [Monthly Operations](#monthly-operations)
5. [Incident Response](#incident-response)
6. [Performance Tuning](#performance-tuning)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Load Balancer │────▶│  Frontend (Next)│────▶│  Backend (Express)│
│     :3000       │     │    :3000        │     │    :3001          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  PostgreSQL     │
                                              │   :5432         │
                                              └─────────────────┘
```

### Service Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Frontend | 3000 | HTTP | User-facing web application |
| Backend | 3001 | HTTP | REST API |
| PostgreSQL | 5432 | TCP | Database (production) |
| SQLite | N/A | File | Database (development) |

### Key Files

| Path | Purpose |
|------|---------|
| `backend/.env` | Backend environment configuration |
| `frontend/.env.local` | Frontend environment configuration |
| `backend/prisma/schema.prisma` | Database schema definition |
| `backend/dist/` | Compiled backend code |
| `frontend/.next/` | Next.js production build |

---

## Daily Operations

### 1. Health Check Routine

Run at shift start and end:

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== My Evo Health Check ==="
echo "Time: $(date)"
echo ""

# Backend health
echo "Backend Health:"
BACKEND=$(curl -s http://localhost:3001/health)
echo "$BACKEND" | jq '.' 2>/dev/null || echo "$BACKEND"
BACKEND_STATUS=$(echo "$BACKEND" | jq -r '.status' 2>/dev/null)

if [ "$BACKEND_STATUS" = "healthy" ]; then
  echo "✅ Backend: OK"
else
  echo "❌ Backend: FAILED"
fi
echo ""

# Frontend health
echo "Frontend Health:"
FRONTEND=$(curl -s http://localhost:3000/api/health)
echo "$FRONTEND" | jq '.' 2>/dev/null || echo "$FRONTEND"
FRONTEND_STATUS=$(echo "$FRONTEND" | jq -r '.status' 2>/dev/null)

if [ "$FRONTEND_STATUS" = "healthy" ]; then
  echo "✅ Frontend: OK"
else
  echo "❌ Frontend: FAILED"
fi
echo ""

# Database check
echo "Database Check:"
DB_STATUS=$(echo "$BACKEND" | jq -r '.services.database' 2>/dev/null)
if [ "$DB_STATUS" = "up" ]; then
  echo "✅ Database: OK"
else
  echo "❌ Database: FAILED"
fi
echo ""

# Recent errors
echo "Recent Backend Errors (last 10):"
journalctl -u my-evo-backend -p err -n 10 --no-pager 2>/dev/null || echo "No journalctl access"

echo ""
echo "=== Check Complete ==="
```

### 2. Log Review

```bash
# Backend logs - last hour
journalctl -u my-evo-backend --since "1 hour ago" --no-pager

# Error logs only
journalctl -u my-evo-backend -p err --no-pager

# Frontend logs
journalctl -u my-evo-frontend --since "1 hour ago" --no-pager

# Real-time log monitoring
journalctl -u my-evo-backend -f
```

### 3. Resource Usage Check

```bash
# CPU and Memory
top -bn1 | grep -E "node|postgres" | head -5

# Disk usage
df -h | grep -E "/$|/var"

# Backend process
ps aux | grep "node.*backend" | grep -v grep

# Port status
netstat -tlnp 2>/dev/null | grep -E "3000|3001|5432" || \
ss -tlnp 2>/dev/null | grep -E "3000|3001|5432"
```

### 4. Backup Verification

```bash
# Check last backup
ls -la /backups/ | tail -5

# Verify backup integrity
# PostgreSQL:
pg_restore --list /backups/latest.dump 2>/dev/null | head -10

# SQLite:
file /backups/*.db | head -5
```

---

## Weekly Operations

### 1. Performance Review

```bash
# Generate weekly stats
cat << 'EOF' > /tmp/weekly-stats.sh
#!/bin/bash
echo "=== Weekly Performance Summary ==="
echo "Period: Last 7 days"
echo "Generated: $(date)"
echo ""

# Request counts
echo "Request Statistics:"
# Extract from logs (adjust based on log format)
# journalctl -u my-evo-backend --since "7 days ago" | wc -l

# Error rates
echo "Error Counts:"
journalctl -u my-evo-backend -p err --since "7 days ago" --no-pager | wc -l

# Uptime
echo ""
echo "Service Uptime:"
systemctl status my-evo-backend --no-pager | grep -E "Active:|UP"
systemctl status my-evo-frontend --no-pager | grep -E "Active:|UP"

# Database size
echo ""
echo "Database Size:"
du -sh backend/prisma/*.db 2>/dev/null || echo "SQLite not in use"
EOF

bash /tmp/weekly-stats.sh
```

### 2. Security Review

```bash
# Check for failed login attempts
grep -i "invalid\|failed\|error" backend/logs/auth.log 2>/dev/null | \
  awk '{print $4}' | sort | uniq -c | sort -rn | head -10

# Review recent user registrations
# (Access via Prisma Studio or direct SQL)
# psql $DATABASE_URL -c "SELECT email, created_at FROM \"User\" ORDER BY created_at DESC LIMIT 10;"

# Check for suspicious API usage
grep "401\|403" backend/logs/*.log 2>/dev/null | wc -l
```

### 3. Dependency Updates

```bash
# Check for outdated packages
cd backend && npm outdated
cd ../frontend && npm outdated

# Security advisories
npm audit --audit-level=high
```

### 4. Backup Rotation Check

```bash
# List all backups
ls -la /backups/

# Count backups by age
find /backups -name "*.dump" -mtime -7 | wc -l   # Last 7 days
find /backups -name "*.dump" -mtime -30 | wc -l  # Last 30 days

# Verify backup destinations
du -sh /backups/* 2>/dev/null
```

---

## Monthly Operations

### 1. Disaster Recovery Test

```bash
#!/bin/bash
# disaster-recovery-test.sh

BACKUP_DIR="/backups"
TEST_DB="myevo_test"

echo "=== Disaster Recovery Test ==="
echo "WARNING: This will test backup restoration"
echo ""

# 1. Find latest backup
LATEST=$(ls -t $BACKUP_DIR/*.dump 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "ERROR: No backup found"
  exit 1
fi
echo "Using backup: $LATEST"

# 2. Create test database
# psql -c "DROP DATABASE IF EXISTS $TEST_DB;"
# psql -c "CREATE DATABASE $TEST_DB;"

# 3. Restore to test database
# pg_restore -d $TEST_DB $LATEST 2>&1 | tail -5

echo "Test restoration complete. Verify data integrity manually."
echo "Remember to clean up test database when done."
# psql -c "DROP DATABASE $TEST_DB;"
```

### 2. Capacity Planning

```bash
# Database growth trend
du -sh backend/prisma/*.db 2>/dev/null
ls -l backend/prisma/*.db 2>/dev/null

# User growth
# psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"
# psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Asset\";"

# Storage projection
# Calculate based on 30-day growth trend
```

### 3. Security Audit

```bash
# Review access logs
lastlog | head -20

# Check for unauthorized access attempts
grep -i "unauthorized\|forbidden" /var/log/*.log 2>/dev/null | tail -20

# Review firewall rules
iptables -L -n 2>/dev/null || echo "No iptables access"
```

### 4. Documentation Review

- Review and update this operations guide
- Verify contact information is current
- Update escalation procedures if needed
- Review and update monitoring thresholds

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 | Complete outage | 15 minutes | Backend down, database unavailable |
| P2 | Major degradation | 30 minutes | High error rate, slow responses |
| P3 | Minor issue | 4 hours | Non-critical feature broken |
| P4 | Low priority | 24 hours | UI glitch, cosmetic issue |

### Incident Response Procedures

#### P1: Complete Outage

```bash
# 1. Immediate triage (0-5 min)
echo "=== P1 Incident Response ==="

# Check if services are running
systemctl status my-evo-backend --no-pager
systemctl status my-evo-frontend --no-pager

# Check processes
ps aux | grep -E "node.*backend|node.*frontend" | grep -v grep

# Check ports
netstat -tlnp 2>/dev/null | grep -E "3000|3001" || ss -tlnp 2>/dev/null | grep -E "3000|3001"

# 2. Attempt restart (5-10 min)
sudo systemctl restart my-evo-backend
sudo systemctl restart my-evo-frontend

# Verify
sleep 5
curl -s http://localhost:3001/health
curl -s http://localhost:3000/api/health

# 3. If restart fails, check logs
journalctl -u my-evo-backend -n 50 --no-pager
journalctl -u my-evo-frontend -n 50 --no-pager

# 4. If database issue
systemctl status postgresql 2>/dev/null || echo "PostgreSQL not managed by systemd"
pg_isready 2>/dev/null || echo "Database not responding"
```

#### P2: High Error Rate

```bash
# 1. Check error logs
journalctl -u my-evo-backend -p err --since "30 minutes ago" --no-pager

# 2. Check system resources
top -bn1 | head -20
free -h
df -h

# 3. Check database connections
# psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 4. Restart if needed
sudo systemctl restart my-evo-backend

# 5. Monitor improvement
watch -n 5 "curl -s http://localhost:3001/health"
```

#### Rollback Procedure

```bash
#!/bin/bash
# emergency-rollback.sh

echo "=== Emergency Rollback ==="

# 1. Identify issue
echo "Current version:"
git describe --tags

# 2. Find previous stable version
echo ""
echo "Available tags:"
git tag -l | sort -V | tail -5

# 3. Rollback
PREV_TAG=$(git tag -l | sort -V | tail -2 | head -1)
echo ""
read -p "Rollback to $PREV_TAG? (yes/no): " confirm

if [ "$confirm" = "yes" ]; then
  git checkout $PREV_TAG
  
  # Rebuild
  cd backend && npm install && npm run build
  cd ../frontend && npm install && npm run build
  
  # Restart
  sudo systemctl restart my-evo-backend
  sudo systemctl restart my-evo-frontend
  
  echo "Rollback complete to $PREV_TAG"
fi
```

---

## Performance Tuning

### Backend Tuning

```typescript
// backend/src/config/index.ts
export const config = {
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
  },
  // Increase timeout for heavy operations
  timeout: 30000, // 30 seconds
};
```

### Database Tuning (PostgreSQL)

```sql
-- Check current connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Connection pool settings (in prisma schema or connection string)
-- ?connection_limit=10&pool_timeout=10
```

### Frontend Performance

```javascript
// frontend/next.config.js
module.exports = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};
```

---

## Troubleshooting

### Common Issues

#### 1. Backend Won't Start

```bash
# Check port conflict
lsof -i :3001 2>/dev/null || netstat -tlnp 2>/dev/null | grep 3001

# Check for missing dependencies
cd backend && npm install

# Check Prisma
cd backend && npx prisma generate
npx prisma migrate status

# Check logs
journalctl -u my-evo-backend -n 100 --no-pager
```

#### 2. Database Connection Error

```bash
# SQLite
ls -la backend/prisma/*.db
file backend/prisma/dev.db

# PostgreSQL
pg_isready -h localhost -p 5432
psql $DATABASE_URL -c "SELECT 1"

# Check connection string
grep DATABASE_URL backend/.env
```

#### 3. CORS Errors

```bash
# Verify CORS origin
grep CORS_ORIGIN backend/.env

# Test CORS headers
curl -I -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:3001/health
```

#### 4. High Memory Usage

```bash
# Find memory leak
node --inspect backend/dist/index.js
# Use Chrome DevTools for heap profiling

# Check for memory-intensive operations
ps aux --sort=-%mem | head -10

# Restart service
sudo systemctl restart my-evo-backend
```

#### 5. Slow API Responses

```bash
# Check database queries
# psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check connection pool
# psql $DATABASE_URL -c "SHOW max_connections;"

# Restart backend
sudo systemctl restart my-evo-backend
```

### Diagnostic Commands

```bash
# Full system health
cat << 'EOF'
=== Full Diagnostic Report ===
Time: $(date)

--- Service Status ---
Backend: $(systemctl is-active my-evo-backend)
Frontend: $(systemctl is-active my-evo-frontend)

--- Network ---
$(netstat -tlnp 2>/dev/null | grep -E "3000|3001|5432" || ss -tlnp 2>/dev/null | grep -E "3000|3001|5432")

--- Resources ---
$(top -bn1 | head -5)
$(free -h)

--- Recent Errors ---
$(journalctl -p err -n 5 --no-pager 2>/dev/null)
EOF
```

---

## Appendix: Service Management Reference

### Systemd Units

#### Backend Service (my-evo-backend.service)

```ini
[Unit]
Description=My Evo Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=myevo
WorkingDirectory=/opt/my-evo/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### Frontend Service (my-evo-frontend.service)

```ini
[Unit]
Description=My Evo Frontend
After=network.target

[Service]
Type=simple
User=myevo
WorkingDirectory=/opt/my-evo/frontend
ExecStart=/usr/bin/node_modules/.bin/next start -p 3000
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Quick Reference Commands

```bash
# View all logs
journalctl -u my-evo-backend -u my-evo-frontend -f

# Restart all services
sudo systemctl restart my-evo-backend my-evo-frontend

# Check all status
systemctl status my-evo-backend my-evo-frontend

# Reload systemd
sudo systemctl daemon-reload
```

---

**Document Owner**: DevOps Team  
**Review Schedule**: Monthly  
**Last Updated**: 2026-05-08
