---
applyTo: "backend/**/*.ts"
---

# Backend conventions (Express + Prisma + TypeScript ESM)

## Imports
- This package uses **ESM with TypeScript** (`"module": "NodeNext"` style). Always include the `.js` extension on relative imports, even when the source file is `.ts`:
  ```ts
  import { config } from './config/index.js';        // CORRECT
  import { authenticate } from '../middleware/auth.js'; // CORRECT
  import { config } from './config';                  // WRONG — runtime ImportError
  ```
- Type-only imports: `import type { Request } from 'express';`

## Layering
Always follow `routes/ → controllers/ → (services/ or direct Prisma)`:
1. **Route** ([backend/src/routes/](../../backend/src/routes/)) — Express `Router()`, attaches middleware (`validateBody`, `authenticate`), delegates to a controller method. Keep thin.
2. **Controller** ([backend/src/controllers/](../../backend/src/controllers/)) — class with async methods `(req, res) => Promise<void>`. Wrap logic in `try/catch`, use `res.status(...).json({ error, message })` on failures.
3. **Prisma client** — import the singleton from `../db/prisma.js`, never instantiate `new PrismaClient()` elsewhere.

## Validation
- Define Zod schemas in [backend/src/models/schemas.ts](../../backend/src/models/schemas.ts).
- Apply via the existing middleware: `router.post('/x', validateBody(mySchema), handler)`.
- Validation failure responses are emitted by `validateBody` itself — don't double-validate inside controllers.

## Auth
- User auth: attach `authenticate` middleware ([backend/src/middleware/auth.ts](../../backend/src/middleware/auth.ts)). Reads `Authorization: Bearer <jwt>` and populates `req.user: JwtPayload`.
- Node (A2A) auth uses `req.nodeAuth` — don't conflate with user auth.
- JWT helpers (`signToken`, `verifyToken`, `hashPassword`, `verifyPassword`) live in `backend/src/auth/jwt.ts`.

## Error response shape
Match the existing format in every endpoint:
```json
{ "error": "ERROR_CODE_OR_NAME", "message": "human readable", "details": {} }
```
Use existing codes: `Unauthorized`, `Conflict`, `Validation Error`, `Not Found`, `Too Many Requests`. For business errors prefer documented codes (`BOUNTY_NOT_FOUND`, `INSUFFICIENT_CREDITS`, etc., per [docs/architecture/API-Endpoint-Specifications.md](../../docs/architecture/API-Endpoint-Specifications.md)).

## Database
- SQLite in dev (`file:./dev.db`). Schema lives at [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma).
- After editing the schema run `npm run prisma:generate` (regen client) and `npm run prisma:migrate` (create migration).
- Don't write raw SQL; use Prisma's typed query API.

## Tests
- Jest + ts-jest, ESM preset. Files: `backend/src/__tests__/**/*.test.ts`.
- Run: `cd backend && npm test`. Use `import { describe, it, expect } from '@jest/globals';`.
- Mirror the existing pattern in [backend/src/__tests__/auth.test.ts](../../backend/src/__tests__/auth.test.ts).

## Don'ts
- Don't add Fastify, PostgreSQL, or Redis dependencies — [SPEC.md](../../SPEC.md) describes a target architecture, not the current one. Flag the drift to the user before any infrastructure swap.
- Don't add a logger library; structured logging utilities exist in [backend/src/middleware/errorLogger.ts](../../backend/src/middleware/errorLogger.ts).
- Don't bypass the rate limiter on `/api/*` without discussion.
