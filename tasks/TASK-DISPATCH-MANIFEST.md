# My-Evo 任务分派清单

**Leader**: Sisyphus
**分解时间**: 2026-04-27T18:15:00Z
**状态**: ✅ 已分解，等待 Worker 分派

---

## 任务总览

| 阶段 | 任务数 | 优先级 |
|------|--------|--------|
| P0 (MVP 关键) | 4 | CRITICAL |
| P1 (核心体验) | 8 | HIGH/MEDIUM |
| P2 (完善优化) | 5 | LOW |
| DOC (架构文档) | 4 | HIGH/MEDIUM |
| **总计** | **21** | - |

---

## 分派队列

### 🚨 CRITICAL - 立即分派 (P0)

| # | 任务ID | 任务名称 | Worker | 文件 |
|---|--------|---------|--------|------|
| 1 | T-P0-001 | 资产购买流程 | frontend-dev | decomposed/T-P0-001-ASSET-PURCHASE-FLOW.md |
| 2 | T-P0-002 | 资产发布 UI | frontend-dev | decomposed/T-P0-002-ASSET-PUBLISH-UI.md |
| 3 | T-P0-003 | Checkout 后端 | backend-dev | decomposed/T-P0-003-CHECKOUT-BACKEND.md |
| 4 | T-P0-004 | 赏金任务前端 | frontend-dev | decomposed/T-P0-004-BOUNTY-FRONTEND.md |

### ⚠️ HIGH - 高优先级 (P1)

| # | 任务ID | 任务名称 | Worker | 文件 |
|---|--------|---------|--------|------|
| 5 | T-P1-001 | 配方编辑器 | frontend-dev | decomposed/T-P1-001-RECIPE-COMPOSER.md |
| 6 | T-P1-002 | 通知系统 | frontend-dev | decomposed/T-P1-002-NOTIFICATIONS-SYSTEM.md |
| 7 | T-P1-003 | Agent 个人页面 | frontend-dev | decomposed/T-P1-003-AGENT-PROFILE-PAGES.md |
| 8 | T-P1-004 | 资产详情页增强 | frontend-dev | decomposed/T-P1-004-ASSET-DETAIL-ENHANCEMENTS.md |

### 📋 MEDIUM - 中优先级 (P1/P2)

| # | 任务ID | 任务名称 | Worker | 文件 |
|---|--------|---------|--------|------|
| 9 | T-P1-005 | 订阅计划 UI | frontend-dev | - |
| 10 | T-P1-006 | 公会系统 | frontend-dev | - |
| 11 | T-P1-007 | 漂流瓶 UI | frontend-dev | - |
| 12 | T-P1-008 | Circle/社区 | frontend-dev | - |

### 📝 LOW - 低优先级 (P2)

| # | 任务ID | 任务名称 | Worker |
|---|--------|---------|--------|
| 13 | T-P2-001 | 收藏/心愿单 | frontend-dev |
| 14 | T-P2-002 | 用户设置增强 | frontend-dev |
| 15 | T-P2-003 | 国际化支持 | frontend-dev |
| 16 | T-P2-004 | 邮件通知 | backend-dev |
| 17 | T-P2-005 | 分析仪表盘 | frontend-dev |

### 📚 DOCUMENTATION

| # | 任务ID | 任务名称 | Worker |
|---|--------|---------|--------|
| 18 | T-DOC-001 | API 文档生成 | documentation |
| 19 | T-DOC-002 | 组件库文档 | documentation |
| 20 | T-DOC-003 | 部署指南 | documentation |
| 21 | T-DOC-004 | 测试策略文档 | documentation |

---

## Worker 分配

### frontend-dev
- 分配任务数: 13
- 任务列表: T-P0-001, T-P0-002, T-P0-004, T-P1-001~T-P1-008, T-P2-001~T-P2-003, T-P2-005

### backend-dev
- 分配任务数: 2
- 任务列表: T-P0-003, T-P2-004

### documentation
- 分配任务数: 4
- 任务列表: T-DOC-001~T-DOC-004

---

## 任务依赖关系

```
P0 任务 (无依赖，可立即开始)
├── T-P0-001 (资产购买) → 依赖 T-P0-003 (后端完成)
├── T-P0-002 (资产发布)
├── T-P0-003 (Checkout 后端) → 无依赖
└── T-P0-004 (赏金前端)

P1 任务 (等待 P0 部分完成)
├── T-P1-001~T-P1-004 → 可在 P0 期间并行
└── T-P1-005~T-P1-008 → 可在 P0 期间并行

P2 任务 (等待 P1 完成)
└── T-P2-001~T-P2-005

DOC 任务 (可与开发并行)
└── T-DOC-001~T-DOC-004
```

---

## 执行建议

1. **第一批分派** (立即):
   - frontend-dev: T-P0-001, T-P0-002, T-P0-004
   - backend-dev: T-P0-003
   - documentation: T-DOC-001

2. **第二批分派** (P0 完成后):
   - frontend-dev: T-P1-001, T-P1-002, T-P1-003, T-P1-004
   - documentation: T-DOC-002, T-DOC-003, T-DOC-004

3. **第三批分派** (P1 完成后):
   - frontend-dev: T-P1-005~T-P1-008
   - frontend-dev: T-P2-001~T-P2-003
   - backend-dev: T-P2-004

4. **第四批分派** (P2 完成后):
   - frontend-dev: T-P2-005

---

## 系统集成

任务已写入 todowrite.json，Worker 系统将自动拾取并分配。

**文件位置**:
- `/workspace/my-evo/.claude/todos/todowrite.json` (主文件)
- `/workspace/my-evo/tasks/dispatch-todowrite.json` (备份)

**任务详情目录**: `/workspace/my-evo/tasks/decomposed/`

---

*分解完成。等待 Worker 系统响应。*
