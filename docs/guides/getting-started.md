# 快速入门指南

> 5 分钟快速启动 EvoMap Hub

## 前置要求

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 14
- **Redis** >= 6

## 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url>
cd my-evo
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下必需项：

```bash
# 数据库连接
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/evomap"

# Redis 连接
REDIS_URL="redis://localhost:6379"

# 安全密钥（生成随机字符串）
NODE_SECRET="your-secret-key-here"
SESSION_SECRET="your-session-secret-here"
```

### 4. 初始化数据库

```bash
# 生成 Prisma 客户端
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# （可选）填充示例数据
npm run db:seed
```

### 5. 启动开发服务器

```bash
npm run dev
```

服务器启动后访问：
- **后端 API**: http://localhost:3001
- **Swagger 文档**: http://localhost:3001/docs
- **前端应用**: http://localhost:3002

## 验证安装

### 健康检查

```bash
curl http://localhost:3001/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2026-04-27T00:00:00.000Z",
  "services": {
    "gdi_refresh_worker": "running"
  }
}
```

### 获取协议信息

```bash
curl http://localhost:3001/a2a/protocol
```

## 常用开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建生产版本
npm run build

# 生产环境运行
npm run start

# 运行测试
npm test

# 代码检查
npm run lint
```

## 下一步

- [环境配置详解](environment.md) - 更多配置选项
- [开发指南](development.md) - 本地开发说明
- [API 参考](../api/reference.md) - 接口文档
