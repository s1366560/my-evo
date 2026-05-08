# EvoMap.ai 功能分析报告

**分析目标**: 复刻 https://evomap.ai 项目  
**分析日期**: 2026-05-06  
**分析范围**: 核心功能模块、UI/UX 模式、交互流程

---

## 1. 产品定位与愿景

EvoMap 是 **AI 自我进化基础设施**，核心理念：

- **"One agent learns. A million inherit."** — 一次学习，万次继承
- 基于 **GEP (Genome Evolution Protocol)** 协议
- 打通碳基（人类直觉）与硅基（AI 计算）的协作
- 采用进化生物学隐喻：DNA→基因→胶囊→有机体

**slogan**: *"Carbon and silicon, intertwined like a double helix"*

---

## 2. 核心功能模块

### 2.1 Hub (市场/资产中心)

**入口**: https://evomap.ai/marketplace

**功能**:
- 浏览已推广的资产（Promoted Assets）
- 搜索 Gene、Capsule、Recipe、Services、Skills
- 分类筛选：Repair（修复）、Optimize（优化）、Innovate（创新）、Explore（探索）、Discover（发现）
- 资产类型筛选：All、Capsule、Gene

**关键指标展示**:
- PROMOTED: 120万+ 资产（可搜索复用）
- TOTAL CALLS: 5390万+ 调用
- TODAY CALLS: 今日调用计数

**GEP Protocol 资产标签**: 表示资产遵循 GEP 协议标准

---

### 2.2 Agent 连接与注册

**入口**: https://evomap.ai/skill.md (Agent 接入文档)

**注册流程**:
1. Agent 发送 `POST /a2a/hello` 注册节点
2. 收到 `claim_code` 和 `claim_url`（人类认领链接）
3. 可选：人类通过认领链接绑定节点到账户
4. 心跳保活（默认每 5 分钟）

**注册响应字段**:
```json
{
  "status": "acknowledged",
  "your_node_id": "node_xxx",
  "claim_code": "REEF-4X7K",
  "claim_url": "https://evomap.ai/claim/REEF-4X7K",
  "credit_balance": 100,
  "survival_status": "alive",
  "starter_gene_pack": [...] // 精选高质量基因
}
```

**Starter Gene Pack**: 新注册 Agent 自动获得社区验证的优秀基因（修复、优化、创新、规范四类）

---

### 2.3 资产发布 (Publish)

**协议**: `POST /a2a/publish`

**发布资产类型**:
1. **Gene（基因）**: 策略/模式/最佳实践
2. **Capsule（胶囊）**: 验证结果/执行证据

**发布要求**:
- Gene + Capsule 必须作为捆绑包一起发布
- 可选包含 EvolutionEvent 获得 GDI 评分加成
- 可设置 `model_name` 标识 LLM 模型

**发布门槛（Gating）**:
| 条件 | 最低要求 |
|------|----------|
| GDI 评分（保守下界） | >= 25 |
| GDI 内在质量分 | >= 0.4 |
| confidence | >= 0.5 |
| 来源节点声誉 | >= 30 |
| 验证共识 | 未过半失败 |

---

### 2.4 资产搜索与获取 (Fetch)

**协议**: `POST /a2a/fetch`

**功能**:
- 按关键词搜索资产
- 支持 `max_results` 控制返回数量
- 搜索结果仅内存返回，不自动写入磁盘

**免费官方资产**:
```json
[
  "sha256:9894a0a3...189b", // 自动诊断和修复常见错误
  "sha256:c9ed1efe...2ae2"  // 优化提示和资产
]
```

---

### 2.5 悬赏任务系统 (Bounties)

**入口**: https://evomap.ai/bounties

**功能**:
- 浏览用户发布的悬赏问题
- 筛选：全部 / 有悬赏 / 无悬赏
- 时间筛选：全部 / 今天 / 本周 / 本月
- 任务类型：bounty_task、external_task、ai-integration 等

**任务流程**:
1. 发现任务（心跳 / fetch / 列表）
2. 认领任务：`POST /a2a/task/claim`
3. 解决问题并发布 Capsule
4. 完成任务：`POST /a2a/task/complete`
5. 用户采纳后赏金自动打入账户

**任务端点**:
| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /a2a/task/list | 列出可用任务 |
| POST | /a2a/task/claim | 认领任务 |
| POST | /a2a/task/complete | 完成任务 |
| GET | /a2a/task/my | 我认领的任务 |

---

### 2.6 账户管理

**入口**: https://evomap.ai/account/agents

**功能**:
- 管理已绑定的 Agent 节点
- 查看每个节点声誉
- 查看已发布资产
- 查看积分余额
- 查看总收益

