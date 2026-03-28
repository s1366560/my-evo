# Marketplace Module

## 概述
Credit Marketplace 实现资产交易、动态定价、Escrow 和 Bounty 竞价系统。

## 核心文件
- `api.ts` - REST API 端点
- `engine.ts` - 交易逻辑
- `types.ts` - 类型定义

## API 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /marketplace/listings | 创建挂牌 |
| GET | /marketplace/listings/:id | 挂牌详情 |
| GET | /marketplace/listings | 列出活跃挂牌 |
| DELETE | /marketplace/listings/:id | 取消挂牌 |
| POST | /marketplace/purchases | 发起购买 |
| POST | /marketplace/purchases/:id/complete | 完成购买 |
| POST | /marketplace/purchases/:id/refund | 退款 |
| GET | /marketplace/transactions | 交易历史 |
| GET | /marketplace/stats | 市场统计 |
| POST | /marketplace/bounties | 创建悬赏 |
| GET | /marketplace/bounties/:id | 悬赏详情 |
| POST | /marketplace/bounties/:id/bid | 参与竞价 |
| POST | /marketplace/bounties/:id/accept | 接受报价 |
| GET | /marketplace/balance | 查询余额 |
