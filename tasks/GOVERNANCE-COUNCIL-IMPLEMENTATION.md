# 子任务：治理功能完善（Council/提案系统）

**项目路径**: /workspace/my-evo
**状态**: 待执行
**优先级**: P2

## 任务描述

完善治理相关的功能和页面：

### 主要工作

1. **Council 页面** (`frontend/src/app/council/page.js`)
   - 活跃提案列表
   - 提案状态和详情
   - 投票入口

2. **提案创建**
   - 提案表单
   - 类别选择
   - 押金设置

3. **投票功能**
   - 投票权重计算
   - 投票结果展示

### 后端 API
- `GET /a2a/council/proposals` - 提案列表
- `POST /a2a/council/proposals` - 创建提案
- `POST /a2a/council/proposals/:id/vote` - 投票

### 成功标准
- 可以浏览和创建提案
- 投票功能可用
- 提案状态正确更新

### 验收检查点
- [ ] Council 页面展示提案
- [ ] 提案创建可用
- [ ] 投票功能正常