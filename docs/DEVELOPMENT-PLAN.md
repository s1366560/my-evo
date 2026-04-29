# My Evo 开发计划

> 版本: v1.0.0
> 日期: 2026-04-27
> 状态: 已规划

---

## 执行摘要

本开发计划基于对 [evomap.ai](https://evomap.ai) 的深度分析和 my-evo 项目的现状评估制定。

**当前进度**:
- 后端服务: 100% (22/22 模块)
- 前端页面: 74% (26/35 页面)
- 核心功能: ~70%

**核心缺口**:
1. 资产购买流程
2. 资产发布 UI
3. Checkout/支付
4. 配方编辑器

---

## 阶段一: MVP 完成 (第 1-2 周)

### 目标
完成核心购买和发布流程，确保平台商业闭环可用。

### 任务清单

#### T-P0-001: 资产购买流程
**负责人**: frontend-dev  
**优先级**: CRITICAL  
**工作量**: 5 天

**用户故事**:
- 作为用户，我可以浏览资产详情
- 作为用户，我可以查看价格和卖家信息
- 作为用户，我可以发起购买
- 作为用户，我可以确认支付
- 作为用户，我可以查看购买历史

**技术方案**:
```
/browse/[assetId]
├── PurchaseButton.tsx      # 购买按钮组件
├── PriceConfirmModal.tsx   # 价格确认弹窗
└── PurchaseSuccess.tsx     # 购买成功页
```

**API 端点**:
```
POST /api/v2/assets/:id/purchase
POST /api/v2/checkout/create
POST /api/v2/checkout/confirm
```

**验收标准**:
- [ ] 资产详情页有购买按钮
- [ ] 购买前显示价格确认弹窗
- [ ] 支付后更新资产所有权
- [ ] 购买历史可在 Dashboard 查看

---

#### T-P0-002: 资产发布 UI
**负责人**: frontend-dev  
**优先级**: CRITICAL  
**工作量**: 8 天

**用户故事**:
- 作为发布者，我可以创建 Gene
- 作为发布者，我可以创建 Capsule
- 作为发布者，我可以创建 Recipe
- 作为发布者，我可以设置价格
- 作为发布者，我可以提交审核

**技术方案**:
```
/dashboard/publish
├── GeneForm.tsx           # Gene 创建表单
├── CapsuleForm.tsx        # Capsule 创建表单
├── RecipeEditor.tsx       # Recipe 可视化编辑器
├── AssetPreview.tsx       # 发布前预览
└── PublishConfirm.tsx     # 发布确认
```

**验收标准**:
- [ ] 有 Gene 创建表单 (名称、描述、信号标签)
- [ ] 有 Capsule 创建表单 (名称、描述、基因关联)
- [ ] 有 Recipe 可视化编辑器 (拖拽工作流)
- [ ] 有发布前预览
- [ ] 提交后进入审核队列

---

#### T-P0-003: Checkout 后端
**负责人**: backend-dev  
**优先级**: CRITICAL  
**工作量**: 6 天

**用户故事**:
- 作为系统，我可以创建订单
- 作为系统，我可以验证支付
- 作为系统，我可以处理退款
- 作为用户，我可以查看订单状态

**API 端点**:
```
POST /api/v2/checkout/create
  Body: { asset_id, buyer_id, price }
  Response: { order_id, payment_url }

POST /api/v2/checkout/confirm
  Body: { order_id, payment_proof }
  Response: { success, asset_transfer }

GET  /api/v2/checkout/:id
  Response: { order_id, status, asset_id, amount }

GET  /api/v2/orders
  Query: { status, page, limit }
  Response: { orders[], total }
```

**数据模型**:
```prisma
model Order {
  id            String    @id @default(cuid())
  order_id      String    @unique
  asset_id      String
  buyer_id      String
  seller_id     String
  amount        Int
  status        OrderStatus
  payment_proof String?
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt
}

enum OrderStatus {
  PENDING
  PAID
  COMPLETED
  CANCELLED
  REFUNDED
}
```

**验收标准**:
- [ ] 可以创建订单
- [ ] 可以确认支付
- [ ] 可以查询订单状态
- [ ] 支付后自动转移资产所有权
- [ ] 退款流程可用

---

## 阶段二: 核心体验 (第 3-5 周)

### 目标
完善核心用户体验，增加用户粘性和参与度。

### 任务清单

#### T-P1-001: 配方编辑器 (Recipe Composer)
**负责人**: frontend-dev  
**优先级**: HIGH  
**工作量**: 8 天

**功能**:
- 可视化拖拽工作流构建器
- Gene/Capsule 节点选择
- 连接线和数据流定义
- 配方预览和测试

**技术栈**:
- React Flow (工作流可视化)
- Tailwind CSS (样式)
- React Hook Form (表单)

---

#### T-P1-002: 通知系统
**负责人**: frontend-dev  
**优先级**: HIGH  
**工作量**: 5 天

**功能**:
- 通知中心组件
- 实时通知 (WebSocket)
- 通知类型: 购买、评论、赏金、投票等
- 通知偏好设置

**技术栈**:
- Socket.io (实时通信)
- Zustand (状态管理)

---

#### T-P1-003: Agent 个人页面
**负责人**: frontend-dev  
**优先级**: HIGH  
**工作量**: 4 天

**功能**:
- Agent 公开资料页
- 资产列表
- 声誉和排名
- 活动历史

---

#### T-P1-004: 资产详情页增强
**负责人**: frontend-dev  
**优先级**: HIGH  
**工作量**: 4 天

**功能**:
- 评论和评分系统
- 版本历史
- 下载功能
- 相关资产推荐

---

#### T-P1-005: 订阅计划 UI
**负责人**: frontend-dev  
**优先级**: MEDIUM  
**工作量**: 5 天

**功能**:
- 套餐对比表格
- 升级/降级流程
- 计费历史

---

#### T-P1-006: 公会系统
**负责人**: frontend-dev  
**优先级**: MEDIUM  
**工作量**: 6 天

**功能**:
- 公会发现和浏览
- 创建和加入公会
- 公会管理面板
- 公会活动

---

#### T-P1-007: 漂流瓶 UI
**负责人**: frontend-dev  
**优先级**: MEDIUM  
**工作量**: 4 天

**功能**:
- 投掷漂流瓶
- 捡拾漂流瓶
- 回复漂流瓶

---

#### T-P1-008: Circle 页面
**负责人**: frontend-dev  
**优先级**: MEDIUM  
**工作量**: 4 天

**功能**:
- Circle 发现
- Circle 加入
- Circle 详情页
- Circle 活动

---

## 阶段三: 完善优化 (第 6-8 周)

### 目标
完善功能和用户体验，修复 Bug，增加国际化支持。

### 任务清单

| 任务 | 负责人 | 优先级 | 工作量 |
|------|--------|--------|--------|
| 收藏/心愿单 | frontend-dev | LOW | 2 天 |
| 用户设置增强 | frontend-dev | LOW | 3 天 |
| 国际化支持 | frontend-dev | LOW | 10 天 |
| 邮件通知 | backend-dev | LOW | 4 天 |
| 分析仪表盘 | frontend-dev | LOW | 5 天 |

---

## 阶段四: 架构文档 (持续)

### 目标
补齐项目文档，确保知识传承。

### 任务清单

| 任务 | 负责人 | 优先级 | 工作量 |
|------|--------|--------|--------|
| 完整架构文档 | documentation | HIGH | 持续 |
| API 文档生成 | documentation | HIGH | 持续 |
| 组件库文档 | documentation | MEDIUM | 持续 |
| 部署指南 | documentation | MEDIUM | 3 天 |
| 测试策略文档 | documentation | MEDIUM | 2 天 |

---

## 资源需求

### 团队配置

| 角色 | 人数 | 职责 |
|------|------|------|
| 前端开发 | 2 | UI/UX、功能开发 |
| 后端开发 | 1 | API、业务逻辑 |
| 全栈 | 1 | 功能开发、集成 |
| 技术写作 | 1 | 文档编写 |

### 技术债务

| 项目 | 优先级 | 说明 |
|------|--------|------|
| 测试覆盖率 | HIGH | 当前测试覆盖不足 |
| 性能优化 | MEDIUM | 页面加载速度 |
| 安全审计 | HIGH | API 安全 |
| 代码重构 | LOW | 清理冗余代码 |

---

## 里程碑

```
Week 1-2   Week 3-5   Week 6-8   Week 9+
   │          │          │          │
   ▼          ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│ MVP  │  │ P1   │  │ P2   │  │ DOC  │
│ 完成 │  │ 功能 │  │ 完善 │  │ 齐全 │
└──────┘  └──────┘  └──────┘  └──────┘

发布节奏:
- Alpha: Week 4  - P0 功能可用，内部测试
- Beta:  Week 8  - P1 功能可用，外部测试
- GA:    Week 12 - 完整版本，生产发布
```

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 需求变更 | 中 | 中 | 敏捷迭代，定期评审 |
| 技术难题 | 低 | 高 | 预留缓冲时间 |
| 人员变动 | 低 | 中 | 文档和知识共享 |
| 集成延迟 | 中 | 中 | 早期集成测试 |

---

*文档版本: v1.0.0 | 更新日期: 2026-04-27*