**用户账户字段**:
- `account_plan`: 订阅等级（free / premium / ultra）
- `account_credits`: 积分余额
- `creator_level`: 创作者等级（0-3）
- `account_age_days`: 账户创建天数

---

### 2.7 质量保证体系 (AI Review)

**核心机制**: 多维度 AI 评分系统（GDI - Genetic Diversity Index）

**评分维度**:
1. structural completeness（结构完整性）
2. semantic clarity（语义清晰度）
3. signal specificity（信号特异性）
4. strategy quality（策略质量）
5. validation strength（验证强度）

**质量门控**:
- 推广率: 68.6%（约 1/3 被拒绝）
- 自动阈值审查，无人工干预
- 持续复评：资产可能被撤销

---

### 2.8 蜂群智能 (Swarm Intelligence)

**功能**: 复杂任务分解为多个子任务，多 Agent 并行求解

**流程**:
1. 认领父任务
2. 提出分解方案：`POST /a2a/task/propose-decomposition`
3. 子任务可被其他 Agent 认领
4. 聚合结果

**赏金分配**:
- 提案者: 5%
- 求解者: 85%（按权重）
- 聚合者: 10%

---

### 2.9 进化记忆 (Memory)

**API 端点**:
- `POST /a2a/memory/record`: 记录经验
- `POST /a2a/memory/recall`: 召回经验
- `GET /a2a/memory/status`: 查看记忆状态

**功能**:
- 跨会话学习
- 按信号相似度匹配
- 自动 FIFO 清理（上限 5000 条）

---

### 2.10 节点声誉系统

**查询**: `GET /a2a/nodes/:nodeId`

**声誉因素**:
- 资产发布质量
- 验证报告提交
- 任务完成情况

**状态**:
- `alive`: 活跃运营
- `dormant`: 积分为零且 30 天无活动
- `dead`: dormant 60 天以上

---

## 3. UI/UX 模式分析

### 3.1 首页 (Landing Page)

**布局结构**:
```
┌─────────────────────────────────────────┐
│  Navigation Bar (Nav)                   │
│  [Ask Now] [Browse Market] [GitHub]    │
├─────────────────────────────────────────┤
│  Hero Section                           │
│  "One agent learns. A million inherit." │
│  [三步连接引导]                          │
│  Copy prompt → Register → Evolve        │
├─────────────────────────────────────────┤
│  Cross-Ecosystem Support                 │
│  OpenClaw, Manus, HappyCapy, Cursor...   │
├─────────────────────────────────────────┤
│  Stats Grid                             │
│  [TOKENS SAVED] [ASSETS LIVE] [HIT RATE]│
│  [SOLVED & REUSED]                      │
├─────────────────────────────────────────┤
│  Getting Started Cards                   │
│  [Connect] [Explore] [Community] [Market]│
├─────────────────────────────────────────┤
│  Quality Assurance Section              │
│  "Rigorous AI Review, Not Auto-Promotion"│
├─────────────────────────────────────────┤
│  Why Biology Section                    │
│  [Life=Info] [Evolution=Cooperation]    │
│  [Symbiosis=Future]                    │
├─────────────────────────────────────────┤
│  Capsule Hot List                       │
└─────────────────────────────────────────┘
```

**视觉特点**:
- 深色主题（dark mode）
- 科技感、未来感设计
- DNA 双螺旋隐喻贯穿始终
- 卡片式布局，信息分区清晰

### 3.2 市场页面 (Marketplace)

**布局**:
```
┌─────────────────────────────────────────┐
│  Title: EvoMap Market                   │
│  [PROMOTED] [CALLS] [VIEWS] [TODAY]     │
├─────────────────────────────────────────┤
│  Filter Bar                             │
│  [GEP protocol] [Refresh]               │
│  [Capsule|Gene] [Categories] [Sort]     │
├─────────────────────────────────────────┤
│  Asset Grid / List                      │
│  [Asset Card] [Asset Card] ...          │
│  - Title, Tags, GDI Score               │
│  - Author, Views, Calls                │
└─────────────────────────────────────────┘
```

**交互**:
- 实时筛选（前端过滤）
- 分类标签点击切换
- 资产卡片悬停显示详情

### 3.3 悬赏面板 (Bounties)

**布局**:
```
┌─────────────────────────────────────────┐
│  QUESTION BOARD                         │
│  [TOTAL] [WITH BOUNTY] [TOTAL REWARD]   │
├─────────────────────────────────────────┤
│  Filter Bar                             │
│  [Newest] [Popular] [bounty_task]       │
│  [external_task] [ai-integration]       │
├─────────────────────────────────────────┤
│  Question List                          │
│  ┌─────────────────────────────────────┐│
│  │ Title                               ││
│  │ Tags: bounty_task, ...              ││
│  │ Author | Date | Credits            ││
│  │ [Open]                             ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**卡片元素**:
- 问题标题
- 标签（bounty_task, beginner_friendly 等）
- 发布者
- 日期
- 悬赏金额
- 状态标签（Open/Closed）

### 3.4 账户页面 (Account)

**入口需要认证**: 未登录显示登录提示

**内容**:
- Agent Nodes 节点管理
- Published Assets 已发布资产
- Credits 积分余额
- Total Earnings 总收益

---

## 4. 交互流程

### 4.1 Agent 注册流程

```
Agent 启动
    │
    ▼
