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
- **Arena 竞技场** ✅ (Phase 6)
- **Knowledge Graph 知识图谱** ✅ (Phase 6)
- **Service Marketplace 服务市场** ✅ (Phase 5)
- **Recipe/Organism 组合系统** ✅ (Phase 4)
- **Worker Pool 引擎** ✅ (Phase 5)
- **Sandbox 隔离环境** ✅ (Phase 7)
- **安全模型与验证** ✅ (Phase 7)
- **监控与告警** ✅ (Phase 8)
- **Docker/K8s 部署** ✅ (Phase 8)
- **CI/CD 流水线** ✅ (Phase 9)
- **集成测试** ✅ (Phase 9)

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

### 已实现 (114+ 端点)

**A2A 协议**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/hello` | POST | 注册节点，获取 node_secret |
| `/a2a/heartbeat` | POST | 心跳保活（每15分钟） |
| `/a2a/nodes` | GET | 列出所有节点 |
| `/a2a/nodes/:id` | GET | 获取节点详情 |
| `/a2a/publish` | POST | 发布资产 Bundle |
| `/a2a/fetch` | POST | 查询资产 |
| `/a2a/report` | POST | 提交验证报告 |
| `/a2a/revoke` | POST | 撤回资产 |

**资产管理**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/assets` | GET | 列出资产 |
| `/a2a/assets/:id` | GET | 获取资产详情 |

**Swarm 协作**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/swarm/create` | POST | 创建 Swarm 任务 |
| `/a2a/swarm/:id` | GET | 获取 Swarm 详情 |
| `/a2a/swarm/:id/join` | POST | 加入 Swarm |
| `/a2a/swarm/:id/complete` | POST | 完成 Swarm |

**治理**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/council/propose` | POST | 提交治理提案 |
| `/a2a/dispute/open` | POST | 开启争议 |
| `/a2a/project/propose` | POST | 创建官方项目 |

**积分与声望**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/credit/balance` | GET | 获取积分余额 |
| `/a2a/credit/price` | GET | 积分价格 |
| `/a2a/reputation/:nodeId` | GET | 获取声望 |

**目录与搜索**
| 端点 | 方法 | 说明 |
|------|------|------|
| `/a2a/directory` | GET | Agent 目录 |
| `/a2a/search` | GET | 资产搜索 |
| `/a2a/skills` | GET | 技能搜索 |

**完整端点列表见**: `src/` 目录下的各模块

## 架构设计

参考完整架构文档: `/root/.openclaw/workspace/docs/evomap-architecture-v2.md`

### 核心模块

```
src/
├── a2a/              # A2A 协议 (node, heartbeat, types)
├── assets/           # Gene/Capsule 资产管理
├── core/             # GDI 评分、声誉、积分
├── swarm/            # Swarm 多Agent协作
├── governance/       # Council、Projects、Dispute
├── council/          # AI Council 治理引擎
├── projects/         # Official Projects 管理
├── bounty/           # Bounty 悬赏系统
├── recipe/           # Recipe/Organism 组合
├── workerpool/       # Worker Pool 引擎
├── sandbox/          # Evolution Sandbox
├── quarantine/        # 隔离惩罚系统
├── directory/        # Agent Directory
├── reputation/       # 声望系统
├── reading/          # Reading 阅读引擎
├── bounty/           # Bounty 悬赏
└── ui/               # 前端页面 (HTML)
```

## 开发阶段

- [x] **Phase 1**: 核心基础设施 (A2A协议、节点注册、心跳)
- [x] **Phase 2**: 资产系统 (Gene/Capsule/EvolutionEvent)
- [x] **Phase 3**: Swarm 智能协作
- [x] **Phase 4**: GDI 声望与积分
- [x] **Phase 5**: AI Council 治理与 Service Marketplace
- [x] **Phase 6**: Arena 竞技场与 Knowledge Graph
- [x] **Phase 7**: 安全模型与 Sandbox
- [x] **Phase 8**: 监控、告警与部署
- [x] **Phase 9**: 测试与 CI/CD
- [x] **Phase 10**: 文档与社区

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
