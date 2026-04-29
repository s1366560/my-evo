# my-evo v2.0 Sprint Plan — Gap Fix

**项目**: my-evo (evomap.ai 复刻)
**版本**: v2.0 — Post-RC Gap Fix Sprint
**生成时间**: 2026-04-29
**生成者**: Workspace Builder (task 87f65ace)
**状态**: **DRAFT** — 需确认优先级

---

## 1. 当前基线

### 1.1 总体状态

| 维度 | 状态 | 详情 |
|------|------|------|
| 前端构建 | ✅ 34 pages, 0 errors | `/pricing` 页面已补齐 |
| 后端构建 | ⚠️ **70 TS errors** | 28 个缺失路由模块 + marketplace/sandbox 类型问题 |
| 单元测试 | ✅ 3100+ tests, 99.9% | 2 pre-existing GDI failures |
| E2E 测试 | ✅ 41 tests passing | |
| 文档 | ✅ 40+ 文档 | |
| 发布就绪 | ✅ All checklist verified | |

**关键约束**: 前端可独立构建/部署，后端需修复 TS errors 才能完整编译。

---

## 2. Gap Triage

### 2.1 分类统计

| 类别 | 阻断(P0) | 高优先(P1) | 中优先(P2) | 合计 |
|------|----------|-----------|-----------|------|
| 后端 — 缺失路由模块 | 28 个 | — | — | 28 |
| 后端 — marketplace TS 类型 | 1 个 | — | — | 1 |
| 后端 — sandbox TS 类型 | 4 个 | — | — | 4 |
| 前端 — UI 细节 | — | 4 项 | 4 项 | 8 |
| 文档 — 深度内容 | — | 3 项 | 2 项 | 5 |
| **合计** | **33** | **7** | **6** | **46** |

### 2.2 P0 — 阻断性（必须处理，否则后端无法完整启动）

#### Gap BE-P0-BACKEND-01: 28 个缺失的后端路由模块

**影响**: `src/app.ts` 引用了 28 个尚未实现的路由模块，编译失败。

**清单**:
```
./worker/gdi-refresh        ./a2a/routes             ./assets/routes
./claim/routes             ./reputation/routes       ./swarm/routes
./workerpool/routes        ./council/routes          ./bounty/routes
./bounty/compat-routes     ./session/routes          ./search/routes
./analytics/routes         ./biology/routes          ./quarantine/routes
./driftbottle/routes       ./community/routes        ./circle/routes
./kg/routes                ./arena/routes            ./arena/service
./account/routes           ./onboarding/routes       ./verifiable_trust/routes
./reading/routes           ./sync/routes             ./task/routes
./task_alias/routes        ./billing/routes          ./questions/routes
./memory_graph/routes      ./memory_graph/spec-routes
```

**根因**: `src/app.ts` 中使用 `app.register(import('./...'))` 导入这些模块，但文件不存在。

**处理方案（三选一）**:
| 方案 | 做法 | 工时 | 风险 |
|------|------|------|------|
| A. 全部实现 | 为每个模块写完整的 routes + service | 40h+ | 高（大量 mock 数据） |
| B. 全部存根 | 写 minimal stubs + `// TODO` comments | 4h | 低（展示编译通过） |
| C. 条件注册 | 在 `app.ts` 中条件化导入（注释掉不存在模块） | 1h | 低（推荐） |

> **推荐方案 C**：修改 `src/app.ts`，将缺失模块的 `app.register()` 调用条件化（用注释或特性开关包裹），使编译通过，同时保留模块注册位置供后续实现。

#### Gap BE-P0-MARKETPLACE-01: marketplace routes.ts 类型错误（14 处）

**文件**: `src/marketplace/routes.ts`
**根因**: routes 调用了 service 层未导出的函数。

**缺失的 service 函数**（需在 `src/marketplace/service.ts` 或 `src/marketplace/service.marketplace.ts` 中补充）:

| 函数名 | 调用位置 | 备注 |
|--------|----------|------|
| `calculateDynamicPrice` | `routes.ts:17` | 来自 `pricing.ts`，需 `export` |
| `buyListing` | `routes.ts:50` | 需新增 |
| `cancelListing` | `routes.ts:66` | 需新增 |
| `getListings` | `routes.ts:82` | 存在 `listListings`，需 alias |
| `searchServiceListings` | `routes.ts:96` | 需新增 |
| `getTransactionHistory` | `routes.ts:121` | 需新增 |
| `createServiceListing` | `routes.ts:164` | 需新增 |
| `getServiceListing` | `routes.ts:189` | 需新增 |
| `updateServiceListing` | `routes.ts:226` | 需新增 |
| `cancelServiceListing` | `routes.ts:239` | 需新增 |
| `purchaseService` | `routes.ts:260` | 需新增 |
| `getMyPurchases` | `routes.ts:281` | 需新增 |
| `confirmPurchase` | `routes.ts:304` | 需新增 |
| `disputePurchase` | `routes.ts:334` | 需新增 |
| `getTransactionHistory` (service.marketplace) | `routes.ts:355` | 需新增 |
| `getTransaction` | `routes.ts:374,388` | 需新增 |
| `getMarketStats` | `routes.ts:396` | 需新增 |
| `getBalance` | `routes.ts:406` | 需新增 |

**工时**: 16-24h（实现完整 marketplace service 层）
**优先级**: P0（阻断 TypeScript 编译）

#### Gap BE-P0-SANDBOX-01: sandbox routes.ts 类型错误（4 处）

**文件**: `src/sandbox/routes.ts`

