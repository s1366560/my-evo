# Production Monitoring Setup Guide

Production-grade monitoring for EvoMap Hub: performance metrics, error tracking, user behavior analytics, and automated alerting.

---

## Architecture Overview

```
Request Lifecycle → Fastify Hooks → Monitoring Middleware → In-Memory Buffer
                                                              ↓
                                                    Alert Rules Engine
                                                              ↓
                                              ┌───────────────┼───────────────┐
                                         Metrics API    Alerts API    Analytics API
                                         /api/v2/       /api/v2/       /api/v2/
                                         monitoring/    monitoring/    monitoring/
```

### Four Pillars

| Pillar | What it tracks | Key metrics |
|---|---|---|
| **Performance** | HTTP latency, throughput, slow requests | `http.response_time_ms`, `http.requests.total`, `http.slow_requests` |
| **Error Tracking** | 5xx errors, validation errors, circuit breakers | `http.errors`, `http.5xx_count`, `manual` |
| **User Analytics** | Page views, API calls, searches, asset publishes | `page_view`, `api_call`, `search`, `asset_publish` |
| **Alerting Rules** | Threshold-based rules with cooldown | 8 default rules (configurable) |

---

## Quick Start

### 1. Environment Variables

Copy `.env.production.example` → `.env.production` and configure:

```bash
# Required
NODE_ENV=production

# Optional: Prometheus pushgateway
PROMETHEUS_PUSHGATEWAY_URL=http://localhost:9091
PROMETHEUS_PUSHGATEWAY_JOB=evomap_hub

# Optional: DataDog
DATADOG_ENABLED=true
DATADOG_API_KEY=your_datadog_api_key

# Optional: Sentry error tracking
SENTRY_DSN=https://example@sentry.io/project

# Optional: Alert webhook (fires on critical alerts)
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
ALERT_WEBHOOK_SECRET=optional_hmac_secret

# Optional: Grafana Loki
GRAFANA_LOKI_URL=http://localhost:3100
GRAFANA_LOKI_TOKEN=your_loki_token
```

### 2. Start the Server

```bash
npm run build
npm start
```

### 3. Verify

```bash
# Health check
curl http://localhost:3001/api/v2/monitoring/health

# Dashboard metrics
curl http://localhost:3001/api/v2/monitoring/dashboard/metrics

# Recent metrics
curl http://localhost:3001/api/v2/monitoring/metrics?limit=10

# Active alerts
curl http://localhost:3001/api/v2/monitoring/alerts
```

---

## API Reference

### Health Check

```
GET /api/v2/monitoring/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "database": { "status": "up", "latency_ms": 2 },
      "redis": { "status": "up", "message": "redis is configured; active connectivity probe is not enabled" },
      "queue": { "status": "up", "message": "queue is not configured" }
    },
    "uptime_seconds": 3600,
    "version": "1.0.0"
  }
}
```

### Dashboard Metrics

```
GET /api/v2/monitoring/dashboard/metrics
```

Returns: node counts, swarm counts, asset stats, credit totals, performance metrics (avg response time, requests/min, error rate), top users, top routes.

### Query Metrics

```
GET /api/v2/monitoring/metrics?names=http.response_time_ms,http.errors&start=2026-04-29T00:00:00Z
```

### Record a Metric

```
POST /api/v2/monitoring/metrics
Content-Type: application/json

{ "name": "custom.metric", "value": 42, "labels": { "env": "prod" } }
```

### Alerts

```
GET  /api/v2/monitoring/alerts?severity=critical&limit=20
GET  /api/v2/monitoring/alerts/stats
POST /api/v2/monitoring/alerts/:alertId/acknowledge
POST /api/v2/monitoring/alerts/:alertId/resolve
POST /api/v2/monitoring/alerts/trigger
```

Trigger example:
```json
POST /api/v2/monitoring/alerts/trigger
{ "name": "Disk Space Low", "severity": "critical", "message": "Disk above 95%", "metric_name": "disk.usage", "metric_value": 96 }
```

### Alert Rules

```
GET  /api/v2/monitoring/alerts/rules
PATCH /api/v2/monitoring/alerts/rules/:ruleId
```

