# 部署指南

> 生产环境部署说明

## 部署架构

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │Frontend │        │Backend  │        │Backend  │
    │(Vercel) │        │(Node)    │        │(Node)   │
    └─────────┘        └────┬────┘        └────┬────┘
                             │                   │
                             └─────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
               ┌────▼────┐        ┌─────▼─────┐       ┌────▼────┐
               │PostgreSQL│        │  Redis    │       │  Neo4j  │
               │ (Primary)│        │ (Cluster) │       │(Optional)│
               └──────────┘        └───────────┘       └─────────┘
```

## 前置要求

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis >= 6
- Nginx 或类似反向代理
- SSL 证书

## 环境配置

### 生产环境变量

```bash
# .env.production
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# 数据库
DATABASE_URL="postgresql://USER:PASSWORD@DB_HOST:5432/evomap?schema=public"

# Redis
REDIS_URL="redis://REDIS_HOST:6379"

# 安全密钥（必须使用强随机密钥）
NODE_SECRET="<64-char-hex-string>"
SESSION_SECRET="<64-char-hex-string>"

# 功能开关
FEATURE_NEO4J_ENABLED="true"
FEATURE_S3_ENABLED="true"
```

## 构建应用

### 后端构建

```bash
# 安装依赖
npm ci --production

# 类型检查
npm run typecheck

# 构建
npm run build

# 运行迁移
npm run db:migrate:prod
```

### 前端构建

```bash
cd frontend

# 安装依赖
npm ci

# 构建
npm run build
```

## 使用 PM2 部署

### 安装 PM2

```bash
npm install -g pm2
```

### 创建 ecosystem 配置

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'evomap-backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '/var/log/evomap/error.log',
      out_file: '/var/log/evomap/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
    },
  ],
};
```

### 启动服务

```bash
# 启动
pm2 start ecosystem.config.js --env production

# 保存进程列表
pm2 save

# 设置开机自启
pm2 startup
```

### PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs evomap-backend

# 重启
pm2 restart evomap-backend

# 重载（零 downtime）
pm2 reload evomap-backend

# 停止
pm2 stop evomap-backend
```

## Nginx 配置

```nginx
# /etc/nginx/sites-available/evomap

upstream backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name api.evomap.ai;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.evomap.ai;

    ssl_certificate /etc/ssl/certs/evomap.crt;
    ssl_certificate_key /etc/ssl/private/evomap.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Gzip 压缩
    gzip on;
    gzip_types application/json application/javascript text/css;

    # API 代理
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时配置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Swagger 文档
    location /docs {
        proxy_pass http://backend;
        proxy_set_header Host $host;
    }

    # 健康检查
    location /health {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        access_log off;
    }
}
```

## Docker 部署

### Dockerfile

```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 生产镜像
FROM node:18-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/evomap
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=evomap
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

启动：

```bash
docker-compose up -d
docker-compose exec backend npm run db:migrate:prod
```

## 监控与日志

### 日志配置

使用结构化日志：

```bash
# JSON 格式日志
LOG_LEVEL=info LOG_FORMAT=json npm run start

# 文件输出
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 健康检查

```bash
# 端点检查
curl https://api.evomap.ai/health

# 预期响应
{
  "status": "ok",
  "timestamp": "2026-04-27T00:00:00.000Z",
  "services": {
    "gdi_refresh_worker": "running"
  }
}
```

### 性能监控

```bash
# PM2 监控
pm2 monit

# 进程状态
pm2 status
```

## 备份策略

### 数据库备份

```bash
# 每日备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U postgres -d evomap > /backups/evomap_$DATE.sql
find /backups -name "evomap_*.sql" -mtime +7 -delete
```

### Redis 备份

```bash
# RDB 持久化备份
redis-cli BGSAVE
```

## 安全检查清单

- [ ] 使用 HTTPS
- [ ] 配置防火墙规则
- [ ] 定期更新依赖
- [ ] 设置安全响应头
- [ ] 启用日志审计
- [ ] 定期备份数据库
- [ ] 使用强密码和密钥
- [ ] 限制 API 速率
- [ ] 启用 CORS 白名单

## 回滚方案

```bash
# 使用 Git 回滚
git checkout v1.0.0
npm ci --production
npm run build
pm2 restart evomap-backend

# 或使用 Docker
docker-compose pull
docker-compose up -d
```

## Docker Compose 部署

项目根目录已包含 `Dockerfile` 和 `docker-compose.yml`：

```bash
# 开发环境
docker-compose up -d

# 生产环境 (使用 prod 配置)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 查看日志
docker-compose logs -f backend

# 重启服务
docker-compose restart backend

# 进入容器
docker exec -it evomap-backend /bin/sh
```

### 生产环境变量

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      NODE_ENV: production
      PORT: 3001
      LOG_LEVEL: info
    restart: always
```

## Kubernetes 部署

项目已包含 `deploy/k8s/` 目录（可扩展）：

```yaml
# deploy/k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: evomap-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: evomap-backend
  template:
    metadata:
      labels:
        app: evomap-backend
    spec:
      containers:
        - name: backend
          image: evomap/backend:latest
          ports:
            - containerPort: 3001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: evomap-secrets
                  key: DATABASE_URL
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 15
```

### K8s 部署步骤

```bash
# 1. 创建命名空间
kubectl create namespace evomap

# 2. 应用配置
kubectl apply -f deploy/k8s/

# 3. 检查状态
kubectl get pods -n evomap

# 4. 查看日志
kubectl logs -n evomap -l app=evomap-backend

# 5. 扩容
kubectl scale deployment evomap-backend --replicas=5 -n evomap
```

## 监控与告警

```bash
# 查看健康状态
curl https://api.evomap.ai/health

# 查看指标 (Prometheus 格式)
curl https://api.evomap.ai/metrics

# Docker 健康检查
docker inspect --format='{{.State.Health.Status}}' evomap-backend
```

---

*最后更新: 2026-04-29*

