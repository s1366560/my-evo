# 前端架构

## 1. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js | v14.2.29 (App Router) |
| 语言 | TypeScript | v5 |
| UI 库 | shadcn/ui + Radix | Tailwind CSS |
| 样式 | Tailwind CSS | v3.4.14 |
| 图表 | Recharts | - |
| 状态 | Zustand | - |
| 表单 | React Hook Form + Zod | - |
| 认证 | NextAuth.js | v4, 多 Provider |

---

## 2. 目录结构

```
frontend/src/
├── app/                      # App Router
│   ├── page.tsx              # Landing 首页
│   ├── layout.tsx            # 根布局
│   ├── providers.tsx         # 全局 Provider
│   ├── (marketing)/          # 营销页面组
│   ├── (app)/               # 认证后应用页面
│   └── api/                 # Route Handlers
│
├── components/              # React 组件
│   ├── ui/                  # shadcn/ui 基础组件
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── table.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   ├── arena/              # 竞技场组件
│   ├── auth/               # 认证组件
│   ├── biology/            # AI 生物组件
│   ├── bounty/             # 赏金组件
│   │   ├── BountyCard.tsx
│   │   ├── BountyDetail.tsx
│   │   ├── BountyFilters.tsx
│   │   ├── BountyList.tsx
│   │   └── BountyStats.tsx
│   ├── browse/             # 浏览组件
│   ├── claim/              # 认领组件
│   ├── council/            # 委员会组件
│   ├── dashboard/          # 仪表盘组件
│   ├── gep/                # 基因组件
│   │   ├── GeneCard.tsx
│   │   ├── GenePublishForm.tsx
│   │   └── CapsulePublishForm.tsx
│   ├── landing/            # Landing 组件
│   ├── layout/             # 布局组件
│   ├── marketplace/        # 市场组件
│   │   └── AssetListingCard.tsx
│   ├── onboarding/         # 新手引导组件
│   ├── publish/            # 发布组件
│   ├── skills/             # 技能组件
│   ├── swarm/              # Swarm 组件
│   ├── charts/             # 图表组件
│   └── workerpool/         # Worker 池组件
│       └── WorkerCard.tsx
│
├── lib/                     # 工具函数
│   ├── api/                # API 客户端封装
│   │   ├── client.ts       # HTTP 客户端
│   │   └── endpoints.ts    # API 端点定义
│   ├── auth/               # NextAuth 配置
│   ├── claim/              # 认领逻辑
│   ├── hooks/              # 自定义 React Hooks
│   │   ├── useAuth.ts
│   │   ├── useBounty.ts
│   │   └── useGene.ts
│   └── stores/             # Zustand stores
│       ├── authStore.ts
│       └── appStore.ts
│
├── tests/                  # 测试
│   ├── e2e-*.spec.ts       # Playwright E2E 测试
│   └── jest.config.cjs
│
├── public/                 # 静态资源
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 3. 页面路由

### 3.1 (marketing) 页面组
公开营销页面，无需认证即可访问。

### 3.2 (app) 页面组 (需认证)
| 路由 | 页面 | 核心组件 |
|------|------|----------|
| /arena | 竞技场 | Arena 相关组件 |
| /biology | AI 生物 | Biology 组件 |
| /bounty | 赏金详情 | BountyDetail |
| /bounty-hall | 赏金大厅 | BountyList, BountyCard |
| /browse | 浏览发现 | BrowseContent |
| /claim | 节点认领 | Claim 相关组件 |
| /council | 委员会 | Council 组件 |
| /marketplace | 市场 | AssetListingCard |
| /publish | 发布页面 | GenePublishForm, CapsulePublishForm |
| /skills | 技能商店 | Skills 组件 |
| /swarm | Swarm 协作 | Swarm 组件 |
| /workerpool | Worker 池 | WorkerCard, WorkerFilter |
| /workspace | 工作区 | Workspace 组件 |

---

## 4. 核心组件

### 4.1 MapVisualization
路径: `components/map/MapVisualization.tsx`
功能: 知识图谱可视化（基于 Recharts）

### 4.2 Bounty 组件组
| 组件 | 功能 |
|------|------|
| BountyCard | 单个赏金卡片 |
| BountyDetail | 赏金详情页 |
| BountyList | 赏金列表 |
| BountyFilters | 筛选器 |
| BountyStats | 统计数据 |

### 4.3 Gene 组件组
| 组件 | 功能 |
|------|------|
| GeneCard | 基因卡片 |
| GenePublishForm | 基因发布表单 |
| CapsulePublishForm | 胶囊发布表单 |

### 4.4 其他核心组件
| 组件 | 功能 |
|------|------|
| AssetListingCard | 资产列表卡片 |
| WorkerCard | Worker 卡片 |
| WorkerFilter | Worker 筛选器 |

---

## 5. 状态管理 (Zustand)

### 5.1 Store 结构
```typescript
// authStore.ts
interface AuthStore {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

// appStore.ts
interface AppStore {
  // 应用全局状态
  notifications: Notification[];
  addNotification: (n: Notification) => void;
}
```

### 5.2 自定义 Hooks
```typescript
// useAuth.ts - 认证状态管理
// useBounty.ts - 赏金相关 API 调用
// useGene.ts - 基因相关 API 调用
```

---

## 6. API 客户端

### 6.1 客户端封装
```typescript
// lib/api/client.ts
class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async get<T>(endpoint: string): Promise<T> { /* ... */ }
  async post<T>(endpoint: string, data: any): Promise<T> { /* ... */ }
  async put<T>(endpoint: string, data: any): Promise<T> { /* ... */ }
  async delete<T>(endpoint: string): Promise<T> { /* ... */ }
}
```

### 6.2 端点定义
```typescript
// lib/api/endpoints.ts
export const endpoints = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
  },
  bounty: {
    list: '/api/bounty',
    get: (id: string) => `/api/bounty/${id}`,
    create: '/api/bounty',
    update: (id: string) => `/api/bounty/${id}`,
  },
  gene: {
    list: '/api/gep',
    get: (id: string) => `/api/gep/${id}`,
    create: '/api/gep',
  },
  // ...
};
```

---

## 7. 认证 (NextAuth.js)

### 7.1 配置
支持多 Provider: GitHub, Google 等

### 7.2 保护路由
使用 Next.js Middleware 保护 `/app/*` 路由

---

## 8. 测试

### 8.1 Playwright E2E 测试
| 测试文件 | 测试内容 |
|----------|----------|
| e2e-arena.spec.ts | 竞技场 |
| e2e-auth.spec.ts | 认证流程 |
| e2e-bounty.spec.ts | 赏金功能 |
| e2e-browse.spec.ts | 浏览功能 |
| e2e-claim.spec.ts | 认领流程 |
| e2e-marketplace.spec.ts | 市场功能 |
| e2e-swarm-workerpool.spec.ts | Swarm & Worker 池 |
