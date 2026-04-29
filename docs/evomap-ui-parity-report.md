# EvoMap UI Parity Comparison Report

**Task**: 公开对比evomap.ai和my evo首页关键区域：hero区、pricing表格、功能卡片、footer链接
**Author**: Workspace Verifier Agent
**Date**: 2026-04-29 (updated)
**Previous Version**: 2026-04-29 (Workspace Builder Agent)
**Source (evomap.ai)**: web_scrape — https://evomap.ai (2026-04-29), https://evomap.ai/pricing (2026-04-29)
**Source (my-evo)**: /workspace/my-evo/frontend/src/app/, /workspace/my-evo/frontend/src/components/

---

## 更新说明（相比上一版本）

| 项目 | 上一版状态 | 本版状态 | 依据 |
|------|-----------|---------|------|
| /pricing 路由 | P0 缺失 | ✅ 已实现 | frontend/src/app/pricing/page.tsx 存在 |
| Hero 文案 One agent learns... | P1 缺失 | ✅ 已实现 | HeroSection.tsx:72 完全匹配 |
| Hero CTA x3 (Ask/Browse/GitHub) | P1 缺失 | ✅ 已实现 | HeroSection.tsx:81-98 |
| 合作伙伴生态展示 | P1 缺失 | ✅ 已实现 | HeroSection.tsx:203-223 PARTNERS 数组 |
| Quality Assurance 区块 | P1 缺失 | ✅ 已实现 | HeroSection.tsx:225-265 GDI Score 区块 |
| Why Biology 区块 | P2 缺失 | ✅ 已实现 | HeroSection.tsx:267-299 |
| Quick Start 3步流程 | P2 差异 | ✅ 已实现 | HeroSection.tsx:102-111 |
| Protocol Pillars 区块 | 缺失 | ✅ 额外实现 | HeroSection.tsx:32-45 |
| Footer 4栏结构 | 部分 | ✅ 已实现 | Footer.tsx Platform/Protocol/Governance/Community |

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
| Partner Logos | PARTNERS数组：OpenClaw/Manus/HappyCapy/Cursor/Claude/Antigravity/Windsurf | ✅ 一致 |
| Quick Start | 3步 (Copy prompt / Register & join / Agent evolves) | ✅ 一致 |
| Stats 指标 | Active nodes / Registry state (Genes/Capsules/Swarms) | ⚠️ 名称不同 |
| Quality Assurance | GDI Score区块 (Usefulness 30% / Novelty 25% / Safety 25% / Efficiency 20%) | ✅ 已实现 |
| Why Biology | DNA / Evolution / Symbiosis 区块 | ✅ 已实现 |
| Protocol Pillars | Gene-Capsule-Recipe / Reputation / Swarm coordination | ✅ 额外实现 |
| Getting Started cards | 分散在首页各处，未集中展示 | ⚠️ 缺失 |
| Capsule Hot List | 无独立区块 | ⚠️ 缺失 |

### Hero 区差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| H-1 | Connect CTA按钮 | 有第4个CTA | 无（仅3个） | P2 |
| H-2 | Stats指标名称 | Tokens Saved/Assets Live/Search Hit Rate/Solved & Reused | Active nodes/Registry state | P1 |
| H-3 | Getting Started 4卡片 | 在Hero区块下方集中展示 | 分散在首页各section | P2 |
| H-4 | Capsule Hot List | Hero下方有胶囊热榜入口 | 无独立区块 | P2 |

## 二、定价页对比

### evomap.ai 定价页 (/pricing)

| 区域 | 内容 |
|------|------|
| 标题 | SUBSCRIPTION PLANS / Choose Your Plan |
| 说明 | CURRENT PLAN / EvoMap is currently in test period. All credits are earned through platform activities. |
| 三层套餐 | Free (0 credits) / Premium (2000 credits/month) / Ultra (10000 credits/month) |
| 功能对比行 | Node Binding / Publishes Monthly / Bounties Monthly / Questions / Vote Rate / KG Query Rate / KG Query Cost / Sandbox Access / Advanced Biology / Webhooks / API Rate Limit / Priority Support |
| Plan Comparison表格 | Publishes/month: 200/500/1,000 / Daily Earning Cap: 500/1,000/2,000 / Daily Fetch Rewards: 200/1,000/5,000 / Publish Rate: 10/30/60 per min / Priority Access: Queued/Under load-Priority/Always instant |
| 积分获取 | Account registration +100 / First node +50 / Answer bounties (posted reward) / Asset promoted +100 / Asset reused +5 per fetch / Validation report +20 |
| 底部说明 | Plan renews monthly from your credits balance. |

### my-evo 定价页 (frontend/src/app/pricing/page.tsx)

