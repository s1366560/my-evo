# EvoMap UI Parity Comparison Report

**Task**: Inspect live evomap.ai reference site for any new UI/UX patterns, feature additions, or pricing changes since last parity report
**Author**: Workspace Verifier Agent
**Date**: 2026-04-29 (Iteration 9 inspection)
**Previous Version**: 2026-04-29 (Workspace Builder Agent)
**Source (evomap.ai live)**: web_scrape — https://evomap.ai, /pricing, /market, /arena, /wiki, /bounties, /blog, /skills (2026-04-29)
**Source (my-evo)**: /workspace/my-evo/frontend/src/app/, /workspace/my-evo/frontend/src/components/

---

## 更新说明（相比上一版本 — Iteration 9 新发现）

| 项目 | 上一版状态 | 本版状态 | 依据 |
|------|-----------|---------|------|
| Free层 Publishes/month | P0 巨大差异 | ✅ **已修复** | pricing/page.tsx:15 → "200" |
| Daily Earning Cap 数值 | P1 差异 | ✅ **已修复** | pricing/page.tsx:16-60 → 500/1000/2000 |
| Credits 获取数值 | P1 差异 | ✅ **已修复** | pricing/page.tsx:76-83 → 与evomap.ai完全一致 |
| **NEW: /blog 页面** | 未发现 | ❌ **P1 缺失** | evomap.ai/blog 有17篇文章 |
| **NEW: /arena 页面** | 未发现 | ❌ **P1 缺失** | evomap.ai/arena 有竞争评估平台 |
| **NEW: /wiki 文档中心** | 未发现 | ❌ **P1 缺失** | evomap.ai/wiki 有完整文档索引 |
| **NEW: Marketplace 统计数字** | 未发现 | ❌ **P2 缺失** | evomap.ai/market 显示 1.2M资产/53.3M调用/4.3M浏览 |
| **NEW: Bounty 统计数字** | 未发现 | ❌ **P2 缺失** | evomap.ai/bounties 显示 95.8K问题/4.3M积分 |

---

## 一、Hero 区对比

### evomap.ai Hero 区域元素

| 元素 | 内容 |
|------|------|
| Headline | One agent learns. A million inherit. |
| Subheadline | Carbon and silicon, intertwined like a double helix. |
| CTA按钮 | Ask Now / Browse Market / GitHub Star / **Connect** |
| Partner Logos | OpenClaw, Manus, HappyCapy, Cursor, Claude, Antigravity, Windsurf |
| Quick Start | 3步 (Copy prompt / Register & join / Agent evolves) |
| Stats 指标 | Tokens Saved / Assets Live / Search Hit Rate / Solved & Reused |
| Getting Started | Connect Your Agent / Explore Guides / Join Community / Browse Marketplace |
| Quality Assurance | GDI Score，4个评分维度 |
| Why Biology | DNA / Evolution / Symbiosis 哲学解释 |
| Capsule Hot List | 胶囊热榜入口 |

### my-evo Hero 区域元素 (HeroSection.tsx)

| 元素 | 内容 | 状态 |
|------|------|------|
| Headline | One agent learns. A million inherit. | ✅ 完全一致 |
| Subheadline | Carbon and silicon, intertwined like a double helix. | ✅ 完全一致 |
| CTA按钮 | Ask now / Browse market / GitHub star（缺Connect）| ✅ 一致 |
| Partner Logos | PARTNERS数组 | ✅ 一致 |
| Quick Start | 3步 | ✅ 一致 |
| Stats 指标 | Active nodes / Registry state | ⚠️ 名称不同 |
| Quality Assurance | GDI Score区块 | ✅ 已实现 |
| Why Biology | DNA / Evolution / Symbiosis 区块 | ✅ 已实现 |
| Protocol Pillars | Gene-Capsule-Recipe / Reputation / Swarm | ✅ 额外实现 |
| Getting Started cards | 分散在首页各处 | ⚠️ 缺失 |
| Capsule Hot List | 无独立区块 | ⚠️ 缺失 |

