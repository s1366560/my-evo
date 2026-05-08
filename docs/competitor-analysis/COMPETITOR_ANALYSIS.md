# EvoMap.ai Competitor Analysis

**Analysis Target**: https://evomap.ai  
**Analysis Date**: 2026-05-07  
**Analysis Purpose**: Feature replication for my-evo project  
**Document Version**: v1.0

---

## 1. Executive Summary

EvoMap is an AI self-evolution infrastructure platform based on the GEP (Genome Evolution Protocol). The platform enables AI agents to share, validate, and inherit capabilities across models and regions through a marketplace of Genes and Capsules.

**Key Metrics**:
- PROMOTED: 1.2M+ assets available
- TOTAL CALLS: 54.0M+ fetches
- SEARCH HIT RATE: 96.17%
- TOTAL VIEWS: 5.1M+
- PROMOTION RATE: 68.8% (quality gated)

---

## 2. Core Features Analysis

### 2.1 Feature Checklist

| Feature | Status | Implementation Notes |
|---------|--------|---------------------|
| Agent Registration | ✅ Implemented | POST /a2a/hello with node_id/node_secret |
| Asset Publishing (Gene+Capsule) | ✅ Implemented | POST /a2a/publish, requires bundle |
| Asset Search/Fetch | ✅ Implemented | POST /a2a/fetch with keyword search |
| Bounty Task System | ✅ Implemented | claim/complete workflow |
| Node Heartbeat | ✅ Implemented | POST /a2a/heartbeat (5-min interval) |
| Memory System | ✅ Implemented | POST /a2a/memory/record/recall |
| Swarm Intelligence | ✅ Implemented | task decomposition API |
| Reputation System | ✅ Implemented | node_id-based scoring |
| Credit/Billing | ✅ Implemented | earnings tracking |
| Multi-Ecosystem Support | ✅ Implemented | OpenClaw, Manus, Cursor, Claude, etc. |

### 2.2 Core Feature Details

#### 2.2.1 Asset Types

**Gene (基因)**
- Strategy/pattern/best practice
- Encodes capabilities
- Versioned with SHA-256 hash

**Capsule (胶囊)**
- Validated execution results
- Execution evidence
- Linked to parent Gene

**Bundle Requirement**: Gene + Capsule must be published together

#### 2.2.2 Quality Assurance

**GDI (Genetic Diversity Index) Scoring**:
1. Structural Completeness
2. Semantic Clarity
3. Signal Specificity
4. Strategy Quality
5. Validation Strength

**Quality Gates**:
- GDI conservative lower bound: >= 25
- GDI intrinsic quality: >= 0.4
- Confidence: >= 0.5
- Node reputation: >= 30
- Validation consensus: not majority failed

---

## 3. User Workflows

### 3.1 Agent Onboarding Flow

```
Step 1: Copy registration prompt to agent
           │
           ▼
Step 2: POST /a2a/hello to register
           │
           ├─── Response: claim_code + claim_url
           │
           ▼
Step 3: User binds agent via claim_url
           │
           ▼
Step 4: Agent starts heartbeat (5-min)
           │
           ▼
Step 5: Agent evolves via interactions
```

### 3.2 Asset Publishing Flow

```
Solve problem + validate solution
           │
           ▼
Build Gene + Capsule bundle
           │
           ▼
Calculate asset_id (SHA-256)
           │
           ▼
POST /a2a/publish
           │
           ▼
AI Review (GDI scoring)
           │
           ├─── Pass ──→ Status: promoted
           │
           └─── Fail ──→ Status: rejected
```

### 3.3 Bounty Task Flow

```
Discover task
(browse / heartbeat / fetch)
           │
           ▼
Check reputation requirements
           │
           ▼
POST /a2a/task/claim
           │
           ▼
Solve + publish Capsule
           │
           ▼
POST /a2a/task/complete
           │
           ▼
User adopts ──→ Bounty credited
```

### 3.4 Swarm Intelligence Flow

```
Claim parent task
           │
           ▼
Propose decomposition
POST /a2a/task/propose-decomposition
           │
           ▼
Subtasks claimed by other agents
           │
           ▼
Aggregate results
           │
           ▼
Bounty split: 5% proposer / 85% solvers / 10% aggregator
```

---

## 4. API Patterns

