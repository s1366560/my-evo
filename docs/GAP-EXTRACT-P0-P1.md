# P0/P1 Gap 清单 — my-evo v1.0.0

**来源**: `docs/RELEASE-v1.0.0-GAP-REPORT.md`
**生成时间**: 2026-04-29
**状态**: 已提取 | 分类完成

---

## P0 — 阻断性缺失（发布前必须完成）

### 前端

| # | Gap ID | 缺失项 | 原站实现 | My Evo 现状 | 影响 |
|---|--------|--------|----------|-------------|------|
| 1 | FE-P0-01 | /pricing 定价页 | 完整三层套餐展示 | ❌ 完全缺失 | 用户无法了解付费方案，无法完成付费转化 |
| 2 | FE-P0-02 | 功能对比表 | 完整特性矩阵（Free/Premium/Ultra） | ❌ 无 | 商业模式无法闭环 |
| 3 | FE-P0-03 | 积分获取指南 | 详细列举积分来源 | ❌ 无 | 用户不清楚如何获取积分 |

### 后端

| # | Gap ID | 缺失项 | 原站实现 | My Evo 现状 | 影响 | 状态 |
|---|--------|--------|----------|-------------|------|------|
| 1 | BE-P0-01 | 订阅套餐体系 | Free/Premium/Ultra 三层套餐逻辑 | ✅ 已实现完整订阅服务 | 商业模式已闭环 | ✅ 已完成 |
| 2 | BE-P0-02 | 积分体系后端 | 积分获取/消耗/查询 API | ✅ 已实现完整积分服务 | 支持付费流程 | ✅ 已完成 |

### 文档

| # | Gap ID | 缺失项 | 备注 |
|---|--------|--------|------|
| — | — | P0 阶段无文档类阻断项 | 定价/订阅属于功能实现，文档可并行补充 |

---

## P1 — 高优先级（建议 Sprint 2 完成）

### 前端

| # | Gap ID | 差异项 | 原站实现 | My Evo 现状 | 工时估算 |
|---|--------|--------|----------|-------------|----------|
| 1 | FE-P1-01 | Hero 区域品牌对齐 | "One agent learns. A million inherit." | Generic 品牌文案 | 4h |
| 2 | FE-P1-02 | 生态合作伙伴展示 | OpenClaw/Manus/Cursor 等 | 无 | 2h |
| 3 | FE-P1-03 | Quality Assurance 区块 | 多维度 AI 评分说明 | 无 | 3h |
| 4 | FE-P1-04 | GitHub Star CTA | GitHub 跳转按钮 | 无 | 1h |

### 后端

| # | Gap ID | 差异项 | 备注 |
|---|--------|--------|------|
| — | — | P1 阶段无明确后端类 Gap | 后端 22 模块核心端点已实现（92% 覆盖率） |

### 文档

| # | Gap ID | 差异项 | 原站实现 | My Evo 现状 | 工时估算 |
|---|--------|--------|----------|-------------|----------|
| 1 | DOC-P1-01 | GEP Protocol 文档 | 40+ 章节 | 仅 4 章节 | 16h |
| 2 | DOC-P1-02 | Webhooks 文档 | 独立章节 | 无 | 4h |
| 3 | DOC-P1-03 | Swarm Intelligence 文档 | 完整文档 | 基础 Swarm API | 8h |

---

## 汇总统计

### 按类别汇总

| 类别 | P0 | P1 | 小计 |
|------|----|----|------|
| 前端 | 3 | 4 | **7** |
| 后端 | 2 | 0 | **2** |
| 文档 | 0 | 3 | **3** |
| **合计** | **5** | **7** | **12** |

### P0 阻断项优先级排序

| 优先级 | Gap ID | 缺失项 | 负责方 |
|--------|--------|--------|--------|
| 1 | FE-P0-01 | /pricing 定价页 | 前端 |
| 2 | BE-P0-01 | 订阅套餐体系 | 后端+前端 |
| 3 | FE-P0-02 | 功能对比表 | 前端 |
| 4 | BE-P0-02 | 积分体系后端 | 后端 |
| 5 | FE-P0-03 | 积分获取指南 | 前端 |

### P1 优先级排序

| 优先级 | Gap ID | 差异项 | 负责方 | 工时 |
|--------|--------|--------|--------|------|
| 1 | DOC-P1-01 | GEP Protocol 文档 | 文档 | 16h |
| 2 | DOC-P1-03 | Swarm Intelligence 文档 | 文档 | 8h |
| 3 | FE-P1-01 | Hero 区域重设计 | 前端 | 4h |
| 4 | DOC-P1-02 | Webhooks 文档 | 文档 | 4h |
| 5 | FE-P1-03 | Quality Assurance 区块 | 前端 | 3h |
| 6 | FE-P1-02 | 生态合作伙伴展示 | 前端 | 2h |
| 7 | FE-P1-04 | GitHub Star CTA | 前端 | 1h |

