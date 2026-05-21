# My Evo Directory Structure

**Version:** 1.0.0 | **Updated:** 2026-04-29

---

## Project Root
```
my-evo/
├── backend/           # Express.js API server
├── frontend/          # Next.js 15 application
├── docs/             # Documentation
├── fastapi/           # FastAPI prototype (deprecated)
├── prisma/            # Prisma schema & migrations
└── skills/           # AI skill definitions
```

---

## Backend (`backend/`)

```
backend/
├── src/
│   ├── index.ts         # Entry point
│   ├── config/index.ts  # Config loader
│   ├── db/index.ts     # Prisma connection
│   ├── middleware/
│   │   ├── auth.ts     # JWT middleware
│   │   └── errorHandler.ts
│   └── routes/
│       ├── auth.ts     # Auth endpoints
│       ├── map.ts      # Map/node endpoints
│       ├── graph.ts    # Graph algorithms
│       └── dashboard.ts
├── prisma/
│   ├── schema.prisma  # DB schema
│   └── migrations/    # Migrations
├── package.json
└── tsconfig.json
```

### Key Files
| File | Purpose |
|------|---------|
| `src/index.ts` | Express setup, middleware, routes |
| `src/routes/` | Route handlers |
| `src/middleware/auth.ts` | JWT verification |
| `prisma/schema.prisma` | Database models |

### Backend Dependencies
- express ^4.18.3
- @prisma/client ^5.10.0
- jsonwebtoken ^9.0.2
- bcryptjs ^2.4.3
- zod ^3.22.4
- helmet ^7.1.0
- graphology ^0.25.4
- d3-dag ^0.11.5

---

## Frontend (`frontend/`)

```
frontend/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Landing page
│   │   ├── (app)/       # Authenticated routes
│   │   ├── (marketing)/  # Marketing routes
│   │   ├── login/
│   │   ├── register/
│   │   ├── browse/
│   │   ├── bounty-hall/
│   │   ├── marketplace/
│   │   ├── map/
│   │   ├── swarm/
│   │   ├── workerpool/
│   │   ├── council/
│   │   ├── claim/
│   │   ├── docs/
│   │   └── skills/
│   ├── components/ui/    # UI components
│   └── lib/             # Utilities
├── public/
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

### Key Routes
| Route | Page |
|-------|------|
| `/` | Landing |
| `/login` | Login |
| `/register` | Register |
| `/onboarding` | Welcome flow |
| `/browse` | Asset discovery |
| `/bounty-hall` | Bounty listing |
| `/map` | Graph viewer |
| `/marketplace` | Asset trading |
| `/swarm` | Multi-agent |
| `/workerpool` | Workers |
| `/council` | Governance |
| `/claim/:code` | Node claiming |

### Frontend Dependencies
- next ^15.1.0
- react ^19.0.0
- @tanstack/react-query ^5.60.0
- zustand ^5.0.0
- @radix-ui/* (UI primitives)
- @xyflow/react (graph)
- react-force-graph-2d
- recharts
- tailwindcss ^4.0.0
- @playwright/test

---

## Database (`prisma/`)

```
prisma/
├── schema.prisma    # Database schema
└── migrations/      # Migration history
    ├── 20260411_*/
    ├── 20260413_*/
    └── 20260415_*/
```

### Schema Models
- **User** - Platform users
- **Session** - JWT sessions
- **Node** - Knowledge nodes
- **Edge** - Relationships
- **Asset** - Content
- **Vote** - Voting

---

## Documentation (`docs/`)

```
docs/
├── architecture.md           # Main arch doc
├── API-SPEC-20260429.md     # API spec
├── DATA-MODELS-20260429.md  # DB schema
├── DIRECTORY-STRUCTURE.md    # This file
├── architecture/
│   ├── overview.md
│   ├── architecture-backend.md
│   ├── architecture-frontend.md
│   └── diagrams/
└── guides/
    ├── getting-started.md
    ├── development.md
    └── deployment.md
```

---

## Dev Commands

### Backend
```bash
cd my-evo/backend
npm run dev           # Port 3001
npm run build
npm run prisma:generate
npm run test
```

### Frontend
```bash
cd my-evo/frontend
npm run dev           # Port 3002
npm run build
npm run type-check
npm run test:e2e
```

---

## Environment Variables

### Backend (.env)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/myevo
JWT_SECRET=secret
JWT_EXPIRES_IN=7d
PORT=3001
CORS_ORIGIN=http://localhost:3002
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

**Version:** 1.0.0 | **Updated:** 2026-04-29
