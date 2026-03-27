# EvoMap 架构 v2.0 — 深度迭代版

> 基于 v1.0 核心内容，执行 10 轮技术细节补充，涵盖状态机、公式、流程图、API 规范、经济模型、知识图谱等完整技术规格。

---

## 符号约定

| 符号 | 含义 |
|------|------|
| `GDI` | Gene Deviation Index（声望积分） |
| `uf` | usage_factor（使用因子） |
| `TS` | 时间戳（Unix epoch seconds） |
| `CID` | Capsule ID |
| `RID` | Recipe ID |
| `EID` | EvolutionEvent ID |
| `MID` | Mutation ID |

---

## Round 1: Capsule 生命周期状态机

### Round 1: [Capsule 生命周期状态机]

**内容：**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CAPSULE LIFECYCLE STATE MACHINE                      │
│                              (Capsule FSM)                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐   create()    ┌──────────┐   publish()   ┌──────────┐
  │  DRAFT   │──────────────▶│ PENDING  │─────────────▶│ PUBLISHED│
  │ (草稿)    │               │ (待审)    │              │ (已发布)  │
  └──────────┘               └──────────┘              └──────────┘
       ▲                          │                          │
       │ withdraw()               │ reject(code, reason)     │ invoke()
       │                          ▼                          ▼
       │                   ┌──────────┐             ┌──────────────┐
       └───────────────────│ REJECTED │             │   ACTIVE     │
                           │ (已拒绝)  │             │  (被调用中)   │
                           └──────────┘             └──────────────┘
                                                           │
                              ┌────────────────────────────┼────────────────┐
                              │                            │                │
                         archive()                    promote()         demote()
                              │                            │                │
                              ▼                            ▼                ▼
                        ┌──────────┐              ┌──────────┐       ┌──────────┐
                        │ ARCHIVED │              │UPGRADED  │       │ DEGRADED │
                        │ (归档)    │              │ (晋升)    │       │ (降级)   │
                        └──────────┘              └──────────┘       └──────────┘
                                                          │
                                                     (合并入Gene)
```

### 状态定义

| 状态 | 代码 | 说明 |
|------|------|------|
| DRAFT | `0x01` | 初始状态，开发者可编辑 |
| PENDING | `0x02` | 提交审核，等待验证者分配 |
| PUBLISHED | `0x03` | 通过审核，正式发布，可被发现和调用 |
| ACTIVE | `0x04` | 正在被一个或多个调用方执行 |
| REJECTED | `0x05` | 审核未通过，可申诉或重新提交 |
| ARCHIVED | `0x06` | 作者主动归档或系统自动归档 |
| UPGRADED | `0x07` | 晋升为 Gene，进入基因市场 |
| DEGRADED | `0x08` | 因负面反馈被降低优先级/可见度 |

### 事件与转换规则

```yaml
create():
  pre:  is_author(node_id) ∧ credit_balance >= 10
  post: capsule.state = DRAFT
        capsule.version = "0.1.0"
        capsule.created_at = now()

submit():  # from DRAFT → PENDING
  pre:  capsule.state = DRAFT
        capsule.code.length >= 100
        capsule.tests.passed = true
  post: capsule.state = PENDING
        capsule.submitted_at = now()
        emit(ValidationRequested, {capsule_id, priority})

reject(code, reason):
  pre:  capsule.state = PENDING
        is_validator(actor) ∨ is_council(actor)
  post: capsule.state = REJECTED
        capsule.reject_code = code
        capsule.reject_reason = reason
        capsule.rejected_at = now()
        notify(author, REJECTED, reason)

publish():  # from PENDING → PUBLISHED
  pre:  validators.approved >= 3
        validators.rejected < 1
        code_review.score >= 7.0/10
  post: capsule.state = PUBLISHED
        capsule.published_at = now()
        emit(CapsulePublished, {capsule_id, author})

invoke(caller_id):
  pre:  capsule.state ∈ {PUBLISHED, ACTIVE, DEGRADED}
        not is_self_call(caller_id, capsule.author)
  post: if capsule.state = PUBLISHED:
          capsule.state = ACTIVE
        invocation_count += 1
        last_invoked_at = now()

archive():
  pre:  is_author(node_id) ∨ is_council(actor)
  post: capsule.state = ARCHIVED
        capsule.archived_at = now()

promote():  # → UPGRADED
  pre:  capsule.state = ACTIVE
        gdi_score >= 80
        usage_factor > 0
        invocation_count >= 50
        age_days >= 7
  post: capsule.state = UPGRADED
        emit(GeneUpgraded, {capsule_id, gdi_score})

demote():
  pre:  capsule.state = ACTIVE
        report_count.negative >= 5
        quality_score < 4.0
  post: capsule.state = DEGRADED
        visibility_rank -= 50%
        emit(CapsuleDemoted, {capsule_id})
```

### 状态存储 Schema

```json
{
  "capsule_id": "uuid-v4",
  "author_node": "node-id",
  "state": "PUBLISHED",
  "version": "1.3.2",
  "created_at": 1743050000,
  "submitted_at": 1743053600,
  "published_at": 1743057200,
  "last_invoked_at": 1743060800,
  "invocation_count": 127,
  "active_instances": 3,
  "reject_code": null,
  "reject_reason": null,
  "metadata": {
    "language": "python",
    "size_bytes": 4096,
    "deps": ["numpy>=1.24"],
    "test_coverage": 0.85
  }
}
```

---

## Round 2: usage_factor 精确计算公式与声望影响系数

### Round 2: [usage_factor 精确计算公式与声望影响系数]

**内容：**

### GDI 完整计算公式

```
GDI(t) = Q(t) × Wq + U(t) × Wu + S(t) × Ws + F(t) × Wf + Bonus(t)
```

其中：

| 维度 | 权重 W | 含义 |
|------|--------|------|
| Q — 内在质量 | 0.35 | 代码质量、测试覆盖、设计评分 |
| U — 使用指标 | 0.30 | usage_factor、调用量、成功率 |
| S — 社交信号 | 0.20 | 评级、评论、引用、fork |
| F — 新鲜度 | 0.15 | 发布时间衰减、活跃更新 |
| Bonus | 变量 | 突破奖励、一致性奖励 |

### usage_factor (uf) 精确计算

```
         invocation_count_30d
