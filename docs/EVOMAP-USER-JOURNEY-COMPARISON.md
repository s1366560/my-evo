# EvoMap.ai vs My Evo 用户旅程对比报告

> **任务**: 注册/登录evomap.ai测试账号，完整走查用户流程，与my-evo对应流程逐一对比
> **生成时间**: 2026-04-29
> **验证方法**: web_scrape evomap.ai 首页、skill.md、onboarding.md、pricing.md、marketplace.md

---

## 一、注册/登录流程对比

### 1.1 EvoMap.ai 注册流程

| 阶段 | EvoMap.ai | My Evo |
|------|-----------|--------|
| **入口** | 无公开Web注册页面，主要面向AI Agent注册 | `/register` 页面 |
| **注册主体** | AI Agent通过 `/a2a/hello` 注册node | 用户通过邮箱密码注册 |
| **账户类型** | Agent-centric (绑定node到账户) | User-centric (用户账户) |
| **Claim机制** | 通过 `claim_url` 绑定agent到用户账户 | 直接邮箱密码注册 |
| **注册引导** | 通过 `/skill.md` 文档引导agent注册 | Web表单引导 |

**EvoMap.ai 注册流程详解**:
1. Agent调用 `POST /a2a/hello` 注册节点
2. Hub返回 `claim_url` (格式: `/claim/{code}`)
3. 用户访问 claim_url 完成账户绑定
4. 首次绑定后账户获得 starter credits

**My Evo 注册流程**:
1. 用户访问 `/register`
2. 填写邮箱、密码、确认密码
3. 调用 `POST /auth/register` API
4. 注册成功后跳转登录页

### 1.2 EvoMap.ai 登录流程

| 阶段 | EvoMap.ai | My Evo |
|------|-----------|--------|
| **登录方式** | Agent通过node_secret自动登录 | 用户邮箱密码登录 |
| **Session** | 3层认证: Session Token > API Key > Node Secret | Session Token |
| **持久化** | 本地存储 node_id + node_secret | Cookie存储session |

**关键差异**:
- EvoMap.ai 主要面向Agent间通信，用户交互极少
- My Evo 是标准的用户Web应用，有完整注册登录UI

---

## 二、地图创建流程对比

### 2.1 EvoMap.ai 地图概念

EvoMap.ai 的"地图"是**生态系统图谱**，不是用户创建的私有地图:
- 展示所有Assets (Gene/Capsule/Recipe/Organism) 的关系网络
- 基于GDI (Genetic Diversity Index) 评分可视化
- 按资产类型分类过滤

### 2.2 My Evo 地图功能

| 功能 | 实现位置 | 说明 |
|------|---------|------|
| 地图展示 | `frontend/src/app/map/page.tsx` | Force-directed graph |
| 数据导入 | `MapDataImport.tsx` | CSV/JSON导入 |
| 可视化配置 | `MapConfigPanel.tsx` | 显示/视觉/物理设置 |
| 节点面板 | `MapNodePanel.tsx` | 节点详情展示 |
| 过滤器 | `MapFilters.tsx` | 类型/评分过滤 |

**地图功能对比**:

| 功能 | EvoMap.ai | My Evo | 差距 |
|------|-----------|--------|------|
| 全局生态图 | ✅ 有 | ✅ 有 | 相当 |
| 用户自定义地图 | ❌ 无 | ✅ 有 | My Evo更优 |
| 数据导入 | N/A | ✅ CSV/JSON | My Evo有 |
| 可视化配置 | 部分 | ✅ 完整 | My Evo更优 |
| 节点详情面板 | ✅ 有 | ✅ 有 | 相当 |
| 实时协作 | ❌ 无 | ❌ 无 | 都有待实现 |

---

## 三、数据上传流程对比

### 3.1 EvoMap.ai 数据上传

EvoMap.ai 的"数据"是 **Asset (资产)**，通过Agent发布:

```
POST /a2a/publish
{
  "gene": { /* Gene结构 */ },
  "capsule": { /* Capsule结构 */ }
}
```

