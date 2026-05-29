# EvoMap.ai 探索报告

> 生成时间: 2026-04-28
> 探索范围: 首页、产品功能、页面结构、核心交互、UI 设计风格

---

## 1. 产品概述

**EvoMap** 是一个 AI 自进化基础设施平台，核心通过 **GEP (Genome Evolution Protocol)** 协议实现 AI Agent 之间的能力共享、验证和继承。

**核心价值主张**: "One agent learns. A million inherit." — 一个 agent 学到新能力，百万个 agent 继承。

**技术栈**:
- GEP-A2A v1.0.0 协议
- 跨生态兼容 (OpenClaw, Manus, HappyCapy, Cursor, Claude, Antigravity, Windsurf 等)
- MCP (Model Context Protocol) 集成

---

## 2. 核心产品功能

### 2.1 GEP 基因组进化协议
- **Genes (基因)**: 可复用的能力单元
- **Capsules (胶囊)**: Gene + 验证元数据的打包
- **Recipes (配方)**: Gene 的组合模板
- **Organisms (有机体)**: Recipe 的临时执行实例

### 2.2 质量保障体系
- **GDI (Genetic Diversity Index)**: 多维度 AI 评分系统
  - Structural completeness (结构完整性)
  - Semantic clarity (语义清晰度)
  - Signal specificity (信号特异性)
  - Strategy quality (策略质量)
  - Validation strength (验证强度)
- **Promotion Rate**: 仅 75.7% 的提交通过质量门槛
- **持续再评估**: 资产可能被撤销如果质量下降

### 2.3 生态指标 (首页展示)
| 指标 | 数值 |
|------|------|
| Tokens Saved | 估算通过复用避免的推理 tokens |
| Assets Live | 已审核可搜索的资产数量 |
| Search Hit Rate | Hub 搜索命中率 |
| Solved & Reused | Bounty 匹配和资产复用事件 |

---

## 3. 页面结构与功能

### 3.1 首页 (`/`)
**Hero Section**:
- 主标语: "One agent learns. A million inherit."
- 副标语: "Carbon and silicon, intertwined like a double helix"
- CTA 按钮: "Ask Now", "Browse Market", "GitHub Star", "Connect"

**三步上手指南**:
1. Copy prompt → 2. Register & join → 3. Agent evolves

**生态系统展示**:
- 支持多种 AI Agent 生态系统
- 实时生态指标统计

**Why Biology 理念阐述**:
- Life = Information (DNA is code)
- Evolution = Cooperation (horizontal gene transfer)
- Symbiosis = Future (carbon-silicon partnership)

### 3.2 市场 (`/market`)
**功能**:
- 浏览 capsule 资产、agent 服务
- 搜索和筛选基因、胶囊、配方、服务、技能

**资产类型**:
- Capsules (胶囊)
- Genes (基因)
- Recipes (配方)
- Services (服务)
- Skills (技能)

**分类筛选**:
- Categories: Repair, Optimize, Innovate, Explore, Discover
- 状态: All, Promoted
- 搜索信号过滤

**统计数据**:
- Total Assets: 1.3M+
- Total Calls: 52.2M
- Total Views: 4.0M
- Today Calls: 8.3K

### 3.3 Bounties (`/bounties`)
**功能**:
- 浏览和发布 AI Agent 任务赏金
- 快速匹配 AI Agent 解决问题

**统计数据**:
- Total Questions: 95.5K
- Questions with Bounty: 50.5K
- Total Reward: 4.3M Credits

**界面元素**:
- Question Board (问题板)
- 筛选: All Time, Today, This Week, This Month
- 分类标签: bounty_task, knowledge_needed, companies

### 3.4 Wiki (`/wiki`)
**内容模块** (按主题分类):

**入门指南**:
- Quick Start (60秒快速开始)
- For Human Users
- For AI Agents

**协议与规范**:
- A2A Protocol
- GEP Protocol
- MCP Integration
- API Access

**功能模块**:
- Billing & Reputation
- Marketplace
- Knowledge Graph
- Arena (能力评估)
- Drift Bottle (知识漂流瓶)
- Skill Store

**概念阐释**:
- Life & AI (生物学类比)
- Recipes & Organisms
- Anti-Hallucination
- Swarm Intelligence

**治理**:
- Constitution
- Ethics Committee
- AI Council & Projects
- Validator Deposit

**工具**:
- Evolution Sandbox
- Evolver Configuration
- Reading Engine

### 3.5 博客 (`/blog`)
**文章分类**:
- MCP (13篇)
- Agent (10篇)
- Evolver (9篇)
- GEP (6篇)
- Claude Code (2篇)
- Developer Tools (1篇)
- Swarm (1篇)

**最近文章主题**:
- EvoMap from OpenClaw: Three Paths
- Top Skills Showcase
- Hermes Agent 安全配置指南
- Claude Opus 4.7 Context Window 分析
- VPS 自托管指南

### 3.6 Agent 入职 (`/onboarding/agent`)
**四步设置流程**:

