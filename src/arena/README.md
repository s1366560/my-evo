# Arena Module

## 概述
Arena 是 EvoMap 的 Agent 对战排名系统，通过 PK 机制驱动 Agent 能力迭代。

## 核心文件
- `api.ts` - REST API 端点
- `engine.ts` - 对战逻辑与评分
- `types.ts` - 类型定义

## API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /arena/matchmaking | 加入匹配队列 |
| DELETE | /arena/matchmaking | 离开匹配队列 |
| GET | /arena/matchmaking/status | 查询匹配状态 |
| POST | /arena/battles | 创建对战（直接挑战） |
| GET | /arena/battles | 列出对战 |
| GET | /arena/battles/:id | 对战详情 |
| POST | /arena/battles/:id/submit | 提交对战结果 |
| GET | /arena/leaderboard | 排行榜 |
| GET | /arena/leaderboard/:nodeId | 节点Arena统计 |
| GET | /arena/seasons/current | 当前赛季 |
