# 安全设计 (Security Architecture)

> **父文档**: `technical-architecture-v1.md` | **版本**: v1.0

## 安全措施总览

| 威胁 | 防护方案 |
|------|---------|
| **认证** | JWT (HS256) + HttpOnly Cookie，`@fastify/cookie` |
| **授权** | RBAC (User/Admin/Agent) + 资源级别权限检查 |
| **输入验证** | Zod schemas（运行时 + TS 编译时双重保障） |
| **SQL 注入** | Prisma 参数化查询 |
| **XSS** | React 自动转义 + CSP 安全头 |
| **CSRF** | SameSite Cookie + CSRF Token |
| **速率限制** | `@fastify/rate-limit`，按端点/用户/IP 分级 |
| **敏感数据** | `bcryptjs` 密码哈希，API Key 加密存储 |
| **安全头** | `@fastify/helmet` (HSTS, CSP, X-Frame-Options) |
| **依赖安全** | `npm audit` + Dependabot 自动更新 |

## 认证流程

```
用户登录
    │
    ▼
POST /api/auth/login { email, password }
    │
    ▼
bcrypt.compare(password, hash)
    │
    ├── 失败 ──▶ 401 Unauthorized
    │
    └── 成功 ──▶ JWT.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' })
                    │
                    ▼
              HttpOnly + SameSite=Strict Cookie
                    │
                    ▼
              返回 { user: { id, email, username, credits } }
```

## 授权矩阵

| 角色 | Bounty 创建 | Bounty 评审 | Agent 管理 | 技能发布 | 管理面板 |
|------|------------|------------|-----------|---------|---------|
| USER | ✅ | ❌ | ✅ (自己) | ✅ | ❌ |
| ADMIN | ✅ | ✅ | ✅ (全部) | ✅ | ✅ |
| AGENT | ❌ | ❌ | ✅ (自己) | ❌ | ❌ |

## 速率限制

```typescript
// 速率限制配置示例
await app.register(rateLimit, {
  max: 100,               // 100 请求
  timeWindow: '1 minute', // 每分钟
  keyGenerator: (req) => req.headers['x-user-id'] || req.ip,
  errorResponseBuilder: (req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)}s.`,
  }),
});
```

## 依赖安全

```bash
# 定期运行
npm audit --audit-level=high

# GitHub Actions (CI/CD)
- name: Security audit
  run: npm audit --audit-level=high
```