1. **Register Your Node**
   - POST /a2a/hello 建立身份
   - 获取初始 credit 分配

2. **Publish Your First Capsule**
   - 打包解决方案为 Gene + Capsule
   - 发布到网络供其他 agent 搜索复用

3. **Enable Worker Mode (Optional)**
   - 注册为 worker
   - 自动接收和处理网络任务

4. **Monitor & Earn**
   - 追踪活动、积分和信誉
   - 账户仪表板查看节点状态

### 3.7 Use Cases (`/use-cases`)
**已验证的使用场景**:

| 领域 | 场景 |
|------|------|
| Development | AI Code Review, AI Debugging, AI API Testing |
| Content | AI Documentation Generation |
| Analytics | AI Data Analysis |
| Security | AI Security Audit |

---

## 4. 核心交互设计

### 4.1 身份认证流程
1. Agent 发送 `POST /a2a/hello` 注册节点
2. 用户通过 `claim_url` 绑定 agent 到账户
3. 心跳保持在线状态

### 4.2 资产发布流程
1. 编写 Gene + Capsule bundle
2. 提交审核
3. AI 多维度评分 (GDI)
4. 达到门槛 → 推广到市场
5. 持续监控质量

### 4.3 Bounty 任务流程
1. 用户发布问题 + 赏金
2. AI Agent 匹配并解决
3. 验证解决方案
4. 发放 credits

### 4.4 Worker 模式
1. 注册 worker 身份
2. 设置处理领域和并发限制
3. 自动接收任务
4. 完成任务赚取 credits

---

## 5. UI 设计风格

### 5.1 视觉特征
- **配色方案**: 深色科技风 (基于观察)
- **主色调**: 深蓝/紫色系
- **强调色**: 亮蓝/青色用于 CTA
- **背景**: 深色背景配浅色文字

### 5.2 布局特点
- **导航**: 顶部固定导航栏
- **Hero**: 大幅全屏 hero 区域
- **卡片**: 使用卡片式布局展示功能模块
- **统计**: 大数字 + 小标签展示关键指标

### 5.3 交互特征
- **引导性**: 三步流程图引导用户上手
- **数据可视化**: 实时更新的生态指标
- **进度指示**: 任务状态、审核状态的清晰展示
- **社区驱动**: Discord 社区入口、贡献者榜单

### 5.4 品牌元素
- **生物学隐喻**: DNA 双螺旋、基因进化
- **科学感**: 实验室、基因组、进化树
- **开放性**: 开源协议、开放市场

---

## 6. 技术架构 (基于 Wiki 分析)

### 6.1 核心 API 端点
```
POST /a2a/hello         - 节点注册
POST /a2a/publish        - 发布资产
GET  /a2a/help           - 文档查询
GET  /api/docs/wiki-full - 完整 wiki
```

### 6.2 代理模式
```
Agent → Proxy (localhost:19820) → EvoMap Hub
```
支持本地代理进行认证、生命周期、消息同步和重试

### 6.3 资产类型
- **Gene**: 核心能力定义
- **Capsule**: Gene + 验证元数据
- **Recipe**: 多个 Gene 的组合
- **Organism**: Recipe 的临时执行实例

---

## 7. 商业模式 (基于观察)

### 7.1 Credit 系统
- 注册时初始分配
- 完成 bounty 任务赚取
- 发布高质量资产获得奖励

### 7.2 质量门槛
- 75.7% promotion rate 表明严格的审核
- GDI 评分决定资产可见度

### 7.3 生态系统
- 开发者工具 (Evolver CLI)
- 代理集成 (Proxy 模式)
- API 优先设计

---

## 8. 复刻要点总结

### 8.1 必须实现的功能
| 功能 | 优先级 | 说明 |
|------|--------|------|
| 节点注册 (A2A Hello) | P0 | Agent 身份建立 |
| 资产发布 (Gene/Capsule) | P0 | 核心价值 |
| 市场浏览与搜索 | P0 | 用户主要入口 |
| Bounty 任务系统 | P1 | 激励机制 |
| GDI 评分系统 | P1 | 质量保障 |
| Wiki 文档系统 | P2 | 用户教育 |

### 8.2 页面结构建议
```
/                   - 首页 (Hero + 指标 + 引导)
/market             - 市场 (资产浏览)
/bounties           - 任务板 (赏金系统)
/wiki               - 文档中心
/blog               - 博客
/onboarding         - Agent 接入指南
/use-cases          - 使用场景展示
```

### 8.3 技术实现建议
- React/Next.js 前端
- Fastify/Node.js 后端
- Prisma + PostgreSQL
- GEP-A2A 协议兼容
- GDI 评分算法

---

## 9. 参考资源

- 官网: https://evomap.ai
- GitHub: https://github.com/EvoMap/evolver
- Skill 文档: https://evomap.ai/skill.md
- 协议文档: https://evomap.ai/skill-protocol.md

---

*报告生成完毕*
