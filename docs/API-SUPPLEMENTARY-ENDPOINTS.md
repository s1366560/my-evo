# 后端API补充接口文档

## 概述

本文档描述 `my-evo` 项目中新增的四组补充接口模块：数据导出（Export）、批量操作（Batch）、高级筛选（Advanced Search）和审计日志（Audit）。

**前缀**: `/api/v2/`
**认证**: 所有接口均需通过 Session Token、API Key（`ek_` 前缀）或 Node Secret 认证。

---

## 1. 数据导出接口 (`/api/v2/export`)

### 1.1 创建导出任务
```
POST /api/v2/export/
```

**请求体**:
```json
{
  "entity_type": "asset",        // asset | node | agent | session | swarm
  "format": "csv",               // csv | json | xlsx | parquet
  "filters": {                    // 可选，筛选条件
    "status": "published",
    "date_from": "2024-01-01",
    "date_to": "2024-12-31",
    "tags": ["tag1", "tag2"]
  },
  "delivery": "async",            // async | sync | webhook
  "delivery_target": "https://...", // webhook URL
  "compression": "gzip"           // none | gzip | zip
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "job_id": "exp_xxx",
    "status": "pending",
    "entity_type": "asset",
    "format": "csv",
    "created_at": "2024-04-29T00:00:00Z",
    "expires_at": "2024-04-30T00:00:00Z"
  }
}
```

### 1.2 列出导出任务
```
GET /api/v2/export/?status=completed&entity_type=asset&page=1&page_size=20
```

### 1.3 获取导出任务状态
```
GET /api/v2/export/:jobId
```

### 1.4 获取导出列定义
```
GET /api/v2/export/columns/:entityType/:format
```

### 1.5 取消导出任务
```
DELETE /api/v2/export/:jobId
```

---

## 2. 批量操作接口 (`/api/v2/batch`)

### 2.1 创建批量任务
```
POST /api/v2/batch/
```

**请求体**:
```json
{
  "operation_type": "asset_bulk_update",
  "item_ids": ["id1", "id2", "id3"],
  "parameters": {
    "data": { "status": "published" }
  },
  "priority": "normal",
  "notification": { "on_complete": true, "webhook": "https://..." }
}
```

**支持的操作类型**:
| 操作类型 | 说明 | 权限要求 |
|---------|------|---------|
| `asset_bulk_update` | 批量更新资源 | `asset:write` |
| `asset_bulk_delete` | 批量删除资源 | `asset:delete` |
| `asset_bulk_publish` | 批量发布资源 | `asset:publish` |
| `asset_bulk_archive` | 批量归档资源 | `asset:write` |
| `node_bulk_update` | 批量更新节点 | `node:write` |
| `node_bulk_score_update` | 批量更新评分 | `node:write` |
| `swarm_bulk_task` | 批量 Swarm 任务 | `swarm:write` |

### 2.2 获取批量任务状态
```
GET /api/v2/batch/:jobId
```

**响应**:
```json
{
  "success": true,
  "data": {
    "job_id": "bat_xxx",
    "status": "running",
    "operation_type": "asset_bulk_update",
    "progress": {
      "total_items": 100,
      "processed_items": 45,
      "successful_items": 43,
      "failed_items": 2,
      "percentage": 45
    }
  }
}
```

### 2.3 暂停批量任务
```
POST /api/v2/batch/:jobId/pause
```

### 2.4 恢复批量任务
```
POST /api/v2/batch/:jobId/resume
```

### 2.5 取消批量任务
```
POST /api/v2/batch/:jobId/cancel
```

### 2.6 列出批量任务
```
GET /api/v2/batch/?operation_type=asset_bulk_update&status=running&page=1
```

### 2.7 获取批量任务进度
```
GET /api/v2/batch/:jobId/progress
```

---

## 3. 高级筛选接口 (`/api/v2/advanced-search`)

### 3.1 高级搜索
```
POST /api/v2/advanced-search/
```

**请求体**:
```json
{
  "entity_type": "asset",
  "query": "machine learning",
  "filters": {
    "status": "published",
    "date_range": { "from": "2024-01-01", "to": "2024-12-31" },
    "tags": ["AI", "ML"],
    "reputation_min": 50,
    "reputation_max": 100
  },
  "sort": { "field": "reputation", "order": "desc" },
  "page": 1,
  "page_size": 20,
  "include_facets": true
}
```

### 3.2 搜索建议
```
GET /api/v2/advanced-search/suggest?q=machine&entity_type=asset
```

### 3.3 获取可用筛选器
```
GET /api/v2/advanced-search/filters/:entityType
```

### 3.4 语义搜索
```
POST /api/v2/advanced-search/semantic
```

### 3.5 相似实体查询
```
POST /api/v2/advanced-search/similar
```

---

## 4. 审计日志接口 (`/api/v2/audit`)

### 4.1 查询审计日志
```
GET /api/v2/audit/?action_type=create&entity_type=asset&page=1&page_size=50
```

**查询参数**:
| 参数 | 说明 |
|-----|------|
| `action_type` | create, read, update, delete, export, admin |
| `entity_type` | asset, node, user, api_key, role |
| `user_id` | 按用户过滤 |
| `date_from` | 开始日期 |
| `date_to` | 结束日期 |

### 4.2 获取审计事件详情
```
GET /api/v2/audit/:eventId
```

### 4.3 获取实体变更历史
```
GET /api/v2/audit/history/:entityType/:entityId
```

### 4.4 获取用户活动摘要
```
GET /api/v2/audit/user-activity/:userId
```

### 4.5 获取安全事件
```
GET /api/v2/audit/security-events/
```

---

## 5. 错误响应格式

所有接口统一错误格式：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "item_ids cannot be empty",
    "details": {}
  }
}
```

**错误码**:
| 错误码 | HTTP 状态 | 说明 |
|-------|----------|------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `UNAUTHORIZED` | 401 | 认证失败 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMIT` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

---

## 6. 速率限制

| 接口组 | 限制 |
|-------|------|
| Export | 10 任务/分钟 |
| Batch | 20 任务/分钟 |
| Advanced Search | 60 请求/分钟 |
| Audit | 100 请求/分钟 |

---

## 7. 已注册路由清单

```
/api/v2/export/           GET, POST
/api/v2/export/:jobId     GET, DELETE
/api/v2/export/columns/:entityType/:format  GET

/api/v2/batch/            GET, POST
/api/v2/batch/:jobId      GET
/api/v2/batch/:jobId/pause   POST
/api/v2/batch/:jobId/resume  POST
/api/v2/batch/:jobId/cancel  POST
/api/v2/batch/:jobId/progress GET

/api/v2/advanced-search/           POST
/api/v2/advanced-search/suggest    GET
/api/v2/advanced-search/filters/:entityType  GET
/api/v2/advanced-search/semantic    POST
/api/v2/advanced-search/similar     POST

/api/v2/audit/              GET
/api/v2/audit/:eventId       GET
/api/v2/audit/history/:entityType/:entityId  GET
/api/v2/audit/user-activity/:userId  GET
/api/v2/audit/security-events/  GET
```
