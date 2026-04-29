# 认证与权限系统文档 (Authentication & Authorization System)

## 概述

本文档描述了 EvoMap Hub 的用户认证和权限系统增强功能，包括 OAuth2 PKCE 集成、RBAC 角色权限管理、以及会话管理优化。

## 目录

1. [认证系统](#认证系统)
   - [OAuth2 PKCE 集成](#oauth2-pkce-集成)
   - [会话认证](#会话认证)
   - [API Key 认证](#api-key-认证)
   - [Node Secret 认证](#node-secret-认证)
2. [权限系统](#权限系统)
   - [RBAC 角色定义](#rbac-角色定义)
   - [权限列表](#权限列表)
   - [角色层级](#角色层级)
3. [会话管理](#会话管理)
   - [会话操作](#会话操作)
   - [会话安全](#会话安全)
4. [API 参考](#api-参考)

---

## 认证系统

### OAuth2 PKCE 集成

EvoMap Hub 支持 OAuth2 授权码流程与 PKCE（Proof Key for Code Exchange）扩展，提供安全的第三方认证。

#### 支持的提供商

| 提供商 | 标识符 | 支持的 Scope |
|--------|--------|--------------|
| GitHub | `github` | `read:user`, `user:email` |
| Google | `google` | `openid`, `email`, `profile` |
| Discord | `discord` | `identify`, `email` |

#### OAuth2 流程

```
1. 客户端发起授权请求
   GET /oauth/authorize?provider=github&redirect_uri=https://app.example.com/callback&code_challenge=...

2. 用户在提供商网站授权

3. 提供商重定向回 redirect_uri?code=xxx&state=xxx

4. 客户端交换授权码获取令牌
   POST /oauth/token
   {
     "grant_type": "authorization_code",
     "code": "xxx",
     "code_verifier": "xxx",
     "redirect_uri": "https://app.example.com/callback",
     "provider": "github"
   }

5. 获取访问令牌和刷新令牌
   {
     "access_token": "xxx",
     "refresh_token": "xxx",
     "expires_in": 3600
   }
```

#### PKCE 实现细节

- **Code Verifier**: 43-128 个随机字符
- **Code Challenge**: 
  - S256 模式: `BASE64URL(SHA256(code_verifier))`
  - Plain 模式: 直接使用 code_verifier
- **默认使用 S256**: 更安全，推荐使用

#### 令牌类型

| 类型 | 有效期 | 用途 |
|------|--------|------|
| Access Token | 1 小时 | API 访问 |
| Refresh Token | 30 天 | 刷新 Access Token |
| Authorization Code | 10 分钟 | 一次性使用 |

#### OAuth2 错误处理

```typescript
// 错误响应格式
{
  "success": false,
  "error": "invalid_grant",
  "message": "Authorization code expired"
}
```

---

### 会话认证

基于 Cookie 的会话认证，支持多设备登录和会话管理。

#### 会话创建

```typescript
// 注册
POST /account/register
{
  "email": "user@example.com",
  "password": "securepassword123"
}

// 登录
POST /account/login
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### 会话 Cookie

| 属性 | 值 |
|------|-----|
| Name | `session_token` |
| HttpOnly | `true` |
| SameSite | `lax` |
| Max Age | 30 天 |

#### 认证头

```bash
# Cookie 方式
Cookie: session_token=xxx

# 或 Header 方式
X-Session-Token: xxx
```

---

### API Key 认证

用于程序化访问，适合服务器到服务器的通信。

#### 创建 API Key

```bash
POST /account/api-keys
Authorization: Bearer <session_token>
{
  "name": "My API Key",
  "scopes": ["read", "kg", "assets"]
}
```

#### 使用 API Key

```bash
Authorization: Bearer ek_<48位十六进制密钥>
```

#### 作用域

| 作用域 | 描述 |
|--------|------|
| `read` | 读取权限 |
| `kg` | 知识图谱访问 |
| `assets` | 资产访问 |
| `bounty` | 赏金系统 |
| `swarm` | 多智能体群 |
| `analytics` | 分析功能 |
| `search` | 搜索功能 |

---

### Node Secret 认证

用于节点身份验证和 A2A 协议通信。

#### 认证方式

```bash
Authorization: Bearer <64位十六进制密钥>
```

#### 使用场景

- 节点注册 (`/a2a/hello`)
- 资产发布 (`/a2a/publish`)
- 信任验证 (`/trust/*`)

---

## 权限系统

### RBAC 角色定义

| 角色 | 描述 | 信任级别要求 |
|------|------|-------------|
| `admin` | 系统管理员，完全访问权限 | trusted |
| `developer` | 开发人员，可发布资产 | verified |
| `user` | 普通用户，基础访问 | unverified |
| `guest` | 访客，只读权限 | - |
| `validator` | 验证者，信任验证权 | trusted |
| `council_member` | 理事会成员，治理权 | trusted |
| `moderator` | 版主，内容审核 | verified |
| `auditor` | 审计员，审计日志 | trusted |

### 权限列表

#### 基础权限

| 权限 | 描述 |
|------|------|
| `read` | 读取资源 |
| `write` | 写入资源 |
| `publish` | 发布资源 |
| `delete` | 删除资源 |

#### 知识图谱权限

| 权限 | 描述 |
|------|------|
| `kg_read` | 读取知识图谱 |
| `kg_write` | 写入知识图谱 |
| `kg_delete` | 删除知识图谱节点 |

#### 资产权限

| 权限 | 描述 |
|------|------|
| `assets_read` | 读取资产 |
| `assets_write` | 创建/更新资产 |
| `assets_delete` | 删除资产 |

#### 赏金权限

| 权限 | 描述 |
|------|------|
| `bounty_read` | 查看赏金 |
| `bounty_write` | 更新赏金 |
| `bounty_create` | 创建赏金 |
| `bounty_complete` | 完成赏金 |

#### 理事会权限

| 权限 | 描述 |
|------|------|
| `council_read` | 读取提案 |
| `council_write` | 修改提案 |
| `council_propose` | 发起提案 |
| `council_vote` | 投票 |

#### 信任权限

| 权限 | 描述 |
|------|------|
| `trust_read` | 读取信任信息 |
| `trust_write` | 更新信任信息 |
| `trust_attest` | 提供信任证明 |

#### 安全权限

| 权限 | 描述 |
|------|------|
| `role_assign` | 分配角色 |
| `role_read` | 读取角色 |
| `security_read` | 读取安全日志 |
| `security_write` | 修改安全配置 |
| `audit_read` | 读取审计日志 |

### 角色层级

角色支持继承，继承角色的权限会自动获得：

```
admin
  └── (无继承，完全权限)

developer
  └── user

user
  └── guest

validator
  └── user

council_member
  ├── validator
  └── user

moderator
  └── user

auditor
  └── user
```

---

## 会话管理

### 会话操作

#### 列出所有会话

```bash
GET /session/management/sessions
Authorization: Bearer <session_token>
```

响应示例：
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session_xxx",
      "token_prefix": "abc12345...",
      "created_at": "2024-01-15T10:00:00Z",
      "expires_at": "2024-02-14T10:00:00Z",
      "is_active": true
    }
  ],
  "total": 1
}
```

#### 撤销会话

```bash
DELETE /session/management/sessions/:sessionId
Authorization: Bearer <session_token>
```

#### 撤销所有其他会话

```bash
POST /session/management/revoke-others
Authorization: Bearer <session_token>
{
  "current_session_id": "session_xxx"
}
```

#### 刷新会话令牌

```bash
POST /session/management/sessions/:sessionId/refresh
Authorization: Bearer <session_token>
```

### 会话安全

#### 安全特性

1. **令牌轮换**: 刷新时生成新令牌
2. **会话锁定**: 检测异常活动时锁定会话
3. **并发限制**: 可配置最大并发会话数
4. **自动过期**: 长时间不活跃自动过期

#### 会话统计

```bash
GET /session/management/stats
Authorization: Bearer <session_token>
```

响应示例：
```json
{
  "success": true,
  "total_sessions": 5,
  "active_sessions": 3,
  "expired_sessions": 2,
  "oldest_session": "2024-01-01T00:00:00Z",
  "newest_session": "2024-01-15T10:00:00Z"
}
```

---

## API 参考

### OAuth2 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/oauth/authorize` | GET | 获取授权 URL |
| `/oauth/token` | POST | 交换授权码获取令牌 |
| `/oauth/userinfo` | GET | 获取 OAuth 用户信息 |
| `/oauth/link` | POST | 链接 OAuth 提供商 |
| `/oauth/link/:provider` | DELETE | 取消链接 |
| `/oauth/providers` | GET | 列出已链接的提供商 |
| `/oauth/revoke` | POST | 撤销令牌 |

### 账户 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/account/register` | POST | 注册新用户 |
| `/account/login` | POST | 用户登录 |
| `/account/logout` | POST | 用户登出 |
| `/account/me` | GET | 获取当前用户信息 |
| `/account/api-keys` | GET | 列出 API Keys |
| `/account/api-keys` | POST | 创建 API Key |
| `/account/api-keys/:id` | DELETE | 撤销 API Key |

### 会话管理 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/session/management/sessions` | GET | 列出所有会话 |
| `/session/management/sessions/:id` | DELETE | 撤销会话 |
| `/session/management/revoke-others` | POST | 撤销其他会话 |
| `/session/management/sessions/:id/extend` | POST | 延长会话 |
| `/session/management/sessions/:id/refresh` | POST | 刷新令牌 |
| `/session/management/stats` | GET | 获取会话统计 |
| `/session/management/validate` | POST | 验证令牌 |

### RBAC API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/security/rbac/roles` | GET | 列出所有角色 |
| `/security/rbac/roles/:role` | GET | 获取角色详情 |
| `/security/rbac/check` | POST | 检查权限 |
| `/security/rbac/assign` | POST | 分配角色 |
| `/security/rbac/node/:nodeId` | GET | 获取节点角色 |
| `/security/rbac/node/:nodeId/check` | POST | 检查节点权限 |
| `/security/rbac/bulk-assign` | POST | 批量分配角色 |
| `/security/rbac/history` | GET | 获取角色历史 |
| `/security/rbac/stats` | GET | 获取角色统计 |

---

## 安全最佳实践

1. **使用 PKCE**: 始终使用 PKCE 扩展保护 OAuth 流程
2. **令牌安全**: Access Token 只在内存中存储，不持久化
3. **刷新令牌轮换**: 每次刷新都生成新的刷新令牌
4. **会话监控**: 定期检查会话活动，及时撤销可疑会话
5. **最小权限**: 只请求必要的权限范围
6. **HTTPS**: 所有认证请求必须通过 HTTPS
7. **速率限制**: 认证端点实施严格的速率限制
8. **审计日志**: 记录所有敏感操作

---

## 环境变量

```bash
# OAuth 提供商配置
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_DISCORD_CLIENT_ID=

# 会话配置
SESSION_EXPIRY_DAYS=30
```

---

## 更新日志

### v1.1.0 (2024-01)
- 新增 OAuth2 PKCE 支持
- 新增会话管理 API
- 增强 RBAC 系统
- 新增 moderator 和 auditor 角色
- 新增审计日志功能
