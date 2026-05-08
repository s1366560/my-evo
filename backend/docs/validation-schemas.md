# Request Validation Schemas

**Project**: My Evo Backend API  
**Version**: 1.0  
**Last Updated**: 2026-05-07

## Overview

All API endpoints use Zod schemas for request validation. This provides:
- Automatic request body/query/param parsing
- Clear error messages with field-level details
- Type safety with TypeScript inference
- Reusable schema definitions

## Schema Location

All validation schemas are defined in:
```
backend/src/models/schemas.ts
```

## Core Schemas

### Authentication Schemas

#### User Registration (`registerSchema`)
```typescript
{
  email: string (required, valid email format),
  username: string (3-20 chars, alphanumeric + underscore),
  password: string (min 8 chars, requires uppercase, lowercase, number)
}
```

**Validation Rules:**
- Email must be a valid email format
- Username: 3-20 characters, only letters, numbers, underscores
- Password: minimum 8 characters with at least one uppercase, one lowercase, and one number

**Error Response Example:**
```json
{
  "error": "Validation Error",
  "details": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must contain at least one uppercase letter" }
  ]
}
```

#### User Login (`loginSchema`)
```typescript
{
  email: string (required, valid email format),
  password: string (required, min 1 char)
}
```

### A2A Protocol Schemas

#### Node Hello (`a2aHelloSchema`)
Used for EvoNode registration.
```typescript
{
  name: string (required, 1-100 chars),
  description?: string (optional, max 500 chars),
  capabilities?: string[] (default: []),
  version?: string (optional),
  endpoint?: string (optional, valid URL)
}
```

#### Node Heartbeat (`a2aHeartbeatSchema`)
```typescript
{
  node_id: string (required),
  status: 'active' | 'busy' | 'idle' (required),
  active_tasks?: string[] (default: []),
  load?: number (0-1, optional)
}
```

### Asset Schemas

#### Asset Publish (`assetPublishSchema`)
```typescript
{
  type: 'gene' | 'capsule' (required),
  name: string (required, 1-200 chars),
  description?: string (optional, max 2000 chars),
  content: {
    dna?: string (optional),
    prompt?: string (optional),
    tools?: string[] (default: []),
    model?: string (optional)
  },
  tags?: string[] (max 10 tags, default: []),
  license?: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'CLOSED' (default: 'MIT'),
  parent_id?: string (UUID, optional - for forks)
}
```

#### Asset Fetch/Search (`assetFetchSchema`)
```typescript
{
  query?: string (optional, search term),
  type?: 'gene' | 'capsule' (optional),
  tags?: string[] (optional, filter by tags),
  sort?: 'recent' | 'popular' | 'gdi' (default: 'recent'),
  limit?: number (1-100, default: 20),
  offset?: number (min 0, default: 0)
}
```

### Bounty Schemas

#### Bounty Create (`bountyCreateSchema`)
```typescript
{
  title: string (required, 1-200 chars),
  description: string (required, 10-5000 chars),
  requirements?: string (optional, max 2000 chars),
  reward: number (required, positive value),
  expires_in_days?: number (1-90, default: 30)
}
```

#### Bounty Claim (`bountyClaimSchema`)
```typescript
{
  bounty_id: string (required)
}
```

#### Bounty Deliverable (`bountyDeliverableSchema`)
```typescript
{
  deliverable: string (required, min 1 char),
  feedback?: string (optional, max 1000 chars)
}
```

### Memory Schemas

#### Memory Store (`memoryStoreSchema`)
```typescript
{
  type: 'fact' | 'skill' | 'experience' | 'rule' (required),
  content: string (required, min 1 char),
  embedding?: number[] (optional, vector embedding),
  metadata?: Record<string, unknown> (optional)
}
```

## Middleware Usage

### Body Validation
```typescript
import { validateBody } from './middleware/validation';
import { registerSchema } from './models/schemas';

app.post('/auth/register', validateBody(registerSchema), authController.register);
```

### Query Validation
```typescript
import { validateQuery } from './middleware/validation';
import { assetFetchSchema } from './models/schemas';

app.get('/assets', validateQuery(assetFetchSchema), assetController.fetch);
```

### Parameter Validation
```typescript
import { validateParams } from './middleware/validation';
import { z } from 'zod';

const uuidParamSchema = z.object({
  id: z.string().uuid()
});

app.get('/assets/:id', validateParams(uuidParamSchema), assetController.get);
```

## Error Response Format

All validation errors return HTTP 400 with the following format:

```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "path.to.field",
      "message": "Human-readable error message"
    }
  ]
}
```

## Best Practices

1. **Always validate user input** - Never trust client data
2. **Use appropriate HTTP methods** - GET for queries, POST for creates
3. **Provide meaningful error messages** - Help clients understand what went wrong
4. **Set reasonable limits** - Prevent abuse with max lengths and counts
5. **Use TypeScript inference** - Leverage `z.infer<typeof schema>` for types

## Future Enhancements

- Add rate limiting schemas per endpoint
- Add pagination cursor-based validation
- Add file upload schema validation
- Add webhook signature validation
