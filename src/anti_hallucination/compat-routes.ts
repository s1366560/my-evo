import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { requireNodeSecretAuth } from '../shared/auth';
import { resolveAuthorizedNodeId } from '../shared/node-access';
import { ForbiddenError, ValidationError } from '../shared/errors';
import * as antiHallucinationService from './service';

async function resolveCompatibilityNodeId(
  app: FastifyInstance,
  auth: NonNullable<FastifyRequest['auth']>,
) {
  return resolveAuthorizedNodeId(app, auth, {
    missingNodeMessage: 'No accessible node found for current credentials',
  });
}

function ensureNodeSecretAuth(
  auth: NonNullable<FastifyRequest['auth']>,
): void {
  if (auth.auth_type !== 'node_secret') {
    throw new ForbiddenError('Node secret credentials are required for verification checks');
  }
}

function buildCheckCompatibilityPayload(
  result: Awaited<ReturnType<typeof antiHallucinationService.performCheck>>,
) {
  const rawResult = result?.result && typeof result.result === 'object'
    ? result.result as Record<string, unknown>
    : {};
  const passed = typeof rawResult.passed === 'boolean'
    ? rawResult.passed
    : rawResult.has_hallucination === false || rawResult.checks_passed === true;
  const summary = typeof rawResult.summary === 'string'
    ? rawResult.summary
    : 'Check completed';
  const rawAlerts = Array.isArray(rawResult.alerts)
    ? rawResult.alerts
    : [];
  const detailMessages = Array.isArray(rawResult.details)
    ? rawResult.details.filter((detail): detail is string => typeof detail === 'string')
    : [];

  return {
    passed,
    confidence: result.confidence,
    validations: Array.isArray(rawResult.validations)
      ? rawResult.validations.map((validation) => {
        const rawValidation = validation as Record<string, unknown>;
        return {
          type: typeof rawValidation.type === 'string' ? rawValidation.type : result.validation_type ?? 'heuristic',
          passed: typeof rawValidation.passed === 'boolean' ? rawValidation.passed : passed,
          message: typeof rawValidation.message === 'string' ? rawValidation.message : summary,
        };
      })
      : [
        {
          type: result.validation_type ?? 'heuristic',
          passed,
          message: summary,
        },
      ],
    alerts: rawAlerts.map((alert) => {
      const rawAlert = alert as Record<string, unknown>;
      return {
        type: typeof rawAlert.type === 'string' ? rawAlert.type : 'heuristic_alert',
        level: typeof rawAlert.level === 'string' ? rawAlert.level : (passed ? 'L0' : 'L2'),
        message: typeof rawAlert.message === 'string' ? rawAlert.message : summary,
        suggestion: typeof rawAlert.suggestion === 'string' ? rawAlert.suggestion : null,
        line: typeof rawAlert.line === 'number' ? rawAlert.line : null,
        confidence: typeof rawAlert.confidence === 'number'
          ? rawAlert.confidence
          : result.confidence,
      };
    }),
    suggestions: Array.isArray(rawResult.suggestions)
      ? rawResult.suggestions.filter(
        (suggestion): suggestion is string => typeof suggestion === 'string',
      )
      : passed
        ? []
        : detailMessages.map((message) => `Review flagged issue: ${message}`),
    data: result,
  };
}

function resolveClaimContent(body: {
  claim?: string;
  code?: string;
  code_content?: string;
}) {
  return body.code_content ?? body.code ?? body.claim;
}

async function runClaimCheck(
  app: FastifyInstance,
  auth: NonNullable<FastifyRequest['auth']>,
  body: {
    claim?: string;
    code?: string;
    code_content?: string;
    asset_id?: string;
    language?: string;
    validation_type?: string;
    trust_anchors?: Array<{
      type: string;
      source: string;
      confidence: number;
    }>;
  },
) {
  ensureNodeSecretAuth(auth);
  const nodeId = await resolveCompatibilityNodeId(app, auth);
  const claimContent = resolveClaimContent(body);

  if (!claimContent) {
    throw new ValidationError('claim or code_content is required');
  }

  const result = await antiHallucinationService.performCheck(
    nodeId,
    claimContent,
    body.validation_type ?? 'claim',
    body.asset_id,
    body.language,
    body.trust_anchors,
  );

  return buildCheckCompatibilityPayload(result);
}

export async function antiHallucinationCompatibilityRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post('/claim', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = (request.body as Parameters<typeof runClaimCheck>[2] | undefined) ?? {};
    const payload = await runClaimCheck(app, auth, body);

    return reply.status(201).send({
      success: true,
      ...payload,
    });
  });

  app.post('/batch', {
    schema: { tags: ['AntiHallucination'] },
    preHandler: [requireNodeSecretAuth()],
  }, async (request, reply: FastifyReply) => {
    const auth = request.auth!;
    const body = (request.body as {
      claims?: Array<Parameters<typeof runClaimCheck>[2]>;
      items?: Array<Parameters<typeof runClaimCheck>[2]>;
    } | undefined) ?? {};
    const claims = body.claims ?? body.items ?? [];

    if (!Array.isArray(claims) || claims.length === 0) {
      throw new ValidationError('claims must contain at least one item');
    }

    const items = await Promise.all(
      claims.map((claim) => runClaimCheck(app, auth, claim)),
    );

    return reply.status(201).send({
      success: true,
      total: items.length,
      passed: items.filter((item) => item.passed).length,
      failed: items.filter((item) => !item.passed).length,
      items,
    });
  });

  app.get('/stats', {
    schema: { tags: ['AntiHallucination'] },
  }, async (_request, reply) => {
    const result = await antiHallucinationService.getCheckStats();
    return reply.send({ success: true, data: result });
  });
}