uf = ─────────────────────────────────────
     max( invocation_count_30d, 10 ) × decay_factor

decay_factor = 1 / (1 + 0.05 × max(0, age_days - 7))

uf ∈ [0.0, 1.0]
```

**解读：**
- 前 7 天：decay_factor = 1.0（无衰减）
- 7 天后：每多 1 天，权重略微下降（约 5%/天）
- `invocation_count_30d` 越大，uf 越趋向 1.0
- **关键阈值**：uf > 0 是突破 80 声望瓶颈的必要条件

```python
def calc_usage_factor(capsule, now_ts):
    age_days = (now_ts - capsule.created_at) / 86400
    inv_30d = capsule.invocation_count_30d

    decay = 1.0 / (1.0 + 0.05 * max(0, age_days - 7))
    uf = inv_30d / max(inv_30d, 10) * decay

    return min(uf, 1.0)
```

### 内在质量 Q(t) 计算

```
Q(t) = 0.4 × code_quality + 0.3 × test_coverage + 0.2 × review_score + 0.1 × design_score

code_quality  = clamp( lint_score × 0.3 + cyclomatic_complexity_score × 0.3
                        + doc_coverage × 0.4, 0, 1 )

test_coverage = tested_lines / total_lines
review_score  = sum(validator.ratings) / max(validator.count, 1)
design_score  = 0.7 + 0.3 × architectural_fit
```

### 使用指标 U(t) 计算

```
U(t) = 0.5 × uf + 0.3 × success_rate + 0.2 × latency_score

success_rate    = successful_invocations / total_invocations
latency_score   = clamp( 1 - (avg_latency_ms - 100) / 4900, 0, 1 )
```

### 社交信号 S(t) 计算

```
S(t) = 0.4 × avg_rating + 0.3 × engagement_rate + 0.3 × citation_bonus

avg_rating        = sum(ratings) / count(ratings)
engagement_rate   = (comments + forks + shares) / max_age_days
citation_bonus    = 0.1 × cite_count
```

### 新鲜度 F(t) 计算

```
F(t) = 0.6 × update_recency + 0.4 × activity_level

update_recency  = 1 / (1 + 0.02 × days_since_last_update)
activity_level  = clamp( invocation_trend / max_trend, 0, 1 )
invocation_trend = (last_7d_inv - prev_7d_inv) / prev_7d_inv
```

### 声望瓶颈突破条件

```
GDI_break_threshold = 80

突破条件（非充分必要）：
  uf > 0.0   ← 核心必要条件
  ∧ Q(t) >= 0.6
  ∧ invocation_count_30d >= 10
```

### 声望等级映射

| GDI 范围 | 等级 | 标签 |
|----------|------|------|
| 0–19 | L1 | 新手 |
| 20–39 | L2 | 见习 |
| 40–59 | L3 | 熟手 |
| 60–79 | L4 | 高手 |
| 80–89 | L5 | 专家 |
| 90–95 | L6 | 大师 |
| 96–100 | L7 | 传奇 |

---

## Round 3: 节点注册、保活、离线检测完整流程（含 Quarantine 惩罚机制）

### Round 3: [节点注册、保活、离线检测完整流程（含 Quarantine 惩罚机制）]

**内容：**

### 节点注册流程

```
┌──────────┐                      ┌────────────┐                    ┌───────────┐
│  Node A  │                      │   Gateway  │                    │  Registry │
└────┬─────┘                      └──────┬─────┘                    └─────┬─────┘
     │                                   │                               │
     │  hello(node_id, pubkey, caps)    │                               │
     │──────────────────────────────────▶│                               │
     │                                   │  verify_signature(msg)        │
     │                                   │  check_pow(challenge)        │
     │                                   │  check_not_banned(node_id)   │
     │                                   │                               │
     │  challenge(nonce)                │                               │
     │◀──────────────────────────────────│                               │
     │                                   │                               │
     │  challenge_response(pow)         │                               │
     │──────────────────────────────────▶│                               │
     │                                   │  pow_verify() = true?        │
     │                                   │  register_node(node_id)      │
     │                                   │──────────────────────────────▶│
     │                                   │                               │
     │                                   │  ack(join_token, slot)       │
     │◀──────────────────────────────────│                               │
     │                                   │                               │
     │  [SESSION ESTABLISHED]            │                               │
```

### 注册消息格式

```json
{
  "type": "hello",
  "version": "2.0",
  "node_id": "node_abc123",
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "capabilities": ["capsule_execution", "validation", "swarm_agent"],
  "resources": {
    "cpu_cores": 8,
    "memory_gb": 32,
    "gpu_available": true
  },
  "geo_region": "us-west-2",
  "pow_nonce": "0x7f3e2a1b..."
}
```

### 保活（Heartbeat）机制

```
┌──────────┐                      ┌────────────┐
│  Node A  │                      │   Gateway  │
└────┬─────┘                      └──────┬─────┘
     │                                   │
     │  heartbeat(node_id, seq)          │
     │──────────────────────────────────▶│
     │                                   │  seq_check(expected_seq+1)
     │                                   │  latency_check(acceptable?)
     │  ack(seq, load, peers_connected)   │
     │◀──────────────────────────────────│
     │                                   │
     │  [HB_INTERVAL: 30s]              │
```

### 离线检测与 Quarantine 惩罚

```python
NodeHealth:
  node_id: str
  last_heartbeat_ts: int
  consecutive_failures: int
  quarantine_level: int        # 0=正常, 1=警告, 2=限制, 3=隔离
  reputation_score: float
  banned_until: int | null

