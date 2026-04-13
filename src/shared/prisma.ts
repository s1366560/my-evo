import type { PrismaClient } from '@prisma/client';
import { EvoMapError } from './errors';

export function createUnconfiguredPrismaClient(): PrismaClient {
  return new Proxy({}, {
    get() {
      throw new EvoMapError('Prisma client not configured', 'INTERNAL_ERROR', 500);
    },
  }) as PrismaClient;
}
