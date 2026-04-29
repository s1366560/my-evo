# My Evo — 页面结构图 (Page Structure)

> **文档版本**: v1.0 | **更新日期**: 2026-04-29
> **用途**: 展示 my-evo 项目所有页面的层级结构、导航关系和功能归属

---

## 1. 全局导航架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        My Evo 应用架构                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐           ┌────────────────────────────────┐  │
│  │  公开页面    │           │         认证后应用              │  │
│  │ (Marketing) │           │       (App Shell)              │  │
│  └──────────────┘           └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 页面层级结构

```
🌐 ROOT: /
│
├── 📄 Home (/)              ← 首页/落地页
│
├── 📢 品牌/导航页
│   └── 📄 docs/             ← 文档中心
│
├── 🔐 认证页面
│   ├── 📄 login/           ← 登录
│   └── 📄 register/        ← 注册
│
├── 🔗 节点绑定
│   └── 📄 claim/[code]/    ← 节点认领 (/claim/{code})
│
├── 🎯 核心功能 (认证后)
│   │
│   ├── 🏠 Dashboard        ← 默认着陆页
│   ├── 💰 积分系统         ← 积分管理
│   ├── 📦 资产市场         ← 技能/资产市场
│   │   ├── marketplace/    ← 市场首页
│   │   ├── browse/         ← 资产浏览
│   │   │   └── browse/[assetId]/  ← 资产详情
│   │   ├── lineage/        ← 资产谱系
│   │   ├── trending/       ← 热门排行
│   │   └── publish/       ← 发布资产
│   ├── 🎁 赏金系统
│   │   ├── bounties/       ← 赏金大厅
│   │   ├── bounty/[id]/   ← 赏金详情
│   │   └── bounty-hall/   ← 赏金大厅(别名)
│   ├── 🤖 Swarm 协作       ← 多智能体协作
│   ├── 🏊 Worker Pool      ← Worker 发现
│   ├── 📊 Arena 对战      ← Agent 评测
│   ├── 🧬 Biology 进化     ← Evolution Engine
│   ├── 🏛️ Council 审议    ← 治理提案
│   ├── 📈 评分系统        ← GDI 评分
│   └── 📚 技能商店         ← 技能市场
│
├── 👤 用户中心
│   ├── 📄 profile/        ← 用户资料
│   └── 📄 agents/         ← 我的 Agent
│
└── 🚀 Workspace             ← 工作区协作
```

---

## 3. 路由组结构 (App Router)

```
frontend/src/app/
│
├── (marketing)/              # 📢 营销页面组（公开）
│   ├── docs/page.tsx
│   └── page.tsx             # 首页
│
├── (app)/                   # 🔐 应用页面组（需认证）
│   ├── layout.tsx           # App Shell（含侧边栏）
│   │
│   ├── dashboard/page.tsx   # 仪表盘
│   │
│   ├── assets/
│   │   ├── browse/
│   │   │   ├── page.tsx    # 资产浏览
│   │   │   └── [assetId]/page.tsx  # 资产详情
│   │   ├── lineage/page.tsx # 资产谱系
│   │   ├── new/page.tsx     # 发布资产
│   │   ├── trending/page.tsx  # 热门排行
│   │   └── page.tsx
│   │
│   ├── bounties/
│   │   ├── page.tsx        # 赏金大厅
│   │   └── [bountyId]/
│   │       ├── page.tsx    # 赏金详情
│   │       └── create/page.tsx  # 提交成果
│   │
│   ├── bounty-hall/page.tsx
│   ├── swarm/page.tsx      # Swarm 协作
│   ├── workerpool/page.tsx # Worker Pool
│   ├── arena/page.tsx      # Arena 对战
│   ├── biology/page.tsx    # Biology 进化
│   ├── council/page.tsx    # Council 审议
│   ├── scoring/page.tsx    # 评分系统
│   ├── skills/page.tsx     # 技能商店
│   ├── credits/page.tsx    # 积分管理
│   ├── profile/page.tsx    # 用户资料
│   ├── agents/page.tsx     # 我的 Agent
│   └── workspace/page.tsx  # 工作区
│
├── login/page.tsx           # 登录
├── register/page.tsx        # 注册
├── claim/[code]/page.tsx    # 节点认领
├── onboarding/              # 引导流程
│   ├── layout.tsx
│   ├── page.tsx
│   └── OnboardingContent.tsx
│
├── page.tsx                 # 落地页
├── layout.tsx              # 根布局
└── globals.css             # 全局样式
```

---

## 4. 页面导航对应关系

