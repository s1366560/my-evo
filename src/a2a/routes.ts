import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requireAuth } from '../shared/auth';
import { PROTOCOL_NAME, PROTOCOL_VERSION, HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import {
  EvoMapError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../shared/errors';
import { getConfig } from '../shared/config';
import * as a2aService from './service';
import * as assetsService from './assets_service';
import { publishAsset } from '../assets/service';
import type { HelloPayload, HeartbeatPayload } from '../shared/types';

const HUB_NODE_ID = 'evomap-hub-001';
const PUBLISH_MESSAGE_MAX_AGE_MS = 15 * 60 * 1000;
const PUBLISH_MESSAGE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const DISPUTE_LIST_LIMIT_MAX = 100;
const DISPUTE_LIST_OFFSET_MAX = 10_000;
const PUBLISH_MESSAGE_ID_PATTERN = /^msg[-_][A-Za-z0-9][A-Za-z0-9._:-]*$/;
const ISO_8601_UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PROTOCOL_REQUIRED_FIELDS = [
  'protocol',
  'protocol_version',
  'message_type',
  'message_id',
  'sender_id',
  'timestamp',
  'payload',
] as const;

function getProtocolOverview() {
  return {
    hub_node_id: HUB_NODE_ID,
    protocol: PROTOCOL_NAME,
    protocol_version: PROTOCOL_VERSION,
    heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
    required_fields: [...PROTOCOL_REQUIRED_FIELDS],
    command_count: Object.keys(a2aService.COMMAND_DOCS).length,
  };
}

function getSchemaOverview() {
  return {
    ...getProtocolOverview(),
    envelope: {
      required_fields: [...PROTOCOL_REQUIRED_FIELDS],
      example: {
        protocol: PROTOCOL_NAME,
        protocol_version: PROTOCOL_VERSION,
        message_type: 'publish',
        message_id: 'msg_example_001',
        sender_id: 'node-example-001',
        timestamp: '2026-01-01T00:00:00.000Z',
        payload: {},
      },
    },
    commands: Object.entries(a2aService.COMMAND_DOCS).map(([command, doc]) => ({
      command,
      path: doc.related_endpoints?.[0] ?? `/a2a/${command}`,
      methods: doc.methods,
      category: doc.category,
      auth_required: doc.auth_required,
      envelope_required: doc.envelope_required,
      description: doc.description,
    })),
  };
}

function assertPublishEnvelope(
  body: {
    protocol?: string;
    protocol_version?: string;
    message_type?: string;
    message_id?: string;
    sender_id?: string;
    timestamp?: string;
    payload?: unknown;
  },
  authenticatedNodeId: string,
): void {
  if (!body.protocol || typeof body.protocol !== 'string') {
    throw new EvoMapError('protocol field is required', 'VALIDATION_ERROR', 400);
  }
  if (body.protocol !== PROTOCOL_NAME) {
    throw new EvoMapError(`protocol must be "${PROTOCOL_NAME}"`, 'VALIDATION_ERROR', 400);
  }
  if (!body.protocol_version || typeof body.protocol_version !== 'string') {
    throw new EvoMapError('protocol_version field is required', 'VALIDATION_ERROR', 400);
  }
  if (body.protocol_version !== PROTOCOL_VERSION) {
    throw new EvoMapError(`protocol_version must be "${PROTOCOL_VERSION}"`, 'VALIDATION_ERROR', 400);
  }
  if (!body.message_id || typeof body.message_id !== 'string') {
    throw new EvoMapError('message_id field is required', 'VALIDATION_ERROR', 400);
  }
  if (!PUBLISH_MESSAGE_ID_PATTERN.test(body.message_id)) {
    throw new EvoMapError('message_id must start with "msg_" or "msg-" and contain only safe characters', 'VALIDATION_ERROR', 400);
  }
  if (body.message_type !== 'publish') {
    throw new EvoMapError('message_type must be "publish"', 'VALIDATION_ERROR', 400);
  }
  if (!body.sender_id || typeof body.sender_id !== 'string') {
    throw new EvoMapError('sender_id field is required', 'VALIDATION_ERROR', 400);
  }
  if (body.sender_id !== authenticatedNodeId) {
    throw new ForbiddenError('sender_id must match authenticated node');
  }
  if (!body.timestamp || typeof body.timestamp !== 'string') {
    throw new EvoMapError('timestamp field is required', 'VALIDATION_ERROR', 400);
  }
  if (!ISO_8601_UTC_TIMESTAMP_PATTERN.test(body.timestamp)) {
    throw new EvoMapError('timestamp must be a valid UTC ISO-8601 string', 'VALIDATION_ERROR', 400);
  }

  const timestampMs = Date.parse(body.timestamp);
  if (Number.isNaN(timestampMs)) {
    throw new EvoMapError('timestamp must be a valid UTC ISO-8601 string', 'VALIDATION_ERROR', 400);
  }
  const now = Date.now();
  if (
    timestampMs < now - PUBLISH_MESSAGE_MAX_AGE_MS
    || timestampMs > now + PUBLISH_MESSAGE_MAX_FUTURE_SKEW_MS
  ) {
    throw new EvoMapError('timestamp is outside the accepted freshness window', 'VALIDATION_ERROR', 400);
  }

  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
    throw new EvoMapError('payload must be an object', 'VALIDATION_ERROR', 400);
  }
}

function parseDisputeOffset(value?: string): number {
  if (value === undefined) {
    return 0;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError('offset must be a non-negative integer');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ValidationError('offset must be a non-negative integer');
  }
  if (parsed > DISPUTE_LIST_OFFSET_MAX) {
    throw new ValidationError(`offset must be less than or equal to ${DISPUTE_LIST_OFFSET_MAX}`);
  }

  return parsed;
}

function parseDisputeLimit(value?: string): number {
  if (value === undefined) {
    return 20;
  }

  if (!/^\d+$/.test(value)) {
    throw new ValidationError('limit must be a positive integer');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError('limit must be a positive integer');
  }

  return Math.min(parsed, DISPUTE_LIST_LIMIT_MAX);
}

function parseIntegerQuery(
  value: string | number | undefined,
  field: string,
  fallback: number,
  minimum: number,
  maximum?: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || (maximum !== undefined && parsed > maximum)) {
    const rangeSuffix = maximum !== undefined ? ` between ${minimum} and ${maximum}` : ` >= ${minimum}`;
    throw new ValidationError(`${field} must be an integer${rangeSuffix}`);
  }

  return parsed;
}

function canViewRawDisputeEvidence(
  viewer: { node_id: string; scopes?: readonly string[] },
  dispute: {
    plaintiff_id?: string | null;
    defendant_id?: string | null;
    arbitrators?: unknown;
  },
): boolean {
  if (viewer.scopes?.includes('disputes:read:any') === true) {
    return true;
  }

  const arbitrators = Array.isArray(dispute.arbitrators)
    ? dispute.arbitrators.filter((value): value is string => typeof value === 'string')
    : [];

  return (
    viewer.node_id === dispute.plaintiff_id
    || viewer.node_id === dispute.defendant_id
    || arbitrators.includes(viewer.node_id)
  );
}

function ensureDisputeWriteAuth(auth: { auth_type?: string } | undefined): void {
  if (!auth) {
    throw new ForbiddenError('Authentication is required');
  }

  if (auth.auth_type === 'api_key') {
    throw new ForbiddenError('API keys cannot create disputes');
  }
}

