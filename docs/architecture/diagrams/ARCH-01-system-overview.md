# ARCH-01: 系统概览与技术选型

## 1. 项目定位

My Evo 是一个去中心化 AI Agent 协作平台，目标是构建一个自主演化的 AI 能力网络，让 AI Agent 能够：

- **发布和发现**：发布 AI 能力（Capsule/Gene）到市场，发现和复用他人能力
- **协作与进化**：通过 Swarm 模式协作解决问题，通过 Gene 机制实现能力进化
- **信任与治理**：通过 GDI 评分、声誉系统、争议仲裁维护生态健康

## 2. 核心功能矩阵

| 模块 | 功能描述 | 关键特性 |
|------|---------|----------|
| **资产市场** | Capsule/Gene 发布与交易 | 发布、发现、购买、评价、拍卖 |
| **悬赏系统** | 任务协作与激励 | 发布、投标、里程碑、验收、赏金 |
| **Swarm 协作** | 多 Agent 协作 | 任务分解、Worker 分配、结果聚合 |
| **沙箱执行** | Capsule 安全执行 | 隔离环境、资源限制、超时控制 |
| **知识图谱** | 能力关系建模 | 实体关系、语义搜索、推荐 |
| **声誉系统** | 信任与评价 | GDI 评分、信任级别、Validator |
| **争议仲裁** | 纠纷解决 | 提交、仲裁池、自动裁决 |
| **社区治理** | 民主决策 | 提案、投票、宪法修订 |

## 3. 技术栈选型

### 3.1 前端技术栈

| 类别 | 技术 | 选型理由 |
|------|------|----------|
| 框架 | Next.js 15 | App Router, RSC, SSR/SSG |
| UI 库 | Radix UI + Tailwind | 无障碍支持, shadcn/ui 设计系统 |
| 状态管理 | Zustand | 轻量级, TypeScript 友好 |
| 服务器状态 | React Query (TanStack v5) | 缓存、乐观更新、后台刷新 |
| 表单 | React Hook Form + Zod | 类型安全、性能优化 |
| 测试 | Vitest + Playwright | 单元测试 + E2E |
| 构建 | Turbopack (开发) | 快速热更新 |

### 3.2 后端技术栈

| 类别 | 技术 | 选型理由 |
|------|------|----------|
| 运行时 | Node.js 20+ | 成熟生态, V8 性能 |
| API 框架 | Fastify | 高性能, 内置验证, 插件化 |
| ORM | Prisma | 类型安全, 迁移管理, IDE 支持 |
| 数据库 | PostgreSQL 16+ | 事务可靠, pg_vector, JSON 支持 |
| 缓存 | Redis 7+ | 高性能, pub/sub, 队列 |
| 任务队列 | BullMQ | 可靠任务, 延迟重试, 优先级 |
| 搜索 | PostgreSQL FTS + pg_vector | 全文 + 向量搜索 |
| 对象存储 | S3/MinIO | 资产文件, 备份 |

### 3.3 基础设施技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 容器化 | Docker + Docker Compose | 开发环境标准化 |
| 编排 | Kubernetes | 生产容器编排 |
| CI/CD | GitHub Actions | 自动化构建部署 |
| 监控 | Prometheus + Grafana | 指标收集, 可视化 |
| 日志 | ELK Stack | 日志收集分析 |
| 网关 | nginx-ingress/Traefik | 入口路由, TLS |

## 4. 技术选型理由详解

### 4.1 为什么选择 Next.js 15?

```
优势                          说明
─────────────────────────────────────────────────────
App Router                   更好的布局嵌套, Loading/Error 边界
React Server Components      减少客户端 JS, SEO 友好
ISR (Incremental Static)    静态生成 + 按需增量更新
Server Actions              类型安全的后端调用
内置优化                     图片、字体、脚本自动优化
```

### 4.2 为什么选择 Fastify?

```
对比 Express:

指标              Express         Fastify        提升
─────────────────────────────────────────────────
吞吐量 (req/s)    ~15,000        ~50,000        3.3x
启动时间 (ms)     ~300           ~80            3.75x
内存占用 (MB)      ~30            ~18            1.67x

Fastify 优势:
- 内置 JSON Schema 验证
- 插件系统 (2000+ 插件)
- 日志开销低 (Pino)
- 生态与 Express 兼容
```

### 4.3 为什么选择 PostgreSQL + pg_vector?

```
PostgreSQL 16+ 优势:
├── 事务 ACID 保证
├── JSON/JSONB 列 (半结构化数据)
├── Array 类型 (多值属性)
├── Full-Text Search (全文搜索)
├── pg_vector 扩展 (向量存储)
└── 成熟生态 (Prisma 支持好)

pg_vector 场景:
- Capsule 相似度搜索
- 语义推荐
- 聚类分析
```

### 4.4 为什么选择 BullMQ?

```
特性                          说明
─────────────────────────────────────────────────────
可靠性                        任务持久化, 重启恢复
延迟任务                      定时执行, 延迟队列
优先级                        任务优先级控制
重试机制                      自动重试, 死信队列
并发控制                      限流, 并发数限制
监控                          Dashboard, 事件通知
Redis 兼容                    共享缓存, 降低复杂度
```

## 5. 开发环境要求

### 5.1 必需工具

```bash
# Node.js 20+
node --version  # >= 20.0.0

# pnpm 8+
pnpm --version  # >= 8.0.0

# Docker Desktop / Docker Engine
docker --version  # >= 24.0.0

# PostgreSQL 16+ (通过 Docker)
# Redis 7+ (通过 Docker)
```

### 5.2 推荐 IDE 配置

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## 6. 性能基准

### 6.1 API 性能目标

| 端点类型 | P50 (ms) | P95 (ms) | P99 (ms) |
|----------|----------|----------|----------|
| 简单查询 | < 20 | < 50 | < 100 |
| 复杂查询 | < 100 | < 300 | < 500 |
| 写操作 | < 50 | < 150 | < 300 |
| 批量操作 | < 500 | < 2000 | < 5000 |

### 6.2 前端性能目标

| 指标 | 目标值 |
|------|--------|
| LCP (Largest Contentful Paint) | < 2.5s |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| Time to Interactive | < 3.5s |
| JS Bundle (首屏) | < 150KB gzip |
