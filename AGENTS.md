# AGENTS.md

> See CLAUDE.md for project overview, tech stack, concepts, and planned commands.

## Code Map

```
src/
  index.ts              # Server entry: buildApp() -> listen(3000), graceful shutdown
  app.ts                # Fastify factory: plugins, auth, error handler, route registration
  shared/
    types.ts            # ALL domain interfaces (1072 lines) - single source of truth
    constants.ts        # ALL business constants grouped by module section headers
    errors.ts           # EvoMapError base + NotFound/Unauthorized/Forbidden/Validation/
                        #   RateLimit/InsufficientCredits/Quarantine/SimilarityViolation/
                        #   TrustLevel/KeyInception
    auth.ts             # 3-layer auth: Session token > API key (ek_ prefix) > Node secret
                        #   Exports: requireAuth, requireTrustLevel, requireScope, checkQuarantine
  {module}/             # 22 active modules, each with identical 4-file structure (see below)
prisma/
  schema.prisma         # 30+ models, 656 lines, comprehensive indexing
```

## Module Pattern (STRICT - every module follows this)

```
src/{module}/
  routes.ts         # Fastify plugin: export default async function(app: FastifyInstance)
  service.ts        # Business logic with setPrisma() for test DI
  service.test.ts   # Jest: mock PrismaClient, setPrisma(mock) in beforeAll
  types.ts          # Re-exports relevant types from shared/types.ts
```

### Route Convention
```typescript
export default async function(app: FastifyInstance): Promise<void> {
  app.post('/endpoint', { preHandler: [requireAuth] }, async (request, reply) => { ... });
}
```

### Service DI Convention
```typescript
let prisma = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }
```

### Test Convention
```typescript
const mockPrisma = { model: { findMany: jest.fn(), create: jest.fn(), ... } } as unknown as PrismaClient;
beforeAll(() => setPrisma(mockPrisma));
afterEach(() => jest.clearAllMocks());
```

## Route Prefix Map (from app.ts)

| Prefix | Modules |
|--------|---------|
| `/a2a` | a2a, assets, credits, reputation |
| `/a2a/council` | council |
| `/api/v2/swarm` | swarm |
| `/api/v2/workerpool` | workerpool |
| `/api/v2/bounty` | bounty |
| `/api/v2/session` | session |
| `/api/v2/analytics` | analytics |
| `/api/v2/biology` | biology |
| `/api/v2/marketplace` | marketplace |
| `/api/v2/quarantine` | quarantine |
| `/api/v2/drift-bottle` | driftbottle |
| `/api/v2/community` | community |
| `/api/v2/circle` | circle |
| `/api/v2/kg` | kg |
| `/api/v2/arena` | arena |
| `/api/v2/reading` | reading |
| `/api/v2/monitoring` | monitoring |
| `/account` | account |
| `/trust` | verifiable_trust |
| `/search` | search |

## Active vs Placeholder Modules

**22 active** (have 4-file structure): a2a, account, analytics, arena, assets, biology, bounty, circle, community, council, credits, driftbottle, kg, marketplace, monitoring, quarantine, reading, reputation, search, session, swarm, verifiable_trust, workerpool

**15 placeholder** (empty directories): anti_hallucination, directory, gepx, memory_graph, onboarding, project, protocol, questions, recipe, sandbox, scripts, skill_store, subscription, sync, trust

## Auth Model

Three credential types checked in order by `requireAuth()`:
1. **Session token** - cookie-based, full access
2. **API key** - header `Authorization: Bearer ek_<48hex>`, read-heavy operations, max 5 per account
3. **Node secret** - header `Authorization: Bearer <64hex>`, node identity for A2A operations

Additional middleware: `requireTrustLevel(level)`, `requireScope(scope)`, `checkQuarantine()`

## Error Handling

Global error handler in app.ts catches `EvoMapError` subclasses and maps to HTTP status codes. Throw domain-specific errors from services:
```typescript
throw new NotFoundError('Asset not found');
throw new InsufficientCreditsError('Need 10 credits');
throw new QuarantineError('Node is quarantined at L2');
```

## Database

- Prisma ORM with PostgreSQL
- Schema at `prisma/schema.prisma` (30+ models)
- Path alias: `@/*` maps to `./src/*` (tsconfig paths)
- Scripts: `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`

## Testing

- Jest with ts-jest, coverage thresholds at 80% (branches, functions, lines, statements)
- Coverage collected ONLY on `**/service.ts` and `src/shared/**`
- Run: `npm test` or `npm run test:coverage`
- Pattern: mock Prisma at module level, inject via `setPrisma()`

## Known Gotchas

- **assets and a2a share `/a2a` prefix** - both registered under same prefix in app.ts
- **CLAUDE.md is outdated** - says "no source code exists" but 22 modules are implemented
- **No CI/CD** - `.github/workflows/` exists but is empty
- **No ESLint/Prettier config files** - lint script exists in package.json but no rc files committed
- **No Dockerfile** - referenced in CLAUDE.md planned commands but not committed
- **coverage/ committed** - HTML coverage reports are in git (likely unintentional)
- **Empty deploy/k8s/** - Kubernetes manifests directory exists but has no files
- **Constants are centralized** despite CLAUDE.md saying "not centralized" - all in shared/constants.ts

## Architecture Spec

`evomap-architecture-v5.md` (~15K lines, Chinese, 42 chapters) is the authoritative spec. Key enforcement points:
- GEP-A2A message envelope: 7 required fields (protocol, protocol_version, message_type, message_id, sender_id, timestamp, payload)
- Quarantine levels: L1 (24h/-5 rep), L2 (7d/-15 rep), L3 (30d/-30 rep)
- GDI scoring weights: usefulness(0.30), novelty(0.25), rigor(0.25), reuse(0.20)
- Similarity threshold: 0.85 default, >=0.95 triggers auto-quarantine
- Credits: start 500, publish costs 5/10/20 (Gene/Capsule/Recipe), 5%/month decay after 90d
