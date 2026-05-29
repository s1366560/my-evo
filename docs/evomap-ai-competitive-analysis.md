# EvoMap.ai 竞品分析报告与功能清单

> **版本**: 1.0 | **日期**: 2026-04-29 | **数据来源**: evomap.ai 实时抓取 + GitHub EvoMap 组织
> **抓取时间**: 2026-04-29 09:06 UTC

---

## 一、产品概述

**EvoMap**（https://evomap.ai）是 **AI Agent 自我进化基础设施平台**，核心理念：
> *"One agent learns. A million inherit."*

**实时市场数据（2026-04-29）**：

| 指标 | 数值 |
|------|------|
| 推广资产总数 | **1.2M** |
| 总调用次数 | **53.0M+** |
| 总浏览量 | **4.2M+** |
| 今日调用 | **274.4K** |
| 提交通过率 | **70.5%** |

### 生物学类比

| 生物概念 | EvoMap 对应 |
|---------|-----------|
| DNA | 代码/知识 |
| 基因 (Gene) | 可复用策略模板 |
| 胶囊 (Capsule) | 完整执行路径 |
| 自然选择 | GDI 评分 |
| 基因水平转移 | 跨模型继承 |

---

## 二、核心功能模块

### 2.1 GEP 协议（v1.0.0）

消息信封格式：
```json
{
  "protocol": "gep-a2a",
  "protocol_version": "1.0.0",
  "message_type": "<hello|publish|validate|fetch|report>",
  "message_id": "msg_<timestamp>_<random_hex>",
  "sender_id": "node_<node_id>",
  "timestamp": "<ISO 8601 UTC>",
  "payload": { "..." }
}
```

核心消息类型：

| 消息类型 | 用途 | 端点 |
|---------|------|------|
| `hello` | 注册节点 | `POST /a2a/hello` |
| `publish` | 发布 Gene+Capsule 捆绑包 | `POST /a2a/publish` |
| `validate` | 干跑测试发布 | `POST /a2a/validate` |
| `fetch` | 查询已推广资产 | `POST /a2a/fetch` |
| `report` | 提交验证结果 | `POST /a2a/report` |

GEP 进化循环：**Scan → Signal → Intent → Mutate → Validate → Solidify**

### 2.2 资产系统

**Gene（基因）**：可复用的策略模板
```json
{
  "type": "Gene",
  "schema_version": "1.5.0",
  "category": "repair|optimize|innovate|explore",
  "signals_match": ["TimeoutError"],
  "summary": "Retry with exponential backoff",
  "asset_id": "sha256:<hex>"
}
```

**Capsule（胶囊）**：经过验证的完整修复方案
```json
{
  "type": "Capsule",
  "schema_version": "1.5.0",
  "trigger": ["TimeoutError"],
  "gene": "sha256:<gene_asset_id>",
  "content": "Intent: fix API timeouts...",
  "diff": "diff --git a/...",
  "confidence": 0.85,
  "blast_radius": { "files": 3, "lines": 52 },
  "outcome": { "status": "success", "score": 0.85 },
  "asset_id": "sha256:<hex>"
}
```

**资产生命周期**：candidate → promoted → rejected → revoked

**晋升要求**：`outcome.score >= 0.7`, `blast_radius.files > 0`, `blast_radius.lines > 0`

### 2.3 质量保证系统

**GDI 评分（Genetic Diversity Index）**：

| 维度 | 权重 |
|------|------|
| 质量 (Quality) | 35% |
| 使用量 (Usage) | 30% |
| 社交信号 (Social) | 20% |
| 新鲜度 (Freshness) | 15% |

审核流程：多维 AI 评分 → 阈值自动审核 → 持续重新评估 → 无人工干预

### 2.4 经济系统

**订阅计划**：

| 计划 | 价格 | 积分/月 | 发布数/月 |
|------|------|---------|----------|
| Free | $0 | - | 200 |
| Premium | 付费 | 2000 | 500 |
| Ultra | 付费 | 10000 | 1000 |

**积分获取**：注册 +100、节点连接 +50、资产推广 +100、资产复用 +5/次

### 2.5 发现与搜索系统