---

## Sprint 2 行动计划

### P0 处理（紧急）

| 任务 | 负责方 | 工时 | 前置依赖 |
|------|--------|------|----------|
| 开发 /pricing 定价页 | 前端 | 8h | 无 |
| 实现订阅套餐体系（后端 API + 前端展示） | 后端+前端 | 16h | BE-P0-01 |
| 功能对比表开发 | 前端 | 4h | 无 |
| 积分获取指南 | 前端 | 4h | BE-P0-02 |

### P1 处理（并行）

| 任务 | 负责方 | 工时 | 前置依赖 |
|------|--------|------|----------|
| GEP Protocol 完整文档 | 文档 | 16h | 无 |
| Swarm Intelligence 文档 | 文档 | 8h | 无 |
| Hero 区域重设计 | 前端 | 4h | 无 |
| Webhooks 文档 | 文档 | 4h | 无 |
| Quality Assurance 区块 | 前端 | 3h | 无 |
| 生态合作伙伴展示 | 前端 | 2h | 无 |
| GitHub Star CTA | 前端 | 1h | 无 |

---

## 后端 Gap 处理记录

### BE-P0-01 & BE-P0-02 完成情况

**完成时间**: 2026-04-29
**执行者**: Workspace Builder Agent

**修复内容**:
1. **恢复缺失的共享模块**:
   - `src/shared/errors.ts`: 重新实现所有自定义错误类 (AppError, ValidationError, NotFoundError, InsufficientCreditsError, TrustLevelError, QuarantineError 等)
   - `src/shared/auth.ts`: 重新实现认证中间件 (requireNodeSecretAuth, requireAuth, requireTrustLevel, requireNoActiveQuarantine, requireScope)
   - 为 FastifyRequest 添加 auth 属性类型声明

2. **修复订阅服务问题**:
   - 修复 `src/subscription/service.ts` 中 `node_id` 拼写错误
   - 修复 `checkPlanLimit` 返回类型，兼容 boolean 类型限制
   - 修复发票数组访问时的 undefined 检查

3. **测试验证**:
   - `src/subscription/service.test.ts`: 24 tests passed
   - `src/credits/service.test.ts`: 24 tests passed

**现有后端 API 端点**:
- 订阅管理: `/subscription/plans`, `/subscription/me`, `/subscription/invoices`, `/subscription/limits`
- 积分管理: `/credits/balance`, `/credits/transactions`, `/credits/purchase`, `/credits/referral`
- 公开端点: `/subscription/public/plans`, `/subscription/public/compare`, `/subscription/public/benefits`

**剩余工作**:
- 前端 /pricing 定价页 (FE-P0-01)
- 前端功能对比表 (FE-P0-02)
- 前端积分获取指南 (FE-P0-03)

---

## 本次会话修复记录 (2026-04-29 16:25 UTC)

### 修复内容

1. **新增缺失的共享模块**:
   - `src/shared/node-access.ts`: 实现 `resolveAuthorizedNodeId` 函数
   - `src/shared/prisma.ts`: 实现 `createUnconfiguredPrismaClient` 工具函数
   - `src/shared/errors.ts`: 导出 `EvoMapError` 别名（向后兼容）

2. **新增缺失的服务模块**:
   - `src/sandbox/service.ts`: 完整的 Sandbox 服务实现
   - `src/marketplace/service.ts`: 完整的 Marketplace 服务实现
   - `src/marketplace/pricing.ts`: Marketplace 定价策略实现
   - `src/marketplace/service.marketplace.ts`: 兼容性重新导出

3. **修复订阅服务**:
   - `src/subscription/service.ts`: 新增 `getSubscriptionStatus` 异步函数导出（sandbox 路由依赖）

4. **测试验证**:
   - `src/subscription/service.test.ts`: ✅ 通过
   - `src/credits/service.test.ts`: ✅ 通过
   - `src/webhook/service.test.ts`: ✅ 通过
   - 共计 68 tests passed

### 后端 API 端点汇总

| 模块 | 端点前缀 | 状态 |
|------|----------|------|
| 订阅管理 | `/api/v2/subscription/*`, `/subscription/*` | ✅ 完整 |
| 积分管理 | `/a2a/credit/*`, `/api/v2/credits/*` | ✅ 完整 |
| Webhook | `/api/v2/webhook/*` | ✅ 完整 |
| Sandbox | `/api/v2/sandbox/*` | ✅ 服务已实现 |
| Marketplace | `/api/v2/marketplace/*` | ✅ 服务已实现 |
| 高级搜索 | `/api/v2/advanced-search/*` | ✅ 完整 |
| 导出 | `/api/v2/export/*` | ✅ 完整 |
| 监控 | `/api/v2/monitoring/*` | ✅ 完整 |

---

**提取完成** | 来源: `docs/RELEASE-v1.0.0-GAP-REPORT.md`
