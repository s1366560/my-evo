# 子任务: 扫描所有 API 路由并生成清单

## 任务 ID
`subtask-scan-routes`

## 优先级
`high`

## 状态
`pending`

## 执行步骤

### 1. 扫描所有 routes.ts 文件
```bash
find /workspace/my-evo/src -name "routes.ts" -o -name "*routes*.ts"
```

### 2. 对每个路由文件提取:
- 模块名称 (从目录名推断)
- HTTP 方法 (GET/POST/PUT/DELETE)
- 路由路径
- 参数定义 (path params, query params, body schema)
- 认证要求

### 3. 输出格式
创建 `/workspace/my-evo/tasks/output/api-inventory.json`:

```json
{
  "generated_at": "2026-04-27T18:06:00Z",
  "total_routes": 0,
  "modules": {
    "module_name": {
      "description": "模块描述",
      "routes": [
        {
          "method": "GET|POST|PUT|DELETE",
          "path": "/api/v1/...",
          "handler": "functionName",
          "params": {
            "path": ["param1"],
            "query": ["param2"],
            "body": ["param3"]
          },
          "auth_required": true|false,
          "description": "路由功能描述"
        }
      ]
    }
  }
}
```

### 4. 需要扫描的核心模块
- `src/a2a/` - Agent A2A 通信协议
- `src/gepx/` - GEP-X 协议
- `src/bounty/` - 赏金任务
- `src/reputation/` - 信誉系统
- `src/recipe/` - 配方管理
- `src/skill_store/` - 技能商店
- `src/marketplace/` - 市场
- `src/subscription/` - 订阅
- `src/circle/` - 圈子

## 交付物
- `/workspace/my-evo/tasks/output/api-inventory.json` - 完整 API 清单
- 控制台输出汇总统计

## 完成标准
- 覆盖所有 src/*/routes.ts 文件
- JSON 格式正确，可被后续任务读取
- 每个路由包含完整元数据