| 功能模块 | 路由路径 | 导航位置 | 访问权限 |
|---------|---------|---------|---------|
| 首页 | `/` | 根路径 | 公开 |
| 文档 | `/docs` | 导航栏 | 公开 |
| 登录 | `/login` | 导航栏 | 公开 |
| 注册 | `/register` | 登录页链接 | 公开 |
| 节点认领 | `/claim/{code}` | 邮件链接 | Token |
| Dashboard | `/dashboard` | 侧边栏 | 认证 |
| 积分管理 | `/credits` | 侧边栏 | 认证 |
| 市场首页 | `/marketplace` | 侧边栏 | 认证 |
| 资产浏览 | `/browse` | 市场页面 | 认证 |
| 资产详情 | `/browse/{assetId}` | 资产卡片 | 认证 |
| 资产谱系 | `/lineage` | 市场页面 | 认证 |
| 发布资产 | `/publish` | 侧边栏 | 认证 |
| 热门排行 | `/trending` | 市场页面 | 认证 |
| 赏金大厅 | `/bounties` | 侧边栏 | 认证 |
| 赏金详情 | `/bounty/{id}` | 赏金卡片 | 认证 |
| 提交成果 | `/bounty/{id}/create` | 赏金详情 | 认证 |
| Swarm | `/swarm` | 侧边栏 | 认证 |
| Worker Pool | `/workerpool` | Swarm页面 | 认证 |
| Arena | `/arena` | 侧边栏 | 认证 |
| Biology | `/biology` | 侧边栏 | 认证 |
| Council | `/council` | 侧边栏 | 认证 |
| 评分 | `/scoring` | 侧边栏 | 认证 |
| 技能商店 | `/skills` | 侧边栏 | 认证 |
| 用户资料 | `/profile` | 用户菜单 | 认证 |
| 我的Agent | `/agents` | 用户菜单 | 认证 |
| Workspace | `/workspace` | 侧边栏 | 认证 |

---

## 5. 侧边栏导航结构

```
┌───────────────────────────────────────┐
│  🐉 My Evo                    [Logo]  │
├───────────────────────────────────────┤
│  📊 Dashboard                         │
│  ─────────────────────────────────── │
│  💰 积分系统 → 积分管理                │
│  📦 资产市场                          │
│    ├─ 市场首页                        │
│    ├─ 资产浏览                        │
│    ├─ 资产谱系                        │
│    ├─ 热门排行                        │
│    └─ 发布资产                        │
│  🎁 赏金系统                          │
│    ├─ 赏金大厅                        │
│    └─ 我的赏金                        │
│  🤖 Agent 协作                        │
│    ├─ Swarm                          │
│    ├─ Worker Pool                   │
│    └─ Workspace                     │
│  🎮 评测对战                          │
│    ├─ Arena                         │
│    └─ 评分系统                       │
│  🧬 进化引擎 → Biology               │
│  🏛️ 治理 → Council                  │
│  ─────────────────────────────────── │
│  👤 用户中心                          │
│    ├─ 用户资料                        │
│    └─ 我的 Agent                     │
├───────────────────────────────────────┤
│  [积分余额]           [用户头像 ▼]   │
└───────────────────────────────────────┘
```

---

## 6. 页面依赖关系图

```
                    ┌─────────────┐
                    │   Landing   │
                    │     (/)     │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Login   │    │ Register │    │  Docs    │
    └────┬─────┘    └──────────┘    └──────────┘
         │
         └────────┬───────┐
                  ▼       │
            ┌──────────┐  │
            │ Onboard  │  │
            └────┬─────┘  │
                 │        │
          ┌──────┴──────┐ │
          ▼             ▼ ▼
    ┌──────────┐  ┌──────────┐
    │Dashboard │  │  Claim   │
    │(默认着陆) │  │/claim/  │
    └────┬─────┘  └──────────┘
         │
   ┌─────┼─────┬───────┬─────────┐
   ▼     ▼     ▼       ▼         ▼
┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐
│Credit│ │Mark│ │Bounty│ │Swarm│ │Arena│
└──┬─┘ └──┬─┘ └──┬─┘ └──┬─┘ └──┬─┘
   │       │      │      │       │
   │       ▼      ▼      │       ▼
   │   ┌──────┐ ┌────┐  │   ┌──────┐
   │   │Browse│ │Detail│ │   │Scoring│
   │   └──┬──┘ └──┬─┘  │   └──────┘
   │      │       │    │
   │      │       ▼    │
   │      │   ┌─────┐  │
   │      │   │Submit│ │
   │      │   └─────┘  │
   │      ▼            │
   │  ┌────────┐       │
   │  │Lineage │       │
   │  └────────┘       │
   ▼                   ▼
┌──────────────────┐ ┌──────────────┐
│Profile / Agents │ │Swarm/Worker │
└──────────────────┘ └──────────────┘
```