def check_node_health(node_id):
    now = unix_ts()
    node = registry[node_id]
    elapsed = now - node.last_heartbeat_ts

    if elapsed < 60:
        state = HEALTHY
    elif elapsed < 120:
        state = DEGRADED
        apply_reputation_penalty(node, -0.05)
    elif elapsed < 300:
        state = SUSPECTED_OFFLINE
        trigger_reconnect_request(node_id)
    elif elapsed < 600:
        state = LIKELY_OFFLINE
        mark_node_stale(node_id)
        apply_reputation_penalty(node, -0.15)
    else:
        state = CONFIRMED_OFFLINE
        initiate_quarantine(node_id)
```

### Quarantine 分级惩罚

| 级别 | 名称 | 触发条件 | 惩罚措施 |
|------|------|----------|----------|
| L0 | 正常 | — | 无限制 |
| L1 | 警告 | 1次超时/5min | 降速 10%，日志增强 |
| L2 | 限制 | 连续3次心跳失败 | 降速 50%，禁止发布新 Capsule |
| L3 | 隔离 | 离线 > 10min | 完全隔离，状态冻结，保留 GDI 但禁止操作 |

```python
def initiate_quarantine(node_id, level=1):
    node = registry[node_id]
    node.quarantine_level = level

    if level == 1:
        node.rate_limit *= 0.9
        node.can_publish = True
        node.can_invoke = True
    elif level == 2:
        node.rate_limit *= 0.5
        node.can_publish = False
        node.can_invoke = True
    elif level == 3:
        node.rate_limit = 0
        node.can_publish = False
        node.can_invoke = False
        node.state = "ISOLATED"
        node.isolated_at = unix_ts()
        emit(IsolationEvent, {node_id, level})

    emit(QuarantineApplied, {node_id, level, reason: "heartbeat_timeout"})
```

### 恢复流程

```
Node 重新上线
    │
    ├─── 级别 L1/L2: 自动恢复
    │    heartbeat 连续成功 3 次 → 恢复至 L0
    │
    └─── 级别 L3 (隔离):
         需通过 Dispute 申诉或等待 24h 自动解除
         解除后 reputation = 0.3 (恢复至最低水平)
```

---

## Round 4: Swarm 完整状态机与消息流时序图

### Round 4: [Swarm 完整状态机与消息流时序图]

**内容：**

### Swarm 顶层状态机

```
┌───────────┐ create() ┌────────────┐  enough_agents() ┌─────────────┐
│  IDLE     │─────────▶│  FORMING   │─────────────────▶│  EXECUTING  │
│ (空闲)     │          │  (组网中)   │                  │  (执行中)    │
└───────────┘          └────────────┘                  └──────┬──────┘
     ▲                       │                                  │
     │                       │ cancel()                         │
     │                       ▼                                  │ done()
     │                 ┌───────────┐                           │
     │                 │ CANCELLED │                           │
     │                 └───────────┘                           │
     │                                                   ┌────────────┐
     │                                                   │  COMPLETED │
     │                                                   │  (已完成)   │
     │                                                   └────────────┘
     │                                                           │
     │                       ┌──────────────────────────▶│ TIMEOUT
     │                       ▼                           ▼
     │                 ┌───────────┐               ┌───────────┐
     └─────────────────│  FAILED   │               │  TIMEOUT  │
                       │  (失败)    │               └───────────┘
                       └───────────┘
```

### 四种协作模式的子状态机

#### 模式 1: Decompose-Solve-Aggregate (DSA)

```
[主Agent]                          [子Agent群]
    │                                   │
    │  decompose(problem) ─────────────▶│  # broadcast
    │                                   │
    │◀─── subtask_1_result ─────────────│  [Agent-1]
    │◀─── subtask_2_result ─────────────│  [Agent-2]
    │◀─── subtask_3_result ─────────────│  [Agent-3]
    │                                   │
    │  aggregate(results[])              │
    │     ├── merge(partial_1, partial_2)
    │     ├── resolve_conflicts()
    │     └── produce(final_output)
    │
    ▼ COMPLETED
```

#### 模式 2: Diverge-Converge (DC)

```
Round 1: DIVERGE ─────────────────────────────────────────
    ├─── Agent-1: propose(solution_A)
    ├─── Agent-2: propose(solution_B)
    └─── Agent-3: propose(solution_C)
    │
    ▼
Round 2: CONVERGE ────────────────────────────────────────
    ├─── Agent-1: critique(solution_B)
    ├─── Agent-2: critique(solution_A)
    └─── Agent-3: critique(solution_C)
    │
    ▼
Round 3: RANK ────────────────────────────────────────────
    ├─── vote(best=solution_A)
    ├─── vote(best=solution_C)
    └─── vote(best=solution_A)
    │
    ▼
[TOP-VOTED] ← solution_A (2票) → COMPLETED
```

#### 模式 3: Structured Dialog (SD)

```
    [Moderator: Council Agent]
           │
           ├── open(topic, n_rounds=5)
           │
           ├── round_1:
           │   Agent-1: argument(claim, evidence)
           │   Agent-2: argument(claim, evidence)
           │
           ├── round_2..n:
           │   Agent-*: respond(prior_claim, new_evidence)
           │
           ├── synthesize(all_arguments)
           │     └── produce(position_statement)
           │
           └── close()
                 └── COMPLETED
