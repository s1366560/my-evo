# T-P1-001: 配方编辑器 (Recipe Composer)

**状态**: 待分派
**优先级**: HIGH (P1)
**Worker 类型**: frontend-dev
**创建时间**: 2026-04-27

---

## 任务描述

实现可视化配方编辑器，支持拖拽式 Gene/Capsule 组合和工作流编排。

## 详细需求

### 1. 配方编辑器页面
- 位置: `frontend/src/app/recipe/composer/page.tsx`
- 功能:
  - 画布区域
  - 节点面板
  - 属性编辑器
  - 保存/发布

### 2. 工作流画布 (Workflow Canvas)
- 位置: `frontend/src/components/WorkflowCanvas/`
- 组件:
  - `Canvas.tsx` - 画布容器
  - `Node.tsx` - 节点组件
  - `Edge.tsx` - 连接线
  - `MiniMap.tsx` - 小地图
  - `Controls.tsx` - 控制面板

### 3. 节点类型
- `GeneNode.tsx` - Gene 节点
- `CapsuleNode.tsx` - Capsule 节点
- `InputNode.tsx` - 输入节点
- `OutputNode.tsx` - 输出节点

### 4. 属性编辑器
- 位置: `frontend/src/components/PropertyPanel/`
- 功能:
  - 节点参数配置
  - 连接映射
  - 条件设置

## 依赖 API

- `GET /api/recipe/:id` - 获取配方
- `POST /api/recipe` - 创建配方
- `PUT /api/recipe/:id` - 更新配方
- `GET /api/assets?type=GENE` - 获取可用 Gene
- `GET /api/assets?type=CAPSULE` - 获取可用 Capsule

## 验收标准

- [ ] 拖拽添加节点
- [ ] 节点连线
- [ ] 属性配置
- [ ] 配方保存
- [ ] 预览执行

## 技术要求

- 使用 React Flow 或类似库
- 遵循项目组件风格

## 预计工时

Large (8-10 小时)
