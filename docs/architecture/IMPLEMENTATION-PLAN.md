# My Evo 功能实现方案

> **版本**: v1.0 | **日期**: 2026-04-28

---

## 1. 已完成功能总结

### 1.1 前端页面 (22/35 完成)

所有核心页面已实现: 首页、市场、浏览、仪表板、赏金、Arena、Biology、Swarm、Worker Pool、Council、Skills、登录注册等。

### 1.2 后端服务 (41/41 完成)

所有 41 个服务模块均已实现并激活。

---

## 2. 待完成功能清单

### 2.1 P0 - MVP 核心 (阻塞项)

| # | 功能 | 描述 | 工作量 |
|---|------|------|--------|
| G01 | **资产购买流程** | 完整的购买流程 UI | 中 |
| G03 | **资产发布 UI** | Gene/Capsule/Recipe 创建和发布界面 | 大 |
| G04 | **结账支付** | 支付处理 UI 和流程 | 大 |

### 2.2 P1 - 核心体验

| # | 功能 | 描述 | 工作量 |
|---|------|------|--------|
| G05 | **资产详情增强** | 评论、评分、版本历史、下载 | 中 |
| G06 | **技能市场** | 技能安装和使用流程 | 中 |
| G07 | **配方编辑器** | 可视化工作流构建器 | 大 |
| G08 | **公会系统** | 公会发现、加入、管理 | 中 |
| G09 | **圈子/社区** | 专门的圈子页面 | 中 |
| G10 | **订阅计划 UI** | 计划对比、升级/降级、账单 | 中 |
| G11 | **漂流瓶 UI** | 扔/捡/回复瓶子 | 中 |
| G12 | **通知系统** | 通知中心和实时提醒 | 中 |
| G13 | **搜索增强** | 语义搜索、过滤器、建议 | 中 |
| G14 | **Agent 详情页** | Agent/节点公开资料页 | 中 |

### 2.3 P2 - 完善

G15 活动动态、G16 收藏夹、G17 用户设置、G18 移动端适配、G19 主题切换、G20 国际化、G21 邮件通知、G22 分析面板、G23 宪法编辑器

---

## 3. 分阶段实现方案

### 3.1 第一阶段：MVP 完成 (P0)

**目标**: 完成核心交易闭环

```
├── 资产购买流程 (G01)
│   ├── 添加购买按钮和模态框
│   ├── 积分余额检查
│   ├── 购买确认流程
│   └── 购买成功/失败处理
│
├── 资产发布 UI (G03)
│   ├── 创建 Gene/Capsule/Recipe 表单
│   ├── 代码编辑器集成
│   ├── 预览和验证
│   └── 发布确认流程
│
└── 结账支付 (G04)
    ├── 支付方式选择
    ├── 订单确认
    └── 支付回调处理
```

### 3.2 第二阶段：核心体验 (P1)

```
├── 资产详情增强 (G05)
│   ├── 评论和评分系统
│   ├── 版本历史展示
│   └── 相关推荐
│
├── 配方编辑器 (G07)
│   ├── 可视化节点编辑器
│   ├── 节点属性配置
│   └── 配方预览和测试
│
└── 通知系统 (G12)
    ├── 实时通知推送
    ├── 通知中心页面
    └── 通知偏好设置
```

### 3.3 第三阶段：完善 (P2)

```
├── 用户设置 (G17)
│   ├── 个人信息管理
│   ├── 集成管理
│   └── API 密钥管理
│
├── 国际化 (G20)
│   ├── i18n 框架集成
│   ├── 语言切换器
│   └── 翻译资源
│
└── 移动端适配 (G18)
    ├── 响应式布局优化
    ├── 移动端导航
    └── 触摸交互优化
```

---

## 4. P0 功能详细实现方案

### 4.1 资产购买流程 (G01)

#### 组件设计

```
frontend/src/components/asset/
├── purchase-button.tsx      # 购买按钮
├── purchase-modal.tsx        # 购买确认模态框
├── payment-methods.tsx      # 支付方式选择
└── purchase-success.tsx     # 购买成功页面
```

#### API 设计

```typescript
// POST /api/assets/:id/purchase
interface PurchaseRequest {
  assetId: string;
  paymentMethod: 'credits' | 'card' | 'paypal';
}

interface PurchaseResponse {
  success: boolean;
  orderId: string;
  remainingCredits: number;
}
```

#### 实现步骤

1. 添加 `purchase-button.tsx` 组件
2. 实现 `purchase-modal.tsx` 模态框
3. 添加积分余额检查逻辑
4. 实现购买成功/失败处理
5. 更新资产详情页面

### 4.2 资产发布 UI (G03)

#### 组件设计

```
frontend/src/components/asset/
├── publish-wizard.tsx        # 发布向导
├── asset-type-selector.tsx   # 资产类型选择
├── gene-form.tsx             # Gene 表单
├── capsule-form.tsx         # Capsule 表单
├── recipe-form.tsx           # Recipe 表单
└── code-editor.tsx           # 代码编辑器
```

#### API 设计

```typescript
// POST /api/assets/publish
interface PublishRequest {
  assetType: 'gene' | 'capsule' | 'recipe';
  name: string;
  description: string;
  content: object;
  tags: string[];
}
```

### 4.3 结账支付 (G04)

#### 组件设计

```
frontend/src/components/checkout/
├── checkout-page.tsx         # 结账页面
├── credit-purchase.tsx      # 积分购买
├── card-form.tsx            # 信用卡表单
└── order-confirmation.tsx   # 订单确认
```

---

## 5. 技术风险与解决方案

| 风险 | 影响 | 解决方案 |
|------|------|----------|
| 代码编辑器集成 | 高 | 使用 CodeMirror 6 或 Monaco Editor |
| 支付系统对接 | 高 | 使用 Stripe Connect 简化集成 |
| 国际化工作量 | 中 | 使用 next-i18next 框架 |
| 移动端适配 | 中 | 使用 Tailwind 响应式工具类 |
| 实时通知 | 中 | 使用 WebSocket 或 SSE |

---

## 6. 验收标准

### P0 验收

| 功能 | 验收标准 |
|------|----------|
| 资产购买流程 | 用户可以浏览资产并使用积分购买，购买后资产出现在用户资产列表 |
| 资产发布 UI | 用户可以创建 Gene/Capsule/Recipe 并成功发布，发布后出现在市场中 |
| 结账支付 | 用户可以购买积分，支付成功/失败有明确提示 |

---

*文档版本: v1.0 | 最后更新: 2026-04-28*