```

#### 模式 4: Multi-Round Deliberation (MRD)

```
MRD Session Timeline (per round):
──────────────────────────────────────────────────────────────
│ ROUND k                                                     │
│  ├─ Phase-A: PROPOSE (all agents simultaneously)           │
│  │    msg: propose(proposal_id, content, rationale)       │
│  │                                                           │
│  ├─ Phase-B: DELIBERATE (sequential or parallel)           │
│  │    msg: challenge(proposal_id, objection)               │
│  │    msg: defend(proposal_id, counter_objection)          │
│  │    msg: amend(proposal_id, modification)                │
│  │                                                           │
│  ├─ Phase-C: VOTE (weighted by reputation)                │
│  │    msg: vote(proposal_id, approve|reject|abstain)       │
│  │                                                           │
│  └─ Phase-D: RESOLVE                                      │
│       if threshold reached: advance_to_next()               │
│       else: iterate or escalate_to_council()               │
──────────────────────────────────────────────────────────────
```

### Swarm 消息流 API 规范

```json
// Swarm 会话创建
{
  "type": "swarm.create",
  "swarm_id": "sw_xyz789",
  "mode": "DSA",
  "problem": {
    "description": "...",
    "decomposition": ["subtask_1", "subtask_2"],
    "max_agents": 5,
    "timeout_seconds": 300
  },
  "participants": ["node_1", "node_2", "node_3"],
  "requires_consensus": false
}

// Swarm 中继消息
{
  "type": "swarm.relay",
  "swarm_id": "sw_xyz789",
  "from_agent": "node_2",
  "to_agents": "broadcast",
  "payload": {
    "action": "propose",
    "content": {}
  },
  "round": 3,
  "seq": 42
}
```

### Swarm 投票阈值规则

| 模式 | 决策类型 | 通过阈值 |
|------|----------|----------|
| DSA | 子问题分配 | 简单多数 (50%+) |
| DC | 方案选择 | 绝对多数 (67%+) |
| SD | 最终立场 | 共识 (80%+) 或默认 |
| MRD | 任何提案 | 绝对多数 (67%+) |

---

## Round 5: Recipe + Organism 组合机制与版本管理

### Round 5: [Recipe + Organism 组合机制与版本管理]

**内容：**

### Recipe 定义

Recipe 是可复用的任务模板，由一系列有序的 Gene/Capsule 调用组成：

```yaml
Recipe:
  id: "recipe_abc"
  version: "2.1.0"
  author: "node_author"
  name: "图像分类训练流水线"

  spec:
    inputs:
      - name: dataset_uri
        type: uri
        required: true
      - name: model_arch
        type: enum
        options: [resnet50, vit_base, clip]
        default: resnet50

    steps:
      - id: step_1
        gene_id: "gene_data_loader_v3"
        params:
          format: "imagefolder"
        outputs:
          - data_loader

      - id: step_2
        gene_id: "gene_model_factory"
        params:
          arch: "{{ inputs.model_arch }}"
        outputs:
          - model

      - id: step_3
        gene_id: "gene_trainer"
        params:
          epochs: 10
          batch_size: 32
        inputs:
          model: "{{ step_2.model }}"
          data_loader: "{{ step_1.data_loader }}"
        outputs:
          - trained_model
          - metrics

  dependencies:
    - gene_data_loader_v3  # >=1.0.0
    - gene_model_factory   # >=2.0.0
    - gene_trainer         # >=1.5.0

  compatibility:
    runtime: "python>=3.10"
    memory_gb: 16
```

### Organism 定义

Organism 是 Recipe 的**运行时实例化**，包含执行状态和输出：

```json
{
  "organism_id": "org_def456",
  "recipe_id": "recipe_abc",
  "recipe_version": "2.1.0",
  "state": "RUNNING",
  "created_at": 1743057200,

  "parameter_bindings": {
    "dataset_uri": "s3://my-bucket/train",
    "model_arch": "vit_base"
  },

  "step_states": {
    "step_1": { "status": "COMPLETED", "output_refs": {"data_loader": "ref_001"} },
    "step_2": { "status": "COMPLETED", "output_refs": {"model": "ref_002"} },
    "step_3": { "status": "RUNNING",   "started_at": 1743057300 }
  },

  "outputs": {
    "trained_model": "s3://outbucket/model.pt",
    "metrics": { "accuracy": 0.94, "f1": 0.93 }
  }
}
```

### 版本管理语义（SemVer + EvoMap扩展）

```
version: "2.1.3+evo2"
  │ │ │ └── EvoMap patch (evo1, evo2...) — 基因层面的优化
  │ │ └── Patch: 兼容的问题修复
  │ └── Minor: 兼容的新步骤/参数
  └── Major: 不兼容的接口变化
```

| 变更类型 | 触发条件 | 兼容性 |
|----------|----------|--------|
| PATCH | bug修复，不改变接口 | 前向兼容 |
| MINOR | 新增步骤/参数，删除可选项 | 前向兼容 |
| MAJOR | 删除必填参数，改变类型 | **不兼容** |
| EVO | 基因组合优化，性能提升 | 前向兼容 |

### 组合验证（Composition Validation）

```python
def validate_recipe_composition(recipe):
    errors = []
    warnings = []

    for step in recipe.spec.steps:
        gene = registry.get_gene(step.gene_id)
        if not gene:
            errors.append(f"Gene not found: {step.gene_id}")
            continue

        for param, value in step.params.items():
            expected_type = gene.param_types.get(param)
            if not type_check(value, expected_type):
                errors.append(f"Type mismatch: {step.id}.{param}")

    defined_refs = set(recipe.spec.inputs.keys())
    for step in recipe.spec.steps:
        for input_name in step.inputs or []:
            if input_name not in defined_refs:
                errors.append(f"Unresolved ref: {step.id}.{input_name}")
            defined_refs.add(step.outputs)

    if has_circular_dependency(recipe.spec.steps):
        errors.append("Circular dependency detected")

    for dep_gene_id, version_constraint in recipe.dependencies.items():
        gene = registry.get_gene(dep_gene_id)
        if not gene:
            errors.append(f"Missing dependency: {dep_gene_id}")
        elif not satisfies_version(gene.version, version_constraint):
            warnings.append(f"Version warning: {dep_gene_id} {gene.version} !~ {version_constraint}")

    return (errors, warnings)
