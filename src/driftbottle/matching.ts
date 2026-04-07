import { PrismaClient } from '@prisma/client';
import type { DriftBottle } from '../shared/types';
import { NotFoundError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

// ----- Tag scoring -----

export function scoreByTags(
  bottleTags: string[],
  userTags: string[],
): number {
  if (!bottleTags || bottleTags.length === 0) {
    return 0;
  }
  if (!userTags || userTags.length === 0) {
    return 0;
  }
  const bottleSet = new Set(bottleTags.map((t) => t.toLowerCase()));
  const matches = userTags.filter((t) => bottleSet.has(t.toLowerCase())).length;
  return matches / bottleTags.length;
}

// ----- Domain scoring -----

export function scoreByDomain(
  bottleDomain: string | undefined,
  userDomain: string | undefined,
): number {
  if (!bottleDomain || !userDomain) {
    return 0;
  }
  if (bottleDomain.toLowerCase() === userDomain.toLowerCase()) {
    return 1;
  }
  // Partial domain match (e.g., "python" vs "python-async")
  const bottleParts = bottleDomain.toLowerCase().split(/[-_/]/);
  const userParts = userDomain.toLowerCase().split(/[-_/]/);
  const overlap = bottleParts.filter((p) => userParts.includes(p)).length;
  return overlap / Math.max(bottleParts.length, 1);
}

// ----- Compatibility -----

export interface CompatibilityResult {
  score: number;
  tagScore: number;
  domainScore: number;
  matchedTags: string[];
  bottleId: string;
}

/**
 * Calculate compatibility score between a bottle and a potential finder.
 * Combines tag overlap and domain similarity.
 */
export function calculateCompatibility(
  bottle: DriftBottle,
  finder: { tags?: string[]; domain?: string },
): CompatibilityResult {
  const tagScore = scoreByTags(bottle.signals, finder.tags ?? []);
  const domainScore = scoreByDomain(undefined, finder.domain);

  // Weighted combination: tags are primary, domain is secondary
  const score = tagScore * 0.7 + domainScore * 0.3;

  const bottleSet = new Set(bottle.signals.map((t) => t.toLowerCase()));
  const matchedTags =
    (finder.tags ?? []).filter((t) => bottleSet.has(t.toLowerCase()));

  return {
    score,
    tagScore,
    domainScore,
    matchedTags,
    bottleId: bottle.bottle_id,
  };
}

// ----- Find matching bottles -----

export interface MatchingBottle {
  bottle: DriftBottle;
  compatibility: CompatibilityResult;
}

/**
 * Find the top-N bottles most compatible with a user.
 * Filters to drifting bottles not created by the user.
 */
export async function findMatchingBottles(
  userId: string,
  limit = 10,
): Promise<MatchingBottle[]> {
  const records = await prisma.driftBottle.findMany({
    where: {
      status: 'drifting',
      sender_id: { not: userId },
      expires_at: { gt: new Date() },
    },
  });

  const bottles: DriftBottle[] = records.map((r) => ({
    bottle_id: r.bottle_id,
    content: r.content,
    sender_id: r.sender_id,
    status: r.status as DriftBottle['status'],
    signals: r.signals,
    hops: r.hops,
    max_hops: r.max_hops,
    path: r.path,
    finder_id: r.finder_id ?? undefined,
    reply: r.reply ?? undefined,
    thrown_at: (r.thrown_at as Date).toISOString(),
    found_at: r.found_at ? (r.found_at as Date).toISOString() : undefined,
    expires_at: (r.expires_at as Date).toISOString(),
  }));

  const scored: MatchingBottle[] = bottles.map((bottle) => ({
    bottle,
    compatibility: calculateCompatibility(bottle, {}),
  }));

  scored.sort((a, b) => b.compatibility.score - a.compatibility.score);

  return scored.slice(0, limit);
}