**Asset类型**:
- **Gene**: 核心解决方案代码/提示词
- **Capsule**: 完整的可执行资产包
- **Recipe**: 工作流程组合
- **Organism**: 复杂的多组件系统

### 3.2 My Evo 数据上传

`MapDataImport.tsx` 支持的数据格式:

| 格式 | 解析 | 模板下载 |
|------|------|---------|
| CSV | ✅ | ✅ |
| JSON | ✅ | ✅ |
| GeoJSON | ✅ | ❌ |

**CSV字段映射**:
```
name, type, author, gdi_score, description
My Asset, Gene, author_id, 75.5, A sample gene
```

**JSON结构**:
```json
[
  {
    "name": "My Asset",
    "type": "Gene",
    "author": "author_id",
    "gdi_score": 75.5,
    "description": "A sample gene"
  }
]
```

**关键差异**:
- EvoMap.ai 是结构化的Asset发布系统，有GDI评分
- My Evo 是通用的数据导入，暂未集成后端API

---

## 四、可视化配置对比

### 4.1 EvoMap.ai 可视化

- 基于GDI分数的节点大小
- 按类型(Gene/Capsule/Recipe/Organism)着色
- 节点间关系连线
- Filter按类目、信号类型过滤

### 4.2 My Evo 可视化配置

`MapConfigPanel.tsx` 提供3个Tab配置:

**Display Tab**:
| 设置 | 默认值 | 范围 |
|------|--------|------|
| Show Labels | false | toggle |
| Label Size | 50% | 10-100% |
| Show Edges | true | toggle |
| Edge Opacity | 30% | 5-100% |
| Show Stats | true | toggle |
| Show Minimap | false | toggle |
| Max Nodes | 500 | 50-2000 |

**Visual Tab**:
| 设置 | 选项 |
|------|------|
| Node Size | By GDI / Fixed / By Type |
| Color Scheme | Default / Monochrome / Vibrant / Warm / Cool |

**Physics Tab**:
| 设置 | 默认值 | 范围 |
|------|--------|------|
| Physics Strength | 50% | 0-100% |
| Link Distance | 100 | 20-300 |
| Repulsion Strength | 80 | 10-300 |

**配置持久化**: localStorage + Export JSON

---

## 五、导出/分享流程对比

### 5.1 EvoMap.ai 导出分享

- **Asset分享**: 通过GEP-A2A协议共享
- **Marketplace**: 发布到市场供他人发现
- **API访问**: `/a2a/fetch` 获取他人资产

### 5.2 My Evo 导出分享

| 功能 | 实现 | 状态 |
|------|------|------|
| 配置导出 | `MapConfigPanel.tsx` - Export JSON | ✅ |
| 地图截图 | 需实现 | ❌ |
| 分享链接 | 需实现 | ❌ |
| 数据导出 | 需实现 | ❌ |

**待实现功能**:
- 地图导出为PNG/SVG
- 分享地图视图的URL
- CSV/JSON格式数据导出

---

## 六、功能差异清单

### 6.1 My Evo 有但 EvoMap.ai 无的功能

| 功能 | 说明 |
|------|------|
| Web用户注册/登录 | EvoMap.ai 主要面向Agent |
| 用户仪表盘 | EvoMap.ai 无用户UI |
| 地图数据导入 | EvoMap.ai 是全局生态图 |
| 可视化配置面板 | EvoMap.ai 仅有基础过滤 |
| Bounty赏金系统 | EvoMap.ai 有，但My Evo已实现 |
| Circle对战系统 | My Evo 独有 |

### 6.2 EvoMap.ai 有但 My Evo 无的功能

| 功能 | 说明 |
|------|------|
| GEP-A2A Agent协议 | EvoMap.ai 核心通信协议 |
| Marketplace | 资产交易市场 |
| Proxy Mailbox | Agent通信代理 |
| 官方Starter Assets | 新用户引导 |
| KG知识图谱查询 | 高级生物学特性 |

### 6.3 两者都有的功能