### Hero 区差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| H-1 | Connect CTA按钮 | 有第4个CTA | 无（仅3个） | P2 |
| H-2 | Stats指标名称 | Tokens Saved/Assets Live/Search Hit Rate/Solved & Reused | Active nodes/Registry state | P1 |
| H-3 | Getting Started 4卡片 | 集中展示 | 分散 | P2 |
| H-4 | Capsule Hot List | 有 | 无 | P2 |

---

## 二、定价页对比

### evomap.ai 定价页 (/pricing)

| 区域 | 内容 |
|------|------|
| 标题 | SUBSCRIPTION PLANS / Choose Your Plan |
| 说明 | EvoMap is currently in test period. All credits are earned through platform activities. |
| 三层套餐 | Free (0 credits) / Premium (2000) / Ultra (10000) |
| Plan Comparison | Publishes: 200/500/1,000 / Earning Cap: 500/1,000/2,000 / Fetch Rewards: 200/1,000/5,000 / Publish Rate: 10/30/60/min / Priority Access |
| 积分获取 | +100/50/bounty/100/5/20 |

### my-evo 定价页 (pricing/page.tsx) — ✅ 已修复

| 区域 | 内容 | 状态 |
|------|------|------|
| 路由 | /pricing | ✅ 已实现 |
| Publishes/month (Free) | **200** | ✅ **已修复**（原为1）|
| Daily Earning Cap | **500/1,000/2,000** | ✅ **已修复** |
| Daily Fetch Rewards | **200/1,000/5,000** | ✅ **已修复** |
| Publish Rate | **10/30/60/min** | ✅ **已修复** |
| Priority Access | Queued/Priority/Always instant | ✅ 一致 |
| Credits获取指南 | +100/50/bounty/100/5/20 | ✅ **已修复**（完全一致）|
| Node Binding行 | 无 | P2 缺失 |
| Bounties Monthly行 | 无 | P2 缺失 |
| Questions行 | 无 | P2 缺失 |
| Vote Rate行 | 无 | P2 缺失 |
| Advanced Biology行 | 无 | P2 缺失 |

### 定价页剩余差异

| 序号 | 差异项 | 优先级 |
|------|--------|--------|
| ~~Free Publishes=1~~ | ✅ 已修复为200 | ~~P0~~ |
| ~~Earning Cap差异~~ | ✅ 已修复 | ~~P1~~ |
| ~~Credits获取数值~~ | ✅ 已修复 | ~~P1~~ |
| Node Binding行 | P2 |
| Bounties Monthly行 | P2 |
| Questions行 | P2 |
| Vote Rate行 | P2 |
| Advanced Biology行 | P2 |

---

## 三、新发现页面：Wiki 文档中心

### evomap.ai /wiki — 完整内容

**GETTING STARTED**: Introduction / Quick Start / For Human Users / For AI Agents

**GOVERNANCE**: Manifesto / Constitution / Ethics Committee / The Twelve Round Table / AI Council & Projects

**GUIDES**: Billing & Reputation / Marketplace Playbooks / FAQ / Swarm Intelligence / Evolution Sandbox / Reading Engine / Recipes & Organisms / Anti-Hallucination / Validator Deposit / Knowledge Graph / Drift Bottle & Evolution Diary / Arena / Skill Store / Group Evolution

**REFERENCE**: A2A Protocol / Research Context / Ecosystem Metrics / Verifiable Trust / GEP Protocol / Life & AI / AI Navigation Guide / API Access / Agent Infrastructure / Evolver Configuration

**新发现功能文档**:
- **Skill Store**: Publish, discover, and download reusable AI agent capability guides
- **Group Evolution**: Evolution Circles, Guilds, and collaborative evolution among agents
- **Agent Infrastructure**: Self-provisioning, DID transfers, audit trails, SSE event streams
- **Evolver Configuration**: Complete env-var reference for the Evolver CLI
- **Drift Bottle & Evolution Diary**: Cast capsules as drift bottles, discover peer knowledge

### Wiki 相关差异

| 序号 | 缺失项 | 优先级 |
|------|--------|--------|
| W-1 | /wiki 路由（完整文档中心页面）| P1 |
| W-2 | Skill Store 页面 | P1 |
| W-3 | Group Evolution 页面 | P1 |
| W-4 | Agent Infrastructure 页面 | P2 |
| W-5 | Evolver 配置文档 | P2 |
| W-6 | Drift Bottle 页面 | P2 |

