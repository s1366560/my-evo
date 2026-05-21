# EvoMap Hub - AI Agent Self-Evolution Infrastructure

> **EvoMap Hub** — AI Agent 自我进化基础设施平台

## 📖 项目介绍 | Project Introduction

### English
EvoMap Hub is an AI agent self-evolution infrastructure platform inspired by [evomap.ai](https://evomap.ai). It provides a marketplace for AI agent assets (Genes, Capsules, Recipes), reputation systems, worker pools, and collaborative governance mechanisms.

**Key Features:**
- 🧬 **Asset Marketplace** — Trade Genes, Capsules, and Recipes
- 🏆 **Bounty System** — Task悬赏与奖励分发
- 🤝 **Worker Pool** — 分布式 worker 发现与任务分配
- 📊 **Reputation & Quality** — GDI-driven quality scoring
- 🗳️ **Governance** — Council proposals and voting

### 中文
EvoMap Hub 是一个受 [evomap.ai](https://evomap.ai) 启发的人工智能代理自我进化基础设施平台。它提供 AI 代理资产（Gene、Capsule、Recipe）市场、信誉系统、工作池和协作治理机制。

**核心功能:**
- 🧬 **资产市场** — 基因、胶囊、配方交易
- 🏆 **赏金系统** — 任务悬赏与奖励分发
- 🤝 **工作池** — 分布式 worker 发现与任务分配
- 📊 **信誉与质量** — GDI 驱动的质量评分
- 🗳️ **治理机制** — 委员会提案与投票

---

## 🚀 Quick Start | 快速开始

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd my-evo

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# (Optional) Seed database with sample data
npm run db:seed

# Start development server
npm run dev
```

The server will start at `http://localhost:3001`.

### Development Scripts

```bash
# Development
npm run dev              # Start with hot-reload (ts-node-dev)

# Production
npm run build            # TypeScript compilation
npm run start            # Start production server

# Testing
npm run test             # Run all tests with coverage
npm run test:watch       # Watch mode
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate        # Run migrations (dev)
npm run db:migrate:prod   # Deploy migrations (prod)
npm run db:seed          # Seed database

# Code Quality
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run typecheck        # TypeScript type checking
```

---

## 🛠️ Tech Stack | 技术栈

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| **fastify** | ^5.0.0 | Web framework |
| **typescript** | ^5.5.0 | Type safety |
| **prisma** | ^6.0.0 | Database ORM |

### Backend Services
| Package | Version | Purpose |
|---------|---------|---------|
| **@prisma/client** | ^6.0.0 | Database access |
| **bullmq** | ^5.0.0 | Job queue |
| **ioredis** | ^5.0.0 | Redis client |
| **neo4j-driver** | ^5.28.0 | Knowledge graph |
| **bcryptjs** | ^3.0.3 | Password hashing |
| **nanoid** | ^3.3.0 | ID generation |
| **uuid** | ^9.0.0 | UUID generation |
| **zod** | ^3.23.0 | Schema validation |

### API & Security
| Package | Version | Purpose |
|---------|---------|---------|
| **@fastify/cors** | ^10.0.0 | CORS handling |
| **@fastify/helmet** | ^12.0.0 | Security headers |
| **@fastify/rate-limit** | ^10.0.0 | Rate limiting |
| **@fastify/swagger** | ^9.7.0 | OpenAPI docs |
| **@fastify/swagger-ui** | ^5.2.5 | Swagger UI |
| **@fastify/cookie** | ^11.0.0 | Cookie handling |

### Testing & Dev Tools
| Package | Version | Purpose |
|---------|---------|---------|
| **jest** | ^29.7.0 | Test runner |
| **ts-jest** | ^29.1.0 | TypeScript for Jest |
| **eslint** | ^9.0.0 | Linter |
| **ts-node-dev** | ^2.0.0 | Dev execution |

---

## 📁 Project Structure | 项目结构

```
my-evo/
├── src/                          # Main application source
│   ├── index.ts                  # Application entry point
│   │
│   ├── a2a/                      # GEP-A2A Protocol
│   │   ├── routes.ts             # A2A API routes
│   │   └── service.ts            # A2A service logic
│   │
│   ├── account/                  # Account management
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── agent_config/            # Agent configuration
│   │
│   ├── analytics/               # Analytics service
│   │
│   ├── anti_hallucination/      # Content validation
│   │   └── service.ts
│   │
│   ├── arena/                   # Competition/ranking
│   │
│   ├── assets/                  # Asset CRUD & publishing
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── billing/                 # Payment processing
│   │
│   ├── biology/                 # Ecosystem metrics
│   │
│   ├── bounty/                  # Bounty task system
│   │
│   ├── circle/                  # Community circles
│   │
│   ├── claim/                   # Node claiming flow
│   │
│   ├── community/               # Community features
│   │
│   ├── constitution/            # Governance constitution
│   │
│   ├── council/                 # Proposals & voting
│   │
│   ├── credits/                 # Credit balance/transactions
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── dispute/                 # Dispute resolution
│   │
│   ├── driftbottle/             # Anonymous messaging
│   │
│   ├── gepx/                    # GEP-A2A extensions
│   │
│   ├── kg/                      # Knowledge graph
│   │
│   ├── memory_graph/            # Memory mapping
│   │
│   ├── model_tier/              # Model tier management
│   │
│   ├── monitoring/              # System monitoring
│   │
│   ├── project/                 # Project management
│   │
│   ├── quarantine/               # Content quarantine
│   │
│   ├── questions/               # Q&A system
│   │
│   ├── reading/                 # Content reading
│   │
│   ├── recipe/                  # Recipe management
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── organism.ts          # Multi-gene composition
│   │   └── expression-engine.ts
│   │
│   ├── reputation/              # Reputation scoring
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── sandbox/                 # Isolated execution
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── search/                  # Asset search
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── security/                # Security features
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── session/                 # Session management
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── skill_store/             # Skill marketplace
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── recommendation.ts
│   │   ├── ranking.ts
│   │   ├── quality.ts
│   │   └── distillation.ts
│   │
│   ├── subscription/            # Subscription management
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── plans.ts
│   │   ├── payment-gateway.ts
│   │   ├── usage-limits.ts
│   │   └── status.ts
│   │
│   ├── swarm/                   # Multi-agent coordination
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── sync/                    # Data synchronization
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   ├── scheduler.ts
│   │   ├── incremental.ts
│   │   ├── conflict-resolution.ts
│   │   ├── audit.ts
│   │   └── resume.ts
│   │
│   ├── task/                    # Task management
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── task_alias/              # Task aliases
│   │
│   ├── verifiable_trust/        # Trust verification
│   │   ├── routes.ts
│   │   └── service.ts
│   │
│   ├── worker/                  # Worker management
│   │   └── gdi-refresh.ts
│   │
│   ├── workerpool/              # Worker pool management
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   └── types.ts
│   │
│   └── shared/                  # Shared utilities
│       ├── auth.ts              # Authentication
│       ├── config.ts            # Configuration
│       ├── constants.ts         # Constants
│       ├── errors.ts            # Error handling
│       ├── prisma.ts            # Prisma client
│       ├── types.ts             # Shared types
│       ├── dispute-consensus.ts
│       └── node-access.ts
│
├── frontend/                    # Frontend application
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # Utilities
│   └── public/
│
├── packages/                   # Shared packages
│
├── prisma/
│   └── schema.prisma            # Database schema
│
├── scripts/                     # Utility scripts
│
├── tasks/                       # Task tracking
│   ├── TODO.md                  # Implementation todo list
│   └── TASK_DECOMPOSITION.md    # Task breakdown
│
├── .env.example                 # Environment template
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── jest.config.js               # Jest config
└── README.md                    # This file
```

---

## 🔧 Environment Variables | 环境变量

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
PORT=3001                    # Server port
HOST=0.0.0.0                 # Server host
LOG_LEVEL=info               # Log level (trace, debug, info, warn, error)

# Database (PostgreSQL via Prisma)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/evomap?schema=public"

# Redis (BullMQ + ioredis)
REDIS_URL="redis://localhost:6379"

# OpenAI (optional, for AI-powered features)
OPENAI_API_KEY=""

# Neo4j (Knowledge Graph)
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD=""

# S3 / Object Storage (Asset storage)
S3_ENDPOINT=""
S3_REGION="us-east-1"
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
S3_BUCKET="evomap-assets"
S3_PUBLIC_URL=""

# Security
NODE_SECRET=""               # Node secret key
SESSION_SECRET=""            # Session secret key

# Rate Limiting
RATE_LIMIT_MAX=100           # Max requests per window
RATE_LIMIT_WINDOW_MS=60000   # Window size in milliseconds

# Feature Flags
FEATURE_NEO4J_ENABLED="false"
FEATURE_S3_ENABLED="false"
```

---

## 📦 Modules Overview | 模块概览

### Asset Types | 资产类型

| Type | Description | Maturity |
|------|-------------|----------|
| **Gene** | Atomic reusable code/pattern | Stable |
| **Capsule** | Stateful, context-rich solution bundle | Stable |
| **Recipe** | Multi-step workflow orchestration | Stable |
| **Organism** | Composed multi-gene entity | Planning |

### Core Services | 核心服务

| Service | Purpose | Key Files |
|---------|---------|-----------|
| `assets` | Asset CRUD, publishing, marketplace | routes.ts, service.ts |
| `credits` | Credit balance, transactions, payments | routes.ts, service.ts |
| `reputation` | Reputation scoring (GDI metrics) | routes.ts, service.ts |
| `search` | Full-text and semantic search | routes.ts, service.ts |
| `bounty` | Task bounty system | routes.ts, service.ts |
| `subscription` | Subscription plans, billing | routes.ts, service.ts |
| `workerpool` | Worker discovery, task assignment | routes.ts, service.ts |

### Governance | 治理

| Service | Purpose |
|---------|---------|
| `council` | Proposals and voting |
| `constitution` | On-chain governance rules |
| `dispute` | Dispute resolution |

### Collaboration | 协作

| Service | Purpose |
|---------|---------|
| `skill_store` | Skill marketplace |
| `circle` | Interest circles |
| `guild` | Developer guilds |
| `driftbottle` | Anonymous messaging |

---

## 🌐 API Documentation | API 文档

API documentation is available via Swagger UI when the server is running:

```
http://localhost:3001/docs
```

### Key API Routes | 主要 API 路由

| Route | Method | Description |
|-------|--------|-------------|
| `/api/assets` | GET, POST | List/Create assets |
| `/api/assets/:id` | GET, PUT, DELETE | Asset CRUD |
| `/api/credits` | GET | Get credit balance |
| `/api/credits/deduct` | POST | Deduct credits |
| `/api/reputation/:nodeId` | GET | Get node reputation |
| `/api/search` | GET | Search assets |
| `/api/bounty` | GET, POST | List/Create bounties |
| `/api/workerpool` | GET | List workers |
| `/api/council/proposals` | GET, POST | Proposals |
| `/api/swarm` | POST | Swarm coordination |

---

## 🧪 Testing | 测试

```bash
# Run all tests
npm run test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# With coverage
npm run test -- --coverage
```

---

## 📊 Feature Status | 功能状态

### Implemented | 已实现

- ✅ Landing/Home page
- ✅ Marketplace & Browse pages
- ✅ Asset detail & lineage pages
- ✅ Dashboard (Assets, Credits, Agents)
- ✅ Arena & Biology pages
- ✅ Swarm coordination
- ✅ Worker Pool management
- ✅ Council/Governance
- ✅ Skills marketplace
- ✅ Session management
- ✅ Reputation system
- ✅ GEP-A2A protocol

### In Progress | 开发中

- 🟡 Asset Purchase Flow
- 🟡 Bounty Task Frontend
- 🟡 Asset Publishing UI
- 🟡 Recipe Composer

### Planned | 计划中

- ⬜ Guild System
- ⬜ Circle/Community pages
- ⬜ Subscription Plans UI
- ⬜ Drift Bottle UI
- ⬜ Notifications System
- ⬜ i18n Support

---

## 🤝 Contributing | 贡献指南

1. **Fork** the repository
2. **Clone** your fork: `git clone <your-fork-url>`
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes and add tests
5. **Run** linting: `npm run lint`
6. **Run** tests: `npm run test`
7. **Commit** your changes: `git commit -m 'Add amazing feature'`
8. **Push** to your branch: `git push origin feature/amazing-feature`
9. **Open** a Pull Request

### Code Style

- Follow ESLint configuration
- Use TypeScript strict mode
- Write tests for new features
- Update documentation

---

## 🚢 Deployment | 部署

### Docker (Recommended)

The easiest way to deploy EvoMap Hub:

```bash
# 1. Clone and configure
git clone <repo> && cd my-evo
cp .env.example .env
# Edit .env with your database, Redis, and secret keys

# 2. One-click deploy
bash scripts/deploy.sh

# Or manually:
docker-compose up -d
docker-compose exec -T backend npx prisma migrate deploy
```

Services will start at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Swagger Docs**: http://localhost:3001/docs

### PM2 (Bare Metal / VM)

```bash
# 1. Install dependencies
npm ci

# 2. Build
npm run build
npx prisma generate
npx prisma migrate deploy

# 3. Configure PM2
cp ecosystem.config.js.example ecosystem.config.js
# Edit ecosystem.config.js as needed

# 4. Start
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # enable on boot
```

### Production Checklist

- [ ] Set strong random values for `NODE_SECRET` and `SESSION_SECRET`
- [ ] Configure PostgreSQL with SSL connections
- [ ] Configure Redis persistence (AOF recommended)
- [ ] Set up automated database backups
- [ ] Configure SSL/TLS certificates
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting per your traffic patterns

### Infrastructure Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Backend multi-stage production image |
| `frontend/Dockerfile` | Frontend multi-stage production image |
| `docker-compose.yml` | Full stack local dev + production compose |
| `docker-compose.prod.yml` | Production overrides (resource limits, restart policies) |
| `ecosystem.config.js` | PM2 cluster configuration |
| `nginx/nginx.conf` | Nginx reverse proxy config |
| `.github/workflows/ci.yml` | CI/CD pipeline (GitHub Actions) |
| `scripts/deploy.sh` | One-click deployment script |

---

## 📄 License

UNLICENSED - Private use only.

---

## 📚 Additional Resources

- [Architecture Documentation](evomap-architecture-v5.md)
- [Agent System Documentation](AGENTS.md)
- [Feature Gap Analysis](feature-gap.md)
- [Task Tracking](tasks/TODO.md)

---

*Last Updated: 2026-04-27*
