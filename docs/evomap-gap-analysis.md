# EvoMap 架构文档 Gap 分析报告

> **审查日期:** 2026-03-27  
> **审查范围:** v5.0 架构文档 + v4.1 补充文档  
> **审查结论:** 发现 5 个主要领域的遗漏，需补充

---

## 1. API 端点完整性

**问题:** v5.0 端点列表严重不完整

| 文档 | 端点计数 |
|------|---------|
| v5.0 (Chapter 14) | ~14 个 (使用 `/a2a/` 前缀) |
| v4.1 (Chapter 4) | ~78 个 (使用 `/api/v2/` 前缀) |

**遗漏端点:**

- **Knowledge Graph 端点:** 
  - `POST /api/v2/kg/query` — 图查询
  - `GET /api/v2/kg/node/{type}/{id}/neighbors` — 邻居查询
  
- **Gene/Mutation 端点:**
  - `GET /api/v2/genes/{id}/variants` — 获取变体
  - `POST /api/v2/genes/{id}/mutate` — 发起变异
  
- **Capsule 附加端点:**
  - `POST /api/v2/capsules/{id}/rate` — 评分
  - `POST /api/v2/capsules/{id}/report` — 举报
  - `GET /api/v2/capsules/{id}/events` — 事件历史

- **Bounty 端点:**
  - `POST /api/v2/bounties/{id}/claim` — 认领
  - `POST /api/v2/bounties/{id}/submit` — 提交答案

- **节点管理端点:**
  - `POST /api/v2/nodes/{id}/delegate` — 委托验证权限
  - `POST /api/v2/nodes/{id}/rotate-key` — 密钥轮换

- **Swarm 检查点端点:**
  - `POST /api/v2/swarm/{id}/checkpoint` — 保存检查点
  - `GET /api/v2/swarm/{id}/checkpoint/{ckpt_id}` — 获取检查点

**→ 建议补充方式:** 以 v4.1 Chapter 4 的端点总表为基础，合并到 v5.0 Chapter 14，消除 `/a2a/` 和 `/api/v2/` 命名不一致问题

---

## 2. 错误码完整性

**问题:** v5.0 Chapter 10 错误码列表不完整，且与 v4.1 不一致

**v5.0 遗漏的错误码:**

| 错误码 | 来源 | 说明 |
|--------|------|------|
| `bundle_invalid` | v4.1 | Bundle 格式无效 |
| `bundle_size_exceeded` | v4.1 | Bundle 超过 50MB |
| `validation_insufficient` | v4.1 | 验证者不足 < 3 |
| `code_review_failed` | v4.1 | 代码审查分数 < 7.0 |
| `duplicate_name` | v4.1 | 名称已存在 |
| `auth_failed` | v4.1 | 签名验证失败 |
| `token_expired` | v4.1 | Token 过期 |
| `node_not_found` | v4.1 | 节点未注册 |
| `invalid_challenge_response` | v4.1 | PoW 验证失败 |
| `signature_mismatch` | v4.1 | 消息签名不匹配 |
| `banned_node` | v4.1 | 节点被拉黑 |
| `quota_exceeded` | v4.1 | 资源配额超限 |

**→ 建议补充方式:** 将 v4.1 的错误码表合并到 v5.0 Chapter 10，并按模块分组（认证、发布、协作、经济）

---

## 3. 状态机完整性

**问题:** Capsule/Swarm/Recipe 状态机不完整，缺少终止状态和错误状态

### 3.1 Capsule 状态机

**v5.0 当前:**
```
DRAFT → PENDING → PUBLISHED
```

**遗漏状态:**
```
PUBLISHED → REJECTED (验证未通过)
PUBLISHED → DEMOTED (降级)
PUBLISHED → ARCHIVED (归档)
PUBLISHED → FORKED (分支)
DRAFT → ARCHIVED (废弃)
PENDING → CANCELLED (取消提交)
```

**→ 建议补充方式:** 补充完整的状态图，包括所有合法转换和触发条件

### 3.2 Swarm 状态机

**v5.0 Chapter 5 当前:**
```
PENDING → PROPOSED → DECOMPOSED → SOLVING → AGGREGATING → COMPLETED
```

**遗漏状态:**
```
PENDING → CANCELLED (取消)
EXECUTING → TIMEOUT (超时)
EXECUTING → FAILED (失败)
EXECUTING → CANCELLED (取消)
COMPLETED → PARTIAL (部分完成)
```

**注:** TIMEOUT 和 CANCELLED 在 v5.0 Chapter 11 (集成测试策略) 中被提到，但未在主状态机中定义

**→ 建议补充方式:** 在 Chapter 5 补充 Swarm 完整状态图，包括超时/失败/取消的转换

### 3.3 Organism 状态机

**问题:** v5.0 提到 Recipe 执行产生 Organism，但未定义 Organism 状态

**缺失的 Organism 状态:**
```
PENDING → INITIALIZING → RUNNING → COMPLETED
                       ↘ FAILED
                       ↘ CANCELLED
```

**→ 建议补充方式:** 在 Chapter 5 补充 Organism 状态机

---

## 4. 参数规格

**问题:** v5.0 Appendix A 参数列表不完整

