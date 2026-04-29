# 部署架构 (Deployment Architecture)

> **父文档**: `technical-architecture-v1.md` | **版本**: v1.0

## 1. 整体架构图

```
                        ┌─────────────────┐
                        │   CDN / WAF     │
                        │  (Cloudflare)   │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │  Load Balancer  │
                        │   (Nginx/LB)    │
                        └────────┬────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                    │
     ┌────────▼────────┐ ┌──────▼────────┐ ┌──────▼────────┐
     │  Next.js App    │ │  Next.js App  │ │  Next.js App  │
     │  (Server 1)     │ │  (Server 2)   │ │  (Server 3)  │
     │  SSR / ISR      │ │  SSR / ISR    │ │  SSR / ISR    │
     └────────┬────────┘ └───────┬────────┘ └───────┬────────┘
              └──────────────────┼──────────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │    API 网关 (Fastify)     │
                    │  Rate Limit + Auth        │
                    └─────────────┬─────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                          │
 ┌──────▼──────┐        ┌───────▼──────┐        ┌───────▼──────┐
 │   Swarm     │        │   Biology    │        │   Bounty     │
 │   Worker    │        │   Worker     │        │   Worker     │
 │  (BullMQ)   │        │  (BullMQ)   │        │  (BullMQ)   │
 └──────┬──────┘        └───────┬──────┘        └───────┬──────┘
        └────────────────────────┼─────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                        │
  ┌──────▼──────┐      ┌───────▼──────┐      ┌───────▼──────┐
  │ PostgreSQL  │      │    Neo4j     │      │    Redis     │
  │ (Primary+   │      │  (Primary+   │      │  (Cluster)   │
  │  Replica)   │      │   Replica)  │      │              │
  └─────────────┘      └─────────────┘      └─────────────┘
```

## 2. 环境配置

| 环境 | 用途 | 关键变量 |
|------|------|---------|
| **local** | 本地开发 | `DATABASE_URL`, `NEO4J_URI`, `REDIS_URL` |
| **dev** | 远程开发预览 | Vercel Preview + Railway |
| **staging** | 集成测试 | 独立服务、独立数据 |
| **production** | 生产环境 | 多区域部署、自动扩缩容 |

## 3. Docker 容器化

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine AS base
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]

# backend/Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

## 4. docker-compose 本地开发

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myevo
      POSTGRES_USER: myevo
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  neo4j:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/devpass
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://myevo:devpass@postgres:5432/myevo
      REDIS_URL: redis://redis:6379
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_USER: neo4j
      NEO4J_PASSWORD: devpass
      JWT_SECRET: dev-jwt-secret
    depends_on:
      - postgres
      - redis
      - neo4j

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    depends_on:
      - backend

volumes:
  postgres_data:
  neo4j_data:
```

## 5. 可观测性

| 维度 | 工具 |
|------|------|
| API 日志 | Fastify 日志（Pino）→ 结构化 JSON |
| 链路追踪 | OpenTelemetry + Jaeger |
| 错误监控 | Sentry |
| Metrics | Prometheus + Grafana |
| 前端监控 | Vercel Analytics + Sentry |
| Health Check | `/health` (postgres + redis + neo4j 连接状态) |
