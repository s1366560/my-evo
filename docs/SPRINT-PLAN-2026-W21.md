# Sprint Plan: 2026-W21 Implementation

**Sprint**: 2026-W21
**Start Date**: 2026-05-19
**Based on**: gap-analysis.md (commit a9b04255e)
**Goal**: 实现 my-evo 项目的核心 P0 模块，修复 app.ts 启动阻塞

---

## 背景

gap-analysis.md 揭示了以下关键问题：
- **Backend**: 33 个模块缺失 (app.ts 尝试动态导入但文件不存在)
- **Frontend**: 约 65% 页面覆盖率
- **Overall Parity**: ~35%

当前 app.ts 会因模块缺失导致启动失败。本 Sprint 聚焦于修复启动阻塞并实现核心协议。

---

## Sprint Goals

### Primary
1. 实现 A2A Protocol 核心模块 (15 endpoints)
2. 实现 Assets 模块 (CRUD + publish)
3. 实现/增强 Search 模块

### Secondary
- 确保 `npm run build` 成功
- 确保 `npx tsx src/index.ts` 正常启动
- 确保后端测试通过

---

## Module 1: A2A Protocol (`src/a2a/`)

### Status
- **Current**: MISSING (app.ts line 192 导入失败)
- **Target**: Full implementation

### Files to Create
```
src/a2a/
├── routes.ts      # Fastify route registration
├── service.ts     # Business logic
└── types.ts       # TypeScript interfaces
```

### API Endpoints

| Method | Path | Description | Priority |
|--------|------|-------------|----------|
| POST | /a2a/hello | Node handshake | P0 |
| POST | /a2a/heartbeat | Heartbeat | P0 |
| POST | /a2a/publish | Publish capability | P0 |
| POST | /a2a/fetch | Fetch node/asset | P0 |
| POST | /a2a/search | Search directory | P0 |
| POST | /a2a/report | Report status | P0 |
| GET | /a2a/directory | List nodes | P0 |
| GET | /a2a/nodes/:nodeId | Get specific node | P0 |
| GET | /a2a/billing/earnings | Earnings | P0 |
| GET | /a2a/help | Help info | P1 |

### Data Model
依赖现有 Prisma models: `Node`, `ReputationEvent`

### Acceptance Criteria
- [ ] 所有 10 个 endpoints 实现
- [ ] TypeScript 类型完整
- [ ] 错误处理完善
- [ ] 基础单元测试

---

## Module 2: Assets (`src/assets/`)

### Status
- **Current**: MISSING (app.ts line 195 导入失败)
- **Target**: Full CRUD + publish

### Files to Create/Modify
```
src/assets/
├── routes.ts      # Fastify route registration
├── service.ts     # Business logic
└── types.ts       # TypeScript interfaces
```

### API Endpoints

| Method | Path | Description | Priority |
|--------|------|-------------|----------|
| GET | /assets | List assets | P0 |
| GET | /assets/:id | Get asset | P0 |
| POST | /assets | Create asset | P0 |
| PUT | /assets/:id | Update asset | P1 |
| DELETE | /assets/:id | Delete asset | P1 |
| POST | /assets/publish | Publish asset | P0 |
| GET | /assets/categories | Asset categories | P2 |

### Data Model
依赖现有 Prisma model: `Asset`

### Acceptance Criteria
- [ ] 资产 CRUD 功能完整
- [ ] 发布流程可用
- [ ] 权限验证
- [ ] 基础单元测试

---

## Module 3: Search (`src/search/`)

### Status
- **Current**: EXISTS (src/search/) - 需要验证完整性
- **Target**: 增强搜索能力

### Files
```
src/search/
├── routes.ts      # 验证/增强
└── service.ts     # 验证/增强
```

### API Endpoints

| Method | Path | Description | Priority |
|--------|------|-------------|----------|
| GET | /search?q= | Full-text search | P0 |
| GET | /search/suggestions | Search suggestions | P1 |
| GET | /search/trending | Trending searches | P1 |

### Acceptance Criteria
- [ ] 全文搜索可用
- [ ] 搜索建议
- [ ] 热门搜索

---

## Task Decomposition

### Phase 1: A2A Protocol
| Task | Worker | Hours | Dependencies |
|------|--------|-------|--------------|
| 创建 src/a2a/types.ts | backend-dev | 1 | - |
| 创建 src/a2a/service.ts | backend-dev | 2 | types.ts |
| 创建 src/a2a/routes.ts | backend-dev | 2 | service.ts |
| 添加单元测试 | backend-dev | 1 | routes.ts |

### Phase 2: Assets Module
| Task | Worker | Hours | Dependencies |
|------|--------|-------|--------------|
| 创建 src/assets/types.ts | backend-dev | 1 | - |
| 创建 src/assets/service.ts | backend-dev | 2 | types.ts |
| 创建 src/assets/routes.ts | backend-dev | 2 | service.ts |
| 添加单元测试 | backend-dev | 1 | routes.ts |

### Phase 3: Search Module
| Task | Worker | Hours | Dependencies |
|------|--------|-------|--------------|
| 审查现有 search 实现 | backend-dev | 0.5 | - |
| 增强 search service | backend-dev | 1.5 | - |
| 添加新 endpoints | backend-dev | 1 | service.ts |

---

## Verification Plan

### Build Verification
```bash
cd /workspace/.memstack/worktrees/c90d13b0-dc20-4ffd-ab72-33c620fb8c5a
npm run build
```

### Test Verification
```bash
npm test
```

### Runtime Verification
```bash
npx tsx src/index.ts
# 期望: 无模块导入错误，服务器正常启动
```

### Health Check
```bash
curl http://localhost:3000/health
# 期望: {"status":"ok",...}
```

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Prisma model 不完整 | Medium | High | 审查现有 schema.prisma |
| 搜索性能问题 | Low | Medium | 使用现有数据库索引 |
| 权限验证复杂性 | Medium | Medium | 使用 shared/auth.ts |

---

## Next Steps (Post-Sprint)

1. **Sprint 2026-W22**: 实现 Bounty, Reputation 模块
2. **Sprint 2026-W23**: 实现 Credits, Subscription 模块
3. **Sprint 2026-W24**: Frontend 增强 (Asset Detail, Checkout)

---

## References

- Gap Analysis: `docs/gap-analysis.md`
- Architecture: `docs/architecture/technical-architecture-v2.md`
- API Spec: `docs/my-evo-api-spec-workspace-v1.md`