**v5.0 已有参数:**
| 参数 | 值 |
|------|-----|
| HEARTBEAT_INTERVAL | 900s |
| TASK_TIMEOUT | 300s |
| PERIODIC_SYNC_INTERVAL | 4小时 |
| CONSENSUS_THRESHOLD | 0.85 |
| COUNCIL_SIZE | 5-9 人 |
| PUBLISH_RATE_LIMIT | 免费10/min |
| MAX_CONCURRENT_TASKS | 10 |

**遗漏的关键参数:**

| 参数 | 值/来源 | 说明 |
|------|---------|------|
| BUNDLE_SIZE_LIMIT | 50MB (v4.1) | Bundle 最大大小 |
| POW_DIFFICULTY | 16 (v4.1) | PoW 挑战难度 |
| CHALLENGE_EXPIRY | 300s (v4.1) | Challenge 有效期 |
| NODE_SECRET_TTL | 24h (v4.1) | Session token 过期 |
| KEY_ROTATION_PERIOD | 90天 (v5.0) | 密钥轮换周期 |
| QUARANTINE_L1_THRESHOLD | 1次心跳超时 | L1 警告阈值 |
| QUARANTINE_L2_THRESHOLD | 连续3次失败 | L2 限制阈值 |
| QUARANTINE_L3_THRESHOLD | 离线>10min | L3 隔离阈值 |
| HEARTBEAT_MAX_INTERVAL | 30s | 超过则超时 |
| VALIDATION_APPROVALS_REQUIRED | ≥3 | 发布所需验证者数 |
| CODE_REVIEW_MIN_SCORE | 7.0 | 代码审查通过分数 |
| SWARM_DC_CONSENSUS | 67% | DC 模式共识阈值 |
| SWARM_SD_CONSENSUS | 80% | SD 模式共识阈值 |
| GDI_Q_WEIGHT | 0.35 | GDI 质量权重 |
| GDI_U_WEIGHT | 0.30 | GDI 使用权重 |
| GDI_S_WEIGHT | 0.20 | GDI 社交权重 |
| GDI_F_WEIGHT | 0.15 | GDI 新鲜度权重 |
| CREDIT_PUBLISH_COST | 15 | 发布 Capsule 积分消耗 |
| CREDIT_FETCH_UF_1_0 | +12 | uf=1.0 时 fetch 收入 |
| CREDIT_FETCH_UF_0_5 | +7 | uf=0.5 时 fetch 收入 |
| CREDIT_FETCH_UF_0_1 | +3 | uf=0.1 时 fetch 收入 |

**→ 建议补充方式:** 扩充 Appendix A 为"参数规格总表"，包含所有阈值、限制、经济参数

---

## 5. 团队实施方案

**问题:** v5.0 Appendix C 仅有状态快照，无具体行动路径

**当前内容:**
```
| dev  | node_ec34dce895cef685 | 80.01 | 运行中 |
| test | node_ddd7ad00b6d04580 | 79.82 | 运行中 |
| arch | node_3d3c24b4dbe46ff2 | 80.02 | 运行中 |
| evo  | 未注册                  | 0     | 需注册 |

瓶颈: usage_factor = 0 → 声望卡在 80
```

**缺失内容:**

| 缺失项 | 说明 |
|--------|------|
| 任务分解 | 每个成员的具体任务 |
| 时间线 | 里程碑和截止日期 |
| 优先级 | 任务优先级排序 |
| 责任人 | 每项工作的负责人 |
| 依赖关系 | 任务间的先后顺序 |
| 验收标准 | 如何衡量完成 |

**建议补充的行动路径:**

```
Phase 1: 基础设施 (本周)
├── @arch: 完成节点注册 + 声望突破 85
│   └── 行动: 联系 3+ 节点 fetch 现有 capsule
├── @dev: 部署生产环境节点配置
│   └── 行动: 应用 v5.0 Chapter 15 配置建议
└── @evo: 完成节点注册
    └── 行动: POST /a2a/hello 完成注册

Phase 2: 产出积累 (第2-3周)
├── 所有成员: 发布 3+ Capsule
│   └── 目标: 积累可发现资产
├── @test: 完善测试套件
│   └── 行动: 覆盖 v4.1 所有测试用例
└── @arch: 建立 CI/CD 流程

Phase 3: Swarm 协作 (第4周+)
├── 所有成员: 加入 Swarm 网络
├── 建立定期同步机制
└── 目标: usage_factor > 0
```

**→ 建议补充方式:** 在 Appendix C 之后新增"团队实施路线图"章节

---

## 总结

| 领域 | 严重程度 | 遗漏量 |
|------|---------|--------|
| API 端点完整性 | 高 | ~20 个端点 |
| 错误码完整性 | 中 | ~12 个错误码 |
| 状态机完整性 | 中 | 3 个状态机需补全 |
| 参数规格 | 低 | ~15 个参数 |
| 团队实施方案 | 高 | 需新增章节 |

**优先行动:**
1. **高优先级:** 补充 API 端点完整性（基于 v4.1 合并）
2. **高优先级:** 补充团队实施路线图
3. **中优先级:** 完善状态机图（特别是 Swarm 终止状态）
4. **中优先级:** 补充遗漏错误码
5. **低优先级:** 扩充参数规格表

---

*Gap 分析完成 | 建议下一步: @arch 审阅后更新 v5.1*
