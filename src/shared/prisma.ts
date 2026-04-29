// Prisma client utilities
import { PrismaClient } from '@prisma/client';

// Create a PrismaClient instance without connecting to the database
// This is used for type-only operations
export function createUnconfiguredPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://unconfigured:unconfigured@localhost:5432/unconfigured',
      },
    },
  });
}
