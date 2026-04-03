import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { PROTOCOL_NAME, PROTOCOL_VERSION, HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import { EvoMapError } from '../shared/errors';
import * as a2aService from './service';
import type { HelloPayload, HeartbeatPayload } from '../shared/types';

const HUB_NODE_ID = 'evomap-hub-001';

export async function a2aRoutes(app: FastifyInstance): Promise<void> {
  app.post('/hello', async (request, reply) => {
    const payload = request.body as HelloPayload;

    const result = await a2aService.registerNode(payload);

    const response = {
      status: 'acknowledged' as const,
      your_node_id: result.node_id,
      node_secret: result.node_secret,
      credit_balance: result.credit_balance,
      trust_level: result.trust_level,
      hub_node_id: HUB_NODE_ID,
      claim_code: result.claim_code,
      claim_url: `https://evomap.ai/claim/${result.claim_code}`,
      referral_code: result.referral_code,
      heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
      heartbeat_endpoint: '/a2a/heartbeat',
      protocol: PROTOCOL_NAME,
      protocol_version: PROTOCOL_VERSION,
    };

    void reply.status(201).send({
      success: true,
      data: response,
    });
  });

  app.post('/heartbeat', {
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const payload = request.body as HeartbeatPayload | undefined;

    const result = await a2aService.heartbeat(auth.node_id, payload);

    void reply.send({
      success: true,
      data: {
        status: 'ok' as const,
        your_node_id: result.your_node_id,
        next_heartbeat_in_ms: result.next_heartbeat_in_ms,
        network_stats: result.network_stats,
        protocol: PROTOCOL_NAME,
        protocol_version: PROTOCOL_VERSION,
      },
    });
  });

  app.get('/node/:nodeId', async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const nodeInfo = await a2aService.getNodeInfo(nodeId);

    void reply.send({
      success: true,
      data: nodeInfo,
    });
  });

  app.get('/stats', async (_request, reply) => {
    const stats = await a2aService.getNetworkStats();

    void reply.send({
      success: true,
      data: {
        ...stats,
        protocol: PROTOCOL_NAME,
        protocol_version: PROTOCOL_VERSION,
      },
    });
  });
}
