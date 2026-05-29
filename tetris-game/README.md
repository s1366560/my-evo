# 🎮 Tetris Game

基于 React + Vite 前端和 Express + WebSocket 后端的俄罗斯方块游戏，支持 Docker 容器化部署和 Drone CI/CD 流水线。

## 功能特性

- ✅ 10×20 游戏网格
- ✅ 7 种经典方块 (I/O/T/S/Z/J/L)
- ✅ 影子方块预览
- ✅ 下一个方块预览
- ✅ 等级系统（每10行提升一级）
- ✅ 分数系统
- ✅ 暂停功能 (P键)
- ✅ 硬降/软降控制
- ✅ WebSocket 多人对战支持
- ✅ 排行榜系统

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | React 18, TypeScript, Vite |
| 后端 | Express, WebSocket (ws) |
| 容器 | Docker, Docker Compose |
| CI/CD | Drone |

## 快速开始

### 本地开发

```bash
# 前端
cd frontend
npm install
npm run dev

# 后端 (新终端)
cd backend
npm install
npm run dev
```

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## API 接口

### HTTP API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/leaderboard` | GET | 获取排行榜 |
| `/api/score` | POST | 提交分数 |

### WebSocket API

连接地址: `ws://localhost:3001/ws`

| 消息类型 | 方向 | 描述 |
|----------|------|------|
| `connected` | 服务端→客户端 | 连接成功，返回 playerId |
| `playerList` | 服务端→客户端 | 玩家列表更新 |
| `updateScore` | 客户端→服务端 | 更新分数 |
| `chat` | 双向 | 聊天消息 |
| `gameEvent` | 双向 | 游戏事件 |

## 部署到生产环境

1. 配置 Drone CI/CD (`.drone.yml`)
2. 设置环境变量:
   - `REGISTRY` - Docker 镜像仓库
   - `SSH_KEY` - 服务器 SSH 密钥
   - `STAGING_HOST` - 部署服务器地址

3. 推送到 main 分支触发流水线

## 控制说明

| 按键 | 功能 |
|------|------|
| ← → | 左右移动 |
| ↑ | 旋转 |
| ↓ | 加速下落 |
| 空格 | 硬降 (直接落到底) |
| P | 暂停/继续 |

## 项目结构

```
tetris-game/
├── frontend/           # 前端项目
│   ├── src/
│   │   ├── App.tsx     # 主游戏组件
│   │   ├── tetris.ts   # 游戏核心逻辑
│   │   └── ...
│   ├── Dockerfile
│   └── nginx.conf
├── backend/            # 后端项目
│   ├── src/
│   │   └── index.ts    # Express + WebSocket 服务器
│   └── Dockerfile
├── docker-compose.yml
└── .drone.yml          # CI/CD 配置
```

## License

MIT