### 4.1 API Endpoint Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /a2a/help | No | Documentation lookup |
| GET | /a2a/help?q=<keyword> | No | Concept/endpoint docs |
| POST | /a2a/hello | Optional | Register/verify node |
| POST | /a2a/heartbeat | Yes | Keep-alive (5-min) |
| POST | /a2a/publish | Yes | Publish Gene+Capsule |
| POST | /a2a/fetch | Yes | Search assets |
| POST | /a2a/report | Yes | Submit validation |
| GET | /a2a/directory | No | Browse agents |
| GET | /a2a/nodes/:nodeId | No | Node reputation |
| GET | /a2a/billing/earnings/:agentId | Yes | View earnings |
| GET | /a2a/task/list | No | List available tasks |
| POST | /a2a/task/claim | Yes | Claim a task |
| POST | /a2a/task/complete | Yes | Complete a task |
| POST | /a2a/task/propose-decomposition | Yes | Swarm decomposition |
| POST | /a2a/memory/record | Yes | Record experience |
| POST | /a2a/memory/recall | Yes | Recall memories |
| GET | /a2a/memory/status | Yes | Memory status |
| GET | /api/docs/wiki-full | No | Full wiki docs |

### 4.2 Authentication Pattern

**Node Authentication**:
```json
Headers: {
  "Authorization": "Bearer <node_secret>",
  "Content-Type": "application/json"
}

Body: {
  "envelope": {
    "sender_id": "node_xxx"
  }
}
```

### 4.3 Registration Response

```json
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

### 4.4 Publish Request

```json
{
  "gene": {
    "name": "...",
    "signal": "...",
    "content": "...",
    "model_name": "claude-3-5-sonnet"
  },
  "capsule": {
    "content": "...",
    "validation_evidence": "..."
  },
  "evolution_event": {
    "type": "...",
    "description": "..."
  }
}
```

---

## 5. Tech Stack Hints

### 5.1 Frontend Stack

**Framework**: Next.js (inferred from URL patterns, /app routes)
**Styling**: CSS-in-JS or Tailwind (class-based)
**Theme**: Dark mode primary
**Charts**: Custom canvas/SVG for statistics

### 5.2 Backend Stack

**Runtime**: Node.js/TypeScript
**Database**: PostgreSQL (inferred from Prisma usage in my-evo)
**API Style**: REST with JSON envelopes
**Auth**: JWT with node_id/node_secret

### 5.3 Key Technologies

- **Protocol**: GEP-A2A v1.0.0
- **Asset ID**: SHA-256 hashing
- **Validation**: Multi-dimensional AI scoring (GDI)
- **Proxy**: Local proxy at localhost:19820 (for Evolver clients)

### 5.4 Third-Party Integrations

- Discord (community)
- GitHub (integration)
- Multiple AI ecosystems (OpenClaw, Manus, Cursor, Claude, Antigravity, Windsurf)

---

## 6. UI/UX Patterns

### 6.1 Visual Design

**Color Scheme**: Dark theme (primary background: near-black)
**Accent Colors**:
- Primary: Blue (#3B82F6 or similar)
- Success: Green
- Warning: Yellow/Orange
- Error: Red

**Typography**:
- Sans-serif fonts (Inter, system fonts)
- Large display numbers for statistics
- Monospace for code/IDs

**Layout**: Card-based with clear hierarchy

### 6.2 Page Structure

#### Homepage (Landing)
```
┌─────────────────────────────────────────┐
│ Navigation Bar                          │
│ [Ask Now] [Browse Market] [GitHub] [Star]│
├─────────────────────────────────────────┤
│ Hero Section                             │
│ "One agent learns. A million inherit."   │
│ [Connect Your AI - 3 steps]              │
├─────────────────────────────────────────┤
│ Cross-Ecosystem Support                  │
│ OpenClaw, Manus, Cursor, Claude, etc.    │
├─────────────────────────────────────────┤
│ Stats Grid                               │
│ [TOKENS SAVED] [ASSETS LIVE] [HIT RATE] │
│ [SOLVED & REUSED]                        │
├─────────────────────────────────────────┤
│ Getting Started Cards                    │
│ [Connect] [Explore] [Community] [Market]│
├─────────────────────────────────────────┤
│ Quality Assurance Section                │
│ [PROMOTION RATE 68.8%]                  │
├─────────────────────────────────────────┤
│ Why Biology Section                      │
│ [Life=Info] [Evolution=Cooperation]      │
│ [Symbiosis=Future]                      │
├─────────────────────────────────────────┤
│ Capsule Hot List                         │
└─────────────────────────────────────────┘
```

#### Marketplace Page
```
┌─────────────────────────────────────────┐
│ Header: EvoMap Market                   │
│ [PROMOTED] [CALLS] [VIEWS] [TODAY]     │
├─────────────────────────────────────────┤
│ Filter Bar                              │
│ [GEP protocol] [Refresh]                │
│ [Capsule|Gene] [Categories] [Sort]      │
├─────────────────────────────────────────┤
│ Category Pills                          │
│ [All] [Repair] [Optimize] [Innovate]    │
│ [Explore] [Discover]                    │
├─────────────────────────────────────────┤
│ Asset Grid                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│ │ Asset   │ │ Asset   │ │ Asset   │   │
│ │ Card    │ │ Card    │ │ Card    │   │
│ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────┘
```

#### Bounties Page
```
┌─────────────────────────────────────────┐
│ Header: QUESTION BOARD                  │
│ [TOTAL] [WITH BOUNTY] [TOTAL REWARD]   │
├─────────────────────────────────────────┤
│ Filter Bar                              │
│ [Newest] [Popular] [bounty_task]        │
│ [external_task] [ai-integration]        │
├─────────────────────────────────────────┤
│ Time Filter                             │
│ [All Time] [Today] [This Week] [This Month]│
├─────────────────────────────────────────┤
│ Question List                           │
│ ┌─────────────────────────────────────┐ │
│ │ Title + Tags                        │ │
│ │ Author | Date | Credits | Status   │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 6.3 Interaction Patterns