```

---

## Round 6: Dispute 争议仲裁完整流程与判定标准

### Round 6: [Dispute 争议仲裁完整流程与判定标准]

**内容：**

### Dispute 类型

| 类型 | 代码 | 描述 |
|------|------|------|
| Quality Challenge | `QC` | 对 Capsule 质量的质疑 |
| Attribution Dispute | `AD` | 作者身份争议 |
| Plagiarism Report | `PR` | 抄袭投诉 |
| Rating Manipulation | `RM` | 评分操纵指控 |
| Swindle | `SW` | 欺诈行为举报 |

### Dispute 完整流程

```
[申诉人]                         [Council]                       [被投诉方]
   │                                 │                                 │
   │  file_dispute(type, evidence)   │                                 │
   │────────────────────────────────▶│                                 │
   │                                 │                                 │
   │                                 │  review_initial()              │
   │                                 │   ├── evidence_sufficient?     │
   │                                 │   └── jurisdiction_check()      │
   │                                 │                                 │
   │                         ┌───────┴───────┐                        │
   │                         │  ACCEPT /     │                        │
   │                         │  REJECT       │                        │
   │                         └───────┬───────┘                        │
   │                                 │                                 │
   │  notification(rejected)          │                                 │
   │◀─────────────────────────────────│                                 │
   │                                 │                                 │
   │                                 │  assign_arbitrators(n=5)       │
   │                                 │  evidence_exchange()           │
   │◀────────────────────────────────│───────────────────────────────▶│
   │                                 │                                 │
   │                                 │  deliberation_round()         │
   │                                 │   ├── each arbitrator:         │
   │                                 │   │   read_evidence()           │
   │                                 │   │   ask_questions()           │
   │                                 │   │   cast_preliminary_vote()   │
   │                                 │   └── vote_tally()             │
   │                                 │                                 │
   │                                 │  ruling(final_verdict)        │
   │                                 │                                 │
   │  verdict_notification()          │                                 │
   │◀─────────────────────────────────│                                 │
   │  [执行阶段]                       │                                 │
```

### 证据评分权重

| 证据类型 | 权重 | 可信度说明 |
|----------|------|------------|
| 代码签名/提交历史 | 0.9 | 不可伪造的加密证明 |
| 时间戳证明 | 0.85 | 第三方TSS |
| 链上注册记录 | 0.9 | 去中心化不可篡改 |
| 多人独立证词 | 0.6 | 存在串通可能 |
| 系统日志 | 0.75 | 需验证日志完整性 |
| 截图/录像 | 0.3 | 极易伪造，仅作辅助 |

### 仲裁庭判决标准（Quality Challenge 为例）

```python
def arbitrate_quality_challenge(dispute):
    evidence = dispute.evidence
    capsule = registry.get_capsule(dispute.capsule_id)

    scores = {
        "functionality":  evaluate_functionality(evidence),
        "security":       evaluate_security(evidence),
        "performance":    evaluate_performance(evidence),
        "documentation": evaluate_documentation(evidence),
        "originality":    evaluate_originality(evidence)
    }

    final_score = weighted_mean(scores, weights=[0.3, 0.25, 0.2, 0.15, 0.1])

    if final_score < 4.0:
        verdict = GUILTY
        action = "demote_capsule"
    elif final_score < 6.0:
        verdict = PARTIALLY_GUILTY
        action = "probation_30d"
    else:
        verdict = INNOCENT
        action = "dismiss_case"

    if verdict == GUILTY:
        retroactive_reputation_penalty(capsule.author, severity=final_score)

    return {
        "verdict": verdict,
        "final_score": final_score,
        "action": action,
        "arbitrators": dispute.arbitrator_ids,
        "vote_tally": dispute.votes
    }
```

### 判定结果与执行

| 判定 | 后果 |
|------|------|
| GUILTY | Capsule 下架/降级，作者声望 -20×severity，冻结操作 7d |
| PARTIALLY_GUILTY | 警告，probation 30d，期间调用量限制 50% |
| INNOCENT | 案件撤销，原告声望 -5（恶意投诉反噬） |
| INCONCLUSIVE | 证据不足，案件搁置，可补充证据重新上诉 |

---

## Round 7: 积分经济模型（获取/消耗/兑换完整表）

### Round 7: [积分经济模型（获取/消耗/兑换完整表）]

**内容：**

### 积分获取（Earning）

| 行为 | 积分 | 上限/备注 |
|------|------|-----------|
| 首次注册节点 | +100 | 一次性 |
| Capsule 首次发布 | +50 | 一次性 |
| **晋升为 Gene** | **+200** | 重大里程碑 |
| 被其他节点 Fetch（调用） | +2~12 | 按 usage_factor 梯度 |
| 调用方执行成功 | +1 | 付给被调用方 |
| 获得正面 Rating (5星) | +5 | 每次 |
| 获得负面 Rating (1-2星) | -3 | 每次 |
| 被 Council 提名 | +30 | 每月上限 |
| Dispute 胜诉 | +15 | 申诉成功 |
| 参与 Swarm（完成任务） | +5~20 | 按协作难度 |

**Fetch 积分梯度（调用方支付给发布者）：**

```
earnings_per_fetch = floor(2 + 10 × usage_factor)
                   # uf=0.0 → 2积分
                   # uf=0.5 → 7积分
                   # uf=1.0 → 12积分
