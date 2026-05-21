# My-Evo 任务分解总览 (Master Decomposition)

**目标**: 复刻 evomap.ai 项目，补齐架构文档并完成 my-evo 项目的前后端功能完整开发
**创建时间**: 2026-04-27
**状态**: 已分解，待分派

---

## 任务分解概览

### 阶段一: MVP 关键功能 (P0) - 阻塞性问题

| 任务ID | 任务名称 | Worker | 优先级 | 状态 |
|--------|---------|--------|--------|------|
| T-P0-001 | **资产购买流程** | frontend-dev | CRITICAL | 待分派 |
| T-P0-002 | **资产发布UI** | frontend-dev | CRITICAL | 待分派 |
| T-P0-003 | **Checkout/支付后端** | backend-dev | CRITICAL | 待分派 |
| T-P0-004 | **赏金任务前端** | frontend-dev | CRITICAL | 待分派 |

### 阶段二: 核心体验 (P1) - 重要功能

| 任务ID | 任务名称 | Worker | 优先级 | 状态 |
|--------|---------|--------|--------|------|
| T-P1-001 | **配方编辑器 (Recipe Composer)** | frontend-dev | HIGH | 待分派 |
| T-P1-002 | **通知系统** | frontend-dev | HIGH | 待分派 |
| T-P1-003 | **Agent 个人页面** | frontend-dev | HIGH | 待分派 |
| T-P1-004 | **资产详情页增强** | frontend-dev | HIGH | 待分派 |
| T-P1-005 | **订阅计划UI** | frontend-dev | MEDIUM | 待分派 |
| T-P1-006 | **公会系统** | frontend-dev | MEDIUM | 待分派 |
| T-P1-007 | **漂流瓶UI** | frontend-dev | MEDIUM | 待分派 |
| T-P1-008 | **Circle/社区页面** | frontend-dev | MEDIUM | 待分派 |

### 阶段三: 完善优化 (P2) - 锦上添花

| 任务ID | 任务名称 | Worker | 优先级 | 状态 |
|--------|---------|--------|--------|------|
| T-P2-001 | **收藏/心愿单** | frontend-dev | LOW | 待分派 |
| T-P2-002 | **用户设置增强** | frontend-dev | LOW | 待分派 |
| T-P2-003 | **国际化支持** | frontend-dev | LOW | 待分派 |
| T-P2-004 | **邮件通知** | backend-dev | LOW | 待分派 |
| T-P2-005 | **分析仪表盘** | frontend-dev | LOW | 待分派 |

### 阶段四: 架构文档 (DOC)

| 任务ID | 任务名称 | Worker | 优先级 | 状态 |
|--------|---------|--------|--------|------|
| T-DOC-001 | **完整架构文档** | documentation | HIGH | 待分派 |
| T-DOC-002 | **API 文档生成** | documentation | HIGH | 待分派 |
| T-DOC-003 | **组件库文档** | documentation | MEDIUM | 待分派 |
| T-DOC-004 | **部署指南** | documentation | MEDIUM | 待分派 |
| T-DOC-005 | **测试策略文档** | documentation | MEDIUM | 待分派 |

---

## 项目技术栈参考

### 后端
- **框架**: Fastify 5.0 + TypeScript 5.5
- **ORM**: Prisma 6.0
- **数据库**: PostgreSQL + Redis + Neo4j
- **模块数**: 51 个 (22 个活跃, 15 个占位)

### 前端
- **框架**: Next.js (frontend/ 目录)
- **UI**: 基于 Radix UI + Tailwind
- **路由**: 22 个页面已实现

### 关键 API 前缀
- `/a2a` - GEP-A2A 协议 (a2a, assets, credits, reputation)
- `/api/v2/swarm` - Swarm 模块
- `/api/v2/bounty` - 赏金系统
- `/api/v2/marketplace` - 市场
- `/api/v2/circle` - 圈子
- `/api/v2/arena` - 竞技场

---

## Worker 分派说明

1. **frontend-dev** - 前端开发 Worker，负责所有 UI/UX 相关功能
2. **backend-dev** - 后端开发 Worker，负责 API、业务逻辑、数据库
3. **documentation** - 文档 Worker，负责架构文档、API 文档

### 分派规则
- P0 任务优先分派
- 每个 Worker 一次最多接收 3 个任务
- 依赖任务需等待前置任务完成

---

## 进度追踪

- [x] 任务分解完成
- [ ] T-P0-001 ~ T-P0-004 分派
- [ ] T-P1-001 ~ T-P1-008 分派
- [ ] T-P2-001 ~ T-P2-005 分派
- [ ] T-DOC-001 ~ T-DOC-005 分派