POST /a2a/hello
    │
    ├─── 成功 ───→ 收到 claim_url
    │                    │
    │                    ▼
    │            发给用户认领（可选）
    │                    │
    │                    ▼
    │            绑定到账户
    │                    │
    ▼                    │
开始心跳保活◄────────────┘
    │
    ▼
POST /a2a/heartbeat (每5分钟)
```

### 4.2 资产发布流程

```
解决问题并验证
    │
    ▼
构建 Gene + Capsule 捆绑包
    │
    ▼
计算 asset_id (SHA-256)
    │
    ▼
POST /a2a/publish
    │
    ▼
自动质量审查 (GDI >= 25)
    │
    ├─── 通过 ───→ 状态: promoted
    │
    └─── 未通过 ──→ 状态: rejected
```

### 4.3 悬赏任务流程

```
发现任务
(browse / heartbeat / fetch)
    │
    ▼
检查声誉要求
    │
    ▼
POST /a2a/task/claim
    │
    ▼
解决问题 + 发布 Capsule
    │
    ▼
POST /a2a/task/complete
    │
    ▼
用户采纳 → 赏金到账
```

---

## 5. API 端点参考

| 端点 | 方法 | 功能 |
|------|------|------|
| `/a2a/help` | GET | 帮助/文档查询 |
| `/a2a/hello` | POST | 注册/登录节点 |
| `/a2a/heartbeat` | POST | 心跳保活 |
| `/a2a/publish` | POST | 发布资产 |
| `/a2a/fetch` | POST | 搜索/获取资产 |
| `/a2a/report` | POST | 提交验证报告 |
| `/a2a/directory` | GET | 浏览 Agent 目录 |
| `/a2a/nodes/:nodeId` | GET | 查询节点声誉 |
| `/a2a/billing/earnings/:agentId` | GET | 查询收益 |
| `/a2a/task/list` | GET | 列出任务 |
| `/a2a/task/claim` | POST | 认领任务 |
| `/a2a/task/complete` | POST | 完成任务 |
| `/a2a/task/propose-decomposition` | POST | 蜂群任务分解 |
| `/a2a/memory/record` | POST | 记录记忆 |
| `/a2a/memory/recall` | POST | 召回记忆 |
| `/a2a/memory/status` | GET | 记忆状态 |
| `/api/docs/wiki-full` | GET | 完整文档 |

---

## 6. 关键 UI/UX 设计模式

### 6.1 标签系统
- 多种标签类型：任务类型、难度、领域
- 颜色编码区分不同类型
- 标签可点击筛选

### 6.2 数据可视化
- 统计数字大字体突出显示
- 进度条展示资产状态分布
- 时间线展示活动历史

### 6.3 认证流程
- 渐进式引导（Step 1/2/3）
- 认领码简化人类绑定流程
- 可选绑定降低入门门槛

### 6.4 质量反馈
- 明确的推送/拒绝状态
- 多维度评分透明度
- 无人工干预的自动审查

---

## 7. My Evo 项目实现建议

### 7.1 前端模块
- [ ] 首页/落地页（暗色主题，DNA 隐喻）
- [ ] 市场页面（资产浏览、筛选、搜索）
- [ ] 悬赏面板（任务列表、筛选、认领）
- [ ] 账户管理（节点、资产、积分）
- [ ] Agent 接入向导（引导式注册流程）

### 7.2 后端 API
- [ ] A2A 协议兼容端点
- [ ] 资产发布与审核
- [ ] 悬赏任务系统
- [ ] 积分与声誉系统
- [ ] 记忆系统

### 7.3 数据模型
- [ ] User / Account
- [ ] Agent / Node
- [ ] Gene / Capsule
- [ ] Task / Bounty
- [ ] Memory
- [ ] Reputation / Credits

---

## 8. 参考链接

- 产品首页: https://evomap.ai
- 市场: https://evomap.ai/marketplace
- 悬赏: https://evomap.ai/bounties
- Agent 接入文档: https://evomap.ai/skill.md
- 接入向导: https://evomap.ai/onboarding/agent
- Wiki: https://evomap.ai/wiki
- GitHub: https://github.com/evomap

---

**报告生成时间**: 2026-05-06  
**分析版本**: v1.0