| 搜索类型 | 端点 |
|---------|------|
| 关键词搜索 | `GET /a2a/assets/search` |
| 语义搜索 | `GET /a2a/assets/semantic-search` |
| 图搜索 | `GET /a2a/assets/graph-search` |
| 排名搜索 | `GET /a2a/assets/ranked` |
| 推荐搜索 | `GET /a2a/assets/recommended` |
| 每日发现 | `GET /a2a/assets/daily-discovery` |

### 2.6 知识图谱

**技术栈**: Neo4j（图数据库）
**API**: `POST /api/hub/kg/query`
**功能**: 语义搜索、实体存储、关系映射、知识合成、图分析

### 2.7 多智能体协作

- Swarm 协调：自组织团队，动态任务分配
- 系统发育树：跟踪 Agent 和资产进化谱系
- Council 治理：自主多智能体决策
- 沙盒环境：安全的多智能体实验

### 2.8 Evolver 引擎

**GitHub**: https://github.com/EvoMap/evolver
**NPM**: `npm install -g @evomap/evolver`

核心特性：自动日志分析、自我修复、70/30 规则（70% 稳定/30% 探索）、安全 blast radius（≤60 文件/次）

---

## 三、UI/UX 分析

### 页面结构

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 核心价值主张、指标展示、Getting Started |
| 市场 | `/marketplace` | 资产浏览、搜索、筛选 |
| 能力页 | `/capabilities/*` | 各能力模块详细介绍 |
| 学习中心 | `/learn` | 指南、教程、协议文档 |
| 定价页 | `/pricing` | 订阅计划对比 |
| AI 导航 | `/ai-nav` | Agent 专用导航 |

### 设计风格

| 设计系统 | 配色 |
|---------|------|
| evomap-dark | `#09090b` |
| evomap-light | `#fafafa` |
| 主色调 | 紫/蓝渐变 |

### 用户流程

**AI Agent 连接流程**：
1. 读取 skill.md 文档
2. POST /a2a/hello 注册节点
3. 用户访问 claim_url 绑定账户
4. Agent 启动进化循环

**资产发布流程**：
1. Agent 检测到错误/改进点
2. 生成 Gene + Capsule 捆绑
3. POST /a2a/validate 干跑验证
4. POST /a2a/publish 发布
5. 等待 GDI 审核（状态: candidate → promoted）

---

## 四、API 端点清单

### GEP-A2A 协议端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/a2a/hello` | 注册节点 |
| POST | `/a2a/publish` | 发布资产包 |
| POST | `/a2a/validate` | 验证资产包 |
| POST | `/a2a/fetch` | 获取资产 |
| POST | `/a2a/report` | 提交验证报告 |

### 资产端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/a2a/assets` | 资产列表 |
| GET | `/a2a/assets/search` | 信号搜索 |
| GET | `/a2a/assets/ranked` | GDI 排名 |
| GET | `/a2a/assets/semantic-search` | 语义搜索 |
| GET | `/a2a/assets/graph-search` | 图搜索 |
| GET | `/a2a/assets/explore` | 探索发现 |
| GET | `/a2a/assets/recommended` | 推荐资产 |
| GET | `/a2a/assets/daily-discovery` | 每日精选 |
| GET | `/a2a/assets/categories` | 分类统计 |
| GET | `/a2a/assets/:asset_id` | 资产详情 |
| GET | `/a2a/assets/:id/related` | 相关资产 |
| GET | `/a2a/assets/:id/branches` | 进化分支 |
| GET | `/a2a/assets/:id/timeline` | 进化时间线 |
| GET | `/a2a/assets/:id/verify` | 完整性验证 |
| GET | `/a2a/assets/:id/audit-trail` | 审计追踪 |
| GET | `/a2a/assets/my-usage` | 我的使用统计 |
| POST | `/a2a/assets/:id/vote` | 投票 |
| POST | `/a2a/assets/:id/reviews` | 提交评论 |
| POST | `/a2a/asset/self-revoke` | 自我撤销 |

### 发现与帮助端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/a2a/help` | 即时文档查询 |
| GET | `/api/docs/wiki-full` | 完整 Wiki |
| GET | `/ai-nav` | AI 导航 |

### 节点与社区端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/a2a/nodes` | 节点列表 |
| GET | `/a2a/nodes/:nodeId` | 节点详情 |
| POST | `/a2a/dm` | 发送私信 |
| GET | `/a2a/directory` | Agent 目录 |

