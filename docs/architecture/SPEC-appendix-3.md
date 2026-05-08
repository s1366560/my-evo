---

## 11. 集成点 (Integration Points)

### 11.1 前后端集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                   前后端集成架构                               │
├─────────────────────────────────────────────────────────────┤
│  [Browser/Client]                                           │
│        │                                                     │
│        │  Next.js SSR/CSR                                   │
│        ▼                                                     │
│  [Next.js API Routes]  ←→  [Fastify Backend:3001]          │
│  /frontend/src/app/api/*    /backend/src/routes/*           │
│        │                        │                            │
│        │  REST API             │  Prisma ORM                │
│        ▼                        ▼                            │
│  [State: React Query]      [PostgreSQL/SQLite]              │
│  [State: Zustand]          [业务数据/地图数据]               │
│                                                              │
│  集成方式:                                                   │
│  1. REST API: /api/v1/* 端点                               │
│  2. Server Actions: Next.js Actions (可选)                   │
│  3. WebSocket: 实时更新 (未来)                               │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 后端服务集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                   后端服务集成架构                             │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Fastify (端口 3001)                   │  │
│  │  Routes ───► Controllers ───► Services ───► Database │  │
│  │   auth        auth           Auth        Prisma       │  │
│  │   a2a         a2a           A2A         SQLite/PG   │  │
│  │   bounty       bounty         Bounty                    │  │
│  │   map          map           Map                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  中间件链:                                                   │
│  Request → CORS → Auth(JWT) → RateLimit → Validation → Handler│
│                                                              │
│  外部集成:                                                   │
│  - OpenAI API (GDI 评分)                                    │
│  - Redis (会话缓存, 可选)                                    │
│  - Nginx (反向代理)                                          │
└─────────────────────────────────────────────────────────────┘
```

### 11.3 前端组件集成模式

```
┌─────────────────────────────────────────────────────────────┐
│                   前端组件集成                                │
├─────────────────────────────────────────────────────────────┤
│  Page (map/page.tsx)                                        │
│    │                                                        │
│    ├── <Navigation />         # 布局: 顶部导航               │
│    ├── <DataConfigPanel />    # 配置: 数据源选择             │
│    │     ├── <Input />       # 原子: 文本输入               │
│    │     ├── <Button />      # 原子: 操作按钮               │
│    │     └── <Tabs />        # 原子: 标签切换               │
│    └── <MapCanvas />          # 核心: D3.js 地图渲染        │
│          └── 数据流向: Upload → Parse → Layout → Render     │
│                                                              │
│  API 集成:                                                   │
│  - POST /api/frontend/maps/save    # 保存地图                │
│  - GET  /api/frontend/maps         # 加载地图列表           │
│  - POST /api/frontend/assets       # 发布资产                │
│  - GET  /api/frontend/marketplace # 市场浏览                │
└─────────────────────────────────────────────────────────────┘
```

### 11.4 第三方服务集成

| 服务 | 用途 | 集成方式 |
|------|------|----------|
| OpenAI API | GDI 评分引擎 | REST API + SDK |
| PostgreSQL | 主数据库 | Prisma ORM |
| SQLite | 开发/测试数据库 | Prisma ORM |
| Redis | 会话缓存 | ioredis |
| Nginx | 反向代理 | HTTP 代理 |
| Docker | 容器化 | docker-compose |

### 11.5 数据同步集成

```
┌─────────────────────────────────────────────────────────────┐
│                    数据同步集成                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  A2A 协议数据流:                                             │
│  ──────────────                                              │
│  EvoNode ──POST /a2a/publish──► Hub ──► Marketplace        │
│                    │                                        │
│                    ▼                                        │
│               PostgreSQL                                    │
│                    │                                        │
│                    ▼                                        │
│            地图可视化数据 ←── GET /api/frontend/maps         │
│                                                              │
│  数据一致性策略:                                             │
│  - 写操作: 先写数据库 → 后更新缓存                           │
│  - 读操作: 先查缓存 → 未命中则查数据库                       │
│  - 事务: 悬赏奖励等关键操作使用数据库事务                    │
└─────────────────────────────────────────────────────────────┘
```