Example update (disable a rule):
```json
PATCH /api/v2/monitoring/alerts/rules/high-error-rate
{ "enabled": false }
```

### User Analytics

```
GET /api/v2/monitoring/analytics/summary?window=24
GET /api/v2/monitoring/analytics/actions?event_type=error&user_id=user-1&limit=50
POST /api/v2/monitoring/analytics/track
```

Track example:
```json
POST /api/v2/monitoring/analytics/track
{
  "event_type": "asset_publish",
  "user_id": "user-1",
  "asset_id": "asset-xyz",
  "metadata": { "route": "/a2a/publish", "method": "POST" },
  "duration_ms": 450
}
```

---

## Default Alert Rules

| ID | Name | Metric | Condition | Severity | Cooldown |
|---|---|---|---|---|---|
| `high-error-rate` | High Error Rate | `http.error_rate` | > 5% | critical | 5 min |
| `slow-response` | Slow Response Time | `http.response_time_ms.avg` | > 2000ms | warning | 5 min |
| `high-latency-p99` | High P99 Latency | `http.response_time_ms.p99` | > 5000ms | critical | 10 min |
| `node-offline-spike` | Node Offline Spike | `node.offline_percent` | > 20% | warning | 15 min |
| `quarantine-surge` | Quarantine Surge | `quarantine.active_count` | > 10 | critical | 10 min |
| `low-credits` | Low System Credits | `credits.total` | < 1000 | info | 60 min |
| `api-rate-limit` | API Rate Limit Hit | `http.rate_limited` | > 100/min | warning | 5 min |
| `search-latency` | Search Latency High | `http.response_time_ms.search` | > 3000ms | warning | 5 min |

---

## Automatic Metrics Captured

The monitoring middleware (`src/monitoring/middleware.ts`) automatically hooks into Fastify's request lifecycle:

### onRequest Hook
- Records `http.requests.total` with method, normalized path
- Stores request start time for latency calculation

### onResponse Hook
- Records `http.response_time_ms` with method, path, status code
- Records `http.response_time_ms.search` for search endpoints
- Records `http.slow_requests` for requests > 2 seconds
- Tracks user action via `trackUserAction()`

### onError Hook
- Records `http.errors` with error type and path
- Triggers critical alert for 5xx errors

### Global Error Handler (app.ts)
- Records `http.errors` metric for all handled errors
- Triggers `5xx Server Error` alert for server errors

---

## Performance Metrics

### Response Time Stats

```
GET /api/v2/monitoring/metrics/stats
```

Returns:
```json
{
  "success": true,
  "data": {
    "avg": 150,
    "p50": 120,
    "p90": 280,
    "p99": 950,
    "count": 1542
  }
}
```

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|---|---|---|
| `http.response_time_ms.avg` | 5-minute rolling average | > 2000ms |
| `http.response_time_ms.p99` | 99th percentile | > 5000ms |
| `http.error_rate` | Errors / total requests % | > 5% |
| `http.slow_requests` | Requests > 2s per 5 min | > 50 |
| `node.offline_percent` | Offline / total nodes % | > 20% |
| `quarantine.active_count` | Active quarantines | > 10 |

---

## User Behavior Analytics

### Event Types

| Event | Description | Auto-tracked |
|---|---|---|
| `api_call` | Any HTTP request | Yes (via middleware) |
| `search` | Search requests | Yes |
| `asset_publish` | Asset publication | Yes |
| `asset_purchase` | Asset purchase | Via manual track |
| `swarm_join` | Swarm participation | Via manual track |
| `node_register` | Node registration | Via manual track |
| `error` | Client/server error | Yes |
| `quarantine` | Node quarantine event | Via manual track |
| `gdi_update` | GDI score update | Via manual track |
| `page_view` | Page navigation | Via manual track |

---

## External Integrations

### Prometheus Pushgateway

Enable metrics export to Prometheus:

```bash
# Start pushgateway
docker run -d -p 9091:9091 prom/pushgateway

# Set env var
PROMETHEUS_PUSHGATEWAY_URL=http://localhost:9091
METRICS_EXPORT_INTERVAL_MS=30000
```

Then call `flushMetrics(state)` in a scheduled job to push to the gateway.

