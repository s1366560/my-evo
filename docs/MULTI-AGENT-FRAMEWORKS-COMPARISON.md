# 主流开源多Agent框架横向对比报告

> 调研时间: 2026-04-28  
> 框架版本: LangGraph, CrewAI, AutoGen/AG2, MetaGPT, Swarms

---

## 一、概览对比矩阵

| 维度 | LangGraph | CrewAI | AutoGen/AG2 | MetaGPT | Swarms |
|------|-----------|--------|-------------|---------|--------|
| **开源协议** | MIT | Apache 2.0 | MIT | MIT | Apache 2.0 |
| **主导厂商** | LangChain Inc. | CrewAI Inc. | Microsoft/AG2AI | 开源社区 | Swarms.ai |
| **核心抽象** | 状态机/图 | Role-based Agent | Conversation | SOP-driven Company | Swarm Orchestration |
| **最低依赖** | Python 3.10+ | Python 3.10+ | Python 3.8+ | Python 3.9+ | Python 3.10+ |
| **入门门槛** | 中高 | 低 | 中 | 中 | 中 |
| **生产就绪度** | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| **GitHub Stars** | ~25k | ~18k | ~35k | ~40k | ~12k |

---

## 二、LangGraph

### 2.1 核心定位
**低层次的状态机编排框架**，强调可控性、可观测性和可持久化。

### 2.2 关键特性
- **图状态机架构**: 基于节点-边 DAG 定义 agent 工作流
- **内置 memory**: 跨会话持久化对话历史
- **Human-in-the-loop**: 易于插入人工审批/干预节点
- **First-class streaming**: 原生 token 级流式输出
- **与 LangSmith 集成**: 完整可观测性 (trace, eval, debug)

### 2.3 优势
- 极度灵活，适合定制化复杂工作流
- 状态可视化调试能力强
- 生态完整 (LangChain 工具链)

### 2.4 劣势
- 学习曲线较陡，需要理解图/状态概念
- 高层次抽象较少，需大量自研

### 2.5 适用场景
- 企业级复杂 agent 系统
- 金融、医疗等强合规领域
- 需要精确控制执行流程的场景

---

## 三、CrewAI

### 3.1 核心定位
**Role-based 多 agent 协作框架**，以"角色-目标-工具"为核心抽象。

### 3.2 关键特性
- **角色抽象**: Engineer, Researcher, Planner 等预定义角色
- **并行/串行执行**: `Crew.kickoff()` 支持进程并行
- **任务委派**: Agent 之间可主动委派任务
- **输出结构化**: 支持 Pydantic 输出验证

### 3.3 优势
- 入门门槛极低，Python 开发者 30 分钟上手
- 概念清晰，适合业务团队

### 3.4 劣势
- 灵活性受限，复杂流程需要绕过框架
- 状态管理能力弱

### 3.5 适用场景
- 快速原型验证
- 文档生成、研究报告类任务
- 业务流程相对固定的项目

---

## 四、AutoGen / AG2

### 4.1 核心定位
**微软开源的对话式多 agent 框架**，强调 agent 间自然语言协作。

### 4.2 关键特性
- **GroupChat**: 多 agent 群聊模式，支持 ~10 agents
- **Human-in-the-loop**: 支持人工介入任意步骤
- **代码执行**: 内置代码解释器
- **AutoGen Studio**: 可视化编排界面
- **多模态支持**: 图像、音频等多模态交互

### 4.3 优势
- Microsoft 背书，企业级可靠性
- GroupChat 机制强大
- 与 Azure OpenAI 深度集成

### 4.4 劣势
- 0.2→AG2 过渡期存在兼容性问题
- GroupChat 规模受限

### 4.5 适用场景
- 企业 Microsoft 生态集成
- 需要人机协作的场景
- 复杂对话式 AI 系统

---

## 五、MetaGPT

### 5.1 核心定位
**模拟软件公司 SOP 的多 agent 框架**，每个 agent 扮演特定角色执行标准流程。

### 5.2 关键特性
- **SOP 驱动**: 模拟产品经理、架构师、工程师等角色
- **端到端开发**: 一句话需求 → 完整代码
- **Benchmark SOTA**: SWE-bench 等任务上表现领先

### 5.3 优势
- 软件开发端到端能力强
- 角色职责清晰，协作机制成熟

### 5.4 劣势
- 专注软件开发，通用性受限
- 资源消耗大

### 5.5 适用场景
- 端到端软件开发任务
- 自动化代码生成
- 模拟软件团队工作流

---

## 六、Swarms

### 6.1 核心定位
**企业级多 agent 编排平台**，提供 18+ 预置架构模式。

### 6.2 关键特性
- **18+ 架构模式**: Sequential, Concurrent, Graph, Mixture-of-Agents 等
- **企业级架构**: 高可用、微服务设计
- **多协议支持**: MCP, X402, AOP 协议集成
- **向后兼容**: 支持 LangChain, AutoGen, CrewAI

### 6.3 优势
- 架构模式最全面
- 企业级功能完善
- 高度可扩展

### 6.4 劣势
- 相对较新，文档和社区待完善
- 某些模式处于 beta 阶段

### 6.5 适用场景
- 企业级大规模 agent 部署
- 需要多种架构模式的复杂项目
- 需要 MCP/X402 等协议集成的场景

---

## 七、选型决策矩阵

| 场景需求 | 推荐框架 | 理由 |
|---------|---------|------|
| 复杂企业级工作流 | LangGraph | 精确控制，可观测性强 |
| 快速原型/MVP | CrewAI | 入门快，概念清晰 |
| 人机协作场景 | AutoGen/AG2 | GroupChat + Human-in-loop |
| 端到端软件开发 | MetaGPT | SOP 驱动，角色分工明确 |
| 多种架构模式 | Swarms | 18+ 预置架构 |
| Microsoft 生态 | AutoGen/AG2 | Azure 深度集成 |

---

## 八、生产环境最佳实践

### 8.1 选型建议
1. **从简单开始**: CrewAI 或 Swarms 原型 → LangGraph 生产
2. **不要过度工程**: 70% 的场景单 agent 就够了
3. **关注可观测性**: 优先选择 LangGraph/Swarms

### 8.2 常见陷阱
- **40% 的多 agent 试点在生产 6 个月内失败** (主因: 选错编排模式)
- 单 agent 在 64% 任务中表现与多 agent 持平
- 多 agent 仅提升 2.1% 效果但成本翻倍

### 8.3 架构演进路径
```
单 Agent → Sequential Workflow → Fan-out/Fan-in → Multi-Agent Debate → Adaptive Planning
  (低复杂度)        (中等复杂度)           (高并发)           (合规审查)       (开放问题)
```

---

## 九、参考资料

1. LangGraph: https://www.langchain.com/langgraph
2. CrewAI: https://github.com/crewAI/crewAI
3. AutoGen/AG2: https://ag2.ai/
4. MetaGPT: https://github.com/geekan/MetaGPT
5. Swarms: https://github.com/kyegomez/swarms
