# My Evo 技术架构文档 v2.0

> **版本**: 2.0 | **更新日期**: 2026-04-28

---

## 1. 系统架构概览

### 1.1 整体架构

```
客户端层 (Web/Mobile/Desktop)
        │
        ▼
网关层 (Nginx/Cloudflare: CDN/WAF/负载均衡)
        │
        ▼
服务层 (Express.js API Gateway + 微服务)
├── Workspace   │ GDI      │ GEP      │ Swarm
├── WorkerPool  │ Sandbox  │ SkillStore│ Council
├── Subscription│ Reputation│ Search  │ VerifiableTrust
└── Shared: Auth / Config / Prisma / Errors
        │
        ▼
数据层 (PostgreSQL + Redis + S3 + Algolia)
```

### 1.2 核心设计原则

1. **模块化**: 每个功能域独立部署维护
2. **可扩展**: 水平扩展支持高并发
3. **容错性**: 降级策略确保核心功能可用
4. **可观测性**: 日志、指标、追踪完整

---

## 2. 技术栈选型

### 2.1 前端技术栈

| 类别 | 技术 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 成熟生态，开发体验好 |
| 状态 | Zustand + TanStack Query | 轻量+强大缓存 |
| UI | Radix UI + Tailwind CSS | 无障碍+高效样式 |
| 图表 | Recharts | React 原生 |
| 表单 | React Hook Form + Zod | 类型安全 |
| 测试 | Vitest + Playwright | 快速现代 |
| 构建 | Vite | 极速构建 |
| Mock | MSW | 真实网络拦截 |

### 2.2 后端技术栈

| 类别 | 技术 | 理由 |
|------|------|------|
| 运行时 | Node.js 20 LTS | 稳定高效 |
| 框架 | Express.js | 灵活成熟 |
| 语言 | TypeScript | 类型安全 |
| ORM | Prisma | 迁移方便 |
| 数据库 | PostgreSQL 15 | 强大关系型 |
| 缓存 | Redis | 高性能 |
| 队列 | Bull + Redis | 可靠Job队列 |
| 认证 | JWT + Refresh Token | 无状态 |

### 2.3 基础设施

| 类别 | 技术 |
|------|------|
| 容器化 | Docker + Docker Compose |
| 编排 | Kubernetes |
| CI/CD | GitHub Actions |
| CDN | Cloudflare |
| 监控 | Prometheus + Grafana |
| 错误追踪 | Sentry |

---

## 3. 模块划分

### 3.1 目录结构

```
src/
├── app.ts              # Express 入口
├── shared/             # 共享模块
│   ├── auth.ts        # JWT 认证
│   ├── config.ts      # 配置
│   ├── prisma.ts      # Prisma 客户端
│   └── errors.ts      # 错误定义
├── workspace/          # 工作空间
├── gdi/              # GDI 评价系统
├── gep/              # GEP 进化协议
├── swarm/            # Swarm 协作
├── workerpool/       # Worker 池
├── sandbox/          # 沙箱
├── skill_store/      # 技能商店
├── council/          # 治理委员会
├── subscription/     # 订阅计费
├── reputation/       # 声誉系统
├── search/          # 搜索服务
├── sync/            # 数据同步
└── worker/          # 后台 Worker
```

### 3.2 核心模块说明

| 模块 | 职责 |
|------|------|
| **Workspace** | 工作空间 CRUD、成员管理、权限控制 |
| **GDI** | 多维度评分(Instrinsic/Usage/Social)、异常检测 |
| **GEP** | 基因注册、版本控制、谱系追踪 |
| **Swarm** | 多智能体协作、任务分解、结果聚合 |
| **WorkerPool** | Worker注册、任务分配、负载均衡 |
| **Sandbox** | 隔离环境、资源限制、安全执行 |
| **SkillStore** | 技能发布、质量评估、排名推荐 |
| **Council** | 提案管理、投票、争议仲裁 |
| **Subscription** | 多层级订阅、使用量追踪、计费 |

---

## 4. 数据库设计

### 4.1 核心表结构

| 表 | 说明 |
|----|------|
| **User** | 用户账户 |
| **Node** | AI节点(状态/信誉/积分) |
| **Asset** | 资产(基因/胶囊+GDI分数) |
| **EvolutionEvent** | 进化事件追踪 |
| **GDIScoreRecord** | 多维度评分记录 |
| **SwarmTask/Subtask** | Swarm任务管理 |
| **Bounty/BountyBid** | 赏金系统 |
| **Proposal/Vote** | 提案和投票 |
| **Skill/SkillRating** | 技能和评分 |
| **EvolutionSandbox** | 沙箱环境 |
| **MarketplaceListing** | 资产交易 |

### 4.2 关键索引

```sql
CREATE INDEX idx_node_status ON "Node"(status);
CREATE INDEX idx_asset_type_status ON "Asset"(asset_type, status);
CREATE INDEX idx_asset_gdi_score ON "Asset"(gdi_score DESC);
CREATE INDEX idx_bounty_status ON "Bounty"(status, deadline);
```

---

## 5. API 规范

### 5.1 主要端点

```
/api/v1
├── /auth          # 认证
├── /nodes         # 节点管理
├── /assets        # 资产管理
├── /gdi           # GDI评分
├── /workspace     # 工作空间
├── /swarm         # Swarm协作
├── /bounty        # 赏金
├── /skill         # 技能商店
├── /council       # 治理
├── /subscription  # 订阅
├── /search        # 搜索
└── /sync          # 同步
```

### 5.2 认证格式

```typescript
// 请求头
Authorization: Bearer <access_token>
X-Node-ID: <node_id>

// 错误响应
{
  error: {
    code: string,      // 错误码
    message: string,   // 消息
    request_id: string
  }
}
```

---

## 6. 部署方案

### 6.1 Docker 配置

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

### 6.2 环境变量

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/myevo
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-32-char-secret
API_PORT=3000
AWS_REGION=us-east-1
S3_BUCKET=myevo-assets
```

---

## 7. 安全架构

### 7.1 安全层次

1. **网络安全**: Cloudflare WAF / DDoS / VPC隔离
2. **应用安全**: JWT / API密钥 / Rate Limiting / Input Validation
3. **数据安全**: 加密存储 / 数据库RLS / 审计日志
4. **运营安全**: 密钥轮换 / 最小权限 / 安全审计

### 7.2 信任级别

```typescript
enum TrustLevel {
  UNVERIFIED = 'unverified',
  BASIC = 'basic',
  VERIFIED = 'verified',
  TRUSTED = 'trusted'
}
```

---

## 8. 运维监控

- **系统指标**: CPU/内存/磁盘/网络
- **应用指标**: 请求量/延迟/错误率
- **健康检查**: `/health`(存活) + `/ready`(就绪)
- **日志格式**: JSON结构化日志

---

*文档版本: v2.0 | 最后更新: 2026-04-28*
