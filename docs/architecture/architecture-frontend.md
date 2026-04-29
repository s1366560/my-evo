# 前端架构 (Frontend Architecture)

> **父文档**: `technical-architecture-v1.md` | **版本**: v1.0

## 1. 框架与构建

| 技术 | 选型 | 理由 |
|------|------|------|
| **框架** | Next.js 15 (App Router) | SSR/SSG、RSC、文件系统路由 |
| **语言** | TypeScript 5.5 | 严格类型检查 |
| **样式** | Tailwind CSS 3.4 + CSS Variables | 原子化 CSS、设计系统主题变量 |
| **UI 组件** | shadcn/ui (Radix Primitives) | 无障碍、可定制 |
| **状态管理** | Zustand + React Query | 轻量+自动缓存 |
| **构建** | Turbopack (dev) + Vite (lib) | 极速 HMR |
| **测试** | Vitest + RTL + Playwright | 单元+集成+E2E |
| **Mock** | MSW 2.x | 拦截真实 HTTP，prod 无缝切换 |

## 2. 目录结构

```
frontend/src/
├── app/                          # Next.js App Router
│   ├── (marketing)/               # 营销页面（公开）
│   ├── (app)/                    # 认证后应用
│   │   ├── swarm/page.tsx        # Swarm 协作编排
│   │   ├── council/page.tsx       # Council 决策审议
│   │   ├── biology/page.tsx      # Biology 进化引擎
│   │   ├── arena/page.tsx        # Arena 评测对战
│   │   ├── marketplace/page.tsx  # Marketplace 技能市场
│   │   ├── bounty/page.tsx       # Bounty 赏金大厅
│   │   ├── browse/page.tsx       # 浏览与搜索
│   │   └── layout.tsx           # 应用 Shell（含侧边栏）
│   ├── login/page.tsx
│   └── register/page.tsx
├── components/
│   ├── ui/                       # shadcn/ui 基础组件
│   │   └── button, card, dialog, dropdown-menu, sheet, tabs,
│   │       toast, tooltip, avatar, badge, table, checkbox,
│   │       select, textarea, progress, switch
│   ├── layout/                   # sidebar, header, mobile-nav
│   ├── charts/                   # 可视化组件
│   │   ├── evolution-timeline.tsx   # D3.js — 进化时间线
│   │   ├── capability-radar.tsx     # Recharts — 能力雷达图
│   │   ├── swarm-topology.tsx       # React Flow — Swarm 拓扑
│   │   ├── council-graph.tsx         # React Flow — Council 关系
│   │   ├── battle-timeline.tsx      # Recharts — 对战时间线
│   │   └── score-gauge.tsx         # Recharts — 评分仪表盘
│   ├── swarm/                   # agent-node, agent-canvas, message-panel
│   ├── council/                 # council-canvas, opinion-card, verdict-panel
│   ├── biology/                 # evolution-dashboard, self-diagnostic, genome-viewer
│   ├── arena/                   # battle-board, leaderboard, match-history
│   ├── marketplace/             # skill-card, skill-detail, publish-form
│   ├── bounty/                  # bounty-card, bounty-detail, submission-form
│   ├── auth/                    # login-form, register-form, user-menu
│   └── dashboard/              # stats-cards, recent-activity, credit-summary
└── lib/
    ├── api/
    │   ├── client.ts            # Fetch 封装
    │   ├── endpoints.ts         # API 端点常量
    │   └── mocks/              # MSW handlers
    │       ├── handlers-auth.ts, handlers-bounty.ts
    │       ├── handlers-swarm.ts, handlers-marketplace.ts
    │       └── browser.ts      # Service Worker 注册
    ├── auth/                   # session.ts, use-auth.ts
    ├── hooks/                  # use-swarm, use-council, use-bounty, use-credits,
    │                           # useDebounce, useLocalStorage, useMediaQuery
    ├── stores/                 # ui-store.ts (Zustand), notifications-store.ts
    └── utils/                  # cn.ts (classname), format.ts (日期/数字)
```

## 3. 图表技术选型

| 图表类型 | 推荐库 | 备选 | 场景 |
|---------|-------|------|------|
| 关系/拓扑图 | React Flow | D3.js | Swarm 协作拓扑、Council 关系图 |
| 能力雷达图 | Recharts RadarChart | Chart.js | Agent 能力多维对比 |
| 时间线/进化链 | D3.js + SVG | Recharts | Biology 进化链可视化 |
| 评分仪表盘 | Recharts RadialBarChart | Custom SVG | 评分环形图 |
| 折线/柱状图 | Recharts | Chart.js | 趋势分析、统计面板 |
| 对战树/博弈图 | React Flow (自定义节点) | D3 Force | Arena 对战拓扑 |

**依据**: React Flow 高度可定制节点/边；Recharts 与 React 深度集成；D3.js 适合高度定制的 SVG 可视化。

## 4. MSW Mock 策略

MSW 拦截真实 HTTP 请求，无需修改业务代码即可切换真实 API：

```typescript
// lib/api/mocks/handlers-auth.ts
import { http, HttpResponse } from 'msw';
export const authHandlers = [
  http.post('/api/auth/login', () =>
    HttpResponse.json({
      user: { id: '1', email: 'demo@example.com', username: 'demo', credits: 100 },
      token: 'mock-jwt-token',
    })
  ),
  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as { email: string; username: string; password: string };
    return HttpResponse.json({
      user: { id: '2', email: body.email, username: body.username, credits: 100 },
      token: 'mock-jwt-token',
    });
  }),
];
```

## 5. 状态管理

| 数据类型 | 方案 | 工具 |
|---------|------|------|
| 服务端数据 | 自动缓存/轮询/乐观更新 | React Query |
| UI 状态 | 侧边栏、模态框、Toast | Zustand |
| 持久状态 | localStorage | Zustand + persist |
| URL 状态 | 搜索、过滤、分页 | nuqs |
