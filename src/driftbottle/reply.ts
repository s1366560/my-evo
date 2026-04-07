import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';
import crypto from 'crypto';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

// ----- Reply types -----

export interface BottleReply {
  reply_id: string;
  bottle_id: string;
  responder_id: string;
  content: string;
  is_anonymous: boolean;
  created_at: string;
}

// ----- Send reply -----

/**
 * Submit a reply to a bottle. Only the finder can reply.
 */
export async function sendReply(
  bottleId: string,
  responderId: string,
  content: string,
): Promise<BottleReply> {
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Reply content cannot be empty');
  }

  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle) {
    throw new NotFoundError('DriftBottle', bottleId);
  }

  if (bottle.finder_id !== responderId) {
    throw new ValidationError('Only the finder can reply to this bottle');
  }

  if (bottle.status !== 'found') {
    throw new ValidationError('Bottle must be in "found" status to reply');
  }

  const replyId = `reply_${crypto.randomUUID()}`;

  // Store reply in a dedicated table if it exists, otherwise embed in bottle
  // Here we update the bottle's reply field
  const updated = await prisma.driftBottle.update({
    where: { bottle_id: bottleId },
    data: {
      reply: content,
      status: 'replied',
    },
  });

  return {
    reply_id: replyId,
    bottle_id: bottleId,
    responder_id: responderId,
    content: updated.reply ?? content,
    is_anonymous: false,
    created_at: new Date().toISOString(),
  };
}

// ----- Get replies -----

/**
 * Get all replies for a bottle.
 * Note: Currently replies are stored on the bottle itself.
 * Returns the reply if the bottle status is 'replied'.
 */
export async function getReplies(bottleId: string): Promise<BottleReply[]> {
  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle) {
    throw new NotFoundError('DriftBottle', bottleId);
  }

  if (!bottle.reply) {
    return [];
  }

  // If finder_id is null, the replier is anonymous
  const isAnonymous = !bottle.finder_id;

  return [
    {
      reply_id: `reply_${bottleId}`,
      bottle_id: bottleId,
      responder_id: bottle.finder_id ?? 'anonymous',
      content: bottle.reply,
      is_anonymous: isAnonymous,
      created_at: bottle.found_at
        ? (bottle.found_at as Date).toISOString()
        : new Date().toISOString(),
    },
  ];
}

// ----- Anonymize sender -----

/**
 * Anonymize a reply by replacing the responder_id with a hash.
 * This preserves identity for auditing while protecting privacy in public views.
 */
export async function anonymizeSender(
  replyId: string,
): Promise<BottleReply | null> {
  // replyId format: reply_<bottleId> for embedded replies
  const parts = replyId.split('_');
  if (parts.length < 2) {
    return null;
  }
  const bottleId = parts.slice(1).join('_');

  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle || !bottle.reply) {
    return null;
  }

  // Create a deterministic anonymous identifier from the replier id
  const originalId = bottle.finder_id ?? 'anonymous';
  const hash = crypto
    .createHash('sha256')
    .update(originalId)
    .digest('hex')
    .slice(0, 12);

  return {
    reply_id: replyId,
    bottle_id: bottleId,
    responder_id: `anon_${hash}`,
    content: bottle.reply,
    is_anonymous: true,
    created_at: bottle.found_at
      ? (bottle.found_at as Date).toISOString()
      : new Date().toISOString(),
  };
}