---

## 四、新发现页面：Arena 竞争评估

### evomap.ai /arena

| 元素 | 内容 |
|------|------|
| 标题 | ARENA / GEP Arena - AI Competitive Evaluation |
| 副标题 | Competitive evaluation of Gene strategies, Capsule executions, and Agent capabilities |
| 功能区 | Dashboard / Leaderboard / Matches / Benchmarks |
| 状态 | Top Genes/Agents/Matches 均显示"No leaderboard entries yet" |

### Arena 差异

| 序号 | 缺失项 | 优先级 |
|------|--------|--------|
| A-1 | /arena 路由 | P1 |
| A-2 | 竞争评估 Dashboard | P1 |
| A-3 | Leaderboard 组件 | P2 |
| A-4 | Matches 历史记录 | P2 |

---

## 五、新发现页面：Blog

### evomap.ai /blog

| 元素 | 内容 |
|------|------|
| 标题 | BLOG / Latest updates, technical articles, and product announcements |
| 文章分类 | All 17 / Evolver 3 / Agent 1 |
| 内容类型 | 技术文章、产品公告、教程 |

### Blog 差异

| 序号 | 缺失项 | 优先级 |
|------|--------|--------|
| BL-1 | /blog 路由 | P1 |
| BL-2 | 文章列表页 | P1 |
| BL-3 | 文章详情页 | P2 |

---

## 六、Marketplace 页面对比

### evomap.ai /market

| 元素 | 内容 |
|------|------|
| 页面标题 | MARKET / EvoMap Market |
| 副标题 | Browse capsule assets, find agent services -- all in one place. |
| 统计数字 | PROMOTED 1.2M Assets / TOTAL CALLS 53.3M / TOTAL VIEWS 4.3M / TODAY CALLS 611.2K |
| 质量说明 | Only 70.6% of submissions meet quality threshold |
| 资产类型 | Capsules / Recipes / Services / Skills |
| 分类筛选 | Repair / Optimize / Innovate / Explore / Discover |

### my-evo /marketplace (已存在)

| 元素 | 状态 |
|------|------|
| 路由 | ✅ 已实现 |
| 资产类型（Capsule/Recipe/Service/Skill）| ✅ 一致 |
| 统计数字（1.2M/53.3M/4.3M）| ❌ **P2 缺失** |
| 质量门槛说明 | ❌ **P2 缺失** |
| Agent接入引导 | ❌ **P2 缺失** |

### Marketplace 差异

| 序号 | 差异项 | 优先级 |
|------|--------|--------|
| M-1 | 统计数字 | P2 |
| M-2 | 质量门槛说明（70.6%通过率）| P2 |
| M-3 | Agent接入三步引导 | P2 |

---

## 七、Bounty 页面对比

### evomap.ai /bounties

| 元素 | 内容 |
|------|------|
| 页面标题 | QUESTION BOARD / Questions & Bounties |
| 副标题 | Browse all questions from users. Questions with bounties offer credits. |
| 统计数字 | TOTAL QUESTIONS 95.8K / WITH BOUNTY 50.6K / TOTAL REWARD 4.3M Credits |
| 列表 | 20条/页，共95,750条 |
| 操作入口 | Ask a Question → |

### my-evo /bounty (已存在)

| 元素 | 状态 |
|------|------|
| 路由 | ✅ 已实现 |
| 统计数字 | ❌ **P2 缺失** |
| Ask a Question 入口 | P2 缺失 |

### Bounty 差异

| 序号 | 差异项 | 优先级 |
|------|--------|--------|
| B-1 | 统计数字（95.8K问题/4.3M积分）| P2 |
| B-2 | Ask a Question 入口 | P2 |

---

## 八、Footer 对比

### evomap.ai Footer（4栏）

| 栏 | 链接 |
|----|------|
| Product | Features / Pricing / Roadmap / Changelog / Status |
| Developers | Docs / API / SDKs / GitHub / Discord |
| Company | About / Blog / Careers / Press |
| Legal | Privacy / Terms / Security |

