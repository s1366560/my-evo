# 环境配置指南

> 详解所有环境变量及其用途

## 配置模板

项目根目录提供 `.env.example` 文件，复制为 `.env` 后配置：

```bash
cp .env.example .env
```

## 服务器配置

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `PORT` | `3001` | 服务器监听端口 |
| `HOST` | `0.0.0.0` | 服务器监听地址 |
| `LOG_LEVEL` | `info` | 日志级别 (trace/debug/info/warn/error) |

## 数据库配置

### PostgreSQL (Prisma)

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/evomap?schema=public"
```

| 参数 | 描述 |
|------|------|
| `USER` | 数据库用户名 |
| `PASSWORD` | 数据库密码 |
| `HOST` | 数据库主机 |
| `PORT` | 数据库端口 (默认 5432) |
| `evomap` | 数据库名称 |

### 常用数据库操作

```bash
# 生成 Prisma 客户端
npm run db:generate

# 开发环境迁移
npm run db:migrate

# 生产环境迁移
npm run db:migrate:prod

# 填充示例数据
npm run db:seed
```

## Redis 配置

```bash
REDIS_URL="redis://localhost:6379"
```

Redis 用于：
- BullMQ 任务队列
- 会话缓存
- 速率限制存储

## AI 服务 (可选)

```bash
OPENAI_API_KEY=""
```

用于 AI 相关功能：
- GDI 评分计算
- 语义搜索
- 资产相似度检测

## Neo4j 知识图谱 (可选)

```bash
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD=""
```

```bash
FEATURE_NEO4J_ENABLED="false"
```

当 `FEATURE_NEO4J_ENABLED=true` 时启用知识图谱功能。

## 对象存储 (可选)

```bash
S3_ENDPOINT=""
S3_REGION="us-east-1"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
S3_BUCKET="evomap-assets"
S3_PUBLIC_URL=""
FEATURE_S3_ENABLED="false"
```

用于存储资产文件和媒体资源。

## 安全配置

```bash
NODE_SECRET=""
SESSION_SECRET=""
```

| 变量 | 用途 | 要求 |
|------|------|------|
| `NODE_SECRET` | 节点认证密钥 | 64字符随机字符串 |
| `SESSION_SECRET` | 会话签名密钥 | 64字符随机字符串 |

**生成随机密钥：**
```bash
openssl rand -hex 32
```

## 速率限制

```bash
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `RATE_LIMIT_MAX` | `100` | 每窗口最大请求数 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | 时间窗口 (毫秒) |

## 完整配置示例

```bash
# ===== 服务器 =====
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# ===== 数据库 =====
DATABASE_URL="postgresql://evomap:password@localhost:5432/evomap"

# ===== Redis =====
REDIS_URL="redis://localhost:6379"

# ===== AI 服务 =====
OPENAI_API_KEY="sk-..."

# ===== Neo4j =====
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="password"
FEATURE_NEO4J_ENABLED="false"

# ===== S3 存储 =====
S3_ENDPOINT=""
S3_REGION="us-east-1"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
S3_BUCKET="evomap-assets"
S3_PUBLIC_URL=""
FEATURE_S3_ENABLED="false"

# ===== 安全 =====
NODE_SECRET="your-64-char-random-secret-key-here"
SESSION_SECRET="your-64-char-random-session-key-here"

# ===== 速率限制 =====
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

## 开发环境 vs 生产环境

### 开发环境

```bash
LOG_LEVEL=debug
FEATURE_NEO4J_ENABLED="false"
FEATURE_S3_ENABLED="false"
RATE_LIMIT_MAX=1000
```

### 生产环境

```bash
LOG_LEVEL=info
FEATURE_NEO4J_ENABLED="true"
FEATURE_S3_ENABLED="true"
RATE_LIMIT_MAX=100
NODE_SECRET="<production-secret>"
SESSION_SECRET="<production-session-secret>"
```
