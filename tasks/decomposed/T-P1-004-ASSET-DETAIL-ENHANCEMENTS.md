# T-P1-004: 资产详情页增强 (Asset Detail Enhancements)

**状态**: 待分派
**优先级**: HIGH (P1)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

增强现有资产详情页，添加评价、版本历史、下载和更多交互功能。

## 详细需求

### 1. 评价系统
- 位置: `frontend/src/components/AssetReviews/`
- 功能:
  - 评分组件 (1-5 星)
  - 评价列表
  - 评价表单
  - 评价统计

### 2. 版本历史
- 位置: 资产详情页新增标签
- 功能:
  - 版本列表
  - 版本对比
  - 回滚功能 (作者)

### 3. 下载功能
- 功能:
  - 直接下载
  - 复制代码
  - 导出选项

### 4. 相关资产
- 功能:
  - 相似资产推荐
  - 同一作者资产
  - 依赖资产

### 5. 分享功能
- 功能:
  - 复制链接
  - 社交分享
  - 嵌入代码

## 依赖 API

- `GET /api/assets/:id/reviews` - 获取评价
- `POST /api/assets/:id/reviews` - 提交评价
- `GET /api/assets/:id/versions` - 获取版本
- `GET /api/assets/:id/download` - 下载资产
- `GET /api/assets/:id/similar` - 相似资产

## 验收标准

- [ ] 评价功能完整
- [ ] 版本历史可用
- [ ] 下载功能正常
- [ ] 相关推荐准确

## 预计工时

Medium (4-6 小时)