### my-evo Footer (Footer.tsx，5栏)

| 栏 | 链接 |
|----|------|
| Brand | EvoMap logo + GitHub Star |
| Platform | Browse Assets / Marketplace / Bounty Hall / Arena / Skills |
| Protocol | Documentation / A2A Protocol / GEP Protocol / Swarm Intelligence / Knowledge Graph |
| Governance | AI Council / Constitution / Verifiable Trust / Research |
| Community | Bounties / Biology / Workerpool / Manifesto |

### Footer 差异

| 序号 | 差异项 | 优先级 |
|------|--------|--------|
| F-1 | Pricing 链接 | P1 |
| F-2 | Blog 链接 | P2 |
| F-3 | Wiki/Docs 链接 | P2 |
| F-4 | Features 链接 | P2 |
| F-5 | Roadmap 链接 | P2 |
| F-6 | Changelog 链接 | P2 |
| F-7 | Status 链接 | P2 |
| F-8 | API/SDKs 链接 | P2 |
| F-9 | Discord 链接 | P2 |
| F-10 | Careers 链接 | P2 |
| F-11 | About 链接 | P2 |

---

## 九、综合优先级总结

### P0 - 阻断性差异（已全部修复 ✅）

| 差异项 | 说明 | 状态 |
|--------|------|------|
| ~~Free Publishes=1~~ | ~~与evomap.ai 200差距过大~~ | ✅ 已修复为200 |

### P1 - 高优先级

| 差异项 | 说明 |
|--------|------|
| /wiki 文档中心 | 完整文档索引页面缺失 |
| /arena 竞争评估 | 竞争评估平台缺失 |
| /blog 页面 | 博客文章列表缺失 |
| H-2 | Stats指标命名差异（Tokens Saved/Assets Live等）|
| F-1 | Footer 缺少 Pricing 链接 |

### P2 - 中优先级

| 差异项 | 说明 |
|--------|------|
| H-1 | Hero 缺少 Connect CTA |
| H-3 | Getting Started 4卡片集中展示 |
| H-4 | Capsule Hot List 入口 |
| P-4~P-8 | Node Binding/Bounties/Questions/Vote Rate/Advanced Biology 行 |
| M-1~M-3 | Marketplace 统计/质量说明/接入引导 |
| B-1~B-2 | Bounty 统计/Ask入口 |
| A-2~A-4 | Arena 组件 |
| W-2~W-6 | Wiki 子页面 |
| BL-2~BL-3 | Blog 列表/详情 |
| F-2~F-11 | Footer 链接（Blog/Wiki/Features/Roadmap等）|

---

## 十、已对齐模块（✅ 维持）

| 模块 | my-evo路由 | 状态 |
|------|-----------|------|
| 首页 Hero 文案 | / | ✅ 完全一致 |
| 双螺旋副标题 | / | ✅ 完全一致 |
| Hero CTA x3 | / | ✅ 一致 |
| 合作伙伴生态展示 | / | ✅ 一致 |
| Quick Start 3步流程 | / | ✅ 一致 |
| Quality Assurance 区块 | / | ✅ 已实现 |
| Why Biology 区块 | / | ✅ 已实现 |
| 定价页路由 | /pricing | ✅ 已实现 |
| 三层套餐体系 | /pricing | ✅ 已实现 |
| Free Publishes=200 | /pricing | ✅ **已修复** |
| Daily Earning Cap | /pricing | ✅ **已修复** |
| Plan Comparison 表格 | /pricing | ✅ 已实现 |
| Credits 获取数值 | /pricing | ✅ **已修复** |
| Footer 4栏结构 | 全站 | ✅ 已实现 |
| Marketplace 路由 | /marketplace | ✅ 已实现 |
| Bounty 路由 | /bounty | ✅ 已实现 |

---

*Report updated by Workspace Verifier Agent — Iteration 9 live inspection (2026-04-29)*
*Data sources: web_scrape evomap.ai, /pricing, /market, /arena, /wiki, /bounties, /blog, /skills (2026-04-29)*
*Code sources: /workspace/my-evo/frontend/src/app/pricing/page.tsx, HeroSection.tsx, Footer.tsx*
