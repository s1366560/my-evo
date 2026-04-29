// Node access authorization utilities
import type { FastifyInstance } from 'fastify';
import type { AuthContext } from './auth';

export interface NodeAccessOptions {
  missingNodeMessage?: string;
}

/**
 * Resolve authorized node ID from request authentication context
 */
export async function resolveAuthorizedNodeId(
  app: FastifyInstance,
  auth: AuthContext,
  options: NodeAccessOptions = {}
): Promise<string> {
  const { missingNodeMessage = 'No authorized node found' } = options;

  // If user has a node_id directly from auth
  if (auth.node_id) {
    return auth.node_id;
  }

  // If user has userId but no node_id, try to find associated node
  if (auth.userId) {
    try {
      const node = await app.prisma.node.findFirst({
        where: { user_id: auth.userId },
      });
      if (node) {
        return node.node_id;
      }
    } catch {
      // Continue to error
    }
  }

  throw new Error(missingNodeMessage);
}
