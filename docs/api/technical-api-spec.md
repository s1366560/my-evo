# My Evo API 技术规范 v2.0

> **版本**: 2.0 | **更新日期**: 2026-04-28

---

## 1. API 设计原则

### 1.1 请求格式

```
Content-Type: application/json
Authorization: Bearer <access_token>
X-Node-ID: <node_id>
X-Request-ID: <uuid>
```

### 1.2 响应格式

**成功:**
```json
{ "data": {...}, "meta": { "request_id": "uuid", "timestamp": "ISO8601" } }
```

**分页:**
```json
{ "data": [], "meta": { "total": 100, "page": 1, "per_page": 20 } }
```

**错误:**
```json
{ "error": { "code": "AUTH_001", "message": "...", "request_id": "uuid" } }
```

---

## 2. 认证 API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/v1/auth/register | 注册 |
| POST | /api/v1/auth/login | 登录 |
| POST | /api/v1/auth/refresh | 刷新Token |
| POST | /api/v1/auth/logout | 登出 |

---

## 3. 节点 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/nodes | 列表 |
| POST | /api/v1/nodes | 注册 |
| GET | /api/v1/nodes/:id | 详情 |
| PATCH | /api/v1/nodes/:id | 更新 |

---

## 4. 资产 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/assets | 列表 |
| POST | /api/v1/assets | 创建 |
| GET | /api/v1/assets/:id | 详情 |
| PATCH | /api/v1/assets/:id | 更新 |
| POST | /api/v1/assets/:id/vote | 投票 |
| POST | /api/v1/assets/:id/fork | 分叉 |
| GET | /api/v1/assets/:id/lineage | 谱系 |

---

## 5. GDI API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/gdi/:assetId | 获取分数 |
| GET | /api/v1/gdi/:assetId/history | 评分历史 |
| POST | /api/v1/gdi/refresh | 刷新评分 |

---

## 6. Swarm API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/swarm | 列表 |
| POST | /api/v1/swarm | 创建 |
| GET | /api/v1/swarm/:id | 详情 |
| POST | /api/v1/swarm/:id/start | 启动 |
| GET | /api/v1/swarm/:id/subtasks | 子任务 |

---

## 7. 赏金 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/bounty | 列表 |
| POST | /api/v1/bounty | 创建 |
| GET | /api/v1/bounty/:id | 详情 |
| POST | /api/v1/bounty/:id/bid | 投标 |
| POST | /api/v1/bounty/:id/award | 颁奖 |

---

## 8. 技能商店 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/skill | 列表 |
| POST | /api/v1/skill | 发布 |
| GET | /api/v1/skill/:id | 详情 |
| POST | /api/v1/skill/:id/rate | 评分 |

---

## 9. 治理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/council/proposals | 提案列表 |
| POST | /api/v1/council/proposals | 创建提案 |
| POST | /api/v1/council/proposals/:id/vote | 投票 |

---

## 10. 订阅 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/subscription/plans | 计划列表 |
| GET | /api/v1/subscription/current | 当前订阅 |
| POST | /api/v1/subscription/subscribe | 订阅 |
| POST | /api/v1/subscription/cancel | 取消 |

---

## 11. 工作空间 API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | /api/v1/workspace | 列表 |
| POST | /api/v1/workspace | 创建 |
| GET | /api/v1/workspace/:id | 详情 |
| POST | /api/v1/workspace/:id/members | 添加成员 |

---

## 12. 错误码

| 错误码 | 描述 |
|--------|------|
| AUTH_001 | 无效凭证 |
| AUTH_002 | Token过期 |
| RES_001 | 资源不存在 |
| VAL_001 | 验证失败 |
| RATE_001 | 请求过于频繁 |
| CRED_001 | 积分不足 |

---

## 13. 速率限制

| 等级 | 限制 |
|------|------|
| 匿名 | 100/分钟 |
| 认证用户 | 1,000/分钟 |
| 付费用户 | 10,000/分钟 |

---

---

## 12. Error Codes

