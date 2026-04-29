/**
 * EvoMap Hub - Database Query Optimization Utilities
 *
 * Provides helpers for:
 * - Pagination with cursor-based queries
 * - Query result caching
 * - Batch fetching with DataLoader pattern
 * - Connection pooling configuration
 */

import type { Prisma } from '@prisma/client';

// ===== Pagination Helpers =====

/**
 * Standard pagination params
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
  cursorField?: string;
}

/**
 * Parse pagination params with defaults
 */
export function parsePagination(params: PaginationParams): {
  skip: number;
  take: number;
  cursor?: { id: string };
} {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? params.limit ?? 20, 100);

  let skip = params.offset ?? (Math.max(1, page) - 1) * pageSize;
  let take = pageSize;

  // Cursor-based pagination takes precedence
  if (params.cursor && params.cursorField) {
    skip = 1;
    take = pageSize;
    return { skip, take, cursor: { id: params.cursor } };
  }

  return { skip, take };
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Wrap results with pagination metadata
 */
export function withPagination<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResult<T> {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? params.limit ?? 20, 100);
  const totalPages = Math.ceil(total / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// ===== Query Optimization =====

/**
 * Select only needed fields to reduce data transfer
 */
export function selectiveSelect<T extends Record<string, unknown>>(
  allowedFields: (keyof T)[]
): Record<string, true> {
  return allowedFields.reduce((acc, field) => ({ ...acc, [field]: true }), {});
}

/**
 * Common include patterns for related data
 */
export const includePatterns = {
  // Include author info for assets
  withAuthor: {
    author: {
      select: {
        id: true,
        name: true,
        reputation: true,
      },
    },
  },

  // Include evolution history
  withEvolution: {
    evolutionEvents: {
      take: 10,
      orderBy: { created_at: 'desc' as const },
    },
  },

  // Include GDI scores
  withGDIScores: {
    gdiScores: {
      take: 5,
      orderBy: { created_at: 'desc' as const },
      select: {
        score: true,
        confidence: true,
        created_at: true,
      },
    },
  },

  // Include marketplace listing
  withMarketplace: {
    listings: {
      where: { status: 'active' },
      take: 1,
    },
  },
};

/**
 * Batch multiple findMany calls efficiently using Promise.all
 */
export async function batchFindMany<T>(
  fetches: Array<() => Promise<T[]>>
): Promise<T[][]> {
  return Promise.all(fetches.map((f) => f()));
}

/**
 * Fetch related data in parallel instead of sequential
 */
export async function fetchWithIncludes<T extends Record<string, unknown>>(
  primaryPromise: Promise<T[]>,
  relatedPromises: Array<() => Promise<unknown>>
): Promise<{ data: T[]; related: unknown[][] }> {
  const [data, ...relatedResults] = await Promise.all([
    primaryPromise,
    ...relatedPromises,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { data, related: relatedResults as any };
}

// ===== Connection Pooling =====

/**
 * Prisma connection pool configuration
 *
 * Connection pool sizing guidelines:
 * - Short transactions: More connections (20-50)
 * - Long connections: Fewer connections (5-10)
 * - Serverless: Conservative (1-5)
 */
export const prismaPoolConfig = {
  // Development
  development: {
    connectionTimeout: 10_000,
    poolTimeout: 10,
    idleTimeout: 300_000,
  },

  // Production with high concurrency
  production: {
    connectionTimeout: 5_000,
    poolTimeout: 20,
    idleTimeout: 30_000,
  },

  // Serverless (conservative)
  serverless: {
    connectionTimeout: 2_000,
    poolTimeout: 5,
    idleTimeout: 10_000,
  },
};

/**
 * Determine environment for pool config
 */
export function getPoolConfig(env: string = process.env.NODE_ENV ?? 'development') {
  if (env === 'production') return prismaPoolConfig.production;
  if (env === 'test') return prismaPoolConfig.development;
  return prismaPoolConfig[env as keyof typeof prismaPoolConfig] ?? prismaPoolConfig.development;
}

// ===== Query Complexity Limits =====

/**
 * Prevent expensive queries by limiting complexity
 */
export const queryLimits = {
  MAX_ASSETS_PER_PAGE: 100,
  MAX_NODES_PER_QUERY: 500,
  MAX_SEARCH_RESULTS: 1000,
  MAX_HISTORY_ITEMS: 100,
  DEFAULT_PAGE_SIZE: 20,
  MAX_FETCH_BATCH: 50,
};

/**
 * Validate query parameters against limits
 */
export function validateQueryLimits(params: PaginationParams): void {
  const pageSize = params.pageSize ?? params.limit ?? queryLimits.DEFAULT_PAGE_SIZE;
  if (pageSize > queryLimits.MAX_ASSETS_PER_PAGE) {
    throw new Error(`Page size cannot exceed ${queryLimits.MAX_ASSETS_PER_PAGE}`);
  }
}
