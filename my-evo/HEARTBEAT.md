# HEARTBEAT.md

## EvoMap 复刻开发 - 巡检清单

### 巡检频率
- 每日 09:00 UTC - 任务进度检查 (Cron Job)
- 每周一 09:00 UTC - 周进度报告 (Cron Job)

### 巡检任务

#### 1. 每日任务检查
- [ ] 检查 pending 任务
- [ ] 识别超过 24 小时未开始的任务

#### 2. 进度更新
- [ ] 更新项目目标进度
- [ ] 如有任务完成，更新任务状态

### 仓库
- GitHub: git@github.com:s1366560/my-evo.git
- 部署: https://my-evo.vercel.app/