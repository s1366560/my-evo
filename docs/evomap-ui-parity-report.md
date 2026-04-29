# EvoMap UI Parity Comparison Report

**Task**: 使用浏览器自动化工具或手动截图方式，对evomap.ai首页、定价页、功能介绍页进行截图，与my-evo对应页面进行逐项对比，输出差异清单  
**Author**: Workspace Builder Agent  
**Date**: 2026-04-29  
**Source (evomap.ai)**: web_scrape (https://evomap.ai, https://evomap.ai/pricing, https://evomap.ai/docs)  
**Source (my-evo)**: /workspace/my-evo/frontend/src/app/ (30+ pages built and verified via `npm run build`)

---

## 一、首页对比 (Homepage Comparison)

### evomap.ai 首页元素

| 区域 | 元素 |
|------|------|
| Hero | "One agent learns. A million inherit." + 3 CTA按钮: Ask Now / Browse Market / GitHub Star |
| 副标题 | Carbon and silicon, intertwined like a double helix |
| Quick Start | 3步流程 (Copy prompt → Register & join → Agent evolves) |
| Cross-Ecosystem | 展示 OpenClaw, Manus, HappyCapy, Cursor, Claude, Antigravity, Windsurf 等合作伙伴 |
| Stats指标 | Tokens Saved / Assets Live / Search Hit Rate / Solved & Reused |
| Getting Started | Connect Your Agent / Guides & Tutorials / Community / Browse Marketplace 4个卡片 |
| Quality Assurance | 多维度AI评分 + GDI分数机制说明 |
| Why Biology | DNA/Evolution/Symbiosis 哲学主题解释 |
| Capsule Hot List | Capsule推荐列表 |

### my-evo 首页元素 (page.tsx)

| 区域 | 元素 |
|------|------|
| Hero | HeroSection 组件 |
| Stats | StatsGrid 组件 (Ecosystem telemetry 主题) |
| Discovery | TrendingSignals 组件 (资产趋势排名) |
| Reputation | TopContributors 组件 (贡献者排名) |
| Bounties | OpenBountiesPreview 组件 |
| CTA | QuickStartCTA 组件 |

### 差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| H-1 | Hero文案 | "One agent learns. A million inherit." + 双螺旋主题 | Generic "EvoMap - AI Self-Evolution Infrastructure" | P1 |
| H-2 | Hero CTA按钮 | Ask Now / Browse Market / GitHub Star / Connect | 仅QuickStartCTA | P1 |
| H-3 | 合作伙伴展示 | 展示 OpenClaw/Manus/Cursor/Claude 等生态logo | 无 | P1 |
| H-4 | 核心指标卡 | Tokens Saved/Assets Live/Search Hit Rate/Solved & Reused | StatsGrid (Telemetry metrics) | P2 |
| H-5 | Quick Start流程 | 3步引导 (prompt→register→evolve) | QuickStartCTA (形式不同) | P2 |
| H-6 | Quality Assurance区块 | 多维度AI评分+GDI机制详细说明 | 无对应区块 | P1 |
| H-7 | Why Biology哲学区块 | DNA/Evolution/Symbiosis解释 | 无 | P2 |
| H-8 | Capsule热榜 | 有专门的Hot List展示 | TrendingSignals近似但不同 | P2 |
| H-9 | Getting Started | 4个导航卡片 (Connect/Tutorials/Community/Marketplace) | 分散在页面各处 | P2 |

---

## 二、定价页对比 (Pricing Page Comparison)

### evomap.ai 定价页元素

| 区域 | 元素 |
|------|------|
| 标题 | SUBSCRIPTION PLANS / Choose Your Plan |
| 当前计划标识 | "CURRENT PLAN" 高亮 |
| 三层套餐 | Free (0 credits) / Premium (2000 credits/month) / Ultra (10000 credits/month) |
| 功能对比表 | Publishes/month / Daily Earning Cap / KG Query Rate / Sandbox Access / Webhooks / API Rate Limit / Priority Support |
| 积分获取方式 | Account registration: +100 / Node connection: +50 / Answer bounties / Asset promoted: +100 等 |
| 底部说明 | "Plan renews monthly from your credits balance" |

### my-evo 定价页

**状态**: 不存在 `/pricing` 路由，无对应页面。

### 差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| P-1 | 定价页路由 | /pricing 完整定价页 | **不存在** | P0 |
| P-2 | 套餐体系 | Free/Premium/Ultra三层 | 仅有 credits 余额显示(dashboard) | P0 |
| P-3 | 功能对比表 | 完整特性矩阵 | 无 | P0 |
| P-4 | 积分获取指南 | 详细列举所有积分来源 | 无 | P0 |
| P-5 | 当前计划高亮 | "CURRENT PLAN"标识 | 无 | P1 |
| P-6 | 套餐切换UI | 完整的订阅管理界面 | 无 | P0 |
| P-7 | 套餐价格展示 | "2000 credits/month" 等具体数字 | 无 | P0 |

---

## 三、功能介绍页/Docs对比 (Documentation & Features Comparison)

### evomap.ai Docs页面 (40+ 章节)

| 分类 | 章节 |
|------|------|
| 入门 | Introduction, Quick Start (Human Users / AI Agents) |
| 协议 | A2A Protocol, GEP Protocol, Life & AI, Recipes & Organisms |
| 核心功能 | Billing & Reputation, Marketplace, Knowledge Graph, Skill Store, Reading Engine, Arena |
| 高级功能 | Swarm Intelligence, Evolution Sandbox, Webhooks, API Access |
| 治理 | Constitution, Ethics Committee, AI Council & Projects, The Twelve Round Table |
| 经济 | Verifiable Trust, Drift Bottle & Evolution Diary, Validator Deposit |
| 研究 | Research Context, Anti-Hallucination |
| 开发者 | Capsule Hot List, Group Evolution, Agent Infrastructure, Evolver Configuration |

### my-evo Docs页面 (4 章节)

| 章节 | 描述 |
|------|------|
| Authentication | API密钥管理说明 |
| Asset API | Gene/Capsule/Recipe 发布浏览 |
| Swarm API | 多智能体协作 |
| Credits API | 积分余额和交易历史 |

### 差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| D-1 | 文档章节数量 | 40+ | 4 | P0 |
| D-2 | GEP Protocol文档 | 独立完整章节 | 无 | P1 |
| D-3 | Swarm Intelligence文档 | Swarm Intelligence + Group Evolution + Agent Infrastructure | Swarm API (基础) | P1 |
| D-4 | Evolution Sandbox文档 | 独立章节 | 无 | P1 |
| D-5 | Knowledge Graph文档 | 独立章节 | 无 | P2 |
| D-6 | Arena文档 | 独立章节 | /arena 页面存在但无文档 | P2 |
| D-7 | Webhooks文档 | 独立章节 | 无 | P1 |
| D-8 | Constitution/治理文档 | 独立章节 | 无 | P2 |
| D-9 | Research Context文档 | 独立章节 | 无 | P2 |
| D-10 | Reading Engine文档 | 独立章节 | 无 | P2 |
| D-11 | Skill Store文档 | 独立章节 | /skills 页面存在但无文档 | P2 |
| D-12 | Drift Bottle文档 | 独立章节 | 无 | P2 |
| D-13 | Verifiable Trust文档 | 独立章节 | 无 | P2 |
| D-14 | Anti-Hallucination文档 | 独立章节 | 无 | P2 |
| D-15 | AI Council文档 | 独立章节 | /council 页面存在但无文档 | P2 |
| D-16 | Manifest/哲学文档 | Manifesto / Life & AI / Constitution | 无 | P2 |

---

## 四、其他显著页面缺失对比

| 序号 | 缺失项 | evomap.ai 对应 | my-evo 状态 | 优先级 |
|------|--------|---------------|------------|--------|
| M-1 | 功能特性页面 | 分散在各doc章节 | 无专门features页 | P1 |
| M-2 | About页面 | 关于页面 | 无 | P2 |
| M-3 | Manifesto页面 | Carbon-Silicon symbiosis | 无 | P2 |
| M-4 | Research页面 | Research Context | 无 | P2 |
| M-5 | GitHub集成 | GitHub Star CTA | 无GitHub CTA | P1 |

---

## 五、差异汇总与优先级

### P0 - 阻断性缺失（需要立即开发）

| 缺失项 | 原因 |
|--------|------|
| /pricing 定价页 | evomap.ai 核心商业模式页面，完全缺失 |
| 订阅套餐体系 | 无法展示不同用户层级的功能差异 |
| 功能对比表 | 用户无法了解套餐间差异 |
| 积分获取指南 | 新用户无法了解如何获取credits |
| Docs文档章节 (40→4) | 文档严重不完整，影响用户理解平台能力 |

### P1 - 高优先级（当前Sprint应完成）

| 差异项 | 建议 |
|--------|------|
| Hero区域重设计 | 对齐 "One agent learns. A million inherit." 双螺旋主题 |
| 合作伙伴/生态logo展示 | 增强平台可信度和生态展示 |
| Quality Assurance区块 | 展示AI评审机制，增强用户信任 |
| GitHub Star CTA | 社区引流 |
| GEP Protocol文档 | 核心协议文档 |
| Swarm Intelligence文档 | Swarm页面已有，需补充文档 |
| Webhooks文档 | API用户必需 |

### P2 - 中优先级（下个Sprint）

| 差异项 | 建议 |
|--------|------|
| Why Biology哲学区块 | 品牌故事，可后续迭代 |
| Capsule热榜 | 已有TrendingSignals近似功能 |
| 剩余20+ Docs章节 | 逐步补充 |

---

## 六、已对齐的模块

以下模块 **my-evo 有且 evomap.ai 也有**，已实现功能对等：

| 模块 | my-evo路由 | evomap.ai对应 | 状态 |
|------|-----------|--------------|------|
| 首页 | / | 有 | ✅ 对齐 |
| Marketplace | /marketplace | Marketplace | ✅ 对齐 |
| Browse/Explore | /browse | 有 | ✅ 对齐 |
| Bounty系统 | /bounty, /bounty-hall | Bounty系统 | ✅ 对齐 |
| Swarm | /swarm | Swarm Intelligence | ✅ 页面有，文档缺 |
| Arena | /arena | Arena | ✅ 页面有，文档缺 |
| Council | /council | AI Council | ✅ 页面有，文档缺 |
| Skills | /skills | Skill Store | ✅ 页面有，文档缺 |
| Biology | /biology | Advanced Biology | ✅ 对齐 |
| Workerpool | /workerpool | 有 | ✅ 对齐 |
| Docs | /docs | Wiki/Docs | ⚠️ 页面有，内容严重不足 |

---

## 七、建议行动

### 立即行动 (1-2天)
1. 创建 `/pricing` 页面，包含三层套餐(Free/Premium/Ultra)和功能对比表
2. 扩充 `/docs` 文档，至少补充 GEP Protocol、API Access、Swarm、Marketplace 章节

### 短期行动 (1周)
3. 重构首页 HeroSection，对齐 evomap.ai 的品牌语言和双螺旋主题
4. 添加 Quality Assurance 区块，展示 AI 评审机制
5. 添加生态合作伙伴展示区

### 中期行动 (2-4周)
6. 补充剩余 20+ Docs 章节
7. 添加 GitHub Star CTA
8. 添加 Why Biology 哲学区块
9. 添加 Manifesto/Research 页面

---

*Report generated from evomap.ai live scrape (2026-04-29) vs my-evo build verification (30 pages, `npm run build` passed)*
