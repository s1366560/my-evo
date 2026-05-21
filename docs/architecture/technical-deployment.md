# My Evo 部署架构文档 v2.0

> **版本**: 2.0 | **更新日期**: 2026-04-28

---

## 1. 部署架构

### 1.1 生产环境

```
Cloudflare CDN (DDoS防护/WAF)
         │
         ▼
Load Balancer (AWS ALB)
         │
    ┌────┼────┐
    ▼    ▼    ▼
API Server × 3 (水平扩展)
    └────┼────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
Redis  │  PostgreSQL (Multi-AZ)
       │
       ▼
     S3 + CloudFront
```

### 1.2 开发环境

```
Docker Compose
├── API Server
├── PostgreSQL
├── Redis
└── Worker
```

---

## 2. Docker 配置

### 2.1 Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . . && RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### 2.2 docker-compose.yml

```yaml
version: '3.8'
services:
  api:
    build: .
    ports: ["3000:3000"]
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      - POSTGRES_USER=${POSTGRES_USER:-myevo}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myevo"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]

  worker:
    build: .
    command: npm run worker
    depends_on: [postgres, redis]

volumes:
  postgres_data:
  redis_data:
```

---

## 3. 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/myevo

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-32-char-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# API
API_PORT=3000
NODE_ENV=development

# AWS
AWS_REGION=us-east-1
S3_BUCKET=myevo-assets

# 第三方
STRIPE_SECRET_KEY=
SENDGRID_API_KEY=
```

---

## 4. Kubernetes 部署

### 4.1 Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myevo-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myevo-api
  template:
    spec:
      containers:
        - name: api
          image: myevo/api:latest
          ports: [{ containerPort: 3000 }]
          resources:
            requests: { memory: "512Mi", cpu: "250m" }
            limits: { memory: "1Gi", cpu: "1000m" }
          livenessProbe:
            httpGet: { path: /health, port: 3000 }
            initialDelaySeconds: 30
          readinessProbe:
            httpGet: { path: /ready, port: 3000 }
            initialDelaySeconds: 5
```

### 4.2 HPA 自动扩缩容

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myevo-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myevo-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## 5. CI/CD 流程

```yaml
# GitHub Actions
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run lint && npm run test && npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: |
          docker build -t myevo/api:${{ github.sha }} .
          docker push myevo/api:${{ github.sha }}
      - run: kubectl rollout restart deployment/myevo-api
```

---

## 6. 监控

### 6.1 健康检查

```
GET /health  - 存活检查
GET /ready  - 就绪检查 (依赖服务状态)
```

### 6.2 日志格式

```json
{
  "level": "info",
  "timestamp": "ISO8601",
  "request_id": "uuid",
  "action": "api.endpoint",
  "duration_ms": 45,
  "status_code": 201
}
```

---

## 7. 备份策略

| 类型 | 频率 | 保留 | 方式 |
|------|------|------|------|
| 数据库全量 | 每日 | 30天 | RDS自动备份 |
| 数据库增量 | 每小时 | 7天 | pg_dump |
| 文件系统 | 每日 | 14天 | rsync + S3 |
| 日志 | 实时 | 90天 | CloudWatch |

---

*文档版本: v2.0 | 最后更新: 2026-04-28*
