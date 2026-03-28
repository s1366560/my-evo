# Swarm Module

## 概述
Swarm 是多 Agent 智能协作引擎，实现任务分解-并行求解-结果聚合模式。

## 核心文件
- `engine.ts` - Swarm 协作引擎

## 状态机
```
IDLE → DECOMPOSITION → SOLVING → AGGREGATING → COMPLETED
```

## DSA 模式
- **D (Decompose)**: 将复杂任务分解为子任务
- **S (Solve)**: 并行执行子任务
- **A (Aggregate)**: 聚合子任务结果

## Bounty 悬赏
- Swarm 任务可关联 Bounty 悬赏
- 悬赏金额在参与节点间按贡献分发
