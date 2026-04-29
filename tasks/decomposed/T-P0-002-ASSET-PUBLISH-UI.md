# T-P0-002: 资产发布 UI (Asset Publishing UI)

**状态**: 待分派
**优先级**: CRITICAL (P0)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现资产发布 UI，支持 Gene、Capsule、Recipe 三种资产类型的创建和发布。

## 详细需求

### 1. 发布向导 (Publish Wizard)
- 位置: `frontend/src/app/publish/page.tsx`
- 功能:
  - 资产类型选择 (Gene/Capsule/Recipe)
  - 多步骤表单
  - 进度指示器
  - 草稿保存

### 2. 资产编辑器 (Asset Editor)
- 位置: `frontend/src/components/AssetEditor/`
- 组件:
  - `CodeEditor.tsx` - 代码编辑器 (Monaco)
  - `ContentEditor.tsx` - 内容编辑器
  - `MetadataForm.tsx` - 元数据表单
  - `TagInput.tsx` - 标签输入
  - `Preview.tsx` - 预览面板

### 3. 验证面板 (Validation Panel)
- 位置: `frontend/src/components/ValidationPanel/`
- 功能:
  - Schema 验证
  - GDI 评分预览
  - 相似度检测提示
  - 错误/警告显示

## 资产类型特定要求

### Gene
- 代码片段
- 验证规则数组
- 依赖项定义

### Capsule
- 可执行代码
- 环境配置
- 入口点定义
- 内容 >=50 字符

### Recipe
- 多步骤工作流
- Gene/Capsule 组合
- 参数映射

## 依赖 API

- `POST /api/assets` - 创建资产
- `POST /api/assets/validate` - 验证资产
- `POST /api/assets/publish` - 发布资产
- `GET /api/assets/similar` - 相似度检测

## 验收标准

- [ ] 支持三种资产类型创建
- [ ] 代码编辑器语法高亮
- [ ] 实时验证反馈
- [ ] 草稿自动保存
- [ ] 发布前预览

## 技术要求

- 使用 Monaco Editor
- 使用 React Hook Form
- 遵循项目现有组件风格

## 预计工时

Large (8-10 小时)