export async function a2aRoutes(app: FastifyInstance): Promise<void> {
  const SERVICE_STATUSES = ['active', 'paused', 'archived'] as const;
  const prisma = app.prisma;

  async function getOptionalAuth(request: FastifyRequest) {
    const hasCredentials = Boolean(
      request.headers.authorization
      || request.cookies?.session_token
      || request.headers['x-session-token'],
    );

    if (!hasCredentials) {
      return undefined;
    }

    try {
      return await authenticate(request);
    } catch {
      return undefined;
    }
  }

  async function getServiceMarketplaceModule() {
    return import('../marketplace/service.marketplace');
  }

  async function getSkillStoreModule() {
    return import('../skill_store/service');
  }

  async function getSessionModule() {
    return import('../session/service');
  }

  async function getSearchModule() {
    return import('../search/service');
  }

  async function getTaskModule() {
    return import('../task/service');
  }

  function ensureTaskNodeIdMatches(
    authenticatedNodeId: string,
    providedNodeId: string | undefined,
  ): void {
    if (providedNodeId !== undefined && providedNodeId !== authenticatedNodeId) {
      throw new ForbiddenError('node_id must match authenticated node');
    }
  }

  function parseCompositeTaskId(taskId: string): [string, string] {
    const parts = taskId.split(':');
    if (parts.length !== 2) {
      throw new ValidationError('Invalid task_id format, expected projectId:taskId');
    }
    return parts as [string, string];
  }

  function parseTaskListNumber(
    value: string | undefined,
    field: 'limit' | 'offset',
    fallback: number,
  ): number {
    if (value === undefined) {
      return fallback;
    }
    if (!/^\d+$/.test(value)) {
      throw new ValidationError(`${field} must be a non-negative integer`);
    }
    const parsed = Number.parseInt(value, 10);
    if (field === 'limit' && parsed < 1) {
      throw new ValidationError('limit must be a positive integer');
    }
    return parsed;
  }

  function requireMarketplaceNodeId(nodeId: string): string {
    if (!nodeId || nodeId.startsWith('user-')) {
      throw new ForbiddenError('Marketplace A2A routes require a node-backed identity');
    }
    return nodeId;
  }

  function toA2AAssetSearchResult(asset: Record<string, unknown>) {
    return {
      asset_id: asset.asset_id,
      asset_type: asset.asset_type,
      name: asset.name,
      description: asset.description,
      signals: asset.signals,
      tags: asset.tags,
      author_id: asset.author_id,
      gdi_score: asset.gdi_score,
      downloads: asset.downloads,
      rating: asset.rating,
      created_at: asset.created_at instanceof Date ? asset.created_at.toISOString() : asset.created_at,
      updated_at: asset.updated_at instanceof Date ? asset.updated_at.toISOString() : asset.updated_at,
    };
  }

  app.post('/hello', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
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
      claim_url: `${getConfig().baseUrl}/claim/${result.claim_code}`,
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
    schema: { tags: ['A2A'] },
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
        heartbeat_interval_ms: result.heartbeat_interval_ms,
        network_stats: result.network_stats,
        protocol: PROTOCOL_NAME,
        protocol_version: PROTOCOL_VERSION,
      },
    });
  });

  app.get('/node/:nodeId', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };

    const nodeInfo = await a2aService.getNodeInfo(nodeId);

    void reply.send({
      success: true,
      data: nodeInfo,
    });
  });

  app.get('/stats', {
    schema: { tags: ['A2A'] },
  }, async (_request, reply) => {
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

  // POST /a2a/validate — bundle dry-run validation
  app.post('/validate', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const body = request.body as { assets: Array<Record<string, unknown>> };
    const result = await a2aService.validateBundle({ assets: body.assets ?? [] });

    void reply.send({
      success: true,
      data: result,
    });
  });

  // POST /a2a/publish — submit Gene + Capsule + EvolutionEvent bundle
  // Protocol envelope: { protocol, protocol_version, message_type, sender_id, timestamp, payload: { assets } }
  // Adapts protocol format -> assets service PublishPayload
  app.post('/publish', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      protocol?: string;
      protocol_version?: string;
      message_type?: string;
      message_id?: string;
      sender_id?: string;
      timestamp?: string;
      payload?: {
        assets?: Array<Record<string, unknown>>;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };

    assertPublishEnvelope(body, auth.node_id);

    const assets = body.payload?.assets;
    if (!assets || assets.length === 0) {
      throw new EvoMapError('payload.assets is required and must not be empty', 'VALIDATION_ERROR', 400);
    }

    const geneAsset = assets.find((a) => a['type'] === 'Gene');
    if (!geneAsset) {
      throw new EvoMapError('Bundle must contain a Gene asset', 'VALIDATION_ERROR', 400);
    }

    const assetId = String(geneAsset['asset_id'] ?? '');
    if (!assetId.startsWith('sha256:')) {
      throw new EvoMapError('Gene.asset_id must start with "sha256:"', 'VALIDATION_ERROR', 400);
    }

    const category = String(geneAsset['category'] ?? '');
    const signalsMatch = Array.isArray(geneAsset['signals_match']) ? geneAsset['signals_match'] as string[] : [];
    const signals = category ? [category, ...signalsMatch] : signalsMatch;

    const publishPayload = {
      sender_id: auth.node_id,
      source_message_id: body.message_id,
      asset_type: (String(geneAsset['type'] ?? 'Gene').toLowerCase()) as 'gene' | 'capsule' | 'recipe',
      name: String(geneAsset['summary'] ?? assetId),
      description: String(geneAsset['summary'] ?? ''),
      content: String(geneAsset['content'] ?? ''),
      signals,
      gene_ids: assets
        .filter((a) => a['asset_id'] && String(a['asset_id']).startsWith('sha256:'))
        .map((a) => String(a['asset_id'])),
    };

    const result = await publishAsset(auth.node_id, publishPayload);

    void reply.status(201).send({
      success: true,
      data: {
        status: result.status,
        asset_id: result.asset_id,
        asset_type: result.asset_type,
        gdi_score: result.gdi_score,
        carbon_cost: result.carbon_cost,
        similarity_check: result.similarity_check,
        validated_assets: assets.length,
      },
    });
  });

  // GET /a2a/assets — list assets with optional filters
  app.get('/assets', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { status, type, author_id, limit, offset } = request.query as Record<string, string | undefined>;
    const requestedStatus = status?.trim();
    const isPublicStatus = !requestedStatus || requestedStatus === 'published' || requestedStatus === 'promoted';
    const auth = isPublicStatus ? undefined : await authenticate(request);
    const effectiveAuthorId = isPublicStatus ? author_id : auth!.node_id;

    const result = await a2aService.listAssets({
      status: requestedStatus,
      type,
      author_id: effectiveAuthorId,
      requester_node_id: auth?.node_id,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    void reply.send({
      success: true,
      data: result.assets,
      meta: { total: result.total },
    });
  });

  // POST /a2a/fetch — fetch one or more assets by ID
  app.post('/fetch', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      asset_ids?: string[];
      search_only?: boolean;
    };

    // search_only=true: returns metadata only, free, no asset_ids required
    // search_only=false/undefined: requires asset_ids, deducts credits
    if (body.search_only && body.asset_ids && body.asset_ids.length > 0) {
      throw new EvoMapError('asset_ids must not be provided when search_only is true', 'VALIDATION_ERROR', 400);
    }
    if (!body.search_only && (!body.asset_ids || body.asset_ids.length === 0)) {
      throw new EvoMapError('asset_ids is required when search_only is false', 'VALIDATION_ERROR', 400);
    }

    const result = await a2aService.fetchAssets(auth.node_id, {
      asset_ids: body.asset_ids && body.asset_ids.length > 0 ? body.asset_ids : undefined,
      search_only: body.search_only,
    });

    void reply.send({
      success: true,
      data: result.assets,
      meta: { total_cost: result.total_cost },
    });
  });

  // GET /a2a/help — Hub info and available commands
  app.get('/help', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { q, method, type } = request.query as { q?: string; method?: string; type?: string };
    const response = a2aService.getHelpResponse({ q, method, type });

    void reply.send({ success: true, data: response });
  });

  app.get('/protocol', {
    schema: { tags: ['A2A'] },
  }, async (_request, reply) => {
    void reply.send({ success: true, data: getProtocolOverview() });
  });

  app.get('/schema', {
    schema: { tags: ['A2A'] },
  }, async (_request, reply) => {
    void reply.send({ success: true, data: getSchemaOverview() });
  });

  // POST /a2a/directory — register node in Hub directory
  app.post('/directory', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { specialties?: string[] };

    const entry = await a2aService.registerInDirectory(auth.node_id, body.specialties ?? []);

    void reply.send({
      success: true,
      data: entry,
    });
  });

  // POST /a2a/dm — send direct message to another node
  app.post('/dm', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      sender_id?: string;
      recipient_id?: string;
      to_id?: string;
      content?: string;
    };
    const recipientId = body.recipient_id ?? body.to_id;

    if (body.sender_id && body.sender_id !== auth.node_id) {
      throw new ForbiddenError('sender_id must match the authenticated node');
    }

    if (!recipientId || !body.content) {
      throw new ValidationError('recipient_id (or to_id) and content are required');
    }

    const result = await a2aService.sendDm(auth.node_id, recipientId, body.content);

    void reply.send({
      success: true,
      data: result,
    });
  });

  // POST /a2a/report — report asset or node
  app.post('/report', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { target_id: string; reason: string };

    if (!body.target_id || !body.reason) {
      throw new ValidationError('target_id and reason are required');
    }

    const result = await a2aService.submitReport(
      auth.node_id,
      body.target_id,
      body.reason as a2aService.SubmitReportResult['reason'],
    );

    void reply.send({
      success: true,
      data: result,
    });
  });

  // ---------------------------------------------------------------------------
  // Aliases for /a2a/bid/* (delegates to /api/v2/bounty)
  // ---------------------------------------------------------------------------

  // POST /a2a/bid/place — create a bid request (self-bounty)
  app.post('/bid/place', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = ((request.body as {
      amount: number;
      estimatedTime: string;
      approach: string;
    } | undefined) ?? {}) as {
      amount: number;
      estimatedTime: string;
      approach: string;
    };
    if (!body.amount || !body.estimatedTime || !body.approach) {
      throw new EvoMapError('amount, estimatedTime, and approach are required', 'VALIDATION_ERROR', 400);
    }
    const { createBounty } = await import('../bounty/service');
    const bounty = await createBounty(
      auth.node_id,
      `Bid Request: ${body.approach.slice(0, 80)}`,
      body.approach,
      [],
      body.amount,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    return reply.status(201).send({ success: true, data: { bounty, bid: null } });
  });

  app.post('/bid/:bountyId', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { bountyId } = request.params as { bountyId: string };
    const body = ((request.body as {
      proposedAmount: number;
      estimatedTime: string;
      approach: string;
    } | undefined) ?? {}) as {
      proposedAmount: number;
      estimatedTime: string;
      approach: string;
    };
    if (!body.proposedAmount || !body.estimatedTime || !body.approach) {
      throw new EvoMapError('proposedAmount, estimatedTime, and approach are required', 'VALIDATION_ERROR', 400);
    }
    const { placeBid } = await import('../bounty/service');
    const bid = await placeBid(bountyId, auth.node_id, body.proposedAmount, body.estimatedTime, body.approach);
    return reply.send({ success: true, data: bid });
  });

  // GET /a2a/bid/list — list bids for the authenticated node
  app.get('/bid/list', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const { listBids } = await import('../bounty/service');
    const bids = await listBids(auth.node_id);
    return { success: true, data: bids };
  });

  // POST /a2a/bid/withdraw — withdraw a bid
  app.post('/bid/withdraw', {
    schema: {
      tags: ['Bounty'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['bid_id'],
        properties: {
          bid_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as { bid_id: string };
    const { withdrawBid } = await import('../bounty/service');
    const bid = await withdrawBid(body.bid_id, auth.node_id);
    return { success: true, data: bid };
  });

  // ---------------------------------------------------------------------------
  // Alias: POST /a2a/ask — publish a bounty (delegates to bounty service)
  // ---------------------------------------------------------------------------
  app.post('/ask', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = ((request.body as {
      title: string;
      description: string;
      requirements?: string[];
      amount: number;
      deadline: string;
    } | undefined) ?? {}) as {
      title: string;
      description: string;
      requirements?: string[];
      amount: number;
      deadline: string;
    };
    if (!body.title || !body.description || !body.amount || !body.deadline) {
      throw new EvoMapError('title, description, amount, and deadline are required', 'VALIDATION_ERROR', 400);
    }
    const { createBounty } = await import('../bounty/service');
    const bounty = await createBounty(
      auth.node_id,
      body.title,
      body.description,
      body.requirements ?? [],
      body.amount,
      body.deadline,
    );
    return reply.status(201).send({ success: true, data: bounty });
  });

  // ---------------------------------------------------------------------------
  // Alias: POST /a2a/dispute/open — file a dispute (delegates to dispute service)
  // ---------------------------------------------------------------------------
  app.post('/dispute/open', {
    schema: { tags: ['Disputes'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    ensureDisputeWriteAuth(auth);
    const body = request.body as {
      type: string;
      defendant_id: string;
      title: string;
      description: string;
      evidence?: unknown[];
      related_asset_id?: string;
      related_bounty_id?: string;
      related_transaction_id?: string;
      filing_fee?: number;
    };
    if (!body.type || !body.defendant_id || !body.title || !body.description) {
      throw new EvoMapError('type, defendant_id, title, and description are required', 'VALIDATION_ERROR', 400);
    }
    const { fileDispute } = await import('../dispute/service');
    const dispute = await fileDispute(auth.node_id, {
      type: body.type,
      defendant_id: body.defendant_id,
      title: body.title,
      description: body.description,
      evidence: body.evidence ?? [],
      related_asset_id: body.related_asset_id,
      related_bounty_id: body.related_bounty_id,
      related_transaction_id: body.related_transaction_id,
      filing_fee: body.filing_fee,
    });
    return reply.status(201).send({ success: true, data: dispute });
  });

  // ---------------------------------------------------------------------------
  // Skill documentation routes under /a2a
  // ---------------------------------------------------------------------------
  app.get('/skill', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    const base = getConfig().baseUrl;
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Hub Skill Documentation',
        description: 'AI Agent self-evolution infrastructure — skill reference',
        api_base: `${base}/a2a`,
        endpoints: {
          list: 'GET /a2a/skill',
          search: 'GET /a2a/skill/search?q=...',
          categories: 'GET /a2a/skill/categories',
          featured: 'GET /a2a/skill/featured',
          detail: 'GET /a2a/skill/:skillId',
          publish: 'POST /a2a/skill/:skillId/publish',
          rate: 'POST /a2a/skill/:skillId/rate',
          download: 'POST /a2a/skill/:skillId/download',
        },
        docs: `${base}/skill.md`,
      },
    });
  });

  app.get('/skill/search', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { q, category, tags, limit, offset, sort } = request.query as Record<string, string | string[] | undefined>;
    const { listSkills } = await import('../skill_store/service');
    const parsedLimit = limit ? Math.min(Number(limit), 100) : 20;
    const parsedOffset = offset ? Number(offset) : 0;
    const parsedTags: string[] | undefined = Array.isArray(tags)
      ? (tags as string[])
      : tags
        ? [tags as string]
        : undefined;
    const result = await listSkills(
      category as string | undefined,
      parsedTags,
      q as string | undefined,
      parsedLimit,
      parsedOffset,
      sort as string | undefined,
      app.prisma,
    );
    return reply.send({ success: true, data: result });
  });

  // POST /a2a/skill/search — search skills via POST body
  app.post('/skill/search', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const body = request.body as {
      q?: string;
      category?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
      sort?: string;
    };
    const { listSkills } = await import('../skill_store/service');
    const result = await listSkills(
      body.category,
      body.tags,
      body.q,
      Math.min(body.limit ?? 20, 100),
      body.offset ?? 0,
      body.sort,
      app.prisma,
    );
    return reply.send({ success: true, data: result });
  });

  app.get('/skill/categories', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { getCategories } = await import('../skill_store/service');
    const result = await getCategories(app.prisma);
    return reply.send({ success: true, data: result });
  });

  app.get('/skill/featured', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const { getFeaturedSkills } = await import('../skill_store/service');
    const parsedLimit = limit ? Math.min(Number(limit), 20) : 10;
    const result = await getFeaturedSkills(parsedLimit, app.prisma);
    return reply.send({ success: true, data: result });
  });

  // POST /a2a/skill/:skillId/rate — rate a skill
  app.post('/skill/:skillId/rate', {
    schema: {
      tags: ['SkillStore'],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rating: { type: 'integer', minimum: 1, maximum: 5 },
        },
        required: ['rating'],
      },
    },
    preValidation: async (request) => {
      const body = request.body as Record<string, unknown> | undefined;
      if (body) {
        const unsupportedKeys = Object.keys(body).filter((key) => key !== 'rating');
        if (unsupportedKeys.length > 0) {
          throw new ValidationError(`Unsupported fields: ${unsupportedKeys.join(', ')}`);
        }
      }
    },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { skillId: string };
    const body = request.body as { rating: number };
    const skillStore = await getSkillStoreModule();
    const result = await skillStore.rateSkill(params.skillId, auth.node_id, body.rating, app.prisma);
    return {
      success: true,
      data: {
        skill_id: result.skill_id,
        rating: result.rating,
        rated_by: result.rater_id,
        rated_at: result.created_at.toISOString(),
      },
    };
  });

  // POST /a2a/skill/:skillId/download — download a skill bundle
  app.post('/skill/:skillId/download', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { skillId: string };
    const skillStore = await getSkillStoreModule();
    const result = await skillStore.downloadSkill(params.skillId, auth.node_id, app.prisma);
    return {
      success: true,
      data: {
        skill_id: result.skill_id,
        download_count: result.download_count,
        downloaded_at: new Date().toISOString(),
        skill: result,
      },
    };
  });

  // POST /a2a/skill/:skillId/publish — publish a skill
  app.post('/skill/:skillId/publish', {
    schema: {
      tags: ['SkillStore'],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string' },
          price: { type: 'integer', minimum: 0 },
        },
      },
    },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { skillId: string };
    const body = (request.body as { category?: string; price?: number } | undefined) ?? {};
    const skillStore = await getSkillStoreModule();
    const result = await skillStore.publishSkillWithUpdates(params.skillId, auth.node_id, {
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.price !== undefined ? { price_credits: body.price } : {}),
    }, app.prisma);
    return {
      success: true,
      data: {
        skill_id: result.skill_id,
        status: result.status,
        published_by: auth.node_id,
        published_at: result.updated_at.toISOString(),
        category: result.category,
        price: result.price_credits,
        skill: result,
      },
    };
  });

  app.get('/skill/:skillId', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { skillId } = request.params as { skillId: string };
    const { getSkill } = await import('../skill_store/service');
    const result = await getSkill(skillId, app.prisma);
    if (!result) {
      throw new NotFoundError('Skill', skillId);
    }
    return reply.send({ success: true, data: result });
  });

  // ---------------------------------------------------------------------------
  // /a2a/service/* — service marketplace routes
  // ---------------------------------------------------------------------------

  // GET /a2a/service/list — list available services
  app.get('/service/list', {
    schema: {
      tags: ['Marketplace'],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as { category?: string; limit?: string | number; offset?: string | number };
    const limit = parseIntegerQuery(query.limit, 'limit', 20, 1, 100);
    const offset = parseIntegerQuery(query.offset, 'offset', 0, 0);
    const serviceMarketplace = await getServiceMarketplaceModule();
    const result = await serviceMarketplace.searchServiceListings({
      category: query.category,
      limit,
      offset,
    }, app.prisma);
    return reply.send({ success: true, data: result.items, meta: { total: result.total } });
  });

  // POST /a2a/service/search — search services
  app.get('/service/search', {
    schema: {
      tags: ['Marketplace'],
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string' },
          category: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { q?: string; category?: string; limit?: string | number; offset?: string | number };
    const limit = query.limit === undefined ? undefined : parseIntegerQuery(query.limit, 'limit', 20, 1, 100);
    const offset = query.offset === undefined ? undefined : parseIntegerQuery(query.offset, 'offset', 0, 0);
    const serviceMarketplace = await getServiceMarketplaceModule();
    const result = await serviceMarketplace.searchServiceListings({
      query: query.q,
      category: query.category,
      limit,
      offset,
    }, app.prisma);
    return { success: true, data: result };
  });

  app.post('/service/search', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          query: { type: 'string' },
          q: { type: 'string' },
          category: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          offset: { type: 'integer', minimum: 0 },
          sender_id: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const body = request.body as { query?: string; q?: string; category?: string; limit?: number; offset?: number };
    const serviceMarketplace = await getServiceMarketplaceModule();
    const result = await serviceMarketplace.searchServiceListings({
      query: body.query ?? body.q,
      category: body.category,
      limit: body.limit,
      offset: body.offset,
    }, app.prisma);
    return { success: true, data: result };
  });

  // POST /a2a/service/publish — publish a service
  app.post('/service/publish', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['title', 'description', 'category'],
        additionalProperties: false,
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          price: { type: 'number', minimum: 0 },
          price_per_task: { type: 'number', minimum: 0 },
          category: { type: 'string', minLength: 1 },
          tags: { type: 'array', items: { type: 'string' } },
          sender_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const sellerId = requireMarketplaceNodeId(auth.node_id);
    const body = request.body as {
      title: string;
      description: string;
      price?: number;
      price_per_task?: number;
      category: string;
      tags?: string[];
    };
    const price = body.price_per_task ?? body.price ?? 0;
    const serviceMarketplace = await getServiceMarketplaceModule();
    const listing = await serviceMarketplace.createServiceListing(sellerId, {
      title: body.title,
      description: body.description,
      category: body.category,
      tags: body.tags ?? [],
      price_type: price > 0 ? 'one_time' : 'free',
      price_credits: price > 0 ? price : 0,
      license_type: 'open_source',
    }, app.prisma);
    return {
      success: true,
      data: {
        service_id: listing.listing_id,
        status: listing.status,
        listing,
      },
    };
  });

  // POST /a2a/service/order — order a service
  app.post('/service/order', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          service_id: { type: 'string', minLength: 1 },
          listing_id: { type: 'string', minLength: 1 },
          sender_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const buyerId = requireMarketplaceNodeId(auth.node_id);
    const body = (request.body as { service_id?: string; listing_id?: string } | undefined) ?? {};
    const listingId = body.listing_id ?? body.service_id;
    if (!listingId) {
      throw new EvoMapError('service_id is required', 'VALIDATION_ERROR', 400);
    }
    const serviceMarketplace = await getServiceMarketplaceModule();
    const purchase = await serviceMarketplace.purchaseService(buyerId, listingId, app.prisma);
    return {
      success: true,
      data: {
        order_id: purchase.purchase_id,
        service_id: purchase.listing_id,
        status: purchase.status,
        purchase,
      },
    };
  });

  // POST /a2a/service/rate — rate a service
  app.post('/service/rate', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        required: ['rating'],
        additionalProperties: false,
        properties: {
          service_id: { type: 'string', minLength: 1 },
          listing_id: { type: 'string', minLength: 1 },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          review: { type: 'string' },
          comment: { type: 'string' },
          sender_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const buyerId = requireMarketplaceNodeId(auth.node_id);
    const body = ((request.body as {
      service_id?: string;
      listing_id?: string;
      rating: number;
      review?: string;
      comment?: string;
    } | undefined) ?? {}) as {
      service_id?: string;
      listing_id?: string;
      rating: number;
      review?: string;
      comment?: string;
    };
    const listingId = body.listing_id ?? body.service_id;
    if (!listingId) {
      throw new EvoMapError('service_id is required', 'VALIDATION_ERROR', 400);
    }
    const serviceMarketplace = await getServiceMarketplaceModule();
    const result = await serviceMarketplace.rateService(
      buyerId,
      listingId,
      body.rating,
      body.comment ?? body.review,
      app.prisma,
    );
    return {
      success: true,
      data: {
        rated: true,
        review_id: result.review_id,
        rating: result.rating,
      },
    };
  });

  // POST /a2a/service/update — update a service listing
  app.post('/service/update', {
    schema: {
      tags: ['Marketplace'],
      body: {
        type: 'object',
        additionalProperties: false,
        properties: {
          service_id: { type: 'string', minLength: 1 },
          listing_id: { type: 'string', minLength: 1 },
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          price: { type: 'number', minimum: 0 },
          price_per_task: { type: 'number', minimum: 0 },
          status: { type: 'string', enum: [...SERVICE_STATUSES] },
          sender_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const sellerId = requireMarketplaceNodeId(auth.node_id);
    const body = ((request.body as {
      service_id?: string;
      listing_id?: string;
      title?: string;
      description?: string;
      price?: number;
      price_per_task?: number;
      status?: string;
    } | undefined) ?? {}) as {
      service_id?: string;
      listing_id?: string;
      title?: string;
      description?: string;
      price?: number;
      price_per_task?: number;
      status?: string;
    };
    const listingId = body.listing_id ?? body.service_id;
    if (!listingId) {
      throw new EvoMapError('service_id is required', 'VALIDATION_ERROR', 400);
    }
    const serviceMarketplace = await getServiceMarketplaceModule();
    const listing = await serviceMarketplace.updateServiceListing(sellerId, listingId, {
      title: body.title,
      description: body.description,
      price_credits: body.price_per_task ?? body.price,
      status: body.status,
    }, app.prisma);
    return {
      success: true,
      data: {
        service_id: listing.listing_id,
        updated: true,
        status: listing.status,
        listing,
      },
    };
  });

  // ---------------------------------------------------------------------------
  // /a2a/assets/search — semantic asset search
  // ---------------------------------------------------------------------------
  app.get('/assets/search', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { q, type, status, sort, limit, offset } = request.query as Record<string, string | undefined>;
    if (!q) {
      throw new ValidationError('q (query) is required');
    }
    const parsedLimit = limit ? Number(limit) : 20;
    const parsedOffset = offset ? Number(offset) : 0;
    const requestedStatus = status?.trim();

    const isPublicStatus = !requestedStatus
      || requestedStatus === 'published'
      || requestedStatus === 'promoted';

    if (isPublicStatus) {
      const searchService = await getSearchModule();
      const result = await searchService.search({
        q,
        type: type as 'gene' | 'capsule' | 'skill' | undefined,
        status: requestedStatus as 'published' | 'promoted' | undefined,
        sort_by: sort as 'relevance' | 'gdi' | 'downloads' | 'rating' | 'newest' | undefined,
        limit: parsedLimit,
        offset: parsedOffset,
      }, app.prisma);
      return reply.send({
        success: true,
        data: result.items.map((item) => ({
          ...toA2AAssetSearchResult({
            asset_id: item.id,
            asset_type: item.type,
            name: item.name,
            description: item.description,
            signals: item.signals,
            tags: item.tags,
            author_id: item.author_id,
            gdi_score: item.gdi_score,
            downloads: item.downloads,
            rating: item.rating,
            created_at: item.created_at,
            updated_at: item.updated_at,
            }),
        })),
        meta: {
          total: result.total,
          query: q,
          facets: result.facets,
          query_time_ms: result.query_time_ms,
        },
      });
    }

    const auth = await authenticate(request);
    const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma!;
    const where: Record<string, unknown> = {
      status: requestedStatus,
      author_id: auth.node_id,
      ...(type ? { asset_type: type } : {}),
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { author_id: { contains: q, mode: 'insensitive' } },
        { signals: { has: q } },
        { tags: { has: q } },
      ],
    };
    const privateOrderBy: Record<string, 'desc'> =
      sort === 'gdi'
        ? { gdi_score: 'desc' }
        : sort === 'downloads'
          ? { downloads: 'desc' }
          : sort === 'rating'
            ? { rating: 'desc' }
            : { updated_at: 'desc' };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: privateOrderBy,
        take: parsedLimit,
        skip: parsedOffset,
      }),
      prisma.asset.count({ where }),
    ]);

    return reply.send({
      success: true,
      data: assets.map((asset) => toA2AAssetSearchResult(asset as unknown as Record<string, unknown>)),
      meta: { total, query: q },
    });
  });

  // ---------------------------------------------------------------------------
  // /a2a/assets/ranked — ranked assets leaderboard
  // ---------------------------------------------------------------------------
  app.get('/assets/ranked', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { type, limit, offset } = request.query as Record<string, string | undefined>;
    const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma;
    const take = limit ? Math.min(Number(limit), 50) : 20;
    const skip = offset ? Number(offset) : 0;
    const where: Record<string, unknown> = { status: 'published' };
    if (type) {
      where.asset_type = type;
    }

    const [ranked, total] = await Promise.all([
      prisma!.asset.findMany({
        where,
        orderBy: [{ gdi_score: 'desc' }, { updated_at: 'desc' }],
        take,
        skip,
      }),
      prisma!.asset.count({ where }),
    ]);

    return reply.send({ success: true, data: ranked.map((asset) => assetsService.toPublicAsset(asset)), meta: { total } });
  });

  // ---------------------------------------------------------------------------
  // /a2a/directory — list registered nodes
  // ---------------------------------------------------------------------------
  app.get('/directory', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { q, specialty, available, limit, offset } = request.query as Record<string, string | undefined>;
    const { listWorkers } = await import('../workerpool/service');
    const result = await listWorkers({
      q: q ?? undefined,
      skill: specialty,
      available: available === 'true' ? true : available === 'false' ? false : undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    return reply.send({
      success: true,
      data: result.workers.map((w: Record<string, unknown>) => ({
        node_id: w.node_id,
        specialties: w.specialties,
        is_available: w.is_available,
        success_rate: w.success_rate,
      })),
      meta: { total: result.total, limit: result.limit, offset: result.offset },
    });
  });

  app.get('/directory/stats', {
    schema: { tags: ['A2A'] },
  }, async (_request, reply) => {
    const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma;

    const [totalAgents, online, workers] = await Promise.all([
      prisma!.worker.count(),
      prisma!.worker.count({
        where: { is_available: true },
      }),
      prisma!.worker.findMany({
        select: { specialties: true },
      }),
    ]);

    const capabilities = workers.reduce<Record<string, number>>((acc, worker) => {
      for (const specialty of worker.specialties) {
        acc[specialty] = (acc[specialty] ?? 0) + 1;
      }
      return acc;
    }, {});

    return reply.send({
      success: true,
      data: {
        total_agents: totalAgents,
        online,
        capabilities,
      },
    });
  });

  // GET /a2a/dm/inbox — get DMs for authenticated node
  app.get('/dm/inbox', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const {
      read,
      unread,
      limit,
      offset,
    } = request.query as Record<string, string | undefined>;
    const readFilter = read === 'true'
      ? true
      : read === 'false'
        ? false
        : unread === 'true'
          ? false
          : undefined;

    const result = await a2aService.getInbox(auth.node_id, {
      read: readFilter,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    void reply.send({
      success: true,
      data: result.messages,
      meta: {
        total: result.total,
        unread: result.unread,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // /a2a/task/* — task alias routes
  // ---------------------------------------------------------------------------
  app.get('/task/list', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { status, limit, offset } = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };
    const taskService = await getTaskModule();
    const parsedLimit = parseTaskListNumber(limit, 'limit', 20);
    const parsedOffset = parseTaskListNumber(offset, 'offset', 0);
    const tasks = await taskService.listTasks('__all__');
    const filtered = status ? tasks.filter((task) => task.status === status) : tasks;
    return reply.send({
      success: true,
      data: filtered.slice(parsedOffset, parsedOffset + parsedLimit),
      meta: {
        total: filtered.length,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  });

  app.post('/task/claim', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; node_id?: string };
    if (!body.task_id) {
      throw new ValidationError('task_id is required');
    }
    ensureTaskNodeIdMatches(auth.node_id, body.node_id);
    const taskService = await getTaskModule();
    const [projectId, taskId] = parseCompositeTaskId(body.task_id);
    const task = await taskService.claimTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  app.post('/task/complete', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; node_id?: string; asset_id?: string };
    if (!body.task_id) {
      throw new ValidationError('task_id is required');
    }
    ensureTaskNodeIdMatches(auth.node_id, body.node_id);
    const taskService = await getTaskModule();
    const [projectId, taskId] = parseCompositeTaskId(body.task_id);
    const task = await taskService.completeTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  app.post('/task/release', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; node_id?: string };
    if (!body.task_id) {
      throw new ValidationError('task_id is required');
    }
    ensureTaskNodeIdMatches(auth.node_id, body.node_id);
    const taskService = await getTaskModule();
    const [projectId, taskId] = parseCompositeTaskId(body.task_id);
    const task = await taskService.releaseTask(projectId, taskId, auth.node_id);
    return reply.send({ success: true, data: task });
  });

  app.post('/task/submit', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      task_id?: string;
      asset_id?: string;
      node_id?: string;
      followup_question?: string;
    };
    if (!body.task_id) {
      throw new ValidationError('task_id is required');
    }
    if (!body.asset_id && !body.node_id) {
      throw new ValidationError('asset_id or node_id is required');
    }
    ensureTaskNodeIdMatches(auth.node_id, body.node_id);
    if (body.followup_question !== undefined && body.followup_question.trim().length < 5) {
      throw new ValidationError('followup_question must be at least 5 characters');
    }
    const taskService = await getTaskModule();
    if (body.asset_id) {
      const asset = await taskService.getAssetById(body.asset_id);
      if (!asset) {
        throw new NotFoundError('Asset', body.asset_id);
      }
    }
    const submission = await taskService.submitTaskAnswer(
      body.task_id,
      auth.node_id,
      body.asset_id,
      body.node_id,
    );
    return reply.status(201).send({ success: true, data: submission });
  });

  app.post('/task/accept-submission', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { task_id?: string; submission_id?: string };
    if (!body.task_id || !body.submission_id) {
      throw new ValidationError('task_id and submission_id are required');
    }
    const taskService = await getTaskModule();
    const submission = await taskService.acceptSubmission(body.task_id, body.submission_id, auth.node_id);
    return reply.send({ success: true, data: submission });
  });

  app.get('/task/my', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { status, role, node_id } = request.query as {
      status?: string;
      role?: string;
      node_id?: string;
    };
    if (role && role !== 'assignee') {
      throw new ValidationError('Unsupported role filter. Only role=assignee is currently supported.');
    }
    ensureTaskNodeIdMatches(auth.node_id, node_id);
    const taskService = await getTaskModule();
    const tasks = await taskService.listTasks('__all__');
    const filtered = tasks.filter((task) =>
      task.assignee_id === auth.node_id && (status === undefined || task.status === status));
    return reply.send({ success: true, data: filtered });
  });

  app.get('/task/eligible-count', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { min_reputation } = request.query as { min_reputation?: string };
    const minReputation = min_reputation ? Number.parseInt(min_reputation, 10) : undefined;
    const taskService = await getTaskModule();
    const count = await taskService.getEligibleNodeCount(minReputation);
    return reply.send({ success: true, data: { count, min_reputation: minReputation ?? null } });
  });

  app.get('/task/:taskId/submissions', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const taskService = await getTaskModule();
    const submissions = await taskService.getSubmissions(taskId);
    return reply.send({ success: true, data: submissions });
  });

  app.post('/task/propose-decomposition', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      task_id?: string;
      sender_id?: string;
      subtasks?: string[];
      sub_task_titles?: string[];
      estimated_parallelism?: number;
    };
    const subTaskTitles = body.sub_task_titles ?? body.subtasks;
    if (!body.task_id || !subTaskTitles?.length) {
      throw new ValidationError('task_id and subtasks are required');
    }
    if (body.sender_id !== undefined && body.sender_id !== auth.node_id) {
      throw new ForbiddenError('sender_id must match authenticated node');
    }
    const taskService = await getTaskModule();
    const decomposition = await taskService.proposeTaskDecomposition(
      body.task_id,
      auth.node_id,
      subTaskTitles,
      body.estimated_parallelism,
    );
    return reply.status(201).send({ success: true, data: decomposition });
  });

  app.get('/task/swarm/:id', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const { getSwarm } = await import('../swarm/service');
    try {
      const swarm = await getSwarm(id);
      if (swarm.creator_id !== auth.node_id) {
        return reply.status(404).send({ success: false, error: 'Swarm not found' });
      }
      return reply.send({ success: true, data: swarm });
    } catch {
      return reply.status(404).send({ success: false, error: 'Swarm not found' });
    }
  });

  app.post('/task/:taskId/commitment', {
    schema: { tags: ['Task'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { taskId } = request.params as { taskId: string };
    const body = request.body as { node_id?: string; deadline?: string };
    if (!body.node_id || !body.deadline) {
      throw new ValidationError('node_id and deadline are required');
    }
    ensureTaskNodeIdMatches(auth.node_id, body.node_id);
    const taskService = await getTaskModule();
    const commitment = await taskService.setTaskCommitment(taskId, auth.node_id, body.deadline);
    return reply.send({ success: true, data: commitment });
  });

  app.get('/task/:taskId', {
    schema: { tags: ['Task'] },
  }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const taskService = await getTaskModule();
    const [projectId, innerTaskId] = parseCompositeTaskId(taskId);
    const task = await taskService.getTask(projectId, innerTaskId);
    if (!task) {
      return reply.status(404).send({ success: false, error: 'NOT_FOUND', message: 'Task not found' });
    }
    return reply.send({ success: true, data: task });
  });

  // GET /a2a/dm/sent — get sent DMs for authenticated node
  app.get('/dm/sent', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit, offset } = request.query as Record<string, string | undefined>;

    const result = await a2aService.getSentDms(auth.node_id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    void reply.send({ success: true, data: result.messages, meta: { total: result.total } });
  });

  // POST /a2a/dm/inbox/read — mark messages as read
  app.post('/dm/inbox/read', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { dm_ids?: string[] };

    await a2aService.markInboxRead(auth.node_id, body.dm_ids);
    void reply.send({ success: true });
  });

  // POST /a2a/dm/:dmId/read — mark a specific DM as read
  app.post('/dm/:dmId/read', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { dmId } = request.params as { dmId: string };

    await a2aService.markDmRead(auth.node_id, dmId);
    void reply.send({ success: true });
  });

  // GET /a2a/trending — trending promoted assets
  app.get('/trending', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { type, limit } = request.query as Record<string, string | undefined>;

    const result = await a2aService.getTrending({
      type,
      limit: limit ? Number(limit) : undefined,
    });

    void reply.send({ success: true, data: result.assets, meta: { period: result.period } });
  });

  // GET /a2a/discover — trending/popular asset discovery
  app.get('/discover', {
    schema: {
      tags: ['Assets'],
      querystring: {
        type: 'object',
        properties: {
          lang: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as { lang?: string; limit?: string; offset?: string };
    const { prisma } = app as unknown as { prisma: { asset: { findMany: Function } } };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const assets = await (prisma as { asset: { findMany: Function } }).asset.findMany({
      where: { status: 'published' },
      orderBy: { gdi_score: 'desc' },
      take: limit,
      skip: offset,
    });
    return reply.send({ success: true, data: assets });
  });

  // POST /a2a/events/poll — poll for new events
  app.post('/events/poll', {
    schema: {
      tags: ['A2A'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['node_id'],
        properties: {
          node_id: { type: 'string', minLength: 1 },
          timeout_ms: { type: 'integer', minimum: 0, maximum: 10_000 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      node_id: string;
      timeout_ms?: number;
      limit?: number;
    };

    if (body.node_id !== auth.node_id) {
      throw new ForbiddenError('node_id must match authenticated node');
    }

    const startedAt = Date.now();
    const polledAt = new Date();
    const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma!;
    const limit = Math.min(body.limit ?? 20, 100);

    const [projectTasks, workerTasks, swarmSubtasks] = await Promise.all([
      prisma.projectTask.findMany({
        where: {
          assignee_id: auth.node_id,
          status: { not: 'completed' },
        },
        orderBy: { updated_at: 'desc' },
        take: limit,
      }),
      prisma.workerTask.findMany({
        where: {
          assigned_to: auth.node_id,
          status: { not: 'completed' },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
      }),
      prisma.swarmSubtask.findMany({
        where: {
          assigned_to: auth.node_id,
          status: { not: 'completed' },
        },
        orderBy: { assigned_at: 'desc' },
        take: limit,
        include: {
          task: {
            select: {
              title: true,
            },
          },
        },
      }),
    ]);

    const events = [
      ...projectTasks.map((task) => ({
        event_id: `project-task:${task.task_id}`,
        event_type: 'task_assigned',
        source: 'project_task',
        timestamp: task.updated_at.toISOString(),
        payload: {
          task_id: task.task_id,
          title: task.title,
          status: task.status,
          signals: [] as string[],
        },
      })),
      ...workerTasks.map((task) => ({
        event_id: `worker-task:${task.task_id}`,
        event_type: 'task_assigned',
        source: 'worker_task',
        timestamp: task.created_at.toISOString(),
        payload: {
          task_id: task.task_id,
          title: task.title,
          status: task.status,
          signals: task.skills,
        },
      })),
      ...swarmSubtasks.map((subtask) => ({
        event_id: `swarm-subtask:${subtask.subtask_id}`,
        event_type: 'swarm_subtask_available',
        source: 'swarm_subtask',
        timestamp: (subtask.assigned_at ?? polledAt).toISOString(),
        payload: {
          task_id: subtask.subtask_id,
          parent_task_id: subtask.swarm_id,
          title: subtask.title,
          swarm_title: subtask.task.title,
          status: subtask.status,
          swarm_role: 'solver',
        },
      })),
    ]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);

    return {
      success: true,
      data: {
        node_id: auth.node_id,
        polled_at: polledAt.toISOString(),
        events,
        next_poll_id: polledAt.toISOString(),
        elapsed_ms: Date.now() - startedAt,
      },
    };
  });

  // ---------------------------------------------------------------------------
  app.post('/dialog', {
    schema: { tags: ['Council'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      proposal_id?: string;
      message: string;
      context?: Record<string, unknown>;
    };
    if (!body.message) {
      throw new EvoMapError('message is required', 'VALIDATION_ERROR', 400);
    }
    const deliberation = {
      proposal_id: body.proposal_id ?? null,
      speaker: auth.node_id,
      message: body.message,
      response: {
        summary: `Acknowledged your input on proposal ${body.proposal_id ?? 'unknown'}. The Council has noted your position.`,
        positions: [
          { member: 'council-member-1', stance: 'pending', confidence: 0.5 },
          { member: 'council-member-2', stance: 'pending', confidence: 0.5 },
        ],
        consensus_estimate: 0.0,
        recommended_action: 'Continue dialogue or submit a vote.',
      },
      timestamp: new Date().toISOString(),
    };
    return { success: true, data: deliberation };
  });

  // ---------------------------------------------------------------------------
  // /a2a/worker/register — alias for /api/v2/workerpool/register
  // ---------------------------------------------------------------------------
  app.post('/worker/register', {
    schema: { tags: ['WorkerPool'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { specialties: string[]; maxConcurrent?: number };
    if (!body.specialties || !Array.isArray(body.specialties) || body.specialties.length === 0) {
      throw new EvoMapError('specialties array is required', 'VALIDATION_ERROR', 400);
    }
    const { registerWorker } = await import('../workerpool/service');
    const worker = await registerWorker(auth.node_id, body.specialties, body.maxConcurrent ?? 3);
    return reply.status(201).send({ success: true, data: worker });
  });

  // ---------------------------------------------------------------------------
  // /a2a/work/* — worker pool work aliases
  // ---------------------------------------------------------------------------

  // GET /a2a/work/available — available work (skill filter)
  app.get('/work/available', {
    schema: {
      tags: ['WorkerPool'],
      querystring: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { skill, limit } = request.query as { skill?: string; limit?: string };
    const { findAvailableWorkers } = await import('../workerpool/service');
    const workers = await findAvailableWorkers(
      skill ? [skill] : ['default'],
      limit ? Math.min(Number(limit), 50) : 20,
    );
    return reply.send({ success: true, data: workers });
  });

  // GET /a2a/work/my — my assigned work [auth]
  app.get('/work/my', {
    schema: {
      tags: ['WorkerPool'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { status, limit, offset } = request.query as {
      status?: string;
      limit?: string;
      offset?: string;
    };
    const where: Record<string, unknown> = { assigned_to: auth.node_id };
    if (status) { where.status = status; }
    const take = limit ? Math.min(Number(limit), 50) : 20;
    const skip = offset ? Number(offset) : 0;
    const [tasks, total] = await Promise.all([
      prisma.workerTask.findMany({ where, orderBy: { created_at: 'desc' }, take, skip }),
      prisma.workerTask.count({ where }),
    ]);
    return reply.send({ success: true, data: tasks, meta: { total } });
  });

  app.post('/work/claim', {
    schema: { tags: ['WorkerPool'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { work_id: string };
    if (!body.work_id) {
      throw new EvoMapError('work_id is required', 'VALIDATION_ERROR', 400);
    }
    const { assignTask } = await import('../workerpool/service');
    const worker = await assignTask(auth.node_id, body.work_id);
    return reply.send({ success: true, data: worker });
  });

  app.post('/work/complete', {
    schema: { tags: ['WorkerPool'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { work_id: string; success?: boolean };
    if (!body.work_id) {
      throw new EvoMapError('work_id is required', 'VALIDATION_ERROR', 400);
    }
    const { completeTask } = await import('../workerpool/service');
    const worker = await completeTask(auth.node_id, body.work_id, body.success ?? true);
    return reply.send({ success: true, data: worker });
  });

  // ─── A. Recipe + Organism aliases ────────────────────────────────────────────

  // GET /a2a/recipe/search — delegate to recipe routes search handler
  app.get('/recipe/search', {
    schema: { tags: ['Recipe'] },
  }, async (request, reply) => {
    const { recipeRoutes } = await import('../recipe/routes');
    void recipeRoutes;
    // Forward query params to recipe search
    const { q, limit, offset } = request.query as Record<string, string | undefined>;
    if (!q) {
      throw new ValidationError('q (query) is required');
    }
    // Delegate to the recipe service directly
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const [items, total] = await Promise.all([
      prisma.recipe.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { created_at: 'desc' },
        take: parsedLimit,
        skip: parsedOffset,
      }),
      prisma.recipe.count({
        where: {
          status: 'published',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
      }),
    ]);
    return reply.send({ success: true, data: { items, total } });
  });

  // GET /a2a/recipe/stats
  app.get('/recipe/stats', {
    schema: { tags: ['Recipe'] },
  }, async (_request, reply) => {
    const [total, published, draft, organismsResult] = await Promise.all([
      prisma.recipe.count(),
      prisma.recipe.count({ where: { status: 'published' } }),
      prisma.recipe.count({ where: { status: 'draft' } }),
      prisma.organism.groupBy({ by: ['status'], _count: { organism_id: true } }),
    ]);
    const organismStats: Record<string, number> = {};
    for (const row of organismsResult) {
      organismStats[row.status] = row._count.organism_id;
    }
    return reply.send({
      success: true,
      data: { total_recipes: total, published_recipes: published, draft_recipes: draft, organisms: organismStats },
    });
  });

  // GET /a2a/recipe/list — list all recipes
  app.get('/recipe/list', {
    schema: {
      tags: ['Recipe'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          author: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { status?: string; author?: string; limit?: string; offset?: string };
    const { listRecipes } = await import('../recipe/service');
    const result = await listRecipes(
      query.status,
      query.author,
      query.limit ? parseInt(query.limit, 10) : 20,
      query.offset ? parseInt(query.offset, 10) : 0,
    );
    return { success: true, data: { items: result.items, total: result.total } };
  });

  // POST /a2a/recipe/:id/publish — publish a recipe
  app.post('/recipe/:recipeId/publish', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { recipeId: string };
    const { publishRecipe } = await import('../recipe/service');
    const recipe = await publishRecipe(params.recipeId, auth.node_id);
    return { success: true, data: recipe };
  });

  // POST /a2a/recipe/:id/archive — archive a recipe
  app.post('/recipe/:recipeId/archive', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { recipeId: string };
    const { archiveRecipe } = await import('../recipe/service');
    const recipe = await archiveRecipe(params.recipeId, auth.node_id);
    return { success: true, data: recipe };
  });

  // POST /a2a/recipe/:id/fork — fork a recipe
  app.post('/recipe/:recipeId/fork', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { recipeId: string };
    const { forkRecipe } = await import('../recipe/service');
    const forkedRecipe = await forkRecipe(params.recipeId, auth.node_id);
    return {
      success: true,
      data: {
        ...forkedRecipe,
        original_recipe_id: params.recipeId,
      },
    };
  });

  // GET /a2a/recipe/:id
  app.get('/recipe/:recipeId', {
    schema: { tags: ['Recipe'] },
  }, async (request, reply) => {
    const { recipeId } = request.params as { recipeId: string };
    const { getRecipe } = await import('../recipe/service');
    const recipe = await getRecipe(recipeId);
    return reply.send({ success: true, data: recipe });
  });

  // POST /a2a/recipe — create a new recipe
  app.post('/recipe', {
    schema: { tags: ['Recipe'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      title: string;
      description: string;
      genes?: unknown;
      price_per_execution?: number;
      max_concurrent?: number;
      input_schema?: unknown;
      output_schema?: unknown;
    };
    if (!body.title || !body.description) {
      throw new EvoMapError('title and description are required', 'VALIDATION_ERROR', 400);
    }
    const { createRecipe } = await import('../recipe/service');
    const recipe = await createRecipe(
      auth.node_id,
      body.title,
      body.description,
      body.genes,
      body.price_per_execution,
      body.max_concurrent,
      body.input_schema,
      body.output_schema,
    );
    return reply.status(201).send({ success: true, data: recipe });
  });

  // POST /a2a/recipe/:recipeId/express — express recipe into organism
  app.post('/recipe/:recipeId/express', {
    schema: { tags: ['Recipe'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const params = request.params as { recipeId: string };
    const body = request.body as { gene_ids?: string[]; ttl_seconds?: number };
    const recipe = await prisma.recipe.findUnique({ where: { recipe_id: params.recipeId } });
    if (!recipe) throw new NotFoundError('Recipe', params.recipeId);
    if (recipe.status !== 'published') {
      throw new EvoMapError('Only published recipes can be expressed', 'VALIDATION_ERROR', 400);
    }
    const organismId = crypto.randomUUID();
    const now = new Date();
    const genes = (body.gene_ids ?? []) as string[];
    const organism = await prisma.organism.create({
      data: {
        organism_id: organismId,
        recipe_id: params.recipeId,
        status: 'assembling',
        genes_expressed: 0,
        genes_total_count: genes.length,
        current_position: 0,
        ttl_seconds: body.ttl_seconds ?? 3600,
        created_at: now,
        updated_at: now,
      },
    });
    return reply.status(201).send({ success: true, data: organism });
  });

  // GET /a2a/organism/active
  app.get('/organism/active', {
    schema: { tags: ['Recipe'] },
  }, async (request, reply) => {
    const query = request.query as { executor_node_id?: string; limit?: string; offset?: string };
    const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma!;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const where: Record<string, unknown> = { status: { in: ['assembling', 'running'] } };
    if (query.executor_node_id) {
      const recipes = await prisma.recipe.findMany({
        where: { author_id: query.executor_node_id },
        select: { recipe_id: true },
      });
      where.recipe_id = { in: recipes.map((r) => r.recipe_id) };
    }
    const [items, total] = await Promise.all([
      prisma.organism.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: offset }),
      prisma.organism.count({ where }),
    ]);
    return reply.send({ success: true, data: { items, total } });
  });

  // PATCH /a2a/organism/:organismId
  app.patch('/organism/:organismId', {
    schema: { tags: ['Recipe'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const params = request.params as { organismId: string };
    const body = ((request.body as {
      status?: string;
      genes_expressed?: number;
      current_position?: number;
      ttl_seconds?: number;
    } | undefined) ?? {}) as {
      status?: string;
      genes_expressed?: number;
      current_position?: number;
      ttl_seconds?: number;
    };
    const { NotFoundError: SNotFoundError } = await import('../shared/errors');
    const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma!;
    const organism = await prisma.organism.findUnique({
      where: { organism_id: params.organismId },
      include: {
        recipe: {
          select: {
            author_id: true,
          },
        },
      },
    });
    if (!organism) throw new SNotFoundError('Organism', params.organismId);
    if (organism.recipe.author_id !== auth.node_id) {
      throw new ForbiddenError('Not allowed to update this organism');
    }
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (body.status !== undefined) updateData.status = body.status;
    if (body.genes_expressed !== undefined) updateData.genes_expressed = body.genes_expressed;
    if (body.current_position !== undefined) updateData.current_position = body.current_position;
    if (body.ttl_seconds !== undefined) updateData.ttl_seconds = body.ttl_seconds;
    const updated = await prisma.organism.update({
      where: { organism_id: params.organismId },
      data: updateData,
    });
    return reply.send({ success: true, data: updated });
  });

  // ─── B. Session extensions ───────────────────────────────────────────────────

  // POST /a2a/session/create — create a collaboration session
  app.post('/session/create', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
      sender_id: string;
      topic: string;
      participants?: string[];
      max_participants?: number;
    };
    if (!body.topic) {
      throw new EvoMapError('topic is required', 'VALIDATION_ERROR', 400);
    }
    const { SESSION_TTL_MS } = await import('../shared/constants');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const creatorMember = {
      node_id: auth.node_id,
      role: 'organizer' as const,
      joined_at: now.toISOString(),
      last_heartbeat: now.toISOString(),
      is_active: true,
    };
    const allMembers = [creatorMember, ...((body.participants ?? []).map((p) => ({
      node_id: p,
      role: 'participant' as const,
      joined_at: now.toISOString(),
      last_heartbeat: now.toISOString(),
      is_active: true,
    })))];
    const session = await prisma.collaborationSession.create({
      data: {
        title: body.topic,
        status: 'active',
        creator_id: auth.node_id,
        members: allMembers as import('@prisma/client').Prisma.InputJsonValue,
        context: {},
        max_participants: body.max_participants ?? 10,
        consensus_config: { algorithm: 'majority' } as import('@prisma/client').Prisma.InputJsonValue,
        vector_clock: {},
        messages: [],
        created_at: now,
        updated_at: now,
        expires_at: expiresAt,
      },
    });
    return reply.status(201).send({ success: true, data: session });
  });

  // POST /a2a/session/message — send a message to a session
  app.post('/session/message', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      sessionId: string;
      type?: string;
      content: string;
    };
    if (!body.sessionId || !body.content) {
      throw new EvoMapError('sessionId and content are required', 'VALIDATION_ERROR', 400);
    }
    const sessionService = await getSessionModule();
    const msg = await sessionService.sendMessage(
      body.sessionId,
      auth.node_id,
      (body.type ?? 'system') as 'subtask_result' | 'query' | 'response' | 'vote' | 'signal' | 'system' | 'operation',
      body.content,
      app.prisma,
    );
    return { success: true, data: msg };
  });

  // POST /a2a/session/join — join a collaboration session
  app.post('/session/join', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as { sessionId: string };
    if (!body.sessionId) {
      throw new EvoMapError('sessionId is required', 'VALIDATION_ERROR', 400);
    }
    const sessionService = await getSessionModule();
    const session = await sessionService.joinSession(body.sessionId, auth.node_id, app.prisma);
    return { success: true, data: session };
  });

  // GET /a2a/session/list — list sessions for authenticated node
  app.get('/session/list', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as { status?: string; limit?: string; offset?: string };
    const sessionService = await getSessionModule();
    const result = await sessionService.listSessionsForNode(auth.node_id, {
      status: query.status as 'creating' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error' | 'expired' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    }, app.prisma);
    return reply.send({
      success: true,
      data: result.sessions,
      meta: { total: result.total, limit: result.limit, offset: result.offset },
    });
  });

  // GET /a2a/session/board — shared collaboration board for active session
  app.get('/session/board', {
    schema: {
      tags: ['Session'],
      querystring: {
        type: 'object',
        required: ['session_id'],
        properties: {
          session_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const query = request.query as { session_id: string };
    const sessionService = await getSessionModule();
    const board = await sessionService.getSessionBoard(query.session_id, auth.node_id, app.prisma);
    return { success: true, data: board };
  });

  // POST /a2a/session/board/update — update shared board
  app.post('/session/board/update', {
    schema: {
      tags: ['Session'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['session_id', 'action'],
        properties: {
          session_id: { type: 'string' },
          action: { type: 'string', enum: ['add', 'remove', 'pin', 'unpin'] },
          item: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'type', 'content'],
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              content: { type: 'string' },
            },
          },
          item_id: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      session_id: string;
      action: 'add' | 'remove' | 'pin' | 'unpin';
      item?: { id: string; type: string; content: string };
      item_id?: string;
    };
    const sessionService = await getSessionModule();
    const result = await sessionService.updateSessionBoard(
      body.session_id,
      auth.node_id,
      body.action,
      body.item,
      body.item_id,
      app.prisma,
    );
    return { success: true, data: result };
  });

  // POST /a2a/session/orchestrate — orchestrate a multi-agent session
  app.post('/session/orchestrate', {
    schema: {
      tags: ['Session'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['session_id'],
        properties: {
          session_id: { type: 'string' },
          sender_id: { type: 'string' },
          mode: { type: 'string', enum: ['sequential', 'parallel', 'hierarchical'] },
          task_graph: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['task_id'],
              properties: {
                task_id: { type: 'string' },
                depends_on: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
          reassign: {},
          force_converge: { type: 'boolean' },
          task_board_updates: {},
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      session_id: string;
      sender_id?: string;
      mode?: 'sequential' | 'parallel' | 'hierarchical';
      task_graph?: Array<{ task_id: string; depends_on?: string[] }>;
      reassign?: Record<string, unknown>;
      force_converge?: boolean;
      task_board_updates?: unknown;
    };
    if (body.sender_id !== undefined && body.sender_id !== auth.node_id) {
      throw new ForbiddenError('sender_id must match authenticated node');
    }
    const sessionService = await getSessionModule();
    const result = await sessionService.orchestrateSession(
      body.session_id,
      auth.node_id,
      {
        mode: body.mode,
        task_graph: body.task_graph,
        reassign: body.reassign,
        force_converge: body.force_converge,
        task_board_updates: body.task_board_updates,
      },
      app.prisma,
    );
    return { success: true, data: result };
  });

  // POST /a2a/session/submit — submit session result
  app.post('/session/submit', {
    schema: {
      tags: ['Session'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['session_id', 'task_id', 'result_asset_id'],
        properties: {
          session_id: { type: 'string', minLength: 1 },
          sender_id: { type: 'string' },
          task_id: { type: 'string', minLength: 1 },
          result_asset_id: { type: 'string', minLength: 1 },
          result: {},
          summary: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      session_id: string;
      sender_id?: string;
      task_id: string;
      result_asset_id: string;
      result: unknown;
      summary?: string;
    };
    if (body.sender_id !== undefined && body.sender_id !== auth.node_id) {
      throw new ForbiddenError('sender_id must match authenticated node');
    }
    const sessionService = await getSessionModule();
    const result = await sessionService.submitSessionResult(
      body.session_id,
      auth.node_id,
      body.task_id,
      body.result_asset_id,
      {
        result: body.result,
        summary: body.summary,
      },
      app.prisma,
    );
    return { success: true, data: result };
  });

  // GET /a2a/session/context — get session context/memory
  app.get('/session/context', {
    schema: {
      tags: ['Session'],
      querystring: {
        type: 'object',
        required: ['session_id'],
        properties: {
          session_id: { type: 'string' },
          node_id: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const query = request.query as { session_id: string; node_id?: string; limit?: string };
    if (query.node_id !== undefined && query.node_id !== auth.node_id) {
      throw new ForbiddenError('node_id must match authenticated node');
    }
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    if (!Number.isFinite(limit) || limit < 1) {
      throw new EvoMapError('limit must be a positive integer', 'VALIDATION_ERROR', 400);
    }
    const sessionService = await getSessionModule();
    const context = await sessionService.getSessionContext(query.session_id, auth.node_id, limit, app.prisma);
    return { success: true, data: context };
  });

  // ─── C. Dispute aliases ───────────────────────────────────────────────────────

  // GET /a2a/dispute/:disputeId
  app.get('/dispute/:disputeId', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { disputeId } = request.params as { disputeId: string };
    const { getDispute } = await import('../dispute/service');
    const dispute = await getDispute(disputeId, request.auth!);
    return reply.send({ success: true, data: dispute });
  });

  // GET /a2a/dispute/:disputeId/messages — list dispute messages (evidence chain)
  app.get('/dispute/:disputeId/messages', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const { disputeId } = request.params as { disputeId: string };
    const query = request.query as { limit?: string; offset?: string };
    const limit = parseDisputeLimit(query.limit);
    const offset = parseDisputeOffset(query.offset);
    const { getDispute } = await import('../dispute/service');
    const disputeRecord = await getDispute(disputeId, request.auth!);
    if (!canViewRawDisputeEvidence(request.auth!, disputeRecord)) {
      throw new ForbiddenError('Cannot access dispute evidence');
    }
    // Dispute model stores evidence as JSON; return it as messages
    const dispute = await prisma.dispute.findUnique({
      where: { dispute_id: disputeId },
      select: { evidence: true },
    });
    const evidence = ((dispute?.evidence as unknown) ?? []) as Array<Record<string, unknown>>;
    const paginated = evidence.slice(offset, offset + limit);
    return reply.send({ success: true, data: paginated, meta: { total: evidence.length } });
  });

  // GET /a2a/disputes — list disputes (alias for existing /dispute/ route)
  app.get('/disputes', {
    schema: { tags: ['Disputes'] },
    preHandler: [requireAuth()],
  }, async (request, reply) => {
    const query = request.query as { status?: string; type?: string; limit?: string; offset?: string };
    const { listDisputes } = await import('../dispute/service');
    const limit = parseDisputeLimit(query.limit);
    const offset = parseDisputeOffset(query.offset);
    const result = await listDisputes(request.auth!, query.status, query.type, limit, offset);
    return reply.send({ success: true, data: { items: result.items, total: result.total } });
  });

  // ─── D. Asset discovery + node endpoints ────────────────────────────────────

  // 1. GET /assets/semantic-search
  app.get('/assets/semantic-search', {
    schema: {
      tags: ['Assets'],
      querystring: {
        type: 'object',
        properties: {
          outcome: { type: 'string' },
          q: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const raw = request.query as Record<string, string | undefined>;
    const q = raw.q;
    const type = raw.type as string | undefined; // unvalidated, passed through
    if (!q) {
      throw new ValidationError('q (query) is required');
    }
    const result = await assetsService.semanticSearch({
      q,
      type,
      outcome: raw.outcome,
      limit: raw.limit ? Number(raw.limit) : undefined,
      offset: raw.offset ? Number(raw.offset) : undefined,
    });
    return reply.send({ success: true, data: result.assets, meta: { total: result.total } });
  });

  // 2. GET /assets/graph-search
  app.get('/assets/graph-search', {
    schema: {
      tags: ['Assets'],
      querystring: {
        type: 'object',
        properties: {
          signals: { type: 'string' },
          depth: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const raw = request.query as Record<string, string | undefined>;
    const result = await assetsService.graphSearch({
      type: raw.type as string | undefined,
      signals: raw.signals ? raw.signals.split(',').map((s) => s.trim()) : undefined,
      depth: raw.depth ? Number(raw.depth) : undefined,
      limit: raw.limit ? Number(raw.limit) : undefined,
    });
    return reply.send({ success: true, data: result.assets });
  });

  // 3. GET /assets/explore
  app.get('/assets/explore', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { limit, offset } = request.query as Record<string, string | undefined>;
    const result = await assetsService.exploreAssets({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return reply.send({ success: true, data: result.assets, meta: { total: result.total } });
  });

  // 4. GET /assets/recommended [auth]
  app.get('/assets/recommended', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { limit, offset } = request.query as Record<string, string | undefined>;
    const result = await assetsService.recommendedAssets({
      nodeId: auth.node_id,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return reply.send({ success: true, data: result.assets, meta: { total: result.total } });
  });

  // 5. GET /assets/daily-discovery
  app.get('/assets/daily-discovery', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const result = await assetsService.dailyDiscovery(limit ? Number(limit) : 10);
    return reply.send({ success: true, data: result.assets, meta: { date: result.date } });
  });

  // 6. GET /assets/categories
  app.get('/assets/categories', {
    schema: { tags: ['Assets'] },
  }, async (_request, reply) => {
    const result = await assetsService.assetCategories();
    return reply.send({ success: true, data: result.categories });
  });

  // 7. GET /assets/:asset_id
  app.get('/assets/:asset_id', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { asset_id } = request.params as { asset_id: string };
    const { detailed } = request.query as { detailed?: string };
    const auth = await getOptionalAuth(request);
    const result = await assetsService.getAssetDetail(asset_id, detailed === 'true', auth?.node_id);
    return reply.send({ success: true, data: result });
  });

  // 8. GET /assets/:id/related
  app.get('/assets/:id/related', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };
    const result = await assetsService.getRelatedAssets(id, limit ? Number(limit) : 10);
    return reply.send({ success: true, data: result.assets });
  });

  // 9. GET /assets/:id/branches
  app.get('/assets/:id/branches', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await assetsService.getAssetBranches(id);
    return reply.send({ success: true, data: result.branches });
  });

  // 10. GET /assets/:id/timeline
  app.get('/assets/:id/timeline', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await assetsService.getAssetTimeline(id);
    return reply.send({ success: true, data: result.events });
  });

  // 11. GET /assets/:id/verify
  app.get('/assets/:id/verify', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await assetsService.verifyAsset(id);
    return reply.send({ success: true, data: result });
  });

  // 12. GET /assets/:id/audit-trail
  app.get('/assets/:id/audit-trail', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await assetsService.getAssetAuditTrail(id);
    return reply.send({ success: true, data: result });
  });

  // 13. GET /assets/chain/:chainId
  app.get('/assets/chain/:chainId', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { chainId } = request.params as { chainId: string };
    const result = await assetsService.getChainAssets(chainId);
    return reply.send({ success: true, data: result.assets });
  });

  // 14. GET /assets/my-usage [auth]
  app.get('/assets/my-usage', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const result = await assetsService.getMyUsage(auth.node_id);
    return reply.send({ success: true, data: result });
  });

  // 15. POST /assets/:id/vote [auth]
  app.post('/assets/:id/vote', {
    schema: {
      tags: ['Assets'],
      body: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down'] },
        },
        required: ['direction'],
        additionalProperties: false,
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { direction?: 'up' | 'down' };
    if (!body.direction || !['up', 'down'].includes(body.direction)) {
      throw new EvoMapError('direction must be "up" or "down"', 'VALIDATION_ERROR', 400);
    }
    const result = await assetsService.voteAsset(auth.node_id, id, body.direction);
    return reply.send({ success: true, data: result });
  });

  // 16. GET /assets/:id/reviews
  app.get('/assets/:id/reviews', {
    schema: { tags: ['Assets'] },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit, offset } = request.query as { limit?: string; offset?: string };
    const result = await assetsService.listReviews(id, limit ? Number(limit) : 20, offset ? Number(offset) : 0);
    return reply.send({ success: true, data: result.reviews, meta: { total: result.total } });
  });

  // 17. POST /assets/:id/reviews [auth]
  app.post('/assets/:id/reviews', {
    schema: {
      tags: ['Assets'],
      body: {
        type: 'object',
        properties: {
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
        },
        required: ['rating', 'comment'],
        additionalProperties: false,
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { rating?: number; comment?: string };
    if (!body.comment) {
      throw new EvoMapError('comment is required', 'VALIDATION_ERROR', 400);
    }
    const result = await assetsService.submitReview(auth.node_id, id, body.rating ?? 0, body.comment);
    return reply.status(201).send({ success: true, data: result });
  });

  // 18. PUT /assets/:id/reviews/:reviewId [auth]
  app.put('/assets/:id/reviews/:reviewId', {
    schema: {
      tags: ['Assets'],
      body: {
        type: 'object',
        properties: {
          comment: { type: 'string' },
        },
        required: ['comment'],
        additionalProperties: false,
      },
    },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id, reviewId } = request.params as { id: string; reviewId: string };
    const body = (request.body ?? {}) as { comment?: string };
    if (!body.comment) {
      throw new EvoMapError('comment is required', 'VALIDATION_ERROR', 400);
    }
    const result = await assetsService.updateReview(auth.node_id, id, reviewId, body.comment);
    return reply.send({ success: true, data: result });
  });

  // 19. DELETE /assets/:id/reviews/:reviewId [auth]
  app.delete('/assets/:id/reviews/:reviewId', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id, reviewId } = request.params as { id: string; reviewId: string };
    const result = await assetsService.deleteReview(auth.node_id, id, reviewId);
    return reply.send({ success: true, data: result });
  });

  // 20. POST /asset/self-revoke [auth]
  app.post('/asset/self-revoke', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as { asset_id: string; reason?: string };
    if (!body.asset_id) {
      throw new EvoMapError('asset_id is required', 'VALIDATION_ERROR', 400);
    }
    const result = await assetsService.selfRevokeAsset(auth.node_id, body.asset_id, body.reason);
    return reply.send({ success: true, data: result });
  });

  // ─── E. Node endpoints ─────────────────────────────────────────────────────

  // 21. GET /nodes
  app.get('/nodes', {
    schema: {
      tags: ['Nodes'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          sort: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { status, sort, limit, offset } = request.query as Record<string, string | undefined>;
    const result = await assetsService.listNodes({
      status,
      sort,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return reply.send({ success: true, data: result.nodes, meta: { total: result.total } });
  });

  // 22. GET /nodes/:nodeId
  app.get('/nodes/:nodeId', {
    schema: { tags: ['Nodes'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const result = await assetsService.getNodeDetail(nodeId);
    return reply.send({ success: true, data: result });
  });

  // 23. GET /nodes/:nodeId/activity
  app.get('/nodes/:nodeId/activity', {
    schema: { tags: ['Nodes'] },
  }, async (request, reply) => {
    const { nodeId } = request.params as { nodeId: string };
    const { limit } = request.query as { limit?: string };
    const result = await assetsService.getNodeActivity(nodeId, limit ? Number(limit) : 50);
    return reply.send({ success: true, data: result.events });
  });

  // ─── F. Other discovery endpoints ─────────────────────────────────────────

  // 24. GET /signals/popular
  app.get('/signals/popular', {
    schema: {
      tags: ['Signals'],
      querystring: { type: 'object', properties: { limit: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const result = await assetsService.getPopularSignals(limit ? Number(limit) : 20);
    return reply.send({ success: true, data: result.signals });
  });

  // 25. GET /validation-reports
  app.get('/validation-reports', {
    schema: {
      tags: ['Validation'],
      querystring: { type: 'object', properties: { asset_id: { type: 'string' }, limit: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { asset_id, limit } = request.query as { asset_id?: string; limit?: string };
    const result = await assetsService.getValidationReports(asset_id, limit ? Number(limit) : 20);
    return reply.send({ success: true, data: result.reports });
  });

  // 26. GET /evolution-events
  app.get('/evolution-events', {
    schema: {
      tags: ['Evolution'],
      querystring: { type: 'object', properties: { limit: { type: 'string' }, offset: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const raw = request.query as Record<string, string | undefined>;
    const result = await assetsService.getEvolutionEvents({
      type: raw.type,
      limit: raw.limit ? Number(raw.limit) : undefined,
      offset: raw.offset ? Number(raw.offset) : undefined,
    });
    return reply.send({ success: true, data: result.events, meta: { total: result.total } });
  });

  // 27. GET /lessons
  app.get('/lessons', {
    schema: {
      tags: ['Discovery'],
      querystring: { type: 'object', properties: { limit: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const result = await assetsService.getLessons(limit ? Number(limit) : 20);
    return reply.send({ success: true, data: result.lessons });
  });

  // 28. GET /policy
  app.get('/policy', {
    schema: { tags: ['Platform'] },
  }, async (_request, reply) => {
    const result = await assetsService.getPolicyConfig();
    return reply.send({ success: true, data: result });
  });

  // 29. GET /policy/model-tiers
  app.get('/policy/model-tiers', {
    schema: { tags: ['Platform'] },
  }, async (_request, reply) => {
    const result = await assetsService.getModelTiers();
    return reply.send({ success: true, data: result.tiers });
  });
}
