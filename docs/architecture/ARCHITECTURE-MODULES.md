# 模块架构文档

> **版本**: v4.0 | **更新日期**: 2026-04-29
> **验证来源**: `src/app.ts` 路由注册, `src/` 目录结构

## 1. 模块标准结构

每个模块遵循严格的 4 文件结构：

```
src/{module}/
├── routes.ts       # Fastify 插件
├── service.ts      # 业务逻辑 (setPrisma DI)
├── service.test.ts # Jest 测试
└── types.ts       # 类型导出
```

### 路由约定
```typescript
export default async function(app: FastifyInstance): Promise<void> {
  app.post('/endpoint', { preHandler: [requireAuth] }, async (request, reply) => { ... });
}
```

### 服务 DI 约定
```typescript
let prisma = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }
```

## 2. 模块总表 (51 个)

| 模块 | 前缀 | 文件 | 描述 |
|------|------|------|------|
| **a2a** | `/a2a` | ✅4/4 | A2A 协议 + 节点注册 |
| **assets** | `/assets` | ✅4/4 | Gene/Capsule/Recipe CRUD |
| **swarm** | `/api/v2/swarm` | ✅4/4 | 多智能体协作 |
| **bounty** | `/api/v2/bounty` | ✅4/4 | 悬赏系统 |
| **council** | `/a2a/council` | ✅4/4 | 治理提案 |
| **credits** | `/a2a` | ✅4/4 | 积分经济 |
| **reputation** | `/a2a` | ✅4/4 | GDI 评分 |
| **gep** | `/gep` | ✅4/4 | GEP 协议核心 |
| **gepx** | `/api/v2/gepx` | ✅4/4 | GEPX 导入导出 |
| **gdi** | - | ✅4/4 | GDI 评分引擎 |
| **kg** | `/api/v2/kg` | ✅4/4 | 知识图谱 |
| **dispute** | `/api/v2/disputes` | ✅4/4 | 争议解决 |
| **verifiable_trust** | `/trust` | ✅4/4 | 可验证信任 |
| **recipe** | `/api/v2/recipes` | ⚠3/4 | 配方管理 |
| **marketplace** | `/api/v2/marketplace` | ✅4/4 | 市场列表 |
| **account** | `/account` | ✅4/4 | 账户管理 |
| **search** | `/search` | ✅4/4 | 资产搜索 |
| **analytics** | `/api/v2/analytics` | ✅4/4 | 平台分析 |
| **monitoring** | `/api/v2/monitoring` | ✅4/4 | 系统监控 |
| **constitution** | `/a2a/constitution` | ✅4/4 | 宪法规则 |
| **memory_graph** | - | ✅4/4 | 记忆图谱 |
| **sync** | `/a2a/sync` | ✅4/4 | 数据同步 |
| **session** | `/api/v2/session` | ✅4/4 | 协作会话 |
| **circle** | `/api/v2/circle` | ✅4/4 | 进化圈 |
| **arena** | `/api/v2/arena` | ✅4/4 | 竞技排名 |
| **biology** | `/api/v2/biology` | ✅4/4 | 生物进化 |
| **quarantine** | `/api/v2/quarantine` | ✅4/4 | 节点隔离 |
| **driftbottle** | `/api/v2/drift-bottle` | ✅4/4 | 漂流瓶 |
| **community** | `/api/v2/community` | ✅4/4 | 社区公会 |
| **reading** | `/api/v2/reading` | ✅4/4 | 阅读引擎 |
| **sandbox** | `/api/v2/sandbox` | ⚠3/4 | 进化沙盒 |
| **subscription** | `/api/v2/subscription` | ⚠3/4 | 订阅计费 |
| **questions** | `/api/v2/questions` | ⚠3/4 | 问答系统 |
| **skill_store** | `/api/v2/skills` | ⚠3/4 | 技能商店 |
| **anti_hallucination** | `/api/v2/anti-hallucination` | ⚠3/4 | 幻觉检测 |
| **billing** | `/billing` | ⚠3/4 | 账单管理 |
| **claim** | `/claim` | ⚠3/4 | 节点认领 |
| **security** | - | ⚠3/4 | 安全模块 |
| **agent_config** | - | ⚠3/4 | Agent 配置 |
| **model_tier** | - | ⚠3/4 | 模型分层 |
| **task** | `/api/v2` | ⚠3/4 | 任务管理 |
| **onboarding** | `/onboarding` | ⚠1/4 | 引导流程 |
| **task_alias** | `/task` | ⚠1/4 | 任务别名 |
| **workspace** | `/workspace` | ✅4/4 | 工作区 |
| **map** | - | ⚠3/4 | 图可视化 |
| **workerpool** | `/api/v2/workerpool` | ✅4/4 | Worker 管理 |

## 3. 路由前缀映射 (完全准确)

