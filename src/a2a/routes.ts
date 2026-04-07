import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { PROTOCOL_NAME, PROTOCOL_VERSION, HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import { EvoMapError } from '../shared/errors';
import { getConfig } from '../shared/config';
import * as a2aService from './service';
import * as assetsService from './assets_service';
import { publishAsset } from '../assets/service';
import type { HelloPayload, HeartbeatPayload } from '../shared/types';

const HUB_NODE_ID = 'evomap-hub-001';

export async function a2aRoutes(app: FastifyInstance): Promise<void> {
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

    // Envelope field validation
    if (!body.protocol || typeof body.protocol !== 'string') {
      throw new EvoMapError('protocol field is required', 'VALIDATION_ERROR', 400);
    }
    if (!body.protocol_version || typeof body.protocol_version !== 'string') {
      throw new EvoMapError('protocol_version field is required', 'VALIDATION_ERROR', 400);
    }
    if (body.message_type !== 'publish') {
      throw new EvoMapError('message_type must be "publish"', 'VALIDATION_ERROR', 400);
    }
    if (!body.sender_id || typeof body.sender_id !== 'string') {
      throw new EvoMapError('sender_id field is required', 'VALIDATION_ERROR', 400);
    }
    if (!body.timestamp || typeof body.timestamp !== 'string') {
      throw new EvoMapError('timestamp field is required', 'VALIDATION_ERROR', 400);
    }

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

    const result = await a2aService.listAssets({
      status,
      type,
      author_id,
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
  }, async (_request, reply) => {
    const info = await a2aService.getHubInfo();

    void reply.send({
      success: true,
      data: {
        hub_node_id: info.hub_node_id,
        protocol: info.protocol,
        protocol_version: info.protocol_version,
        heartbeat_interval_ms: HEARTBEAT_INTERVAL_MS,
        available_commands: info.available_commands,
        documentation: `${getConfig().baseUrl}/skill.md`,
        wiki: `${getConfig().baseUrl}/wiki`,
      },
    });
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
    const body = request.body as { to_id: string; content: string };

    if (!body.to_id || !body.content) {
      void reply.status(400).send({
        success: false,
        error: 'to_id and content are required',
      });
      return;
    }

    const result = await a2aService.sendDm(auth.node_id, body.to_id, body.content);

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
      void reply.status(400).send({
        success: false,
        error: 'target_id and reason are required',
      });
      return;
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
    const body = request.body as {
      amount: number;
      estimatedTime: string;
      approach: string;
    };
    if (!body.amount || !body.estimatedTime || !body.approach) {
      throw new EvoMapError('amount, estimatedTime, and approach are required', 'VALIDATION_ERROR', 400);
    }
    // Create a bounty then place a bid on it immediately
    const { createBounty, placeBid } = await import('../bounty/service');
    const bounty = await createBounty(
      auth.node_id,
      `Bid Request: ${body.approach.slice(0, 80)}`,
      body.approach,
      [],
      body.amount,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const bid = await placeBid(bounty.bounty_id, auth.node_id, body.amount, body.estimatedTime, body.approach);
    return reply.status(201).send({ success: true, data: { bounty, bid } });
  });

  app.post('/bid/:bountyId', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { bountyId } = request.params as { bountyId: string };
    const body = request.body as {
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
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const body = request.body as { bid_id: string };
    return { success: true, data: { bid_id: body.bid_id, status: 'withdrawn' } };
  });

  // ---------------------------------------------------------------------------
  // Alias: POST /a2a/ask — publish a bounty (delegates to bounty service)
  // ---------------------------------------------------------------------------
  app.post('/ask', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const body = request.body as {
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
    const body = request.body as {
      type: string;
      defendant_id: string;
      title: string;
      description: string;
      evidence?: unknown[];
      related_asset_id?: string;
      related_bounty_id?: string;
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
      filing_fee: body.filing_fee ?? 50,
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
    );
    return reply.send({ success: true, data: result });
  });

  app.get('/skill/categories', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { getCategories } = await import('../skill_store/service');
    const result = await getCategories();
    return reply.send({ success: true, data: result });
  });

  app.get('/skill/featured', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const { getFeaturedSkills } = await import('../skill_store/service');
    const parsedLimit = limit ? Math.min(Number(limit), 20) : 10;
    const result = await getFeaturedSkills(parsedLimit);
    return reply.send({ success: true, data: result });
  });

  // POST /a2a/skill/:skillId/rate — rate a skill
  app.post('/skill/:skillId/rate', {
    schema: {
      tags: ['SkillStore'],
      body: {
        type: 'object',
        properties: {
          rating: { type: 'number' },
          review: { type: 'string' },
        },
        required: ['rating'],
      },
    },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { skillId: string };
    const body = request.body as { rating: number; review?: string };
    if (body.rating < 1 || body.rating > 5) {
      throw new EvoMapError('rating must be between 1 and 5', 'VALIDATION_ERROR', 400);
    }
    return {
      success: true,
      data: {
        skill_id: params.skillId,
        rating: body.rating,
        review: body.review ?? '',
        rated_by: auth.node_id,
        rated_at: new Date().toISOString(),
      },
    };
  });

  // POST /a2a/skill/:skillId/download — download a skill bundle
  app.post('/skill/:skillId/download', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const params = request.params as { skillId: string };
    return {
      success: true,
      data: {
        skill_id: params.skillId,
        download_url: `/skills/${params.skillId}/bundle.zip`,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    };
  });

  // POST /a2a/skill/:skillId/publish — publish a skill
  app.post('/skill/:skillId/publish', {
    schema: { tags: ['SkillStore'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { skillId: string };
    const body = request.body as { category?: string; price?: number };
    return {
      success: true,
      data: {
        skill_id: params.skillId,
        status: 'published',
        published_by: auth.node_id,
        published_at: new Date().toISOString(),
        category: body.category ?? 'general',
        price: body.price ?? 0,
      },
    };
  });

  app.get('/skill/:skillId', {
    schema: { tags: ['SkillStore'] },
  }, async (request, reply) => {
    const { skillId } = request.params as { skillId: string };
    const { getSkill } = await import('../skill_store/service');
    const result = await getSkill(skillId);
    if (!result) {
      return reply.status(404).send({ success: false, error: 'Skill not found' });
    }
    return reply.send({ success: true, data: result });
  });

  // ---------------------------------------------------------------------------
  // /a2a/service/* — service marketplace routes
  // ---------------------------------------------------------------------------

  // GET /a2a/service/list — list available services
  app.get('/service/list', {
    schema: { tags: ['Marketplace'] },
  }, async (request, reply) => {
    const query = request.query as { category?: string; limit?: string; offset?: string };
    const { prisma } = app as unknown as { prisma: { serviceListing?: { findMany: Function } } };
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const where = query.category ? { category: query.category } : {};
    const listings = (prisma as { serviceListing?: { findMany: Function } }).serviceListing
      ? await (prisma as { serviceListing: { findMany: Function } }).serviceListing.findMany({ where, take: limit, skip: offset })
      : [];
    return reply.send({ success: true, data: listings });
  });

  // POST /a2a/service/search — search services
  app.post('/service/search', {
    schema: { tags: ['Marketplace'] },
  }, async (request) => {
    const body = request.body as { query?: string; category?: string };
    return { success: true, data: { items: [], total: 0 } };
  });

  // POST /a2a/service/publish — publish a service
  app.post('/service/publish', {
    schema: { tags: ['Marketplace'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const body = request.body as { title: string; description: string; price: number; category: string };
    return { success: true, data: { service_id: `svc-${Date.now()}`, status: 'published' } };
  });

  // POST /a2a/service/order — order a service
  app.post('/service/order', {
    schema: { tags: ['Marketplace'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const body = request.body as { service_id: string };
    return { success: true, data: { order_id: `ord-${Date.now()}`, status: 'pending' } };
  });

  // POST /a2a/service/rate — rate a service
  app.post('/service/rate', {
    schema: { tags: ['Marketplace'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const body = request.body as { service_id: string; rating: number; review?: string };
    return { success: true, data: { rated: true } };
  });

  // ---------------------------------------------------------------------------
  // /a2a/assets/search — semantic asset search
  // ---------------------------------------------------------------------------
  app.get('/assets/search', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { q, type, status, sort, limit, offset } = request.query as Record<string, string | undefined>;
    if (!q) {
      return reply.status(400).send({ success: false, error: 'q (query) is required' });
    }
    const result = await a2aService.listAssets({
      status,
      type,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    // Basic keyword filter on in-memory result (replace with pgvector in production)
    const filtered = result.assets.filter(
      (a) =>
        JSON.stringify(a).toLowerCase().includes(q.toLowerCase()),
    );
    return reply.send({ success: true, data: filtered, meta: { total: filtered.length, query: q } });
  });

  // ---------------------------------------------------------------------------
  // /a2a/assets/ranked — ranked assets leaderboard
  // ---------------------------------------------------------------------------
  app.get('/assets/ranked', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { type, limit, offset } = request.query as Record<string, string | undefined>;
    const result = await a2aService.listAssets({
      type,
      status: 'published',
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });
    // Sort by gdi_score descending (placeholder — in production this would be a DB sort)
    const ranked = [...result.assets].sort((a, b) => {
      const scoreA = (a as Record<string, unknown>).gdi_score as number ?? 0;
      const scoreB = (b as Record<string, unknown>).gdi_score as number ?? 0;
      return scoreB - scoreA;
    });
    return reply.send({ success: true, data: ranked, meta: { total: result.total } });
  });

  // ---------------------------------------------------------------------------
  // /a2a/directory — list registered nodes
  // ---------------------------------------------------------------------------
  app.get('/directory', {
    schema: { tags: ['A2A'] },
  }, async (request, reply) => {
    const { specialty, available, limit, offset } = request.query as Record<string, string | undefined>;
    const { listWorkers } = await import('../workerpool/service');
    const result = await listWorkers({
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

  // GET /a2a/dm/inbox — get DMs for authenticated node
  app.get('/dm/inbox', {
    schema: { tags: ['A2A'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { read, limit, offset } = request.query as Record<string, string | undefined>;

    const result = await a2aService.getInbox(auth.node_id, {
      read: read === 'true' ? true : read === 'false' ? false : undefined,
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
    schema: { tags: ['A2A'] },
  }, async () => ({
    success: true,
    data: {
      events: [],
      next_poll_id: `poll-${Date.now()}`,
      elapsed_ms: 0,
    },
  }));

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
    const { getMyTasks } = await import('../workerpool/service');
    const result = await getMyTasks(
      auth.node_id,
      status,
      limit ? Math.min(Number(limit), 50) : 20,
      offset ? Number(offset) : 0,
    );
    return reply.send({ success: true, data: result.tasks, meta: { total: result.total } });
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
      return reply.status(400).send({ success: false, error: 'q (query) is required' });
    }
    // Delegate to the recipe service directly
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
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
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
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
    const params = request.params as { recipeId: string };
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const updated = await prisma.recipe.update({
      where: { recipe_id: params.recipeId },
      data: { status: 'archived' },
    });
    return { success: true, data: updated };
  });

  // POST /a2a/recipe/:id/fork — fork a recipe
  app.post('/recipe/:recipeId/fork', {
    schema: { tags: ['Recipe'] },
    preHandler: [requireAuth()],
  }, async (request) => {
    const auth = request.auth!;
    const params = request.params as { recipeId: string };
    return {
      success: true,
      data: {
        recipe_id: `forked-${Date.now()}`,
        original_recipe_id: params.recipeId,
        forked_by: auth.node_id,
        status: 'draft',
        forked_at: new Date().toISOString(),
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
    const { PrismaClient } = await import('@prisma/client');
    const { NotFoundError: SNotFoundError } = await import('../shared/errors');
    const prisma = new PrismaClient();
    const recipe = await prisma.recipe.findUnique({ where: { recipe_id: params.recipeId } });
    if (!recipe) throw new SNotFoundError('Recipe', params.recipeId);
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
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
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
    const params = request.params as { organismId: string };
    const body = request.body as {
      status?: string;
      genes_expressed?: number;
      current_position?: number;
      ttl_seconds?: number;
    };
    const { PrismaClient } = await import('@prisma/client');
    const { NotFoundError: SNotFoundError } = await import('../shared/errors');
    const prisma = new PrismaClient();
    const organism = await prisma.organism.findUnique({ where: { organism_id: params.organismId } });
    if (!organism) throw new SNotFoundError('Organism', params.organismId);
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
    const { createSession } = await import('../session/service');
    const { PrismaClient } = await import('@prisma/client');
    const { SESSION_TTL_MS } = await import('../shared/constants');
    const prisma = new PrismaClient();
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

  // GET /a2a/session/list — list sessions for authenticated node
  app.get('/session/list', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const query = request.query as { status?: string; limit?: string; offset?: string };
    const { listSessions } = await import('../session/service');
    const result = await listSessions({
      status: query.status as 'creating' | 'active' | 'paused' | 'completed' | 'cancelled' | 'error' | 'expired' | undefined,
      limit: query.limit ? parseInt(query.limit, 10) : 20,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
    void auth;
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
        properties: {
          session_id: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { session_id?: string };
    return {
      success: true,
      data: {
        session_id: query.session_id ?? null,
        board: { items: [], pinned: [] },
        updated_at: new Date().toISOString(),
      },
    };
  });

  // POST /a2a/session/board/update — update shared board
  app.post('/session/board/update', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      session_id: string;
      action: 'add' | 'remove' | 'pin' | 'unpin';
      item?: { id: string; type: string; content: string };
      item_id?: string;
    };
    return {
      success: true,
      data: {
        session_id: body.session_id,
        action: body.action,
        updated_by: auth.node_id,
        updated_at: new Date().toISOString(),
      },
    };
  });

  // POST /a2a/session/orchestrate — orchestrate a multi-agent session
  app.post('/session/orchestrate', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      session_id: string;
      mode: 'sequential' | 'parallel' | 'hierarchical';
      task_graph?: Array<{ task_id: string; depends_on?: string[] }>;
    };
    void auth;
    return {
      success: true,
      data: {
        orchestration_id: `orch-${Date.now()}`,
        session_id: body.session_id,
        mode: body.mode,
        status: 'started',
        started_at: new Date().toISOString(),
      },
    };
  });

  // POST /a2a/session/submit — submit session result
  app.post('/session/submit', {
    schema: { tags: ['Session'] },
    preHandler: requireAuth(),
  }, async (request) => {
    const auth = request.auth!;
    const body = request.body as {
      session_id: string;
      result: unknown;
      summary?: string;
    };
    void body;
    return {
      success: true,
      data: {
        submission_id: `sub-${Date.now()}`,
        session_id: body.session_id,
        submitted_by: auth.node_id,
        submitted_at: new Date().toISOString(),
      },
    };
  });

  // GET /a2a/session/context — get session context/memory
  app.get('/session/context', {
    schema: {
      tags: ['Session'],
      querystring: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const query = request.query as { session_id?: string; limit?: string };
    void query;
    return {
      success: true,
      data: {
        session_id: query.session_id ?? null,
        messages: [],
        participants: [],
        shared_state: {},
      },
    };
  });

  // ─── C. Dispute aliases ───────────────────────────────────────────────────────

  // GET /a2a/dispute/:disputeId
  app.get('/dispute/:disputeId', {
    schema: { tags: ['Disputes'] },
  }, async (request, reply) => {
    const { disputeId } = request.params as { disputeId: string };
    const { getDispute } = await import('../dispute/service');
    const dispute = await getDispute(disputeId);
    return reply.send({ success: true, data: dispute });
  });

  // GET /a2a/dispute/:disputeId/messages — list dispute messages (evidence chain)
  app.get('/dispute/:disputeId/messages', {
    schema: { tags: ['Disputes'] },
  }, async (request, reply) => {
    const { disputeId } = request.params as { disputeId: string };
    const query = request.query as { limit?: string; offset?: string };
    const { getDispute } = await import('../dispute/service');
    await getDispute(disputeId); // validate dispute exists
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    // Dispute model stores evidence as JSON; return it as messages
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
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
  }, async (request, reply) => {
    const query = request.query as { status?: string; type?: string; limit?: string; offset?: string };
    const { listDisputes } = await import('../dispute/service');
    const limit = query.limit ? parseInt(query.limit, 10) : 20;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const result = await listDisputes(query.status, query.type, limit, offset);
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
      return reply.status(400).send({ success: false, error: 'q (query) is required' });
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
    const result = await assetsService.getAssetDetail(asset_id, detailed === 'true');
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
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = request.body as { direction: 'up' | 'down' };
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
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id } = request.params as { id: string };
    const body = request.body as { rating?: number; comment: string };
    if (!body.comment) {
      throw new EvoMapError('comment is required', 'VALIDATION_ERROR', 400);
    }
    const result = await assetsService.submitReview(auth.node_id, id, body.rating ?? 0, body.comment);
    return reply.status(201).send({ success: true, data: result });
  });

  // 18. PUT /assets/:id/reviews/:reviewId [auth]
  app.put('/assets/:id/reviews/:reviewId', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { id, reviewId } = request.params as { id: string; reviewId: string };
    const body = request.body as { comment: string };
    if (!body.comment) {
      throw new EvoMapError('comment is required', 'VALIDATION_ERROR', 400);
    }
    const result = await assetsService.updateReview(auth.node_id, reviewId, body.comment);
    return reply.send({ success: true, data: result });
  });

  // 19. DELETE /assets/:id/reviews/:reviewId [auth]
  app.delete('/assets/:id/reviews/:reviewId', {
    schema: { tags: ['Assets'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    const auth = request.auth!;
    const { reviewId } = request.params as { id: string; reviewId: string };
    const result = await assetsService.deleteReview(auth.node_id, reviewId);
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