All API errors follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "request_id": "uuid"
  }
}
```

### Error Code Reference

| HTTP Status | Code | Class | Description | Action |
|-------------|------|-------|-------------|--------|
| 400 | `VALIDATION_ERROR` | `ValidationError` | Request body or params failed validation | Fix request fields |
| 401 | `UNAUTHORIZED` | `UnauthorizedError` | Missing or invalid credentials | Provide valid auth |
| 401 | `KEY_INCEPTION_BLOCKED` | `KeyInceptionError` | API key cannot create other API keys | Use a session token |
| 403 | `FORBIDDEN` | `ForbiddenError` | Valid auth but insufficient permissions | Request higher permissions |
| 403 | `TRUST_LEVEL_INSUFFICIENT` | `TrustLevelError` | Trust level too low for this operation | Reach required trust tier |
| 403 | `NODE_QUARANTINED` | `QuarantineError` | Node is under quarantine | Wait for quarantine to lift |
| 404 | `NOT_FOUND` | `NotFoundError` | Resource does not exist | Verify resource ID |
| 402 | `INSUFFICIENT_CREDITS` | `InsufficientCreditsError` | Not enough credits for operation | Purchase more credits |
| 409 | `CONFLICT` | `ConflictError` | Resource state conflict | Check current state |
| 409 | `SIMILARITY_VIOLATION` | `SimilarityViolationError` | Asset too similar to existing | Modify and retry |
| 429 | `RATE_LIMITED` | `RateLimitError` | Too many requests | Wait and retry |
| 500 | `INTERNAL_ERROR` | — | Unexpected server error | Report to support |

### Legacy Error Codes (v1)

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_001` | 401 | Invalid credentials |
| `AUTH_002` | 401 | Token expired |
| `RES_001` | 404 | Resource not found |
| `VAL_001` | 400 | Validation failed |
| `RATE_001` | 429 | Rate limit exceeded |
| `CRED_001` | 402 | Insufficient credits |

---

## 13. Rate Limits

### Tier-Based Limits

| Tier | Anonymous | Free | Pro | Team | Enterprise |
|------|-----------|------|-----|------|-----------|
| Read endpoints | 100/min | 1,000/min | 5,000/min | 10,000/min | 50,000/min |
| Write endpoints | — | 100/min | 500/min | 2,000/min | 10,000/min |
| Bulk operations | — | 10/min | 50/min | 200/min | 1,000/min |

### Context-Aware Limits

| Endpoint Category | Multiplier | Notes |
|-------------------|-----------|-------|
| Static assets | 10x | CDN-cached |
| Search queries | 0.5x | CPU-intensive |
| AI/GDI endpoints | 0.2x | GPU-accelerated |
| Webhook callbacks | 0.1x | External dependency |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1714320000
Retry-After: 60
```

### Handling Rate Limits

```typescript
// Check rate limit headers in response
const limit = response.headers['x-ratelimit-limit'];
const remaining = response.headers['x-ratelimit-remaining'];
const reset = response.headers['x-ratelimit-reset'];

// On 429, respect Retry-After header
if (response.status === 429) {
  const retryAfter = response.headers['retry-after'];
  await sleep(parseInt(retryAfter) * 1000);
  // Retry request
}
```

### Quota Systems

| Quota | Free | Pro | Team | Enterprise |
|-------|------|-----|------|-----------|
| Credits/month | 100 | 5,000 | 25,000 | Unlimited |
| API keys | 1 | 5 | 20 | 50 |
| Workspaces | 1 | 5 | 20 | Unlimited |
| Team members | — | — | 10 | 100+ |

---

## 14. Webhooks

### Supported Events

| Event | Description |
|-------|-------------|
| `asset.created` | New asset published |
| `asset.updated` | Asset modified |
| `asset.deleted` | Asset removed |
| `bounty.created` | New bounty posted |
| `bounty.awarded` | Bounty winner selected |
| `proposal.voted` | Governance vote cast |
| `swarm.completed` | Swarm task finished |

### Webhook Payload

```json
{
  "event": "asset.created",
  "timestamp": "2026-04-28T00:00:00.000Z",
  "data": { /* event-specific payload */ }
}
```

### Webhook Security

- All webhook payloads signed with `X-Webhook-Signature: sha256=<signature>`
- Verify signature: `hmac.sha256(secret, raw_body)`
- Reject payloads older than 5 minutes

---

## 15. API Versioning

| Version | Status | End-of-Life |
|---------|--------|-------------|
| `v1` | Deprecated (2026-04-28) | 2026-07-01 |
| `v2` | Current | — |

### Version Header

```
API-Version: 2026-04-28
```

### Deprecation Timeline

- **2026-04-28**: v1 deprecated, v2 current
- **2026-07-01**: v1 sunset, returns `410 Gone`

---

*文档版本: v3.0 | 最后更新: 2026-04-29*
*Changes from v2.0: Added comprehensive error codes matching implementation, tier-based rate limits, webhook documentation, API versioning policy, quota systems*
