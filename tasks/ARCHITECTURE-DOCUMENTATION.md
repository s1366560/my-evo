# My-Evo 完整架构文档

**项目路径**: /workspace/my-evo
**创建时间**: 2026-04-27
**状态**: 待执行
**优先级**: P0

## 任务描述

生成 My-Evo 项目完整架构文档，包括：
1. 分析项目整体架构（前端、后端、数据库）
2. 生成 API 规约文档（所有 Edge Functions）
3. 绘制数据流程图
4. 编写部署方案
5. 输出到 /workspace/docs/architecture/ 目录

## 项目概况

### 技术栈
- **后端**: Fastify 5.0 + TypeScript 5.5 + Prisma 6.0
- **前端**: Next.js (frontend/ 目录)
- **数据库**: PostgreSQL + Redis + Neo4j
- **测试**: Jest + ts-jest

### 后端模块 (src/)
| 模块 | 说明 |
|------|------|
| a2a | GEP-A2A 协议实现 |
| account | 账户管理 |
| assets | 资产 CRUD & 发布 |
| analytics | 分析服务 |
| arena | 竞技/排名 |
| biology | 生态系统指标 |
| bounty | 赏金任务系统 |
| council | 提案与投票 |
| credits | 积分系统 |
| dispute | 争议解决 |
| driftbottle | 匿名消息 |
| gepx | GEP-A2A 扩展 |
| kg | 知识图谱 |
| marketplace | 市场 |
| memory_graph | 内存图谱 |
| model_tier | 模型层管理 |
| quarantine | 内容隔离 |
| recipe | 配方管理 |
| reputation | 信誉系统 |
| sandbox | 沙盒执行 |
| search | 搜索服务 |
| security | 安全功能 |
| session | 会话管理 |
| skill_store | 技能市场 |
| subscription | 订阅管理 |
| swarm | 多智能体协调 |
| sync | 数据同步 |
| task | 任务管理 |
| worker | Worker 管理 |
| workerpool | Worker 池管理 |

## 成功标准

在 /workspace/docs/architecture/ 目录生成以下文档：
- [ ] README.md - 架构概览
- [ ] backend.md - 后端架构文档
- [ ] frontend.md - 前端架构文档
- [ ] database.md - 数据库设计文档
- [ ] api.md - API 规约文档
- [ ] deployment.md - 部署方案
- [ ] data-flow.md - 数据流程图

## 进度追踪

- [ ] 分析后端代码结构
- [ ] 分析前端代码结构
- [ ] 分析数据库 Schema
- [ ] 提取所有 API 路由
- [ ] 生成架构文档
- [ ] 生成数据流程图
- [ ] 编写部署方案