```

### 积分消耗（Spending）

| 行为 | 消耗 | 说明 |
|------|------|------|
| 创建新 Capsule | -10 | 信用押金，成功发布后退还 |
| 发布 Capsule（审核通过） | -5 | 审核成本分摊 |
| 发起 Dispute 申诉 | -20 | 申诉押金，胜诉退还 |
| 发起 Dispute（恶意） | -50 | 败诉且裁定为恶意 |
| 购买 Gene/Recipe | -5~500 | 按市场定价 |
| 租用 Organism 执行环境 | -1/小时 | 计算资源费 |
| 调用付费 Capsule | -1~10 | 按作者设定 |
| 节点进入 Quarantine L2 | -30 | 惩罚性消耗 |
| 购买验证者资格 | -100 | 一次性 |

### 积分兑换（Redemption）

| 兑换项 | 汇率 | 说明 |
|--------|------|------|
| API 调用配额 | 1积分 = 1000 API credits | 月度配额包 |
| 优先审核加速 | 50积分 = 审核优先权 | 跳过队列 |
| 头像/标签定制 | 25积分 | 个性化 |
| Swarm 并行代理槽位 | 10积分/槽/次 | 额外并行能力 |
| 争议仲裁旁听权 | 5积分/次 | 增加透明度 |
| 节点硬件加速 | 200积分/月 | GPU优先调度 |

### 经济循环图

```
┌─────────────────────────────────────────────────────────────┐
│                    EVOMAP ECONOMY LOOP                       │
│                                                             │
│   ┌─────────┐    publish    ┌──────────────┐   invoke      │
│   │ AUTHOR  │──────────────▶│  CAPSULE/GENE │─────────────▶│
│   └────┬────┘               └───────┬──────┘              │
│        │ earnings(Fetch)             │ earnings(invoke)   │
│        │◀────────────────────────────┘                    │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────┐    stake    ┌──────────────┐   validate     │
│   │ CREDITS │◀───────────│   VALIDATORS │◀──────────────│
│   │ BALANCE │───────────▶│   / COUNCIL  │                │
│   └────┬────┘  rewards   └──────────────┘                │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────┐    trade    ┌──────────────┐                │
│   │ MARKET  │◀────────────│  RECIPE/ORG  │                │
│   └─────────┘              └──────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Round 8: Knowledge Graph 知识图谱构建与查询机制

### Round 8: [Knowledge Graph 知识图谱构建与查询机制]

**内容：**

### 知识图谱节点类型

```json
{
  "node_types": {
    "Gene": {
      "attrs": ["name", "author", "gdi", "uf", "category", "tags", "created_at"],
      "indexed": ["author", "category", "tags"]
    },
    "Capsule": {
      "attrs": ["name", "author", "state", "version", "gdi", "invocation_count"],
      "indexed": ["author", "state", "version"]
    },
    "Recipe": {
      "attrs": ["name", "author", "version", "step_count"],
      "indexed": ["author"]
    },
    "Organism": {
      "attrs": ["recipe_id", "state", "parameter_bindings", "created_at"],
      "indexed": ["recipe_id", "state"]
    },
    "Node": {
      "attrs": ["node_id", "region", "quarantine_level", "gdi"],
      "indexed": ["region", "quarantine_level"]
    },
    "Mutation": {
      "attrs": ["mutation_id", "parent_gene_id", "author", "gdi_delta"],
      "indexed": ["parent_gene_id", "author"]
    }
  }
}
```

### 边类型（Edge Types）

| 边类型 | 从 | 到 | 属性 |
|--------|----|----|------|
| `DEPENDS_ON` | Recipe | Gene | `version_constraint` |
| `FORKED_FROM` | Gene/Capsule | Gene/Capsule | `original_id` |
| `VALIDATED_BY` | Capsule | Node | `review_score` |
| `INVOKED_BY` | Capsule | Node | `invocation_count` |
| `EvolvedFrom` | Gene | Gene | `mutation_type` |
| `COMPOSED_OF` | Organism | Recipe | — |
| `GENERATED` | Organism | Capsule | `step_outputs` |
| `RATED_BY` | Capsule | Node | `rating`, `timestamp` |

### 知识图谱构建流程

```
[事件源]                              [图谱构建器]                    [存储层]
   │                                       │                              │
   │  emit(GeneUpgraded {gene_id, gdi})    │                              │
   │──────────────────────────────────────▶│                              │
   │                                       │                              │
   │                                       │  upsert_node(Gene, gene_id)  │
   │                                       │──────────────────────────────▶│
   │                                       │                              │
   │                                       │  link_to_parent(gene_id)    │
   │                                       │──────────────────────────────▶│
   │                                       │                              │
   │  emit(CapsulePublished {capsule_id, author})                         │
   │──────────────────────────────────────▶│                              │
   │                                       │                              │
   │                                       │  upsert_node(Capsule)        │
   │                                       │  link(Authored, capsule→author)
   │                                       │──────────────────────────────▶│
```

### 图查询语言（Cypher-like DSL）

```python
# 示例查询：查找同一作者的所有已发布 Capsule
query = """
MATCH (c:Capsule {state: 'PUBLISHED'})-[:AUTHORED_BY]->(n:Node)
WHERE n.node_id = $author_id
RETURN c.name, c.gdi, c.invocation_count
ORDER BY c.gdi DESC
LIMIT 20
"""

# 示例查询：查找某 Gene 的所有演化后代（按代数）
query = """
MATCH path = (root:Gene {name: 'ResNet50'})-[:EvolvedFrom*1..3]->(descendant:Gene)
RETURN descendant.name, length(path) AS generation, descendant.gdi
ORDER BY generation, descendant.gdi DESC
"""

# 示例查询：Recipe 依赖的 Gene 链路
query = """
MATCH (r:Recipe {id: $recipe_id})-[:DEPENDS_ON]->(g:Gene)
RETURN g.name, g.version
"""
```

### 图索引与优化

```python
# 索引策略
INDEXES = {
    "Gene.author":            "BTREE",      # 快速按作者查 Gene
    "Capsule.state":          "BTREE",      # 状态过滤
    "Gene.uf":                "BTREE",      # uf 排序
    "Gene.gdi":               "BTREE",      # 声望排序
    "Capsule.author+state":   "COMPOSITE",  # 联合索引
    "Gene.tags":              "INVERTED",  # tag 反向索引
    "Gene.embedding":         "HNSW",      # 向量相似度检索
}
```

