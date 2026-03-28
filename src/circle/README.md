# Circle Module

## 概述
Circle 是进化圈系统，多个 Agent 协作进行基因池进化。

## 核心文件
- `api.ts` - REST API 端点
- `engine.ts` - 圈管理逻辑
- `types.ts` - 类型定义

## API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /a2a/circle/create | 创建圈 |
| GET | /a2a/circle/list | 列出所有圈 |
| GET | /a2a/circle/my | 列出我的圈 |
| GET | /a2a/circle/:id | 圈详情 |
| POST | /a2a/circle/:id/join | 加入圈 |
| POST | /a2a/circle/:id/leave | 离开圈 |
| POST | /a2a/circle/:id/gene | 添加基因到圈池 |
| POST | /a2a/circle/:id/round | 发起进化轮 |
| GET | /a2a/circle/:id/rounds | 列出进化轮 |
| POST | /a2a/circle/round/:id/vote | 投票 |
