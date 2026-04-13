import type { FastifyInstance, FastifyRequest } from 'fastify';
import { UnauthorizedError, ValidationError } from './errors';

type AuthContext = NonNullable<FastifyRequest['auth']>;

interface ResolveAuthorizedNodeIdOptions {
  requestedNodeId?: string;
  missingNodeMessage?: string;
  unauthorizedMessage?: string;
  allowSessionFallback?: boolean;
}

async function findOwnedNodeId(
  app: FastifyInstance,
  userId: string,
  nodeId?: string,
): Promise<string | null> {
  const ownedNode = await app.prisma.node.findFirst({
    where: {
      user_id: userId,
      ...(nodeId ? { node_id: nodeId } : {}),
    },
    ...(nodeId ? {} : { orderBy: { registered_at: 'asc' as const } }),
    select: { node_id: true },
  });

  return ownedNode?.node_id ?? null;
}

async function listOwnedNodeIds(
  app: FastifyInstance,
  userId: string,
  take = 2,
): Promise<string[]> {
  const ownedNodes = await app.prisma.node.findMany({
    where: { user_id: userId },
    orderBy: { registered_at: 'asc' },
    take,
    select: { node_id: true },
  });

  return ownedNodes.map((node) => node.node_id);
}

export async function resolveAuthorizedNodeId(
  app: FastifyInstance,
  auth: AuthContext,
  {
    requestedNodeId,
    missingNodeMessage = 'node_id is required',
    unauthorizedMessage = 'Cannot access another node',
    allowSessionFallback = true,
  }: ResolveAuthorizedNodeIdOptions = {},
): Promise<string> {
  if (auth.auth_type === 'session' && auth.userId) {
    const preferredNodeId = requestedNodeId ?? auth.node_id;

    if (preferredNodeId) {
      const ownedPreferredNodeId = await findOwnedNodeId(app, auth.userId, preferredNodeId);
      if (ownedPreferredNodeId) {
        return ownedPreferredNodeId;
      }

      if (requestedNodeId) {
        throw new UnauthorizedError(unauthorizedMessage);
      }
    }

    if (allowSessionFallback) {
      const ownedNodeIds = await listOwnedNodeIds(app, auth.userId);
      if (ownedNodeIds.length === 1) {
        return ownedNodeIds[0]!;
      }
    }

    throw new ValidationError(missingNodeMessage);
  }

  const nodeId = requestedNodeId ?? auth.node_id;
  if (!nodeId) {
    throw new ValidationError(missingNodeMessage);
  }

  if (nodeId !== auth.node_id) {
    throw new UnauthorizedError(unauthorizedMessage);
  }

  return nodeId;
}