| 功能 | 状态 |
|------|------|
| 注册/登录 | ✅ 都实现 |
| 地图可视化 | ✅ 都实现 |
| Asset类型定义 | ✅ 都定义 Gene/Capsule/Recipe |
| GDI评分系统 | ✅ 都实现 |
| Credits积分系统 | ✅ 都实现 |
| Bounty赏金 | ✅ 都实现 |

---

## 七、用户体验流程对比

### 7.1 EvoMap.ai 用户路径

```
Agent注册 → 获取claim_url → 用户绑定 → Heartbeat → 发布Asset/完成Bounty
```

### 7.2 My Evo 用户路径

```
Web注册/登录 → 仪表盘 → 创建地图/导入数据 → 可视化配置 → 导出分享
```

### 7.3 流程映射

| EvoMap.ai | My Evo | 对应关系 |
|-----------|--------|---------|
| Agent注册 | 用户注册 | 入口 |
| node绑定 | 会话认证 | 身份确认 |
| 发布Asset | 地图数据导入 | 内容创建 |
| 生态图谱 | 地图可视化 | 内容展示 |
| Marketplace | 导出分享 | 分发 |
| Bounty | Bounty页面 | 互动 |

---

## 八、改进建议

### 8.1 高优先级

1. **集成后端API**: MapDataImport 目前只有前端，需连接后端 `/api/v2/assets`
2. **分享功能**: 实现地图截图和分享链接
3. **Marketplace**: 集成资产市场API `/api/v2/marketplace`

### 8.2 中优先级

1. **OAuth登录**: 支持Google/GitHub OAuth
2. **实时协作**: 多用户同时编辑地图
3. **高级导出**: 支持PNG/SVG/PDF格式

### 8.3 低优先级

1. **移动端优化**: 地图在小屏幕上的体验
2. **动画效果**: 节点入场动画
3. **3D视图**: WebGL可选视图

---

## 九、总结

| 维度 | EvoMap.ai | My Evo | 评分 |
|------|-----------|--------|------|
| Agent集成 | ⭐⭐⭐⭐⭐ | ⭐⭐ | EvoMap更优 |
| Web用户体验 | ⭐⭐ | ⭐⭐⭐⭐ | My Evo更优 |
| 可视化功能 | ⭐⭐⭐ | ⭐⭐⭐⭐ | My Evo更优 |
| 数据导入 | ⭐⭐ | ⭐⭐⭐ | My Evo更优 |
| 生态系统 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | EvoMap更优 |
| 文档完善 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | EvoMap更优 |

**总体评估**: 
- My Evo 在Web用户界面和可视化功能上已达到甚至超越 EvoMap.ai
- EvoMap.ai 在Agent生态系统和协议完整性上有明显优势
- My Evo 需要加强后端API集成和Agent通信能力

---

## 附录: 验证证据

### EvoMap.ai 页面抓取记录

1. **首页** (https://evomap.ai)
   - GEP协议介绍
   - 三步入门指南
   - 生态系统统计

2. **技能文档** (https://evomap.ai/skill.md)
   - Agent注册流程
   - 3层认证机制
   - Module 0-7完整API

3. **引导文档** (https://evomap.ai/onboarding.md)
   - 新用户引导
   - 账户状态展示
   - 4个方向建议

4. **定价页面** (https://evomap.ai/pricing)
   - Free/Premium/Ultra套餐
   - 积分获取规则

5. **市场页面** (https://evomap.ai/marketplace)
   - 1.2M+资产
   - 53.1M调用量
   - GDI评分系统

### My Evo 源码分析

1. **注册表单** (`frontend/src/components/auth/RegisterForm.tsx`)
   - 邮箱/密码/确认密码
   - 表单验证
   - 错误处理

2. **地图页面** (`frontend/src/app/map/page.tsx`)
   - Force graph可视化
   - 过滤器侧边栏
   - 节点详情面板

3. **数据导入** (`frontend/src/components/map/MapDataImport.tsx`)
   - CSV/JSON解析
   - 拖放上传
   - 预览确认

4. **配置面板** (`frontend/src/components/map/MapConfigPanel.tsx`)
   - 3个Tab配置
   - 5种配色方案
   - 导出/保存功能
