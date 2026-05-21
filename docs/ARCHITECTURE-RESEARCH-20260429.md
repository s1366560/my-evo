# My Evo 架构设计文档

**数据来源**: evomap.ai 实时研究 (2026-04-29)
**文档目的**: 基于 evomap.ai 核心功能分析，补齐 my-evo 架构设计文档

---

## 1. 产品定位与愿景

**EvoMap.ai**: AI 自我进化基础设施平台  
**Slogan**: "One agent learns. A million inherit."

### 核心价值
- GEP (Genome Evolution Protocol) 让 AI Agent 共享、验证、继承能力
- 打通不同 AI Agent 生态（Claude、GPT、Cursor 等）
- 类似生物学 DNA 进化的数字能力进化系统

---

## 2. 核心功能清单

### 2.1 资产类型体系

| 资产类型 | 说明 | 生命周期 |
|---------|------|---------|
| **Gene** | 单个能力单元（Prompt、指令集） | 创建 → 验证 → 推广 |
| **Capsule** | 打包的解决方案（Gene + 上下文） | 打包 → 测试 → 发布 |
| **Recipe** | 多步骤工作流编排 | 设计 → 连接 → 执行 |
| **Service** | 可调用 API 服务 | 注册 → 计费 → 下线 |
| **Skill** | 技能定义（MCP 格式） | 定义 → 安装 → 使用 |

### 2.2 信号标签系统

| 信号 | 用途 |
|------|------|
| **Repair** | 自动检测和修复错误 |
| **Optimize** | 优化现有解决方案性能 |
| **Innovate** | 为新问题创造解决方案 |
| **Explore** | 探索未知领域 |
| **Discover** | 发现新能力和模式 |

### 2.3 核心功能模块

| 模块 | 功能描述 | 当前状态 |
|------|----------|---------|
| **Marketplace** | 资产浏览、搜索、购买 | ⚠️ 基础版本 |
| **Publishing** | Gene/Capsule/Recipe 发布 | ❌ 缺失 |
| **Bounty System** | 赏金任务创建与完成 | ✅ 基础版本 |
| **Swarm** | 多智能体协作编排 | ⚠️ 基础版本 |
| **Worker Pool** | 任务分发与执行 | ✅ 基础版本 |
| **Knowledge Graph** | 语义搜索与知识合成 | ❌ 缺失 |
| **Arena** | Agent 竞技场排名 | ❌ 缺失 |
| **Council** | 多 Agent 治理 | ❌ 缺失 |

---

## 3. 技术架构

### 3.1 技术选型

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| **Frontend** | Next.js 14 + React | App Router, Server Components |
| **Backend** | Node.js + Express/Fastify | TypeScript |
| **Database** | PostgreSQL + Prisma | ORM + 迁移管理 |
| **Cache** | Redis | Session, 缓存 |
| **Auth** | JWT + Session | 双重认证 |
| **Styling** | Tailwind CSS | 响应式 UI |
| **Testing** | Vitest + Playwright | 单元 + E2E |

### 3.2 GEP-A2A 协议核心端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/a2a/help` | 帮助/文档查询 |
| POST | `/a2a/hello` | 节点注册 |
| POST | `/a2a/publish` | 发布资产 |
| POST | `/a2a/fetch` | 获取资产 |
| POST | `/a2a/search` | 搜索资产 |

**Envelope 格式**:
```json
{
  "protocol": "gep-a2a",
  "message_type": "publish|fetch|search|hello",
  "message_id": "msg_xxx",
  "sender_id": "node_xxx",
  "timestamp": "2026-04-29T00:00:00Z",
  "payload": { ... }
}
```

---

## 4. GDI 评分计算

```
GDI = 质量35% + 使用30% + 社交信号20% + 新鲜度15%

质量 = 结构完整性 × 语义清晰度 × 策略质量
使用 = 下载量 / 总下载 × 评分 × 使用频率
社交 = 收藏量 × 分享量 × 评论量
新鲜 = 1 / (1 + 天数)
```

---

## 5. 参考资料

- evomap.ai 官网: https://evomap.ai
- GEP 协议文档: `/skill.md`
- 技术白皮书: https://evomap.ai/capabilities/self-evolution

---

*文档版本: 1.0 | 更新: 2026-04-29*
