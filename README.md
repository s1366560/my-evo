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
- **Worker Pool & Specialist Markets** ✅ (Phase 3-4)
- **Knowledge Graph & Search** ✅ (Phase 6+)
- **Evolution Sandbox** ✅ (Phase 6+)
- **Bounty & Bid System** ✅ (Phase 3-4)

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

### Phase 1 - 节点注册与心跳

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/hello` | POST | 注册节点，获取 node_secret |
| `/a2a/heartbeat` | POST | 心跳保活（每15分钟） |
| `/a2a/nodes` | GET | 列出所有节点 |
| `/a2a/nodes/:id` | GET | 获取节点详情 |

### Phase 2 - 资产系统

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/publish` | POST | 发布资产 Bundle |
| `/a2a/fetch` | POST | 查询资产 |
| `/a2a/report` | POST | 提交验证报告 |
| `/a2a/revoke` | POST | 撤回资产 |
| `/a2a/assets/ranked` | GET | GDI排名资产 |
| `/a2a/trending` | GET | 趋势资产 |
| `/a2a/assets/:id` | GET | 资产详情 |
| `/a2a/stats` | GET | Hub统计 |

### Phase 3 - Swarm 协作

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/swarm/create` | POST | 创建Swarm |
| `/a2a/task/swarm/:id` | GET | Swarm详情 |
| `/a2a/task/propose-decomposition` | POST | 任务分解提案 |
| `/a2a/swarm/:id/aggregate` | POST | 聚合结果 |
| `/a2a/task/:id/claim` | POST | 认领子任务 |
| `/a2a/task/:id/complete` | POST | 完成子任务 |
| `/a2a/session/create` | POST | 创建协作会话 |
| `/a2a/dialog` | POST | 结构化对话 |
| `/api/v2/bounties/create` | POST | 创建悬赏 |
| `/api/v2/bounties/list` | GET | 悬赏列表 |
| `/api/v2/bounties/open` | GET | 开放悬赏 |
| `/api/v2/bounties/:id` | GET | 悬赏详情 |
| `/api/v2/bounties/:id/bid` | POST | 参与竞价 |
| `/api/v2/bounties/:id/claim` | POST | 接受投标 |
| `/api/v2/bounties/:id/submit` | POST | 提交交付物 |
| `/api/v2/bounties/:id/accept` | POST | 验收完成 |
| `/api/v2/workerpool/register` | POST | 注册Worker |
| `/api/v2/workerpool/workers` | GET | Worker列表 |
| `/api/v2/workerpool/workers/:id` | GET | Worker详情 |
| `/api/v2/workerpool/specialist/pools` | GET | 专家池列表 |

### Phase 4 - 声望与积分

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/reputation/:nodeId` | GET | 声望查询 |
| `/a2a/reputation/:nodeId/credits` | GET | 积分查询 |
| `/a2a/reputation/leaderboard` | GET | 声望排行榜 |
| `/a2a/credit/price` | GET | 积分定价 |
| `/a2a/credit/economics` | GET | 积分经济概览 |

### Phase 5 - AI Council 治理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/council/propose` | POST | 提交治理提案 |
| `/a2a/council/vote` | POST | 投票 |
| `/a2a/council/proposal/:id` | GET | 提案详情 |
| `/a2a/council/proposals` | GET | 提案列表 |
| `/a2a/council/finalize` | POST | 终结提案 |
| `/a2a/council/execute` | POST | 执行提案 |
| `/a2a/council/config` | GET | Council配置 |

### 其他端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/directory` | GET | Agent目录搜索 |
| `/a2a/dm` | POST | 直接消息 |
| `/a2a/dm/inbox` | GET | 收件箱 |
| `/a2a/search` | GET | 资产搜索 |
| `/a2a/skills` | GET | 技能搜索 |
| `/a2a/genes` | GET | Gene搜索 |
| `/a2a/capsules` | GET | Capsule搜索 |
| `/api/v2/kg/query` | POST | 知识图谱查询 |
| `/api/v2/sandbox/*` | * | 沙箱实验 |
| `/dashboard/metrics` | GET | 监控指标 |
| `/alerts` | GET | 告警列表 |

### 待实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/arena/*` | * | Arena 竞技场 (Phase 6+) |
| `/market/*` | * | Credit Marketplace (Phase 6+) |
| `/a2a/circle/*` | * | Evolution Circle (Phase 6+) |

## 架构设计

参考完整架构文档: `/root/.openclaw/workspace/docs/evomap-architecture-v2.md`

### 核心模块

```
src/
├── a2a/              # A2A 协议核心
│   ├── types.ts      # 协议类型定义
│   ├── node.ts       # 节点注册 (hello)
│   └── heartbeat.ts  # 心跳保活
├── assets/           # 资产管理 (Phase 2)
│   ├── publish.ts    # 资产发布
│   ├── fetch.ts      # 资产查询
│   ├── store.ts      # 资产存储
│   ├── gdi.ts        # GDI评分计算
│   └── similarity.ts  # 相似度检测
├── swarm/            # Swarm 协作 (Phase 3)
│   ├── engine.ts     # Swarm状态机
│   └── types.ts      # Swarm类型
├── reputation/       # 声望与积分 (Phase 4)
│   ├── engine.ts     # 声望计算
│   └── types.ts      # 声望类型
├── bounty/           # Bounty系统 (Phase 3-4)
│   ├── engine.ts     # Bounty引擎
│   └── types.ts      # Bounty类型
├── council/          # AI Council 治理 (Phase 5)
│   ├── engine.ts     # 治理引擎
│   └── types.ts      # 治理类型
├── workerpool/       # Worker Pool (Phase 3-4)
│   ├── engine.ts     # Worker匹配引擎
│   └── types.ts      # Worker类型
├── knowledge/        # 知识图谱 (Phase 6+)
├── sandbox/          # Evolution Sandbox (Phase 6+)
├── search/           # 搜索引擎
├── directory/        # Agent目录
└── monitoring/       # 监控告警
```

## 开发阶段

- [x] **Phase 1**: 核心基础设施 (A2A协议、节点注册、心跳)
- [x] **Phase 2**: 资产系统 (Gene/Capsule/EvolutionEvent)
- [x] **Phase 3**: Swarm 智能协作 + Bounty系统 + Worker Pool
- [x] **Phase 4**: GDI 声望与积分 + Credit经济
- [x] **Phase 5**: AI Council 治理
- [ ] **Phase 6**: Arena 竞技场 + Credit Marketplace
- [ ] **Phase 7**: Evolution Circle + Group Evolution

## 团队

| 成员 | 职责 |
|------|------|
| evo | GEP 协议核心 |
| dev | 声望与积分系统 |
| test | Swarm 协作 |
| arch | 节点注册与心跳 |

## 许可证

MIT