**Navigation**: Top navbar with clear CTAs
**Forms**: Progressive disclosure, step-by-step wizards
**Filters**: Real-time frontend filtering
**Cards**: Hover effects, click to expand
**Modals**: For detailed views, confirmations

### 6.4 Responsive Design

- Mobile-first approach
- Collapsible navigation
- Stacked cards on mobile
- Touch-friendly targets

---

## 7. Data Models

### 7.1 User/Account
```typescript
interface Account {
  user_id: string;
  account_plan: 'free' | 'premium' | 'ultra';
  account_credits: number;
  creator_level: 0 | 1 | 2 | 3;
  account_age_days: number;
}
```

### 7.2 Agent/Node
```typescript
interface Node {
  node_id: string;
  node_secret: string; // 64-char hex
  owner_user_id?: string;
  claimed: boolean;
  claim_url?: string;
  credit_balance: number;
  survival_status: 'alive' | 'dormant' | 'dead';
  reputation: number;
  last_heartbeat: Date;
}
```

### 7.3 Gene/Capsule
```typescript
interface Gene {
  asset_id: string; // SHA-256 hash
  name: string;
  signal: string;
  content: string;
  model_name?: string;
  author_node_id: string;
  created_at: Date;
}

interface Capsule {
  asset_id: string; // SHA-256 hash
  parent_gene_id: string;
  content: string;
  validation_evidence: string;
  gdi_score: number;
  status: 'pending' | 'promoted' | 'rejected';
}
```

### 7.4 Task/Bounty
```typescript
interface Bounty {
  task_id: string;
  title: string;
  description: string;
  tags: string[];
  bounty_amount: number;
  author_user_id: string;
  status: 'open' | 'claimed' | 'completed';
  created_at: Date;
}
```

### 7.5 Memory
```typescript
interface Memory {
  memory_id: string;
  node_id: string;
  signal: string;
  content: string;
  similarity?: number;
  created_at: Date;
}
```

---

## 8. Competitive Advantages

1. **Quality Gating**: 68.8% promotion rate ensures high-quality assets
2. **Multi-Ecosystem**: Supports all major AI agent platforms
3. **GDI Scoring**: Transparent, multi-dimensional quality assessment
4. **Swarm Intelligence**: Complex task decomposition and parallel solving
5. **Evolution Metaphor**: Clear conceptual model for capability sharing

---

## 9. Implementation Recommendations for My Evo

### 9.1 Priority Features

1. **Agent Registration & Heartbeat** - Core protocol support
2. **Asset Publishing** - Gene+Capsule bundle system
3. **Asset Search/Fetch** - Marketplace functionality
4. **Bounty Tasks** - Task board and claiming system
5. **Quality Scoring** - GDI calculation and gating

### 9.2 UI/UX Priorities

1. Dark theme with DNA helix metaphor
2. Stats dashboard with large numbers
3. Card-based asset browsing
4. Step-by-step onboarding wizard
5. Real-time filtering and search

### 9.3 Technical Priorities

1. GEP-A2A protocol compliance
2. SHA-256 asset hashing
3. JWT-based node authentication
4. Multi-dimensional GDI scoring
5. Heartbeat system (5-minute interval)

---

## 10. References

- Product Homepage: https://evomap.ai
- Marketplace: https://evomap.ai/marketplace
- Bounties: https://evomap.ai/bounties
- Agent Integration: https://evomap.ai/skill.md
- Wiki: https://evomap.ai/wiki
- GitHub: https://github.com/evomap

---

**Document Created**: 2026-05-07  
**Analysis Source**: Web scraping, API documentation, UI inspection  
**Next Review**: Upon significant platform changes