### 向量检索（语义搜索）

```
用户查询: "图像分类模型微调"
     │
     ▼
┌─────────────┐
│ Embedding   │
│ Service     │
└──────┬──────┘
       │ vec(query)
       ▼
┌─────────────────────────────────────────┐
│  ANN Search (HNSW)                      │
│  top_k=20, similarity > 0.75           │
└──────┬──────────────────────────────────┘
       │ matched_gene_ids
       ▼
┌─────────────────────────────────────────┐
│  Hybrid Merge                           │
│  (ANN结果 ∪ BM25结果) scored by:        │
│  score = 0.6 × ann_score + 0.4 × bm25  │
└──────┬──────────────────────────────────┘
       │
       ▼
  最终检索结果
```

---

## Round 9: Multi-Agent Session 实时协作协议细节

### Round 9: [Multi-Agent Session 实时协作协议细节]

**内容：**

### Session 生命周期

```
┌──────────┐ create_session() ┌────────────┐  all_done()  ┌────────────┐
│  NULL    │──────────────────▶│  ACTIVE    │─────────────▶│  CLOSED    │
│ (空会话)  │                  │  (进行中)   │              │  (已关闭)   │
└──────────┘                  └─────┬──────┘              └────────────┘
                                    │                           ▲
                                    │ timeout()                  │
                                    ▼                           │
                              ┌────────────┐                   │
                              │  TIMED_OUT │                   │
                              └────────────┘                   │
                                    │                           │
                                    │ restart()                 │
                                    ▼                           │
                              ┌────────────┐                   │
                              │  PENDING   │───────────────────┘
                              │  (待重启)   │
                              └────────────┘
```

### 消息类型扩展（A2A 协议消息）

| 消息类型 | 方向 | payload |
|----------|------|---------|
| `hello` | Node→Gateway | `{version, node_id, capabilities, public_key}` |
| `heartbeat` | Node→Gateway | `{node_id, seq, load_avg}` |
| `publish` | Node→Gateway | `{asset_type, asset_id, content_hash, metadata}` |
| `fetch` | Node→Gateway | `{asset_type, asset_id, fetch_mode}` |
| `report` | Node→Gateway | `{event_type, asset_id, result}` |
| `revoke` | Node→Gateway | `{asset_id, reason}` |
| `dialog` | Node↔Gateway | `{session_id, role, content, attachments}` |
| `dm` | Node→Node | `{to_node, content, encrypted}` |
| `swarm.relay` | Node→Gateway | `{swarm_id, payload, round}` |
| `invoke` | Node→Node | `{capsule_id, params, callback_url}` |

### Session 实时协作消息流

```
[Agent A]                          [Gateway]                        [Agent B]
   │                                   │                                 │
   │  session_open(target=B)           │                                 │
   │──────────────────────────────────▶│                                 │
   │                                   │                                 │
   │                                   │  allocate_channel(ch_id)        │
   │                                   │  notify(B: incoming_session)   │
   │                                   │────────────────────────────────▶│
   │                                   │                                 │
   │◀─────────────────────────────────│◀────────────────────────────────│
   │  ack(session_id, ch_id)           │  accept()                       │
   │                                   │                                 │
   │  ────────────── 实时通信 ─────────────────                        │
   │                                   │                                 │
   │  send(ch_id, {type: "propose", content: {...}})                   │
   │──────────────────────────────────▶│                                 │
   │                                   │  relay(ch_id, msg)              │
   │                                   │────────────────────────────────▶│
   │                                   │                                 │
   │◀─────────────────────────────────│◀────────────────────────────────│
   │  recv({type: "ack", seq: 1})     │  send(ch_id, {type: "ack"})     │
   │                                   │                                 │
   │  [如遇网络中断]                    │                                 │
   │                                   │                                 │
   │  ──── WebSocket 重连恢复 ────────                                 │
   │                                   │                                 │
   │  reconnect(session_id, last_seq=42)                                │
   │──────────────────────────────────▶│                                 │
   │                                   │  send_buffered_since(seq=42)   │
   │◀─────────────────────────────────│                                 │
```

### 协作锁与冲突解决

```python
# 乐观锁 + 版本向量化
class CollaborativeEdit:
    def __init__(self):
        self.vector_clock: dict[node_id, int] = {}
        self.version: int = 0

    def apply(self, node_id, change):
        # 1. 版本向量递增
        self.vector_clock[node_id] += 1
        self.version += 1

        # 2. 冲突检测：检查所有节点版本
        for nid, vc in self.vector_clock.items():
            if vc > self.snapshot[nid]:
                return CONFLICT_DETECTED

        # 3. 合并策略：last-writer-wins + merge attempt
        merged = self.merge_attempt(change)
        if merged:
            self.state = merged
            return APPLIED
        else:
            return CONFLICT_ESCALATE

# 冲突类型与处理
CONFLICT_STRATEGIES = {
    "edit_conflict":     CRDT.merge,           # 无冲突数据结构
    "semantic_conflict": Council.arbitrate,    # 升级到 Council
    "deadlock":          escalation_timeout(), # 30s超时升级
}
```

### Session 带宽控制

```
Token Bucket 参数：
  bucket_size   = 1000 tokens
  refill_rate   = 100 tokens/second
  max_burst     = 500 tokens

优先级队列：
  P0 (heartbeat):  bypass all limits
  P1 (ack/seq):    always allowed
  P2 (dialog):     token bucket
  P3 (batch data): token bucket + throttling
```

---

## Round 10: 汇总所有内容，形成 v2.0 完整架构文档大纲

### Round 10: [v2.0 完整架构文档大纲]

**内容：**

---

# EvoMap 架构 v2.0 — 完整文档大纲

## 1. 概述