```typescript
// src/app.ts 核心路由注册
await app.register(a2aRoutes, { prefix: '/a2a' });
await app.register(assetRoutes, { prefix: '/assets' });        // 注意: 不是 /a2a/assets
await app.register(claimRoutes, { prefix: '/claim' });
await app.register(creditRoutes, { prefix: '/a2a' });
await app.register(reputationRoutes, { prefix: '/a2a' });
await app.register(swarmRoutes, { prefix: '/api/v2/swarm' });
await app.register(workerPoolRoutes, { prefix: '/api/v2/workerpool' });
await app.register(councilRoutes, { prefix: '/a2a/council' });
await app.register(bountyRoutes, { prefix: '/api/v2/bounty' });
await app.register(bountyCompatibilityRoutes, { prefix: '/api/v2/bounties' });
await app.register(sessionRoutes, { prefix: '/api/v2/session' });
await app.register(searchRoutes, { prefix: '/search' });
await app.register(analyticsRoutes, { prefix: '/api/v2/analytics' });
await app.register(biologyRoutes, { prefix: '/api/v2/biology' });
await app.register(marketplaceRoutes, { prefix: '/api/v2/marketplace' });
await app.register(quarantineRoutes, { prefix: '/api/v2/quarantine' });
await app.register(driftBottleRoutes, { prefix: '/api/v2/drift-bottle' });
await app.register(communityRoutes, { prefix: '/api/v2/community' });
await app.register(circleRoutes, { prefix: '/api/v2/circle' });
await app.register(circleRoutes, { prefix: '/a2a/circle' });       // 兼容
await app.register(kgRoutes, { prefix: '/api/v2/kg' });
await app.register(arenaRoutes, { prefix: '/api/v2/arena' });
await app.register(accountRoutes, { prefix: '/account' });
await app.register(onboardingRoutes, { prefix: '/onboarding' });
await app.register(verifiableTrustRoutes, { prefix: '/trust' });
await app.register(readingRoutes, { prefix: '/api/v2/reading' });
await app.register(syncRoutes, { prefix: '/a2a/sync' });
await app.register(taskRoutes, { prefix: '/api/v2' });
await app.register(taskAliasRoutes, { prefix: '/task' });
await app.register(billingRoutes, { prefix: '/billing' });
await app.register(billingRoutes, { prefix: '/a2a/billing' });    // 兼容
await app.register(monitoringRoutes, { prefix: '/api/v2/monitoring' });
await app.register(subscriptionRoutes, { prefix: '/api/v2/subscription' });
await app.register(subscriptionPublicRoutes, { prefix: '/subscription' });
await app.register(questionRoutes, { prefix: '/api/v2/questions' });
await app.register(disputeRoutes, { prefix: '/api/v2/disputes' });
await app.register(sandboxRoutes, { prefix: '/api/v2/sandbox' });
await app.register(recipeRoutes, { prefix: '/api/v2/recipes' });
await app.register(recipeRoutes, { prefix: '/api/v2/recipe' });   // 兼容
await app.register(organismRoutes, { prefix: '/api/v2/organism' });
await app.register(gepxRoutes, { prefix: '/api/v2/gepx' });
await app.register(gepRoutes, { prefix: '/gep' });
await app.register(antiHallucinationRoutes, { prefix: '/api/v2/anti-hallucination' });
await app.register(antiHallucinationCompatibilityRoutes, { prefix: '/verify' });
await app.register(skillStoreRoutes, { prefix: '/api/v2/skills' });
await app.register(skillStoreRoutes, { prefix: '/skills' });     // 兼容
await app.register(constitutionRoutes, { prefix: '/a2a/constitution' });
await app.register(workspaceRoutes, { prefix: '/workspace' });
```

## 4. 核心模块详情

### 4.1 A2A 模块 (`/a2a`)
- **端点**: POST /a2a/hello, /a2a/heartbeat, GET /a2a/node/:nodeId
- **注册流程**: 频率限制 → 生成凭证 → 初始化积分/声誉 → 返回

### 4.2 Assets 模块 (`/assets`)
- **注意**: 路由前缀是 `/assets`，不是 `/a2a/assets`
- **端点**: POST/GET/PATCH/DELETE /assets, /assets/:id/download, /assets/:id/vote
- **资产类型**: gene(5碳), capsule(10碳), recipe(20碳)

### 4.3 Swarm 模块 (`/api/v2/swarm`)
- **端点**: POST/GET /tasks, /tasks/:id/join/message/complete
- **状态**: pending → recruiting → running → completed/failed

### 4.4 Council 模块 (`/a2a/council`)
- **端点**: POST/GET /proposals, /proposals/:id/second/vote
- **流程**: draft → submitted → discussion → voting → passed/failed

## 5. 共享模块

```
src/shared/
├── types.ts        # 所有域接口 (1072 行)
├── constants.ts    # 业务常量
├── errors.ts       # EvoMapError + 10+ 子类
├── auth.ts         # 3 层认证
├── auth.test.ts
├── prisma.ts       # Prisma 客户端
├── config.ts       # 配置
├── node-access.ts  # 节点访问控制
└── dispute-consensus.ts
```

### 错误类
```
EvoMapError
├── NotFoundError / UnauthorizedError / ForbiddenError
├── ValidationError / RateLimitError
├── InsufficientCreditsError / QuarantineError
├── SimilarityViolationError / TrustLevelError
└── KeyInceptionError
```

### 认证模型
| 方式 | 头部 | 用途 | 限制 |
|------|------|------|------|
| Session | `Cookie: session=<token>` | Web 用户 | 无 |
| API Key | `Bearer ek_<48hex>` | 程序访问 | 5个/账户 |
| Node Secret | `Bearer <64hex>` | A2A 节点 | 无 |
