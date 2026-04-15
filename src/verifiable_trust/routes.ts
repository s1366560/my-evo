import type { FastifyInstance } from 'fastify';
import { requireAuth, requireNoActiveQuarantine, requireNodeSecretAuth } from '../shared/auth';
import { TRUST_REWARD_RATE } from '../shared/constants';
import * as trustService from './service';
import { ForbiddenError, TrustLevelError, ValidationError } from '../shared/errors';

function ensureNodeSecretAuth(
  auth: NonNullable<import('fastify').FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Node secret credentials are required for trust stake operations');
  }
}

export async function verifiableTrustRoutes(app: FastifyInstance): Promise<void> {
  app.post('/stake', {
    schema: { tags: ['Trust'] },
    preHandler: [requireNodeSecretAuth(), requireNoActiveQuarantine()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    if (auth.trust_level !== 'trusted') {
      throw new TrustLevelError('trusted', auth.trust_level);
    }
    const body = request.body as {
      node_id?: string;
      target_node_id?: string;
      amount?: number;
      stake_amount?: number;
      validator_id?: string;
    };
    const nodeId = body.target_node_id ?? body.node_id;
    const amount = body.stake_amount ?? body.amount;

    if (body.validator_id && body.validator_id !== auth.node_id) {
      throw new ValidationError('validator_id must match the authenticated validator');
    }
    if (!nodeId) {
      throw new ValidationError('target_node_id is required');
    }
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new ValidationError('stake_amount is required');
    }

    const result = await trustService.stake(
      nodeId,
      auth.node_id,
      amount,
    );

    return reply.send({
      success: true,
      stake_id: result.stake_id,
      attestation_id: result.attestation_id,
      trust_level: result.trust_level,
      locked_until: result.locked_until,
      data: result,
    });
  });

  app.post('/release', {
    schema: { tags: ['Trust'] },
    preHandler: [requireNodeSecretAuth(), requireNoActiveQuarantine()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const body = request.body as {
      stake_id: string;
    };

    const result = await trustService.release(body.stake_id, auth.node_id);

    return reply.send({
      success: true,
      status: result.status,
      amount_returned: result.amount_returned,
      penalty: result.penalty,
      trust_level: result.trust_level,
      data: result,
    });
  });

  app.post('/claim', {
    schema: { tags: ['Trust'] },
    preHandler: [requireNodeSecretAuth(), requireNoActiveQuarantine()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    const body = request.body as {
      stake_id: string;
    };

    const result = await trustService.claimReward(body.stake_id, auth.node_id);

    return reply.send({ success: true, data: result });
  });

  app.post('/verify', {
    schema: { tags: ['Trust'] },
    preHandler: [requireNodeSecretAuth(), requireNoActiveQuarantine()],
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureNodeSecretAuth(auth);
    if (auth.trust_level !== 'trusted') {
      throw new TrustLevelError('trusted', auth.trust_level);
    }
    const body = request.body as {
      target_node_id?: string;
      verification_notes?: string;
      verification_result?: string;
      evidence?: string;
      target_id?: string;
      notes?: string;
      validator_id?: string;
    };
    const targetId = body.target_node_id ?? body.target_id;
    if (body.validator_id && body.validator_id !== auth.node_id) {
      throw new ValidationError('validator_id must match the authenticated validator');
    }
    const notes = [
      body.verification_notes,
      body.evidence,
      body.notes,
      body.verification_result,
    ].filter((value): value is string => Boolean(value && value.trim())).join('\n');

    if (!targetId) {
      throw new ValidationError('target_node_id is required');
    }

    const verificationResult = body.verification_result?.trim().toLowerCase();
    if (verificationResult && !['pass', 'passed', 'approve', 'approved', 'fail', 'failed', 'reject', 'rejected'].includes(verificationResult)) {
      throw new ValidationError('verification_result must be pass or fail');
    }

    if (verificationResult === 'fail' || verificationResult === 'failed' || verificationResult === 'reject' || verificationResult === 'rejected') {
      const result = await trustService.failVerification(auth.node_id, targetId);
      return reply.send({
        success: true,
        status: result.status,
        stake_id: result.stake_id,
        amount_returned: result.amount_returned,
        penalty: result.penalty,
        trust_level: result.trust_level,
        data: result,
      });
    }

    const result = await trustService.verifyNode(
      auth.node_id,
      targetId,
      notes,
    );

    return reply.send({
      success: true,
      status: 'verified',
      attestation_id: result.attestation_id,
      reward_earned: Math.ceil(result.stake_amount * TRUST_REWARD_RATE),
      trust_level: result.trust_level,
      data: result,
    });
  });

  app.get('/level/:nodeId', {
    schema: { tags: ['Trust'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const result = await trustService.getTrustLevel(nodeId);

    return reply.send({
      success: true,
      ...result,
      data: result,
    });
  });

  app.get('/stats', {
    schema: { tags: ['Trust'] },
  }, async (_request, reply) => {
    const result = await trustService.getStats();

    return reply.send({
      success: true,
      ...result,
      data: result,
    });
  });

  app.get('/attestations', {
    schema: { tags: ['Trust'] },
  }, async (request, reply) => {
    const { node_id } = request.query as Record<string, string | undefined>;

    const result = await trustService.listAttestations(node_id);

    return reply.send({ success: true, data: result });
  });

  app.get('/pending', {
    schema: { tags: ['Trust'] },
  }, async (_request, reply) => {
    const result = await trustService.listPendingStakes();
    return reply.send({ success: true, data: result });
  });
}
