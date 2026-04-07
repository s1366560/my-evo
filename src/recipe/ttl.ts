import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export { prisma };

// ===== Constants =====

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 86400; // 24 hours
const DEFAULT_TTL_SECONDS = 3600; // 1 hour

// ===== Types =====

export interface TTLConfig {
  organism_id: string;
  ttl_seconds: number;
  expires_at: Date;
}

export interface CleanupResult {
  expired_count: number;
  expired_ids: string[];
}

// ===== TTL Management =====

/**
 * Set the TTL (time-to-live) for an organism.
 * Clamps to MIN_TTL_SECONDS - MAX_TTL_SECONDS range.
 */
export async function setTTL(organismId: string, ttlSeconds: number): Promise<TTLConfig> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  const clampedTTL = clampTTL(ttlSeconds);
  const expiresAt = new Date(Date.now() + clampedTTL * 1000);

  await prisma.organism.update({
    where: { organism_id: organismId },
    data: {
      ttl_seconds: clampedTTL,
      updated_at: new Date(),
    },
  });

  return {
    organism_id: organismId,
    ttl_seconds: clampedTTL,
    expires_at: expiresAt,
  };
}

/**
 * Check all organisms and clean up expired ones.
 * Returns the list of expired organism IDs.
 */
export async function checkAndCleanup(): Promise<CleanupResult> {
  const now = new Date();

  // Find all organisms that are not completed/failed/expired
  const activeOrganisms = await prisma.organism.findMany({
    where: {
      status: {
        in: ['assembling', 'alive', 'running'],
      },
    },
  });

  const expiredIds: string[] = [];

  for (const org of activeOrganisms) {
    const ageMs = now.getTime() - org.created_at.getTime();
    const ttlMs = org.ttl_seconds * 1000;

    if (ageMs > ttlMs) {
      await prisma.organism.update({
        where: { organism_id: org.organism_id },
        data: {
          status: 'expired',
          updated_at: now,
        },
      });
      expiredIds.push(org.organism_id);
    }
  }

  return {
    expired_count: expiredIds.length,
    expired_ids: expiredIds,
  };
}

/**
 * Extend the TTL of an organism by additional seconds.
 * Does not exceed MAX_TTL_SECONDS.
 */
export async function extendTTL(
  organismId: string,
  additionalSeconds: number,
): Promise<TTLConfig> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  if (organism.status === 'completed' || organism.status === 'failed' || organism.status === 'expired') {
    throw new ValidationError(`Cannot extend TTL for organism with status: ${organism.status}`);
  }

  const newTTL = clampTTL(organism.ttl_seconds + additionalSeconds);
  const expiresAt = new Date(Date.now() + newTTL * 1000);

  await prisma.organism.update({
    where: { organism_id: organismId },
    data: {
      ttl_seconds: newTTL,
      updated_at: new Date(),
    },
  });

  return {
    organism_id: organismId,
    ttl_seconds: newTTL,
    expires_at: expiresAt,
  };
}

/**
 * Get the remaining TTL for an organism in seconds.
 * Returns 0 if the organism is already expired.
 */
export async function getRemainingTTL(organismId: string): Promise<number> {
  const organism = await prisma.organism.findUnique({
    where: { organism_id: organismId },
  });

  if (!organism) {
    throw new NotFoundError('Organism', organismId);
  }

  const now = new Date();
  const ageMs = now.getTime() - organism.created_at.getTime();
  const ttlMs = organism.ttl_seconds * 1000;
  const remainingMs = ttlMs - ageMs;

  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * Get TTL statistics across all organisms.
 */
export async function getTTLStats(): Promise<{
  total_active: number;
  expiring_soon: number; // within 5 minutes
  expired_total: number;
}> {
  const now = new Date();
  const fiveMinutesMs = 5 * 60 * 1000;

  const [activeOrganisms, expiredTotal] = await Promise.all([
    prisma.organism.findMany({
      where: {
        status: { in: ['assembling', 'alive', 'running'] },
      },
    }),
    prisma.organism.count({
      where: { status: 'expired' },
    }),
  ]);

  let expiringSoon = 0;
  for (const org of activeOrganisms) {
    const ageMs = now.getTime() - org.created_at.getTime();
    const remainingMs = org.ttl_seconds * 1000 - ageMs;
    if (remainingMs > 0 && remainingMs <= fiveMinutesMs) {
      expiringSoon++;
    }
  }

  return {
    total_active: activeOrganisms.length,
    expiring_soon: expiringSoon,
    expired_total: expiredTotal,
  };
}

// ===== Internal Helpers =====

function clampTTL(ttlSeconds: number): number {
  if (ttlSeconds < MIN_TTL_SECONDS) return MIN_TTL_SECONDS;
  if (ttlSeconds > MAX_TTL_SECONDS) return MAX_TTL_SECONDS;
  return ttlSeconds;
}