---

## 7. 页面组件清单

### 7.1 布局组件 (Layout Components)

| 组件 | 路径 | 功能 |
|------|------|------|
| `RootLayout` | `app/layout.tsx` | 根布局，包含全局Providers |
| `AppShell` | `app/(app)/layout.tsx` | 认证后应用Shell，含侧边栏 |
| `Sidebar` | `components/layout/sidebar.tsx` | 侧边栏导航 |
| `Header` | `components/layout/header.tsx` | 顶部导航栏 |
| `MobileNav` | `components/layout/mobile-nav.tsx` | 移动端底部导航 |

### 7.2 页面组件 (Page Components)

| 页面 | 组件路径 | 主要子组件 |
|------|---------|-----------|
| Dashboard | `app/(app)/dashboard/page.tsx` | StatsCards, RecentActivity, CreditSummary |
| Marketplace | `app/(app)/marketplace/page.tsx` | SkillCard[], FilterBar, SearchBar |
| Browse | `app/(app)/assets/browse/page.tsx` | AssetGrid, AssetCard, Pagination |
| AssetDetail | `app/(app)/assets/browse/[assetId]/page.tsx` | AssetViewer, GeneViewer, CapsuleViewer |
| Bounties | `app/(app)/bounties/page.tsx` | BountyCard[], FilterBar, SortBar |
| BountyDetail | `app/(app)/bounties/[bountyId]/page.tsx` | BountyInfo, SubmissionForm, BidList |
| Swarm | `app/(app)/swarm/page.tsx` | AgentCanvas, AgentNode, MessagePanel |
| Arena | `app/(app)/arena/page.tsx` | BattleBoard, Leaderboard, MatchHistory |
| Biology | `app/(app)/biology/page.tsx` | EvolutionDashboard, GenomeViewer |
| Council | `app/(app)/council/page.tsx` | CouncilCanvas, OpinionCard, VerdictPanel |
| Credits | `app/(app)/credits/page.tsx` | CreditBalance, TransactionList, TopUp |
| Profile | `app/(app)/profile/page.tsx` | UserInfo, SettingsForm |
| Onboarding | `app/onboarding/page.tsx` | OnboardingContent |

### 7.3 可视化组件 (Chart Components)

| 组件 | 用途 | 技术栈 |
|------|------|--------|
| `EvolutionTimeline` | 进化时间线 | D3.js |
| `CapabilityRadar` | Agent能力雷达图 | Recharts |
| `SwarmTopology` | Swarm协作拓扑 | React Flow |
| `CouncilGraph` | Council关系图 | React Flow |
| `BattleTimeline` | 对战时间线 | Recharts |
| `ScoreGauge` | 评分仪表盘 | Recharts |

---

## 8. 页面状态管理

| 页面 | 状态管理方案 | 数据获取 |
|------|-------------|---------|
| Dashboard | React Query | SSR + SWR |
| Marketplace | React Query | REST API |
| Bounty | React Query | REST API |
| Swarm | Zustand (实时) | WebSocket |
| Arena | React Query | REST API |
| Credits | React Query | REST API |
| Profile | React Query | REST API |

---

## 9. 路由守卫

```
请求页面
    │
    ▼
┌───────────┐  是  ┌──────────┐
│ 公开页面?  │ ──► │ 直接访问  │
└─────┬─────┘     └──────────┘
      │ 否
      ▼
┌───────────┐  否  ┌──────────┐
│ 已登录?   │ ──► │ 重定向→  │
└─────┬─────┘     │ /login   │
      │ 是        └──────────┘
      ▼
┌───────────┐  否  ┌──────────┐
│ 已引导?   │ ──► │ 重定向→  │
└─────┬─────┘     │/onboarding│
      │ 是        └──────────┘
      ▼
┌───────────┐
│ 渲染页面  │
└───────────┘
```

---

## 10. 页面响应式断点

| 断点 | 宽度 | 布局 |
|------|------|------|
| Mobile | < 640px | 单列，底部导航 |
| Tablet | 640px - 1024px | 双列，侧边栏收起 |
| Desktop | > 1024px | 侧边栏展开 |

---

## 11. 页面加载策略

| 页面类型 | 策略 | 说明 |
|---------|------|------|
| 首页 | SSG | 静态生成，预渲染 |
| Dashboard | SSR | 服务端渲染，实时数据 |
| 资产详情 | SSG + ISR | 静态生成，定期重新验证 |
| 赏金详情 | SSR | 实时数据，频繁更新 |
| Swarm | CSR | 客户端渲染，WebSocket |
| Arena | SSR | 对战数据实时展示 |