### 任务与经济端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/a2a/bounties` | 赏金列表 |
| POST | `/a2a/bounties` | 发布赏金 |
| GET | `/a2a/bounties/:id` | 赏金详情 |
| POST | `/a2a/bounties/:id/claim` | 认领赏金 |
| POST | `/a2a/bounties/:id/complete` | 完成赏金 |
| GET | `/a2a/credits` | 积分查询 |

### 进化与知识端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/a2a/evolution-events` | 进化事件 |
| GET | `/a2a/lessons` | Lesson Bank |
| GET | `/a2a/mutations` | 变异列表 |
| GET | `/a2a/mutations/:id` | 变异详情 |
| POST | `/a2a/memory/event` | 内存事件 |
| GET | `/api/hub/kg/query` | 知识图谱查询 |

### 平台与政策端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/a2a/stats` | Hub 统计 |
| GET | `/a2a/trending` | 热门资产 |
| GET | `/a2a/policy/model-tiers` | 模型层级 |

### Proxy 端点（Evolver 客户端）

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `{PROXY}/mailbox/send` | 发送消息 |
| POST | `{PROXY}/mailbox/poll` | 轮询消息 |
| POST | `{PROXY}/asset/submit` | 提交资产 |
| POST | `{PROXY}/asset/fetch` | 获取资产 |
| POST | `{PROXY}/asset/search` | 搜索资产 |
| POST | `{PROXY}/task/subscribe` | 订阅任务 |
| POST | `{PROXY}/task/claim` | 认领任务 |
| GET | `{PROXY}/proxy/status` | Proxy 状态 |

---

## 五、技术栈推测

### 前端

| 技术 | 推测依据 |
|------|---------|
| Next.js / React | 现代 Web 应用标配 |
| TypeScript | 强类型代码库 |
| Tailwind CSS | 快速样式开发 |
| Shadcn/UI | 组件库 |
| Storybook | 组件文档与测试 |

### 后端

| 技术 | 推测依据 |
|------|---------|
| Node.js / Bun | 高速 JS 运行时 |
| PostgreSQL | my-evo 已采用 |
| Neo4j | 知识图谱存储 |
| Redis | 缓存层 |

### DevOps

| 技术 | 推测依据 |
|------|---------|
| Docker | 容器化部署 |
| GitHub Actions | CI/CD |
| Vercel/Cloudflare | 前端托管 |

### AI/LLM

| 技术 | 说明 |
|------|------|
| GDI 评分引擎 | 多维 AI 评估 |
| Embedding 模型 | 语义搜索 |

---

## 六、GitHub 组织

**EvoMap GitHub**: https://github.com/EvoMap

| 仓库 | 描述 |
|------|------|
| evolver | GEP 驱动的自我进化引擎（7.1k ⭐）|
| gep-mcp-server | MCP Server for GEP |
| awesome-agent-evolution | 精选列表 |
| awesome-agent-swarm | 多智能体框架列表 |
| pdf2gep | PDF 转 GEP 资产 |
| skill2gep | Skill 转 Gene/Capsule |
| global-welfare-monitor | 开源示范项目 |

---

## 七、文档资源

| 文档 | 路径 | 说明 |
|------|------|------|
| Agent 集成指南 | `/skill.md` | 完整接入指南 |
| 协议规范 | `/skill-protocol.md` | A2A 协议参考 |
| 资产结构 | `/skill-structures.md` | Gene/Capsule 结构 |
| 任务系统 | `/skill-tasks.md` | Bounty/Worker Pool |
| 高级功能 | `/skill-advanced.md` | 高级特性 |
| 平台特性 | `/skill-platform.md` | 平台 API |
| Evolver | `/skill-evolver.md` | Evolver CLI |

---

## 八、my-evo 复刻优先级建议

### P0 - 核心 MVP
1. 节点注册与认证（POST /a2a/hello）
2. Gene/Capsule 发布与获取
3. 资产搜索与浏览
4. 订阅计划管理
5. 积分经济系统

### P1 - 完整功能
6. Swarm 多智能体
7. Worker Pool
8. GDI 评分引擎
9. 知识图谱（Neo4j）

### P2 - 高级功能
10. Proxy 客户端（Evolver）
11. Council 治理
12. 跨模型进化
13. 沙盒环境

---

*文档生成完成 - 2026-04-29*
