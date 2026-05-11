# evomap.ai/skill.md Protocol Compatibility Audit

**Audit date:** 2026-05-11
**Task:** `d93ed7a5-8008-42b0-b408-9de075ae04a8`
**Worktree:** `workspace/node-3342824615fd-88071490-683`

## 1. Scope

Audit `POST /a2a/hello` (node registration) response fields against:
1. The skill.md protocol spec encoded in `docs/product/evomap功能分析报告.md` (lines 45–63)
2. Evolver client expectations from `https://github.com/EvoMap/evolver.git`

## 2. Expected Response Shape (skill.md spec)

```json
// docs/product/evomap功能分析报告.md:53-63
{
  "status": "acknowledged",
  "your_node_id": "node_xxx",
  "claim_code": "REEF-4X7K",
  "claim_url": "https://evomap.ai/claim/REEF-4X7K",
  "credit_balance": 100,
  "survival_status": "alive",
  "starter_gene_pack": [...]
}
```

## 3. Actual Response Shape (current impl)

```typescript
// backend/src/controllers/a2aController.ts:45-51
res.status(201).json({
  node_id: node.nodeId,
  secret: secret,
  status: 'pending',
  hub_url: `/a2a/node/${node.nodeId}`,
  message: 'Node registered successfully. Complete verification to activate.',
});
```

## 4. Compatibility Gap List

| # | Severity | Gap | Spec Field | Actual Field | Evidence |
|---|---|---|---|---|---|
| 1 | **CRITICAL** | `status` value mismatch | `"acknowledged"` | `"pending"` | `a2aController.ts:48` |
| 2 | **CRITICAL** | `claim_code` absent | `"REEF-4X7K"` | _(not returned)_ | `a2aController.ts:45-51`; `schema.prisma` has no `claimCode` field |
| 3 | **CRITICAL** | `claim_url` absent | `"https://evomap.ai/claim/REEF-4X7K"` | `"hub_url": "/a2a/node/..."` (relative internal path) | `a2aController.ts:49` |
| 4 | **CRITICAL** | `credit_balance` absent | `100` | _(not returned)_ | `a2aController.ts:45-51`; `Node.credits` exists in `schema.prisma:66` but is never populated or returned |
| 5 | **MEDIUM** | `starter_gene_pack` absent | `[...]` (array of Gene objects) | _(not returned)_ | `a2aController.ts:45-51`; no Gene query in `hello()` |
| 6 | **LOW** | `survival_status` absent | `"alive"` | _(not returned)_ | `a2aController.ts:45-51` |

### Non-breaking extras returned (not in spec)

| Extra Field | Value | Notes |
|---|---|---|
| `secret` | plain text | Extra; harmless; needed by node for future auth |
| `hub_url` | `/a2a/node/${nodeId}` | Extra; internal relative path; harmless |
| `message` | string | Extra; human-readable; harmless |

### Naming variance

| Spec | Actual | Notes |
|---|---|---|
| `your_node_id` | `node_id` | Both present; functionally equivalent |

## 5. Evolver Client Availability

- `evolver.git` and `evolver2/` exist at `/workspace/evolver*` (baseline checkout only; not in this worktree)
- `COMPETITOR_ANALYSIS.md:260` documents the Evolver local proxy at `localhost:19820`
- Evolver source not available in worktree — cannot inspect exact parsed fields
- **Risk:** Evolver may parse only the spec-defined fields; extra fields (`secret`, `hub_url`, `message`) likely ignored safely, but missing required fields will cause errors

## 6. Functional Impact

| Gap | Impact |
|---|---|
| `claim_code` / `claim_url` | Human-claim binding flow broken; no way for users to associate node with their account |
| `status: "pending"` vs `"acknowledged"` | Evolver may reject registration, treating `"pending"` as an error state |
| `credit_balance` | Evolver cannot display or enforce credit-aware behavior |
| `starter_gene_pack` | New nodes receive no curated genes on boot; must source genes manually |
| `survival_status` | Cosmetic; low functional impact |

## 7. Prisma Schema State

```prisma
// backend/prisma/schema.prisma:54-81
model Node {
  id          String   @id @default(uuid())
  nodeId      String   @unique
  name        String?
  description String?
  capabilities String?
  version     String?
  endpoint    String?
  status      String   @default("PENDING")  // PENDING, ACTIVE, INACTIVE, BLOCKED
  reputation  Float    @default(0)
  level       Int      @default(1)
  credits     Float    @default(0)         // credits field exists but unused
  userId      String?
  user        User?    @relation(...)
  createdAt   DateTime @default(now())
  lastSeenAt  DateTime?
  assets      Asset[]
  heartbeatLogs HeartbeatLog[]
  // MISSING: claimCode, claimUrl, starterGenePack
}
```

## 8. Root Cause

`a2aController.hello()` was implemented with a minimal "register and get token" model. It does not:
1. Generate a `claimCode` — needed for the human-binding workflow
2. Populate `credits` from any starter allocation
3. Fetch `starter_gene_pack` genes from the database
4. Return `"acknowledged"` as the protocol status

## 9. Fix Priority

| Priority | Gap | Fix Summary |
|---|---|---|
| P1 | `status: "acknowledged"` | Change `a2aController.ts:48` from `'pending'` to `'acknowledged'` |
| P1 | `claim_code` + `claim_url` | Add `claimCode` field to Prisma Node schema; generate code; return both fields |
| P1 | `credit_balance` | Return `node.credits` in the response (or default `100` on creation) |
| P2 | `starter_gene_pack` | Query top-rated published genes and return as array |
| P3 | `survival_status` | Return `"alive"` as static value |

## 10. Out of Scope

- Evolver client source code (not in worktree)
- Other endpoints (`/a2a/heartbeat`, `/a2a/publish`, `/a2a/fetch`) — not in this audit scope
- Frontend React Query hooks and MSW handlers for the hello endpoint
