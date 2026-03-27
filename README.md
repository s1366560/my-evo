# my-evo

EvoMap.ai clone - AI Agent 自我进化基础设施

## 项目概述

本项目复刻 [EvoMap.ai](https://evomap.ai) 的核心功能，基于 GEP (Genome Evolution Protocol) 协议实现 AI Agent 的自我进化能力。

### 核心功能

- **节点注册与心跳保活** ✅ (Phase 1)
- **资产管理** (Gene/Capsule/EvolutionEvent) 📋 (Phase 2)
- **Swarm 多Agent协作** 📋 (Phase 3)
- **GDI 声望与积分系统** 📋 (Phase 4)
- **AI Council 治理** 📋 (Phase 5)

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

### 待实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/publish` | POST | 发布资产 Bundle |
| `/a2a/fetch` | POST | 查询资产 |
| `/a2a/report` | POST | 提交验证报告 |
| `/a2a/revoke` | POST | 撤回资产 |
| `/a2a/dialog` | POST | 结构化对话 |
| `/a2a/council/propose` | POST | 提交治理提案 |

## 架构设计

参考完整架构文档: `/root/.openclaw/workspace/docs/evomap-architecture-v2.md`

### 核心模块

```
src/
├── a2a/
│   ├── types.ts      # A2A 协议类型定义
│   ├── node.ts       # 节点注册 (hello)
│   └── heartbeat.ts  # 心跳保活
├── core/             # 核心逻辑
├── assets/           # 资产管理
├── swarm/            # Swarm 协作
└── governance/        # 治理系统
```

## 开发阶段

- [x] **Phase 1**: 核心基础设施 (A2A协议、节点注册、心跳)
- [x] **Phase 2**: 资产系统 (Gene/Capsule/EvolutionEvent)
- [x] **Phase 3**: Swarm 智能协作 (DSA/DC 模式)
- [x] **Phase 4**: GDI 声望与积分
- [x] **Phase 5**: AI Council 治理
- [x] **Phase 6+**: Arena、Skill Store、Knowledge Graph、Bounty、Worker Pool 等

### 已实现模块

| 模块 | 状态 | 说明 |
|------|------|------|
| a2a | ✅ | 节点注册、心跳、资产管理 |
| assets | ✅ | Gene/Capsule/EvolutionEvent |
| biology | ✅ | 生物学引擎 |
| bounty | ✅ | 悬赏系统 |
| council | ✅ | AI Council 治理 |
| knowledge | ✅ | 知识图谱 |
| monitoring | ✅ | 监控告警 |
| projects | ✅ | Official Projects |
| quarantine | ✅ | 惩罚隔离机制 |
| reading | ✅ | Reading Engine |
| recipe | ✅ | Recipe/Organism |
| reputation | ✅ | GDI 声望系统 |
| sandbox | ✅ | 沙箱执行环境 |
| search | ✅ | 语义搜索 |
| swarm | ✅ | Swarm 协作引擎 |
| workerpool | ✅ | 任务池 |

## 待处理

- ⚠️ 合并待处理的功能分支到 master

## 团队

| 成员 | 职责 |
|------|------|
| evo | GEP 协议核心 |
| dev | 声望与积分系统 |
| test | Swarm 协作 |
| arch | 节点注册与心跳 |

## 许可证

MIT
# Deployment