### DataDog

```bash
DATADOG_ENABLED=true
DATADOG_API_KEY=your_key
DATADOG_APP_KEY=your_app_key
```

Install: `npm install dd-trace --save`

### Sentry

```bash
SENTRY_DSN=https://example@sentry.io/project
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Install: `npm install @sentry/node --save`

```typescript
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
});

// Wrap Fastify with Sentry error handler
// (Fastify error handler in app.ts already records to monitoring)
```

### Alert Webhook

For critical alerts, set `ALERT_WEBHOOK_URL` to POST alert payloads:

```typescript
// In a background job or alert rule callback:
const payload = {
  alert: {
    id: alert.id,
    name: alert.name,
    severity: alert.severity,
    message: alert.message,
    triggered_at: alert.triggered_at,
    metric_name: alert.metric_name,
    metric_value: alert.metric_value,
  },
  environment: process.env.NODE_ENV,
  service: 'evomap-hub',
};
await fetch(process.env.ALERT_WEBHOOK_URL!, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

---

## Docker / Production Deployment

### Docker Compose (Recommended)

```yaml
version: '3.8'
services:
  app:
    build: .
    env_file: .env.production
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: evomap
      POSTGRES_USER: evomap
      POSTGRES_PASSWORD: CHANGEME
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

  # Optional: Prometheus + Grafana
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3002:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    restart: unless-stopped

  # Optional: Pushgateway for Prometheus
  pushgateway:
    image: prom/pushgateway:latest
    ports:
      - "9091:9091"
    restart: unless-stopped

volumes:
  postgres_data:
```

### Kubernetes

Key annotations for Prometheus scraping:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3001"
  prometheus.io/path: "/api/v2/monitoring/metrics"
```

### PM2 (Single Server)

```bash
npm install -g pm2
pm2 start dist/index.js --name evomap-hub
pm2 save
pm2 startup
```

---

## Grafana Dashboard Setup

### Import JSON Dashboard

1. Go to Grafana → Dashboards → Import
2. Paste dashboard JSON (see `grafana-dashboard.json` in this directory)
3. Select Prometheus data source
4. Dashboard shows:
   - Request rate (req/min)
   - Error rate (%)
   - Response time (avg, p50, p90, p99)
   - Active alerts by severity
   - Top 10 slow endpoints
   - Node health (online/offline/quarantined)

### Prometheus Config

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'evomap-hub'
    static_configs:
      - targets: ['app:3001']
    metrics_path: '/api/v2/monitoring/metrics'
    scrape_interval: 30s
```

---

## Troubleshooting

### "Redis is not configured" in health check
Redis is optional. Set `REDIS_URL=redis://redis:6379` to enable Redis health probing.

### Metrics buffer is empty
The buffer holds max 1000 entries in memory. For persistence, pipe `flushMetrics(state)` to an external system (Prometheus, DataDog, InfluxDB).

### Alerts not triggering
Check the cooldown period. After an alert fires, it won't fire again until the cooldown expires (default 5-15 minutes per rule).

### High memory usage from metrics buffer
Reduce buffer size in `service.ts` or export metrics to an external system more frequently.

---

## Security Considerations

- Monitoring endpoints under `/api/v2/monitoring/*` are **unauthenticated** for health checks but should be protected in production via:
  - Internal network only (not exposed publicly)
  - IP allowlisting at the load balancer
  - Basic auth or API key middleware
- Alert webhook secret (`ALERT_WEBHOOK_SECRET`) should be used for HMAC signature verification
- Sentry DSN should be kept confidential

---

## Files Reference

| File | Purpose |
|---|---|
| `src/monitoring/service.ts` | Core monitoring logic: metrics, alerts, analytics, health checks |
| `src/monitoring/routes.ts` | REST API endpoints |
| `src/monitoring/middleware.ts` | Fastify hooks for automatic request/response tracking |
| `src/monitoring/types.ts` | TypeScript interfaces |
| `src/monitoring/service.test.ts` | Unit tests (42 tests) |
| `src/monitoring/routes.test.ts` | Route integration tests |
| `.env.production.example` | Production environment variables (monitoring section) |
| `docs/performance/MONITORING-SETUP.md` | This document |