| 行 | 错误 | 修复 |
|----|------|------|
| 310 | `state: string` 不能赋值给 `"pending" \| "completed" \| ...` | 类型断言 `state as Sandbox['state']` 或 `parseState()` |
| 431 | `SandboxAsset` 缺少 `sandbox_id` 必填字段 | 补 `sandbox_id` 参数 |
| 603 | `success` 属性重复定义 | 删除重复的 `success: true` |
| 621 | `success` 属性重复定义 | 删除重复的 `success: true` |

**工时**: 2h（简单类型修复）
**优先级**: P0

---

## 3. Sprint 计划

### Sprint 1 — 阻断修复（目标：后端 TypeScript 编译通过）

**目标**: 消除 70 个 TS 编译错误

| # | 任务 | 负责人 | 工时 | 依赖 |
|---|------|--------|------|------|
| S1-T1 | 修复 `src/sandbox/routes.ts` 4处类型错误 | 后端 | 2h | 无 |
| S1-T2 | `src/app.ts` 条件化缺失路由注册（方案C） | 后端 | 1h | S1-T1 |
| S1-T3 | `src/marketplace/service.ts` 补充缺失函数 | 后端 | 16h | 无 |
| S1-T4 | 验证 `npm run build` 编译通过 | 后端 | 1h | S1-T3 |

**Sprint 1 交付物**:
- ✅ 后端 0 TypeScript errors
- ✅ `src/app.ts` 中缺失路由的条件化注释说明
- ✅ marketplace service 完整

**验收标准**: `npm run build 2>&1 | grep "error TS" | wc -l` → `0`

---

### Sprint 2 — UI 完善（目标：品牌对齐）

**目标**: Hero 区域、生态合作展示、QA 区块等 P1 前端差异

| # | 任务 | 负责人 | 工时 | 依赖 |
|---|------|--------|------|------|
| S2-T1 | Hero 区域品牌对齐（"One agent learns..." 文案） | 前端 | 4h | Sprint 1 |
| S2-T2 | 生态合作伙伴展示（OpenClaw/Manus/Cursor） | 前端 | 2h | Sprint 1 |
| S2-T3 | Quality Assurance 区块 | 前端 | 3h | Sprint 1 |
| S2-T4 | GitHub Star CTA 按钮 | 前端 | 1h | Sprint 1 |
| S2-T5 | 验证前端构建 0 errors | 前端 | 1h | S2-T1..T4 |

**验收标准**: `cd frontend && npm run build 2>&1 | tail -5` → `0 errors`

---

### Sprint 3 — 文档完善（目标：开发者体验提升）

**目标**: 补齐 GEP Protocol、Swarm、Webhooks 深度文档

| # | 任务 | 负责人 | 工时 | 依赖 |
|---|------|--------|------|------|
| S3-T1 | GEP Protocol 文档（40章节 → 完整） | 文档 | 16h | Sprint 1 |
| S3-T2 | Swarm Intelligence 文档 | 文档 | 8h | Sprint 1 |
| S3-T3 | Webhooks 独立章节 | 文档 | 4h | Sprint 1 |
| S3-T4 | 文档审查和一致性检查 | 文档 | 4h | S3-T1..T3 |

---

### Sprint 4 — 28 个路由模块实现（可选，后续迭代）

**说明**: 仅在需要完整后端功能时执行。每个模块约 1-2h，实现基础 CRUD + service。

**模块分组**（建议按功能域分组，每组 1-2 天）:
| 分组 | 模块 |
|------|------|
| 核心 Agent | swarm, workerpool, council, arena |
| 内容 | claim, bounty, questions, reading |
| 社交 | community, circle, driftbottle, session |
| 账户 | account, onboarding, billing, sync |
| 数据 | assets, search, analytics, biology |
| 信任 | reputation, verifiable_trust, quarantine, kg |
| 任务 | task, task_alias, a2a, worker/gdi-refresh |
| 新增 | memory_graph |

**总工时**: ~40h（建议 2 周迭代完成）

---

## 4. 推荐行动路径

### 路径 A: 快速发布（推荐）

```
Day 1:  修复 sandbox 4处类型错误（S1-T1）
Day 1:  条件化 app.ts 缺失路由（S1-T2）
Day 2:  marketplace service 补函数（S1-T3）
Day 2:  npm run build 验证 0 errors（S1-T4）
Day 3:  前端 UI P1 完善（S2-T1..T4）
Day 4:  提交代码，发布 v1.0.0
```
→ **结果**: v1.0.0 发布，后端完整编译，前端品牌对齐

### 路径 B: 保守路径

```
Day 1-2:  完成 Sprint 1（阻断修复）
Day 3-5:  完成 Sprint 2（UI 完善）
Day 6-7:  文档补充（Sprint 3 部分）
Week 2:   Sprint 4 路由模块（可选）
```
→ **结果**: v2.0.0，具备完整后端和文档

---

## 5. 工时汇总

| Sprint | 任务 | 工时 | 产出 |
|--------|------|------|------|
| Sprint 1 | 阻断修复 | 20h | 后端 0 TS errors |
| Sprint 2 | UI 完善 | 10h | 品牌对齐 |
| Sprint 3 | 文档完善 | 28h | 开发者文档完整 |
| Sprint 4 | 28 路由模块 | 40h | 完整后端（可选） |
| **合计** | | **58h（必做）+ 40h（可选）** | |

---

## 6. 关键风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| marketplace service 规模较大（18 个函数） | Sprint 1 延期风险 | 可先实现存根函数 + TODO，后续迭代补全 |
| 28 个路由模块依赖 app.ts 注册逻辑 | 条件化注册后功能降级 | 明确标记 TODO，待后续实现 |
| sandbox `state` 字段类型不匹配 | 编译失败 | 简单类型断言修复，2h 可解决 |

---

*文档生成: Workspace Builder Agent | 2026-04-29*
