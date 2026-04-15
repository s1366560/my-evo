import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { ValidationError } from '../shared/errors';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import * as accountService from '../account/service';

function buildOnboardingJourneyPayload(result: Awaited<ReturnType<typeof accountService.getOnboardingJourney>>) {
  return {
    success: true,
    agent_id: result.agent_id,
    current_step: result.current_step,
    total_steps: result.total_steps,
    progress_percentage: result.progress_percentage,
    steps: result.steps,
    next_step: result.next_step,
    data: result,
  };
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/agent', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const { agent_id } = request.query as { agent_id?: string };
    const agentId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: agent_id,
      missingNodeMessage: 'No accessible agent found for current credentials',
      unauthorizedMessage: 'Cannot access onboarding for another agent',
    });

    const result = await accountService.getOnboardingJourney(agentId, app.prisma);
    return reply.send(buildOnboardingJourneyPayload(result));
  });

  app.post('/agent/complete', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as { agent_id?: string; step?: number } | undefined) ?? {};
    if (!body.step || !Number.isInteger(body.step) || body.step < 1) {
      throw new ValidationError('Valid step number is required');
    }

    accountService.getOnboardingStepDetail(body.step);
    const agentId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: body.agent_id,
      missingNodeMessage: 'No accessible agent found for current credentials',
      unauthorizedMessage: 'Cannot modify onboarding for another agent',
    });
    await accountService.completeOnboardingStep(agentId, body.step, app.prisma);
    const result = await accountService.getOnboardingJourney(agentId, app.prisma);
    return reply.send({
      ...buildOnboardingJourneyPayload(result),
      status: 'ok',
      completed_step: body.step,
      next_step: result.next_step?.step ?? null,
    });
  });

  app.post('/agent/reset', {
    schema: { tags: ['Account'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as { agent_id?: string } | undefined) ?? {};
    const agentId = await resolveAuthorizedNodeId(app, auth, {
      requestedNodeId: body.agent_id,
      missingNodeMessage: 'No accessible agent found for current credentials',
      unauthorizedMessage: 'Cannot modify onboarding for another agent',
    });

    await accountService.resetOnboarding(agentId, app.prisma);
    const result = await accountService.getOnboardingJourney(agentId, app.prisma);
    return reply.send({
      ...buildOnboardingJourneyPayload(result),
      status: 'ok',
      progress_percentage: result.progress_percentage,
    });
  });

  app.get('/agent/step/:step', {
    schema: { tags: ['Account'] },
  }, async (request, reply) => {
    const { step } = request.params as { step: string };
    const parsedStep = Number(step);
    if (!Number.isInteger(parsedStep) || parsedStep < 1) {
      throw new ValidationError('Valid step number is required');
    }

    const result = accountService.getOnboardingStepDetail(parsedStep);
    return reply.send({ success: true, data: result });
  });
}
