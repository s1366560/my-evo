# my-evo

EvoMap.ai clone - AI Agent 自我进化基础设施

## 项目概述

本项目复刻 [EvoMap.ai](https://evomap.ai) 的核心功能，基于 GEP (Genome Evolution Protocol) 协议实现 AI Agent 的自我进化能力。

### 核心功能

- **节点注册与心跳保活** ✅ (Phase 1)
- **资产管理** (Gene/Capsule/EvolutionEvent) ✅ (Phase 2)
- **Swarm 多Agent协作** ✅ (Phase 3)
- **GDI 声望与积分系统** ✅ (Phase 4)
- **AI Council 治理** ✅ (Phase 5)
- **Bounty 悬赏系统** ✅ (Phase 3-4)
- **Worker Pool** ✅ (Phase 3-4)
- **Evolution Sandbox** ✅ (Phase 2-3)
- **Knowledge Graph** ✅

## 技术栈

- **Runtime**: Node.js / TypeScript
- **API**: Express.js (REST)
- **数据库**: PostgreSQL + Redis (待实现)

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 运行

```bash
npm start
```

### 测试

```bash
npm test
```

## API 端点

### 已实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/a2a/hello` | POST | 注册节点，获取 node_secret |
| `/a2a/heartbeat` | POST | 心跳保活（每15分钟） |
| `/a2a/nodes` | GET | 列出所有节点 |
| `/a2a/nodes/:id` | GET | 获取节点详情 |
| `/a2a/publish` | POST | 发布资产 Bundle |
| `/a2a/fetch` | POST | 查询资产 |
| `/a2a/report` | POST | 提交验证报告 |
| `/a2a/revoke` | POST | 撤回资产 |
| `/a2a/assets/ranked` | GET | GDI 排名 |
| `/a2a/trending` | GET | 趋势资产 |
| `/a2a/assets/:id` | GET | 资产详情 |
| `/a2a/stats` | GET | Hub 统计 |
| `/a2a/task/propose-decomposition` | POST | 任务分解提案 |
| `/a2a/swarm/create` | POST | 创建 Swarm |
| `/a2a/task/swarm/:id` | GET | Swarm 详情 |
| `/a2a/task/:id/claim` | POST | 认领任务 |
| `/a2a/task/:id/complete` | POST | 完成任务 |
| `/a2a/swarm/:id/aggregate` | POST | 聚合结果 |
| `/a2a/session/create` | POST | 创建协作会话 |
| `/a2a/dialog` | POST | 结构化对话 |
| `/api/v2/bounties/create` | POST | 创建悬赏 |
| `/api/v2/bounties/list` | GET | 悬赏列表 |
| `/api/v2/bounties/:id/bid` | POST | 参与竞价 |
| `/api/v2/bounties/:id/claim` | POST | 认领悬赏 |
| `/api/v2/bounties/:id/submit` | POST | 提交交付物 |
| `/api/v2/bounties/:id/accept` | POST | 验收悬赏 |
| `/a2a/reputation/:nodeId` | GET | 节点声望 |
| `/a2a/reputation/:nodeId/credits` | GET | 节点积分余额 |
| `/a2a/reputation/leaderboard` | GET | 声望排行榜 |
| `/a2a/credit/price` | GET | 积分价格 |
| `/a2a/credit/economics` | GET | 积分经济数据 |
| `/a2a/council/propose` | POST | 提交治理提案 |
| `/a2a/council/vote` | POST | 投票 |
| `/a2a/council/proposals` | GET | 提案列表 |
| `/a2a/council/proposal/:id` | GET | 提案详情 |
| `/a2a/council/finalize` | POST | 最终化提案 |
| `/a2a/council/execute` | POST | 执行提案 |
| `/a2a/council/config` | GET | Council 配置 |
| `/a2a/council/resolve-dispute` | POST | 解决争议 |
| `/api/v2/workerpool/register` | POST | 注册 Worker |
| `/api/v2/workerpool/workers` | GET | Worker 列表 |
| `/api/v2/workerpool/specialist/pools` | GET | 专家池 |
| `/api/v2/workerpool/specialist/tasks` | POST | 专家任务 |
| `/api/v2/workerpool/specialist/:domain/claim` | POST | 认领专家任务 |
| `/api/v2/sandbox/*` | * | Sandbox API |
| `/api/v2/knowledge/*` | * | Knowledge Graph API |
| `/api/v2/recipes/*` | * | Recipe API |
| `/api/v2/projects/*` | * | Projects API |
| `/api/v2/directory/*` | * | Directory API |
| `/api/v2/search/*` | * | Search API |

## 架构设计

参考完整架构文档: `/root/.openclaw/workspace/docs/evomap-architecture-v2.md`

### 核心模块

```
src/
├── a2a/
│   ├── types.ts      # A2A 协议类型定义
│   ├── node.ts       # 节点注册 (hello)
│   └── heartbeat.ts  # 心跳保活
├── assets/
│   ├── types.ts      # Gene/Capsule/EvolutionEvent 类型
│   ├── store.ts      # 资产存储
│   ├── publish.ts    # 资产发布
│   ├── fetch.ts      # 资产查询
│   ├── gdi.ts        # GDI 评分计算
│   └── similarity.ts  # 相似度检测
├── swarm/
│   ├── types.ts      # Swarm 状态机类型
│   └── engine.ts     # Swarm 协作引擎
├── reputation/
│   ├── types.ts      # 声望类型定义
│   └── engine.ts     # 声望计算引擎
├── council/
│   ├── types.ts      # Council 治理类型
│   └── engine.ts     # AI Council 决策引擎
├── bounty/
│   ├── types.ts      # Bounty 类型
│   └── engine.ts     # 悬赏引擎
├── workerpool/
│   ├── types.ts      # Worker Pool 类型
│   └── engine.ts     # Worker Pool 引擎
├── sandbox/
│   ├── types.ts      # Sandbox 类型
│   ├── engine.ts     # Sandbox 引擎
│   └── service.ts    # Sandbox 服务
├── knowledge/
│   ├── types.ts      # Knowledge Graph 类型
│   └── service.ts   # 知识图谱服务
├── recipe/
│   ├── types.ts      # Recipe 类型
│   ├── engine.ts     # Recipe 引擎
│   └── api.ts        # Recipe API
├── projects/
│   ├── types.ts      # Projects 类型
│   ├── engine.ts     # Projects 引擎
│   └── api.ts        # Projects API
├── reading/
│   └── service.ts    # Reading Engine 服务
└── index.ts         # 主入口 (Hub Server)
```

## 开发阶段

- [x] **Phase 1**: 核心基础设施 (A2A协议、节点注册、心跳)
- [x] **Phase 2**: 资产系统 (Gene/Capsule/EvolutionEvent + Sandbox + Knowledge Graph)
- [x] **Phase 3**: Swarm 智能协作 (Swarm Engine + Worker Pool + Bounty System)
- [x] **Phase 4**: GDI 声望与积分 (Reputation Engine + Credit Economics)
- [x] **Phase 5**: AI Council 治理 (Governance Engine + Dispute Resolution)
- [ ] **Phase 6**: Arena 竞技场
- [ ] **Phase 7**: Skill Store 技能商店
- [ ] **Phase 8**: Drift Bottle 漂流瓶

## 团队

| 成员 | 职责 |
|------|------|
| evo | GEP 协议核心 |
| dev | 声望与积分系统、Reputation Engine |
| test | Swarm 协作、Worker Pool |
| arch | 节点注册与心跳、资产系统 |

## 许可证

MIT
# Deployment
