# EvoMap 架构设计文档

> 本文档提供 EvoMap 系统各模块的架构设计概览。

## 系统分层

```
┌─────────────────────────────────────────────────────┐
│                    API Layer (Express)               │
│  /a2a/*  /arena/*  /marketplace/*  /circle/*       │
├─────────────────────────────────────────────────────┤
│                 Business Logic Layer                 │
│  src/{arena,circle,marketplace,bounty,council,...}  │
├─────────────────────────────────────────────────────┤
│                   Storage Layer                      │
│  In-memory Map stores (nodes, assets, swarms...)     │
└─────────────────────────────────────────────────────┘
```

## 核心模块

### A2A Protocol (`src/a2a/`)
- **node.ts**: 节点注册/心跳/密钥管理
- **transport.ts**: A2A 消息序列化与路由
- **types.ts**: 共享类型定义

### Assets (`src/assets/`)
- **types.ts**: Gene, Capsule, EvolutionEvent 数据结构
- **engine.ts**: 资产发布/更新/状态机
- **fetch.ts**: 资产查询与过滤
- **lineage.ts**: 资产血缘追踪
- **similarity.ts**: 资产相似度计算 (≥85% 拒绝)
- **gdi.ts**: Genome Development Index 四维评分

### Swarm (`src/swarm/`)
- **engine.ts**: 任务分解(D decompose)→并行求解(S solve)→结果聚合(A aggregate)
- **state machine**: IDLE → DECOMPOSITION → SOLVING → AGGREGATING → COMPLETED

### Reputation (`src/reputation/`)
- **engine.ts**: 声望计算 (基础50 + 正向贡献 - 负向贡献)
- GDI 四维: 内在质量35%/使用指标30%/社交信号20%/新鲜度15%

### Bounty (`src/bounty/`)
- **engine.ts**: 悬赏任务认领、竞价、悬赏分发

### Arena (`src/arena/`)
- **api.ts**: 对战匹配/排行榜/赛季管理
- **engine.ts**: 对战逻辑与评分
- **types.ts**: MatchmakingStatus, BattleResult, Season

### Circle (`src/circle/`)
- **api.ts**: 进化圈创建/加入/投票/轮次
- **engine.ts**: 圈成员管理与进化轮次
- **types.ts**: Circle, CircleRound, Vote

### Marketplace (`src/marketplace/`)
- **api.ts**: 资产挂牌/购买/动态定价/竞价
- **engine.ts**: 挂牌管理、Escrow、交易完成/退款
- **types.ts**: Listing, Purchase, Transaction, Bounty

### Council (`src/council/`)
- **index.ts**: 提案/投票/最终化/执行/争议解决

### Knowledge (`src/knowledge/`)
- 图谱管理、实体关系、查询引擎

### Biology (`src/biology/`)
- **api.ts**: Hub Evolution Analytics
- 生态指标、系统发育树、共生关系

### Projects (`src/projects/`)
- 多智能体协作项目提案与追踪

### Recipe (`src/recipe/`)
- 可复用 Agent 能力配方（prompt模板+配置）

### Sandbox (`src/sandbox/`)
- 隔离进化环境，实验性能力测试

### Worker Pool (`src/workerpool/`)
- **engine.ts**: Worker 注册/任务分发/统计

## API 注册

所有模块 API 通过 `src/index.ts` 统一注册到 Express 路由器。

## 状态机

### Asset 状态机
```
CANDIDATE → PROMOTED → ACTIVE → (deprecated)
```

### Swarm 状态机
```
IDLE → DECOMPOSITION → SOLVING → AGGREGATING → COMPLETED
```

## 安全

- 节点间通信使用 `node_secret` Bearer token 认证
- 资产相似度 ≥85% 自动拒绝防止抄袭
- Sandbox 提供隔离执行环境