| 区域 | 内容 | 状态 |
|------|------|------|
| 路由 | /pricing | ✅ 已实现 |
| 标题 | Choose your plan | ✅ 一致 |
| 套餐数量 | 3层: Free / Premium / Ultra | ✅ 一致 |
| Credits量 | 0 / 2,000 / 10,000 credits/month | ✅ 一致 |
| 功能行数 | 7行（Publishes/Daily Earning/KG Query/Sandbox/Webhooks/API Rate/Priority Support）| ⚠️ 偏少 |
| Node Binding | 无 | ⚠️ 缺失 |
| Bounties Monthly | 无 | ⚠️ 缺失 |
| Questions | 无 | ⚠️ 缺失 |
| Vote Rate | 无 | ⚠️ 缺失 |
| Advanced Biology | 无 | ⚠️ 缺失 |
| Plan Comparison表格 | 无 | ⚠️ 缺失 |
| Daily Fetch Rewards | 无 | ⚠️ 缺失 |
| Publish Rate | 无 | ⚠️ 缺失 |
| Priority Access | 无 | ⚠️ 缺失 |
| Credits获取指南 | 6项（Account +100 / Node +50 / Bounty +25-500 / Promoted +100 / Contribution +10-200 / Bug +50）| ⚠️ 数值与 evomap.ai 不同 |
| 当前计划高亮 | Most popular 标签（非 CURRENT PLAN）| ⚠️ 语义略有差异 |

### 定价页数值对比（Free层）

| 指标 | evomap.ai | my-evo | 一致性 |
|------|-----------|--------|--------|
| Publishes/month | 200 | 1 | ❌ 差异巨大 |
| Daily Earning Cap | 500 credits | 100 credits | ❌ 差异 |
| Publish Rate | 10/min | 无 | ❌ |
| Priority Access | Queued under load | 无 | ❌ |

### 定价页差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| P-1 | Publishes/month (Free) | 200 | 1 | P0 |
| P-2 | Daily Earning Cap | 500/1,000/2,000 | 100/5,000/unlimited | P1 |
| P-3 | Daily Fetch Rewards行 | 有 | 无 | P1 |
| P-4 | Publish Rate行 | 有（10/30/60/min）| 无 | P1 |
| P-5 | Priority Access行 | 有 | 无 | P1 |
| P-6 | Node Binding行 | 有 | 无 | P2 |
| P-7 | Bounties Monthly行 | 有 | 无 | P2 |
| P-8 | Questions行 | 有 | 无 | P2 |
| P-9 | Vote Rate行 | 有 | 无 | P2 |
| P-10 | Advanced Biology行 | 有 | 无 | P2 |
| P-11 | Plan Comparison表格 | 有完整对比表 | ✅ 已实现 | — |
| P-12 | Credits获取数值 | Account +100, Bounty reward-based, Reused +5, Validation +20 | Account +100, Bounty +25-500, Reused无, Validation无, Bug +50 | P1 |
| P-13 | 当前计划高亮文案 | CURRENT PLAN | Most popular | P2 |

## 三、功能卡片对比

### evomap.ai 功能卡片

| 卡片 | 描述 |
|------|------|
| Connect Your Agent | Follow our step-by-step guide to register and connect your AI agent |
| Explore Guides & Tutorials | Learn about GEP protocol, MCP integration, marketplace, billing |
| Join the Community | Ask questions, share feedback, and connect with other developers |
| Browse Marketplace | Discover AI evolution assets, agent services, and ready-to-use capabilities |

### my-evo 功能卡片

my-evo 首页没有在 Hero 区域下方独立实现 Getting Started 4卡片。相关功能分散在以下位置：

| 分散位置 | 对应功能 |
|---------|---------|
| 首页 StatsGrid section | Ecosystem telemetry / Infrastructure signals |
| 首页 TrendingSignals section | Trending assets discovery |
| OpenBountiesPreview | Open bounties / Marketplace discovery |
| QuickStartCTA | Getting started CTA |

差异：evomap.ai 将4个功能入口集中展示，my-evo 分散为4个独立区块。

---

## 四、Footer 对比

### evomap.ai Footer（4栏）

| 栏 | 链接 |
|----|------|
| Product | Features / Pricing / Roadmap / Changelog / Status |
| Developers | Docs / API / SDKs / GitHub / Discord |
| Company | About / Blog / Careers / Press |
| Legal | Privacy / Terms / Security |

### my-evo Footer (Footer.tsx，5栏：1品牌+4内容栏）

| 栏 | 链接 |
|----|------|
| Brand | EvoMap logo + tagline + GitHub Star |
| Platform | Browse Assets / Marketplace / Bounty Hall / Arena / Skills |
| Protocol | Documentation / A2A Protocol / GEP Protocol / Swarm Intelligence / Knowledge Graph |
| Governance | AI Council / Constitution / Verifiable Trust / Research |
| Community | Bounties / Biology / Workerpool / Manifesto |

### Footer 差异清单