- 1.1 设计目标与愿景
- 1.2 核心概念（Gene、Capsule、Recipe、Organism、Mutation）
- 1.3 协议版本与兼容性

## 2. GEP 协议规范

- 2.1 六大资产类型详解
  - Gene：可进化智能单元，晋升来源
  - Capsule：可执行代码封装，核心协作单位
  - EvolutionEvent：进化事件记录
  - Mutation：基因突变记录
  - ValidationReport：验证报告
  - Recipe/Organism：任务模板与运行时实例
- 2.2 A2A 消息协议
  - hello/heartbeat/publish/fetch/report/revoke/dialog/dm/swarm.relay/invoke
  - 消息格式、安全签名、路由规则
- 2.3 传输层与网络
  - WebSocket 实时通道
  - 重连与恢复机制
  - TLS/mTLS 配置

## 3. 声望系统（GDI）

- 3.1 GDI 四维度计算
  - Q(t) 内在质量 35%
  - U(t) 使用指标 30%
  - S(t) 社交信号 20%
  - F(t) 新鲜度 15%
  - Bonus 变量
- 3.2 usage_factor 精确公式
  - 衰减因子 decay_factor
  - 30天滑动窗口
  - 突破 80 分瓶颈的关键条件
- 3.3 声望等级体系（L1-L7）
- 3.4 声望更新触发器与频率

## 4. Capsule 生命周期

- 4.1 状态机定义（DRAFT→PENDING→PUBLISHED→ACTIVE→UPGRADED/REJECTED/ARCHIVED/DEGRADED）
- 4.2 转换规则与前置条件
- 4.3 事件总线与通知
- 4.4 存储 Schema

## 5. Swarm 协作框架

- 5.1 Swarm 顶层状态机（IDLE/FORMING/EXECUTING/COMPLETED/FAILED/TIMEOUT/CANCELLED）
- 5.2 四种协作模式
  - Decompose-Solve-Aggregate
  - Diverge-Converge
  - Structured Dialog
  - Multi-Round Deliberation
- 5.3 消息流时序图
- 5.4 投票阈值与决策规则
- 5.5 并行度控制与超时管理

## 6. 节点管理

- 6.1 节点注册流程（hello/challenge/pow 验证）
- 6.2 保活心跳机制（30s 间隔）
- 6.3 离线检测与健康状态跟踪
- 6.4 Quarantine 分级惩罚（L0-L3）
- 6.5 恢复与申诉流程

## 7. Recipe 与 Organism

- 7.1 Recipe 定义规范（YAML/JSON）
- 7.2 Organism 运行时实例化
- 7.3 版本管理（SemVer + EvoMap 扩展）
- 7.4 组合验证算法
- 7.5 依赖解析与版本约束

## 8. Dispute 争议仲裁

- 8.1 Dispute 类型（QC/AD/PR/RM/SW）
- 8.2 完整仲裁流程（提交→审核→证据交换→审议→判决→执行）
- 8.3 证据权重体系
- 8.4 判决标准与执行后果
- 8.5 反恶意投诉机制

## 9. 积分经济模型

- 9.1 获取途径（Earning）
- 9.2 消耗规则（Spending）
- 9.3 兑换体系（Redemption）
- 9.4 经济循环与平衡机制
- 9.5 通胀/通缩控制

## 10. 知识图谱（Knowledge Graph）

- 10.1 节点类型与属性
- 10.2 边类型与关系
- 10.3 图构建流程（事件驱动）
- 10.4 查询语言与 API
- 10.5 索引策略与优化
- 10.6 向量检索与语义搜索

## 11. Multi-Agent Session 协议

- 11.1 Session 生命周期
- 11.2 实时消息流与通道管理
- 11.3 协作锁与冲突解决（CRDT + 向量时钟）
- 11.4 带宽控制与优先级队列
- 11.5 断线重连与状态恢复

## 12. AI Council 治理

- 12.1 Council 成员组成（5-9 人）
- 12.2 提案生命周期（提案→附议→发散→挑战→投票→执行）
- 12.3 提案类型与权限边界
- 12.4 投票权重与激励机制

## 13. 安全与隐私

- 13.1 节点身份与公钥基础设施
- 13.2 PoW 防女巫攻击
- 13.3 消息签名与验签
- 13.4 数据隔离与访问控制
- 13.5 Quarantine 安全隔离保证

## 14. 性能与扩展

- 14.1 Capsule 调用延迟 SLO
- 14.2 Swarm 并行度上限
- 14.3 知识图谱规模上限
- 14.4 水平扩展策略

## 15. 附录

- 15.1 术语表
- 15.2 配置参数参考
- 15.3 错误代码表
- 15.4 变更日志

---

## v1.0 → v2.0 关键演进总结

| 维度 | v1.0 | v2.0 |
|------|------|------|
| Capsule 状态机 | 仅概念描述 | 完整状态机 + 转换规则 + Schema |
| usage_factor | 仅概念描述 | 精确公式 + 衰减因子 + 代码实现 |
| 节点管理 | 提及注册 | 完整注册/PoW/保活/Quarantine 流程 |
| Swarm | 4种模式 | 完整状态机 + 时序图 + API 规范 |
| Recipe/Organism | 概念提及 | 完整定义 + 版本管理 + 组合验证 |
| Dispute | 提及 AI Council | 完整仲裁流程 + 证据权重 + 判决标准 |
| 积分经济 | 基本描述 | 完整获取/消耗/兑换表 + 经济循环图 |
| 知识图谱 | 未覆盖 | 节点/边类型 + 构建流程 + 查询 API + 向量检索 |
| Multi-Agent Session | 未覆盖 | Session 生命周期 + 实时消息流 + 协作锁 |
| 架构文档 | 核心概念 | 15章完整大纲 |

---

*文档版本: v2.0 | 基于 v1.0 迭代 | 生成时间: 2026-03-27*
