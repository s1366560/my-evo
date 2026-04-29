import { PrismaClient } from '@prisma/client';
let _prisma: PrismaClient | null = null;
// eslint-disable-next-line prefer-const
export let prisma: PrismaClient | null = _prisma; // For Prisma-based code compatibility
export const getPrisma = (): PrismaClient | null => _prisma;
export const isMockMode = (): boolean => !process.env.DATABASE_URL;

export const connectDatabase = async (): Promise<void> => {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️  No DATABASE_URL - running in MOCK mode (in-memory storage)');
    return;
  }
  try {
    prisma = new PrismaClient({ log: ['error'] });
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ DB connection failed, falling back to MOCK mode');
    prisma = null;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (prisma) { await prisma.$disconnect(); prisma = null; }
};

process.on('SIGINT', async () => { await disconnectDatabase(); process.exit(0); });
process.on('SIGTERM', async () => { await disconnectDatabase(); process.exit(0); });

// Mock types
export interface MockUser {
  id: string; email: string; password: string; name: string;
  level: number; reputation: number; credits: number;
  createdAt: Date; updatedAt: Date;
}
export interface MockMap {
  id: string; userId: string; name: string; description: string;
  isPublic: boolean; createdAt: Date; updatedAt: Date;
}
export interface MockNode {
  id: string; mapId: string; label: string; description: string;
  nodeType: string; positionX: number; positionY: number;
  metadata: Record<string, unknown>; createdAt: Date; updatedAt: Date;
}
export interface MockEdge {
  id: string; mapId: string; sourceId: string; targetId: string;
  label: string; metadata: Record<string, unknown>; createdAt: Date; updatedAt: Date;
}

// Re-export mock store
export { MockStore, mockStore, initMockData } from './mock-store.js';
