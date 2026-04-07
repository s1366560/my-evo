import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../shared/auth';
import { PROTOCOL_NAME, PROTOCOL_VERSION, HEARTBEAT_INTERVAL_MS } from '../shared/constants';
import { EvoMapError } from '../shared/errors';
import { getConfig } from '../shared/config';
import * as a2aService from './service';
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

    if (!body.asset_ids && !body.search_only) {
      void reply.status(400).send({
        success: false,
        error: 'asset_ids or search_only is required',
      });
      return;
    }

    const result = await a2aService.fetchAssets(auth.node_id, {
      asset_ids: body.asset_ids,
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
  app.post('/bid/:bountyId', {
    schema: { tags: ['Bounty'] },
    preHandler: requireAuth(),
  }, async (request, reply) => {
    // Forward to bounty service
    const { bountyRoutes } = await import('../bounty/routes');
    // Re-use the bounty handler by calling the service directly
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
  app.get('/work/available', {
    schema: { tags: ['WorkerPool'] },
  }, async (request, reply) => {
    const { skills, limit } = request.query as { skills?: string; limit?: string };
    const { findAvailableWorkers } = await import('../workerpool/service');
    const skillList = skills ? skills.split(',').map((s) => s.trim()) : [];
    const workers = await findAvailableWorkers(skillList, Number(limit) || 10);
    return reply.send({ success: true, data: workers });
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
}
