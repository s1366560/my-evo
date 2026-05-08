---

## 9. React 组件树 (Component Hierarchy)

### 9.1 组件目录结构

```
src/components/
├── ui/                          # 基础 UI 组件 (shadcn/ui)
│   ├── Button.tsx              # 按钮组件
│   ├── Card.tsx                # 卡片组件
│   ├── Input.tsx               # 输入框组件
│   └── Tabs.tsx                # 标签页组件
│
├── layout/                      # 布局组件
│   ├── Navigation.tsx          # 顶部导航栏
│   └── Footer.tsx              # 页脚
│
├── marketplace/                # 市场组件
│   └── AssetCard.tsx           # 资产卡片
│
├── bounty/                     # 悬赏组件
│   └── BountyCard.tsx          # 悬赏卡片
│
├── publish/                    # 发布组件
│   ├── GenePublishForm.tsx     # Gene 发布表单
│   └── CapsulePublishForm.tsx  # Capsule 发布表单
│
├── dashboard/                  # 仪表盘组件
│   └── UserDashboard.tsx       # 用户仪表盘
│
└── map/                        # 地图可视化组件
    └── DataConfigPanel.tsx     # 数据配置面板
```

### 9.2 页面组件结构 (App Router)

```
frontend/src/app/
├── layout.tsx                  # 根布局
├── page.tsx                    # Landing Page
├── login/page.tsx              # 登录页
├── register/page.tsx           # 注册页
├── onboarding/page.tsx         # 引导流程
├── pricing/page.tsx            # 定价页
├── marketplace/page.tsx        # 市场浏览 (AssetCard[])
├── bounty/page.tsx             # 悬赏列表 (BountyCard[])
├── map/page.tsx               # 地图可视化
│   ├── 地图画布 (D3.js/Canvas)
│   ├── DataConfigPanel.tsx
│   └── 工具栏
├── browse/page.tsx             # 浏览页
├── workspace/page.tsx          # 工作区
├── memory/page.tsx             # 记忆管理
└── publish/page.tsx            # 发布页
    ├── GenePublishForm.tsx
    └── CapsulePublishForm.tsx
```

### 9.3 组件关系图

```
                    ┌─────────────────────────┐
                    │       Root Layout       │
                    │     (layout.tsx)       │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Landing Page │    │  Authenticated   │    │   Auth Pages    │
│  (page.tsx)  │    │    Layout        │    │ (login/register)│
└───────────────┘    │ (future: group) │    └─────────────────┘
                     └────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌──────────────┐    ┌──────────────┐
│  Marketplace  │    │     Map      │    │   Bounty     │
│  Page         │    │    Page      │    │   Page       │
│  ─────────    │    │  ──────────  │    │  ──────────  │
│ AssetCard[]   │    │  Canvas      │    │ BountyCard[] │
│   └─Card     │    │    │         │    └──────────────┘
│   └─Button   │    │    ▼         │
│   └─Tabs     │    │ DataConfig   │
│   └─Input    │    │  Panel       │
└───────────────┘    │   │         │
                      │  Input     │
                      │  Button    │
                      └────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Component Composition                      │
├─────────────────────────────────────────────────────────────┤
│  Atomic Design:                                             │
│  atoms/ → molecules/ → organisms/ → templates/ → pages/    │
│                                                              │
│  Example:                                                    │
│  atoms: Button, Input, Card, Badge                          │
│  molecules: AssetCard, FilterBar                            │
│  organisms: AssetGrid, DataConfigPanel                      │
│  templates: MapCanvas                                       │
│  pages: MapPage                                             │
└─────────────────────────────────────────────────────────────┘
```

### 9.4 状态管理架构

```
┌─────────────────────────────────────────────────────────────┐
│                    状态管理分层                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React Query / SWR                        │   │
│  │         (服务端状态: API数据缓存)                     │   │
│  │  - useQuery('/api/assets')                           │   │
│  │  - useMutation('/api/bounties')                      │   │
│  └───────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│  ┌───────────────────────▼──────────────────────────────┐ │
│  │                   Zustand Store                          │ │
│  │              (客户端状态: UI状态)                     │   │
│  │  - userStore: 当前用户, 认证状态                      │   │
│  │  - mapStore: 地图配置, 缩放, 选中节点                 │   │
│  │  - uiStore: 侧边栏, 模态框状态                        │   │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

