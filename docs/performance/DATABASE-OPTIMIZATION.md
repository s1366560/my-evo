# Database Query Optimization Guide

**Project:** EvoMap Hub  
**Date:** 2026-04-29

---

## 1. Indexing Strategy

### 1.1 Asset Queries

```prisma
// prisma/schema.prisma - Asset model indexes

@@index([asset_type, status])       // Type + status filtering
@@index([author_id])                 // User's assets lookup
@@index([gdi_score(sort: Desc)])    // Popularity sorting
@@index([status, gdi_score])        // Filtered popularity
@@index([created_at(sort: Desc)])   // Timeline queries
@@index([asset_type, status, gdi_score]) // Combined queries
```

### 1.2 Node Queries

```prisma
@@index([status])        // Active/inactive filtering
@@index([trust_level])   // Trust level filtering
@@index([user_id])       // User-node mapping
```

### 1.3 Knowledge Graph

```prisma
@@index([from_id])           // Outgoing relationships
@@index([to_id])             // Incoming relationships
@@index([relationship_type]) // Type-based traversal
```

---

## 2. Query Patterns

### 2.1 Efficient Pagination

```typescript
// BAD: Offset-based pagination (slow for large datasets)
const assets = await prisma.asset.findMany({
  skip: 1000,
  take: 20,
});

// GOOD: Cursor-based pagination (fast)
const assets = await prisma.asset.findMany({
  cursor: { id: lastSeenId },
  take: 20,
});
```

### 2.2 Selective Field Loading

```typescript
// BAD: Load all fields
const assets = await prisma.asset.findMany({
  where: { status: 'published' },
});

// GOOD: Load only needed fields
const assets = await prisma.asset.findMany({
  where: { status: 'published' },
  select: {
    id: true,
    name: true,
    gdi_score: true,
    author_id: true,
  },
});
```

### 2.3 Batch Operations

```typescript
// BAD: Individual operations
for (const id of ids) {
  await prisma.asset.update({
    where: { id },
    data: { status: 'archived' },
  });
}

// GOOD: Batch update
await prisma.asset.updateMany({
  where: { id: { in: ids } },
  data: { status: 'archived' },
});
```

---

## 3. Caching Integration

### 3.1 Cache-Aside Pattern

```typescript
import { cacheAside, cacheKeys } from '../shared/cache';

async function getPublishedAssets(type?: string) {
  const key = cacheKeys.assetList(type);
  
  return cacheAside(key, 'ASSET', async () => {
    return prisma.asset.findMany({
      where: { status: 'published', asset_type: type },
      orderBy: { gdi_score: 'desc' },
      take: 100,
    });
  });
}
```

### 3.2 Invalidation Strategy

```typescript
// Invalidate on asset update
await cacheDelete(cacheKeys.asset(assetId));
await cacheDeletePattern('assets:list:*');

// Invalidate on user update
await cacheDelete(cacheKeys.user(userId));
```

---

## 4. Query Complexity Guidelines

| Operation | Complexity | Recommendation |
|-----------|-----------|----------------|
| Simple lookup | O(log n) | Use index |
| Range scan | O(n) | Limit with WHERE |
| Join | O(n*m) | Use select/include wisely |
| Full table scan | O(n) | Avoid, add filters |

---

## 5. Performance Checklist

- [ ] All query fields are indexed
- [ ] Use `select()` to limit returned data
- [ ] Use cursor-based pagination for large datasets
- [ ] Batch operations with `updateMany`/`deleteMany`
- [ ] Cache expensive queries
- [ ] Monitor slow query log
- [ ] Use EXPLAIN ANALYZE for optimization

---

*Document version: 1.0*
