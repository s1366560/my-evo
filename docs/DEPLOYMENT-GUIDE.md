# My Evo 部署指南

**版本**: 1.0.0 | **更新日期**: 2026-04-29 | **目标环境**: 开发/生产

---

## 目录

1. [环境要求](#1-环境要求)
2. [快速开始 (Docker)](#2-快速开始-docker)
3. [手动部署](#3-手动部署)
4. [生产环境配置](#4-生产环境配置)
5. [数据库设置](#5-数据库设置)
6. [反向代理配置](#6-反向代理配置)
7. [监控与日志](#7-监控与日志)
8. [故障排除](#8-故障排除)

---

## 1. 环境要求

### 硬件要求

| 环境 | CPU | 内存 | 磁盘 |
|------|-----|------|------|
| 开发 | 2 核 | 4 GB | 20 GB |
| 生产 | 4 核 | 8 GB | 50 GB |

### 软件要求

| 组件 | 版本 | 必需 |
|------|------|------|
| Node.js | ≥18.0.0 | 是 |
| npm | ≥9.0.0 | 是 |
| PostgreSQL | 15+ | 是 |
| Redis | 6+ | 推荐 |
| Docker | 24+ | 可选 |
| Docker Compose | 2.0+ | 可选 |

---

## 2. 快速开始 (Docker)

### 2.1 克隆项目

```bash
git clone <repo-url>
cd my-evo
```

### 2.2 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件
nano .env
```

### 2.3 启动服务

```bash
# 开发环境 (包含热重载)
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
```

### 2.4 访问服务

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:3001 |
| API 文档 | http://localhost:3001/docs |

---

## 3. 手动部署

### 3.1 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 3.2 配置数据库

```bash
# 创建 PostgreSQL 数据库
createdb myevo

# 生成 Prisma Client
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# (可选) 填充种子数据
npm run db:seed
```

### 3.3 构建应用

```bash
# 构建后端
npm run build

# 构建前端
cd frontend && npm run build && cd ..
```

### 3.4 启动服务

```bash
# 启动后端 (生产模式)
NODE_ENV=production npm start

# 或启动开发服务器
npm run dev

# 新终端窗口 - 启动前端
cd frontend && npm run dev
```

---

## 4. 生产环境配置

### 4.1 环境变量 (.env.production)

```bash
# 数据库 - 使用生产级连接
DATABASE_URL=postgresql://user:password@db:5432/myevo?sslmode=require

# 安全密钥 - 生成强随机密钥
JWT_SECRET=$(openssl rand -hex 64)
SESSION_SECRET=$(openssl rand -hex 64)
NODE_SECRET=$(openssl rand -hex 64)

# Redis - 生产配置
REDIS_URL=redis://redis:6379

# CORS - 限制为已知域名
CORS_ORIGIN=https://yourdomain.com

# 运行环境
NODE_ENV=production
PORT=3001

# OAuth (如使用)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

### 4.2 Docker Compose 生产配置

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    depends_on:
      - db
      - redis
    networks:
      - backend-network

  frontend:
    image: nginx:alpine
    restart: always
    volumes:
      - ./dist:/usr/share/nginx/html
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - backend-network

  db:
    image: postgres:15-alpine
    restart: always
    environment:
      - POSTGRES_DB=myevo
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend-network

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - backend-network

volumes:
  postgres_data:
  redis_data:

networks:
  backend-network:
    driver: bridge
```

### 4.3 启动生产环境

```bash
# 使用生产配置启动
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 运行数据库迁移
docker-compose exec backend npm run db:migrate

# 检查服务状态
docker-compose ps

# 查看后端日志
docker-compose logs -f backend
```

---

## 5. 数据库设置

### 5.1 PostgreSQL 配置

```sql
-- 创建数据库
CREATE DATABASE myevo;

-- 创建用户
CREATE USER myevo_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE myevo TO myevo_user;

-- 切换到数据库并授权
\c myevo
GRANT ALL ON SCHEMA public TO myevo_user;
```

### 5.2 数据库迁移

```bash
# 开发环境迁移
npm run db:migrate

# 生产环境迁移
docker-compose exec backend npm run db:migrate

# 创建新迁移
npm run db:migrate -- --name add_new_table

# 重置数据库 (开发环境)
npm run db:reset
```

### 5.3 数据库备份

```bash
# 备份
pg_dump -U myevo_user -h localhost myevo > backup_$(date +%Y%m%d).sql

# 恢复
psql -U myevo_user -h localhost myevo < backup_20260429.sql
```

---

## 6. 反向代理配置

### 6.1 Nginx 配置

```nginx
# nginx/nginx.conf
upstream backend {
    server backend:3001;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # 前端静态文件
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API 代理
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket 支持
    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 7. 监控与日志

### 7.1 健康检查

```bash
# 后端健康检查
curl http://localhost:3001/health

# Docker 健康检查
docker-compose ps
```

### 7.2 日志管理

```bash
# 后端日志
docker-compose logs -f backend

# 所有服务日志
docker-compose logs -f

# 使用日志轮转
docker-compose logs --tail=100 --follow > app.log 2>&1 &
```

### 7.3 性能监控

推荐使用以下工具：
- **Prometheus + Grafana**: 指标收集与可视化
- **New Relic / Datadog**: 应用性能监控
- **Sentry**: 错误追踪

---

## 8. 故障排除

### 8.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 连接数据库失败 | DATABASE_URL 配置错误 | 检查环境变量 |
| 前端 502 | 后端未启动 | 检查后端日志 |
| OAuth 回调失败 | 重定向 URL 配置错误 | 检查 OAuth 应用设置 |
| 静态资源加载失败 | Nginx 配置错误 | 检查 nginx.conf |

### 8.2 调试命令

```bash
# 检查端口占用
lsof -i :3001
lsof -i :3000

# 检查进程
ps aux | grep node
ps aux | grep docker

# 检查网络
docker network ls
docker network inspect my-evo_backend-network

# 进入容器调试
docker-compose exec backend sh
docker-compose exec db psql -U postgres
```

### 8.3 安全检查清单

- [ ] 使用 HTTPS
- [ ] 配置强密码和密钥
- [ ] 限制 CORS 源
- [ ] 启用 Rate Limiting
- [ ] 配置防火墙规则
- [ ] 定期备份数据库
- [ ] 更新依赖版本

---

## 9. 相关文档

- [架构文档](./ARCHITECTURE.md)
- [API 规范](./API-SPEC-20260429.md)
- [数据字典](./DATA-DICTIONARY.md)
- [贡献指南](./CONTRIBUTING.md)

---

**最后更新**: 2026-04-29