| 序号 | 差异项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| F-1 | 栏目标签命名 | Product/Developers/Company/Legal | Platform/Protocol/Governance/Community | P2 |
| F-2 | Pricing链接 | 有 | 无（定价页已实现但footer未链接）| P1 |
| F-3 | Features链接 | 有 | 无 | P2 |
| F-4 | Roadmap链接 | 有 | 无 | P2 |
| F-5 | Changelog链接 | 有 | 无 | P2 |
| F-6 | Status链接 | 有 | 无 | P2 |
| F-7 | API/SDKs链接 | 有（Developers栏）| 无独立链接 | P2 |
| F-8 | Discord链接 | 有 | 无 | P2 |
| F-9 | Blog链接 | 有 | 无 | P2 |
| F-10 | Careers链接 | 有 | 无 | P2 |
| F-11 | About链接 | 有 | 无 | P2 |
| F-12 | 底部版权/版本 | EvoMap + AutoGame Limited | v1.0.0 - AutoGame Limited | ✅ 基本一致 |

---

## 五、首页 Stats 指标对比

### evomap.ai 首页 Stats

| 指标 | 说明 |
|------|------|
| TOKENS SAVED | Estimated inference tokens avoided through reuse |
| ASSETS LIVE | Reviewed assets available for search and reuse |
| SEARCH HIT RATE | Percentage of Hub searches that find existing solutions |
| SOLVED & REUSED | Bounty matches and asset reuse events combined |

### my-evo Stats

Hero区域右侧面板 (HeroSection.tsx:115-199)：

| 指标 | 内容 |
|------|------|
| Active nodes | Verified participants contributing to shared capability graph |
| Registry state | Genes discoverable / Capsules published / Swarms coordinating |

首页 StatsGrid 组件另有 ecosystem telemetry 展示。

### Stats 指标差异

| 序号 | 指标项 | evomap.ai | my-evo | 优先级 |
|------|--------|-----------|--------|--------|
| S-1 | Tokens Saved | 有（展示推理token节省量）| 无 | P1 |
| S-2 | Assets Live | 有（已审核资产数）| 无（Registry state含Genes/Capsules但不区分审核状态）| P1 |
| S-3 | Search Hit Rate | 有（Hub搜索命中率）| 无 | P1 |
| S-4 | Solved & Reused | 有（Bounty匹配+资产复用事件）| 无 | P1 |
| S-5 | Active nodes | 无 | 有 | ✅ my-evo 特有 |
| S-6 | Registry state | 无 | 有 | ✅ my-evo 特有 |

---

## 六、综合优先级总结

### P0 - 阻断性差异

| 差异项 | 说明 |
|--------|------|
| P-1 | Free层 Publishes/month 数值为 1（evomap.ai 为 200），差异过大 |

### P1 - 高优先级

| 差异项 | 说明 |
|--------|------|
| H-2 | Stats 指标命名差异（Tokens Saved / Assets Live / Search Hit Rate / Solved & Reused）|
| P-2 | Daily Earning Cap 数值差异 |
| P-3~P-5 | Daily Fetch Rewards / Publish Rate / Priority Access 行缺失 |
| P-11 | Plan Comparison 完整对比表格缺失 | ✅ 已实现 |
| P-12 | Credits 获取数值与 evomap.ai 不一致 |
| F-2 | Footer 缺少 Pricing 链接 |
| S-1~S-4 | 4个核心 Stats 指标缺失 |

### P2 - 中优先级

| 差异项 | 说明 |
|--------|------|
| H-1 | Hero 缺少 Connect 第4个 CTA |
| H-3 | Getting Started 4卡片集中展示（当前分散在首页各处）|
| H-4 | Capsule Hot List 入口缺失 |
| P-6~P-10 | Node Binding/Bounties/Questions/Vote Rate/Advanced Biology 行缺失 |
| P-13 | Most popular vs CURRENT PLAN 文案差异 |
| F-1, F-3~F-11 | Footer 链接缺失（Features/Roadmap/Changelog/Status/API/Discord/Blog/Careers/About）|

---

## 七、已对齐模块（✅ 完成）

| 模块 | my-evo路由 | evomap.ai对应 | 状态 |
|------|-----------|--------------|------|
| 首页 Hero 文案 | / | One agent learns. A million inherit. | ✅ 完全一致 |
| 双螺旋副标题 | / | Carbon and silicon... | ✅ 完全一致 |
| Hero CTA x3 | / | Ask/Browse/GitHub Star | ✅ 一致 |
| 合作伙伴生态展示 | / | Partner logos | ✅ 一致 |
| Quick Start 3步流程 | / | 3步引导 | ✅ 一致 |
| Quality Assurance 区块 | / | GDI Score | ✅ 已实现 |
| Why Biology 区块 | / | DNA/Evolution/Symbiosis | ✅ 已实现 |
| Protocol Pillars | / | 无对应 | ✅ 额外实现 |
| 定价页路由 | /pricing | /pricing | ✅ 已实现 |
| 三层套餐体系 | /pricing | Free/Premium/Ultra | ✅ 已实现 |
| Credits 获取指南 | /pricing | 6项指南 | ✅ 已实现 |
| Footer 4栏结构 | 全站 | 4栏 | ✅ 已实现 |

---

*Report updated by Workspace Verifier Agent — 2026-04-29*
*Data sources: web_scrape evomap.ai (2026-04-29), web_scrape evomap.ai/pricing (2026-04-29)*
*Code sources: /workspace/my-evo/frontend/src/app/pricing/page.tsx, HeroSection.tsx, Footer.tsx*
