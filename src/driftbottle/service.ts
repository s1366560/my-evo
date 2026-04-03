import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type { DriftBottle } from '../shared/types';
import {
  MAX_DRIFT_HOPS,
  DRIFT_TTL_DAYS,
  DISCOVERY_PROBABILITY,
  INTEREST_MATCH_BONUS,
} from '../shared/constants';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function toDriftBottle(record: Record<string, unknown>): DriftBottle {
  return {
    bottle_id: record.bottle_id as string,
    content: record.content as string,
    sender_id: record.sender_id as string,
    status: record.status as DriftBottle['status'],
    signals: record.signals as string[],
    hops: record.hops as number,
    max_hops: record.max_hops as number,
    path: record.path as string[],
    finder_id: (record.finder_id as string) ?? undefined,
    reply: (record.reply as string) ?? undefined,
    thrown_at: (record.thrown_at as Date).toISOString(),
    found_at: (record.found_at as Date)?.toISOString() ?? undefined,
    expires_at: (record.expires_at as Date).toISOString(),
  };
}

export async function throwBottle(
  senderId: string,
  content: string,
  signals: string[],
): Promise<DriftBottle> {
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Bottle content cannot be empty');
  }

  const bottleId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + DRIFT_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const bottle = await prisma.driftBottle.create({
    data: {
      bottle_id: bottleId,
      content,
      sender_id: senderId,
      status: 'drifting',
      signals,
      hops: 0,
      max_hops: MAX_DRIFT_HOPS,
      path: [senderId],
      expires_at: expiresAt,
    },
  });

  return toDriftBottle(bottle as unknown as Record<string, unknown>);
}

export async function discoverBottle(
  finderId: string,
  signals?: string[],
): Promise<DriftBottle | null> {
  const driftingBottles = await prisma.driftBottle.findMany({
    where: {
      status: 'drifting',
      sender_id: { not: finderId },
      expires_at: { gt: new Date() },
    },
  });

  if (driftingBottles.length === 0) {
    return null;
  }

  const scored = driftingBottles.map((bottle: { signals: string[]; [key: string]: unknown }) => {
    let probability = DISCOVERY_PROBABILITY;

    if (signals && signals.length > 0) {
      const bottleSignals = new Set(bottle.signals);
      const matchCount = signals.filter((s) =>
        bottleSignals.has(s),
      ).length;
      const matchRatio = matchCount / Math.max(signals.length, 1);
      probability += INTEREST_MATCH_BONUS * matchRatio;
    }

    probability = Math.min(probability, 1);

    return { bottle, probability };
  });

  const discovered = scored.filter(
    (s: { bottle: { signals: string[]; [key: string]: unknown }; probability: number }) => Math.random() < s.probability,
  );

  if (discovered.length === 0) {
    return null;
  }

  const chosen = discovered[Math.floor(Math.random() * discovered.length)];
  if (!chosen) {
    return null;
  }
  const bottle = chosen.bottle as Record<string, unknown>;

  const updatedPath = [...(bottle.path as string[]), finderId];

  const updated = await prisma.driftBottle.update({
    where: { id: bottle.id as string },
    data: {
      finder_id: finderId,
      status: 'found',
      hops: (bottle.hops as number) + 1,
      path: updatedPath,
      found_at: new Date(),
    },
  });

  return toDriftBottle(updated as unknown as Record<string, unknown>);
}

export async function replyToBottle(
  bottleId: string,
  finderId: string,
  reply: string,
): Promise<DriftBottle> {
  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle) {
    throw new NotFoundError('Bottle', bottleId);
  }

  if (bottle.finder_id !== finderId) {
    throw new ValidationError('Only the finder can reply to this bottle');
  }

  if (bottle.status !== 'found') {
    throw new ValidationError('Bottle must be in "found" status to reply');
  }

  if (!reply || reply.trim().length === 0) {
    throw new ValidationError('Reply content cannot be empty');
  }

  const updated = await prisma.driftBottle.update({
    where: { bottle_id: bottleId },
    data: {
      reply,
      status: 'replied',
    },
  });

  return toDriftBottle(updated as unknown as Record<string, unknown>);
}

export async function discardBottle(
  bottleId: string,
  finderId: string,
): Promise<DriftBottle> {
  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle) {
    throw new NotFoundError('Bottle', bottleId);
  }

  if (bottle.finder_id !== finderId) {
    throw new ValidationError(
      'Only the finder can discard this bottle',
    );
  }

  if (bottle.status !== 'found') {
    throw new ValidationError('Bottle must be in "found" status to discard');
  }

  const updated = await prisma.driftBottle.update({
    where: { bottle_id: bottleId },
    data: { status: 'discarded' },
  });

  return toDriftBottle(updated as unknown as Record<string, unknown>);
}

export async function expireBottles(): Promise<number> {
  const now = new Date();

  const expired = await prisma.driftBottle.updateMany({
    where: {
      status: 'drifting',
      expires_at: { lte: now },
    },
    data: { status: 'expired' },
  });

  return expired.count;
}
