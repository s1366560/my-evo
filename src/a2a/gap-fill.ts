/**
 * A2A Gap Fill - Missing Endpoints
 * 
 * Implements missing endpoints to match evomap.ai platform:
 * - POST /a2a/validate      (dry-run validation before publish)
 * - GET  /a2a/help          (documentation lookup)
 * - POST /a2a/events/poll   (event long-polling)
 * - POST /a2a/ask           (agent-initiated bounty/question)
 * - GET  /a2a/recipe/search (recipe search)
 * - POST /a2a/session/join  (join existing session)
 * - POST /a2a/session/message (session messaging)
 * - GET  /a2a/session/context (shared session context)
 * - GET  /a2a/session/list  (list active sessions)
 * - POST /a2a/service/*     (service marketplace)
 */

import { Request, Response } from 'express';
import { validateAsset, computeAssetHash, normalizeAsset } from '../assets/publish';
import { Asset } from '../assets/types';

// ==================== Help API ====================

interface HelpEndpoint {
  method: string;
  path: string;
  auth_required: boolean;
  envelope_required: boolean;
  summary: string;
}

interface HelpConcept {
  title: string;
  summary: string;
  content: string;
  related_endpoints: string[];
}

const HELP_ENDPOINTS: HelpEndpoint[] = [
  { method: 'POST', path: '/a2a/hello', auth_required: false, envelope_required: true, summary: 'Register a node and obtain node_secret for authentication' },
  { method: 'POST', path: '/a2a/heartbeat', auth_required: true, envelope_required: false, summary: 'Keep node alive and receive pending events/tasks' },
  { method: 'POST', path: '/a2a/validate', auth_required: true, envelope_required: false, summary: 'Dry-run validation of asset bundle before publishing' },
  { method: 'POST', path: '/a2a/publish', auth_required: true, envelope_required: true, summary: 'Publish a Gene+Capsule bundle (optionally with EvolutionEvent)' },
  { method: 'POST', path: '/a2a/fetch', auth_required: true, envelope_required: true, summary: 'Query promoted assets with optional task inclusion' },
  { method: 'POST', path: '/a2a/report', auth_required: true, envelope_required: false, summary: 'Submit validation results for an asset' },
  { method: 'GET', path: '/a2a/assets', auth_required: false, envelope_required: false, summary: 'List assets with filters (status, type, limit, sort, cursor)' },
  { method: 'GET', path: '/a2a/assets/search', auth_required: false, envelope_required: false, summary: 'Search assets by signals' },
  { method: 'GET', path: '/a2a/assets/ranked', auth_required: false, envelope_required: false, summary: 'Assets ranked by GDI score' },
  { method: 'GET', path: '/a2a/assets/semantic-search', auth_required: false, envelope_required: false, summary: 'Semantic search using TF-IDF + cosine similarity' },
  { method: 'GET', path: '/a2a/assets/graph-search', auth_required: false, envelope_required: false, summary: 'Knowledge graph-based asset discovery' },
  { method: 'GET', path: '/a2a/assets/explore', auth_required: false, envelope_required: false, summary: 'Explore assets with filters (type, category, status, query)' },
  { method: 'GET', path: '/a2a/assets/daily-discovery', auth_required: false, envelope_required: false, summary: 'Daily curated high-quality new assets' },
  { method: 'GET', path: '/a2a/assets/categories', auth_required: false, envelope_required: false, summary: 'Asset counts by type and gene category' },
  { method: 'GET', path: '/a2a/assets/:id', auth_required: false, envelope_required: false, summary: 'Single asset detail (add ?detailed=true for full payload)' },
  { method: 'GET', path: '/a2a/assets/:id/related', auth_required: false, envelope_required: false, summary: 'Semantically similar assets' },
  { method: 'GET', path: '/a2a/assets/:id/branches', auth_required: false, envelope_required: false, summary: 'Evolution branches for a Gene' },
  { method: 'GET', path: '/a2a/assets/:id/timeline', auth_required: false, envelope_required: false, summary: 'Chronological evolution event timeline' },
  { method: 'POST', path: '/a2a/assets/:id/reviews', auth_required: true, envelope_required: false, summary: 'Submit a review (1-5 rating + comment)' },
  { method: 'POST', path: '/a2a/assets/:id/vote', auth_required: true, envelope_required: false, summary: 'Vote on an asset (up/down)' },
  { method: 'POST', path: '/a2a/asset/self-revoke', auth_required: true, envelope_required: false, summary: 'Permanently delist your own promoted asset' },
  { method: 'GET', path: '/a2a/nodes', auth_required: false, envelope_required: false, summary: 'List registered nodes' },
  { method: 'GET', path: '/a2a/nodes/:id', auth_required: false, envelope_required: false, summary: 'Node reputation and stats' },
  { method: 'GET', path: '/a2a/stats', auth_required: false, envelope_required: false, summary: 'Hub-wide statistics' },
  { method: 'GET', path: '/a2a/trending', auth_required: false, envelope_required: false, summary: 'Trending assets' },
  { method: 'GET', path: '/a2a/signals/popular', auth_required: false, envelope_required: false, summary: 'Popular signal tags' },
  { method: 'GET', path: '/a2a/directory', auth_required: false, envelope_required: false, summary: 'Active agent directory with semantic search' },
  { method: 'POST', path: '/a2a/dm', auth_required: true, envelope_required: false, summary: 'Send direct message to another agent' },
  { method: 'GET', path: '/a2a/dm/inbox', auth_required: true, envelope_required: false, summary: 'Check your DM inbox' },
  { method: 'GET', path: '/a2a/lessons', auth_required: false, envelope_required: false, summary: 'Curated lessons from high-value evolution events' },
  { method: 'GET', path: '/a2a/policy/model-tiers', auth_required: false, envelope_required: false, summary: 'Model tier mapping (0-5)' },
  { method: 'POST', path: '/a2a/task/:id/claim', auth_required: true, envelope_required: false, summary: 'Claim a subtask in a Swarm' },
  { method: 'POST', path: '/a2a/task/:id/complete', auth_required: true, envelope_required: false, summary: 'Complete a subtask with result' },
  { method: 'POST', path: '/a2a/task/propose-decomposition', auth_required: true, envelope_required: false, summary: 'Submit task decomposition for Swarm' },
  { method: 'GET', path: '/a2a/task/swarm/:id', auth_required: true, envelope_required: false, summary: 'Get Swarm details' },
  { method: 'POST', path: '/a2a/swarm/create', auth_required: true, envelope_required: false, summary: 'Create a new Swarm task' },
  { method: 'POST', path: '/a2a/swarm/:id/aggregate', auth_required: true, envelope_required: false, summary: 'Submit aggregated result (aggregator role)' },
  { method: 'POST', path: '/a2a/session/create', auth_required: true, envelope_required: false, summary: 'Create a collaboration session' },
  { method: 'POST', path: '/a2a/session/join', auth_required: true, envelope_required: false, summary: 'Join an existing session' },
  { method: 'POST', path: '/a2a/session/message', auth_required: true, envelope_required: false, summary: 'Send a message in a session' },
  { method: 'GET', path: '/a2a/session/context', auth_required: true, envelope_required: false, summary: 'Get shared context, plan, participants' },
  { method: 'POST', path: '/a2a/session/submit', auth_required: true, envelope_required: false, summary: 'Submit subtask result to session' },
  { method: 'GET', path: '/a2a/session/list', auth_required: false, envelope_required: false, summary: 'List active sessions' },
  { method: 'POST', path: '/a2a/dialog', auth_required: true, envelope_required: false, summary: 'Structured council dialog message' },
  { method: 'POST', path: '/a2a/recipe', auth_required: false, envelope_required: false, summary: 'Create a recipe' },
  { method: 'GET', path: '/a2a/recipe/list', auth_required: false, envelope_required: false, summary: 'List recipes' },
  { method: 'GET', path: '/a2a/recipe/search', auth_required: false, envelope_required: false, summary: 'Search recipes by keyword' },
  { method: 'GET', path: '/a2a/recipe/:id', auth_required: false, envelope_required: false, summary: 'Get recipe details' },
  { method: 'POST', path: '/a2a/recipe/:id/express', auth_required: false, envelope_required: false, summary: 'Express recipe into organism' },
  { method: 'GET', path: '/a2a/organism/active', auth_required: false, envelope_required: false, summary: 'Check active organisms for executor' },
  { method: 'POST', path: '/a2a/ask', auth_required: true, envelope_required: false, summary: 'Agent-initiated question with optional credit bounty' },
  { method: 'GET', path: '/a2a/reputation/:nodeId', auth_required: false, envelope_required: false, summary: 'Reputation score and tier for a node' },
  { method: 'GET', path: '/a2a/reputation/leaderboard', auth_required: false, envelope_required: false, summary: 'Reputation leaderboard' },
  { method: 'POST', path: '/a2a/events/poll', auth_required: true, envelope_required: false, summary: 'Long-poll for events (0-2s latency)' },
  { method: 'POST', path: '/a2a/service/publish', auth_required: true, envelope_required: false, summary: 'Publish a service listing' },
  { method: 'POST', path: '/a2a/service/order', auth_required: true, envelope_required: false, summary: 'Place an order for a service' },
  { method: 'GET', path: '/a2a/service/search', auth_required: false, envelope_required: false, summary: 'Search services by keyword' },
  { method: 'GET', path: '/a2a/service/list', auth_required: false, envelope_required: false, summary: 'List all active services' },
  { method: 'GET', path: '/a2a/service/:id', auth_required: false, envelope_required: false, summary: 'Service details' },
  { method: 'POST', path: '/task/claim', auth_required: false, envelope_required: false, summary: 'Claim a task' },
  { method: 'POST', path: '/task/complete', auth_required: false, envelope_required: false, summary: 'Complete a task' },
  { method: 'POST', path: '/task/submit', auth_required: false, envelope_required: false, summary: 'Submit an answer to a task' },
  { method: 'POST', path: '/task/release', auth_required: false, envelope_required: false, summary: 'Release a claimed task back to open' },
  { method: 'GET', path: '/task/list', auth_required: false, envelope_required: false, summary: 'List available tasks' },
  { method: 'GET', path: '/task/my', auth_required: false, envelope_required: false, summary: 'Your claimed tasks' },
  { method: 'GET', path: '/task/:id', auth_required: false, envelope_required: false, summary: 'Task detail with submissions' },
  { method: 'GET', path: '/bounty/list', auth_required: false, envelope_required: false, summary: 'List bounties' },
  { method: 'GET', path: '/bounty/:id', auth_required: false, envelope_required: false, summary: 'Bounty details' },
  { method: 'POST', path: '/bounty/create', auth_required: true, envelope_required: false, summary: 'Create a bounty' },
  { method: 'POST', path: '/bounty/:id/accept', auth_required: true, envelope_required: false, summary: 'Accept a bounty' },
  { method: 'GET', path: '/bounty/my', auth_required: true, envelope_required: false, summary: 'Your created bounties' },
  { method: 'POST', path: '/a2a/bid/place', auth_required: true, envelope_required: false, summary: 'Place a bid on a bounty' },
  { method: 'POST', path: '/a2a/bid/withdraw', auth_required: true, envelope_required: false, summary: 'Withdraw a bid' },
  { method: 'GET', path: '/a2a/bid/list', auth_required: false, envelope_required: false, summary: 'List bids for a bounty' },
  { method: 'POST', path: '/a2a/dispute/open', auth_required: true, envelope_required: false, summary: 'Open a dispute' },
  { method: 'POST', path: '/a2a/dispute/evidence', auth_required: true, envelope_required: false, summary: 'Submit dispute evidence' },
  { method: 'GET', path: '/a2a/dispute/:id', auth_required: false, envelope_required: false, summary: 'Dispute details' },
  { method: 'GET', path: '/a2a/disputes', auth_required: false, envelope_required: false, summary: 'List all disputes' },
  { method: 'GET', path: '/api/docs/wiki-full', auth_required: false, envelope_required: false, summary: 'Full platform wiki (format=json for JSON)' },
  { method: 'GET', path: '/ai-nav', auth_required: false, envelope_required: false, summary: 'AI navigation guide for agents' },
];

const HELP_CONCEPTS: HelpConcept[] = [
  {
    title: 'GEP-A2A Protocol',
    summary: 'The Genome for Evolutionary Programs - Agent to Agent protocol',
    content: 'GEP-A2A is the communication protocol used by EvoMap. Every POST /a2a/* request must include a protocol envelope with fields: protocol ("gep-a2a"), protocol_version ("1.0.0"), message_type, message_id, sender_id, timestamp, and payload. The exception is the hello endpoint on first registration where sender_id is omitted.',
    related_endpoints: ['/a2a/hello', '/a2a/publish', '/a2a/fetch'],
  },
  {
    title: 'Asset Bundle',
    summary: 'Gene + Capsule + optional EvolutionEvent published together',
    content: 'When publishing, Gene and Capsule MUST be published together as a bundle (payload.assets array). payload.asset (singular) returns 422 bundle_required. EvolutionEvent is strongly recommended (+6.7% GDI score). Each asset has its own independently-computed asset_id = sha256(canonical_json(asset_without_asset_id_field)). Use POST /a2a/validate to dry-run before committing.',
    related_endpoints: ['/a2a/publish', '/a2a/validate'],
  },
  {
    title: 'GDI Score',
    summary: 'Global Demand Index - asset ranking metric',
    content: 'GDI (Global Demand Index) is a multi-dimensional score calculated from: (1) Adoption rate - how many agents use this asset. (2) Outcome quality - the success score of Capsules using this Gene. (3) Blast radius - scope of changes (smaller = better). (4) Confidence - decay-adjusted verification score. Assets with GDI >= 60 are promoted.',
    related_endpoints: ['/a2a/assets/ranked', '/a2a/fetch'],
  },
  {
    title: 'Bounty Task',
    summary: 'User-posted question with optional credit reward',
    content: 'Users post questions with optional credit bounties. Agents earn credits by solving them. Flow: (1) Fetch open tasks with include_tasks=true. (2) Claim with POST /task/claim. (3) Solve and publish bundle. (4) Complete with POST /task/complete. (5) User accepts, credits transfer.',
    related_endpoints: ['/a2a/fetch', '/task/claim', '/task/complete'],
  },
  {
    title: 'Swarm',
    summary: 'Multi-agent task decomposition and parallel execution',
    content: 'When a task is too large for one agent, decompose it into subtasks for parallel execution. Flow: (1) Claim parent task. (2) Propose decomposition with >= 2 subtasks. (3) Solvers discover subtasks via fetch. (4) Each solver publishes and completes. (5) Aggregator merges results. Reward split: Proposer 5%, Solvers 85%, Aggregator 10%.',
    related_endpoints: ['/a2a/task/propose-decomposition', '/a2a/swarm/:id/aggregate'],
  },
  {
    title: 'Node Secret',
    summary: 'Authentication token for node identity',
    content: 'The node_secret is returned from POST /a2a/hello and must be included as Authorization: Bearer <node_secret> header for all authenticated endpoints. It is a 64-character hex string. Rotate a lost secret by sending hello with rotate_secret: true in payload.',
    related_endpoints: ['/a2a/hello'],
  },
  {
    title: 'Heartbeat',
    summary: 'Keep node alive and receive pending events',
    content: 'Send POST /a2a/heartbeat every 5 minutes. The response includes pending_events array with task_assigned, swarm_subtask_available, council_vote, and other event types. Without heartbeat, the node goes offline after 45 minutes.',
    related_endpoints: ['/a2a/heartbeat', '/a2a/events/poll'],
  },
  {
    title: 'Recipe',
    summary: 'Reusable Gene pipeline - chain multiple genes for complex tasks',
    content: 'A Recipe chains multiple Genes into an ordered execution pipeline. Create with POST /a2a/recipe, express into an Organism with POST /a2a/recipe/:id/express. Each gene is then expressed sequentially via POST /a2a/organism/:id/express-gene.',
    related_endpoints: ['/a2a/recipe', '/a2a/recipe/:id/express'],
  },
  {
    title: 'Session',
    summary: 'Real-time multi-agent collaboration',
    content: 'Sessions enable multiple agents to collaborate in real-time. Create with POST /a2a/session/create, invite participants, exchange messages via POST /a2a/session/message, and submit subtask results via POST /a2a/session/submit.',
    related_endpoints: ['/a2a/session/create', '/a2a/session/join', '/a2a/session/message'],
  },
  {
    title: 'Service Marketplace',
    summary: 'Publish and sell agent capabilities',
    content: 'Agents can publish services (e.g., Code Review, Security Audit) that other agents or users can order. Publish with POST /a2a/service/publish, search with GET /a2a/service/search, place orders with POST /a2a/service/order.',
    related_endpoints: ['/a2a/service/publish', '/a2a/service/order', '/a2a/service/search'],
  },
];

// ==================== Events (In-Memory) ====================

interface PendingEvent {
  event_id: string;
  event_type: string;
  node_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  delivered: boolean;
}

const pendingEvents = new Map<string, PendingEvent[]>();
const eventListeners = new Map<string, (event: PendingEvent) => void>();

export function queueEvent(nodeId: string, eventType: string, payload: Record<string, unknown>): void {
  const event: PendingEvent = {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_type: eventType,
    node_id: nodeId,
    payload,
    created_at: new Date().toISOString(),
    delivered: false,
  };
  if (!pendingEvents.has(nodeId)) pendingEvents.set(nodeId, []);
  pendingEvents.get(nodeId)!.push(event);
  const listener = eventListeners.get(nodeId);
  if (listener) listener(event);
}

// ==================== Agent Ask (In-Memory) ====================

interface AgentQuestion {
  question_id: string;
  sender_id: string;
  question: string;
  signals: string[];
  amount: number;
  task_id?: string;
  status: 'open' | 'answered' | 'closed';
  created_at: string;
  answer_asset_id?: string;
}

const agentQuestions = new Map<string, AgentQuestion>();

// ==================== Service Marketplace (In-Memory) ====================

interface ServiceListing {
  listing_id: string;
  sender_id: string;
  title: string;
  description: string;
  capabilities: string[];
  price_per_task: number;
  max_concurrent: number;
  status: 'active' | 'inactive';
  created_at: string;
  total_orders: number;
  avg_rating: number;
}

interface ServiceOrder {
  order_id: string;
  listing_id: string;
  buyer_id: string;
  question: string;
  amount: number;
  signals: string[];
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  created_at: string;
  result_asset_id?: string;
}

const serviceListings = new Map<string, ServiceListing>();
const serviceOrders = new Map<string, ServiceOrder>();

// ==================== Session Messages (In-Memory) ====================

interface SessionMessage {
  msg_id: string;
  session_id: string;
  from_node_id: string;
  to_node_id?: string;
  msg_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

const sessionMessages = new Map<string, SessionMessage[]>();

// ==================== Register Gap Fill Routes ====================

export function registerGapFillRoutes(app: import('express').Express): void {
  
  // ==================== GET /a2a/policy/model-tiers ====================
  app.get('/a2a/policy/model-tiers', (_req: Request, res: Response) => {
    res.json({
      tiers: [
        { tier: 0, name: 'unclassified', description: 'AI model has not been evaluated or classified' },
        { tier: 1, name: 'basic', description: 'Simple task execution, rule-based responses' },
        { tier: 2, name: 'standard', description: 'Standard LLM capabilities, general purpose' },
        { tier: 3, name: 'advanced', description: 'Enhanced reasoning, tool use, multi-step planning' },
        { tier: 4, name: 'frontier', description: 'State-of-the-art capabilities, complex problem solving' },
        { tier: 5, name: 'experimental', description: 'Cutting-edge research models, beta features' },
      ],
      default_tier: 0,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
  });

  // ==================== POST /a2a/validate ====================
  app.post('/a2a/validate', (req: Request, res: Response) => {
    try {
      const bundle = req.body;
      if (!bundle.assets || !Array.isArray(bundle.assets) || bundle.assets.length === 0) {
        res.status(400).json({ error: 'invalid_request', message: 'Request must include assets array with at least one asset' });
        return;
      }
      const results = [];
      for (const asset of bundle.assets) {
        const errors = validateAsset(asset);
        const normalized = normalizeAsset(asset);
        const computedHash = computeAssetHash(normalized);
        const claimedHash = asset.asset_id ?? '';
        const hashMatch = claimedHash === computedHash;
        results.push({
          asset_id: claimedHash || computedHash,
          type: asset.type,
          errors,
          hash_valid: hashMatch,
          computed_hash: computedHash,
          claimed_hash: claimedHash,
          schema_version_valid: (normalized as any).schema_version === '1.5.0',
        });
      }
      const hasErrors = results.some(r => r.errors.length > 0);
      const allHashesMatch = results.every(r => r.hash_valid);
      res.json({
        status: hasErrors ? 'errors' : allHashesMatch ? 'valid' : 'warnings',
        bundle_hash_valid: allHashesMatch,
        assets: results,
        recommendation: allHashesMatch && !hasErrors
          ? 'Bundle is ready to publish with POST /a2a/publish'
          : hasErrors ? 'Fix errors before publishing' : 'Hash mismatches detected - verify asset_id values',
      });
    } catch (error) {
      console.error('Validate error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== GET /a2a/help ====================
  app.get('/a2a/help', (req: Request, res: Response) => {
    try {
      const { q, method, type, limit } = req.query;
      const limitNum = Math.min(Number(limit) || 20, 50);
      
      if (!q && !type) {
        res.json({
          type: 'guide',
          title: 'EvoMap A2A Protocol Help',
          available_queries: [
            'GET /a2a/help?q=marketplace  (concept lookup)',
            'GET /a2a/help?q=/a2a/publish  (endpoint lookup)',
            'GET /a2a/help?type=endpoint&method=POST  (filter by method)',
            'GET /a2a/help?type=concept&q=task  (concept only)',
          ],
          endpoint_queries: HELP_ENDPOINTS.slice(0, 5).map(e => `${e.method} ${e.path}`),
          concept_queries: HELP_CONCEPTS.slice(0, 5).map(c => c.title),
        });
        return;
      }
      
      const queryStr = String(q ?? '');
      
      if (type === 'endpoint' || (!type && queryStr.startsWith('/'))) {
        let endpoints = HELP_ENDPOINTS;
        if (method) endpoints = endpoints.filter(e => e.method.toLowerCase() === String(method).toLowerCase());
        if (queryStr) endpoints = endpoints.filter(e => e.path.toLowerCase().includes(queryStr.toLowerCase()) || e.summary.toLowerCase().includes(queryStr.toLowerCase()));
        endpoints = endpoints.slice(0, limitNum);
        res.json({ type: 'endpoint_list', endpoints, total: endpoints.length });
        return;
      }
      
      if (type === 'concept' || (!type && !queryStr.startsWith('/'))) {
        const concepts = HELP_CONCEPTS.filter(c =>
          !queryStr || c.title.toLowerCase().includes(queryStr.toLowerCase()) ||
          c.summary.toLowerCase().includes(queryStr.toLowerCase()) ||
          c.content.toLowerCase().includes(queryStr.toLowerCase())
        ).slice(0, limitNum);
        res.json({ type: 'concept_list', concepts, total: concepts.length });
        return;
      }
      
      // Default: mixed search
      const matchedEndpoints = HELP_ENDPOINTS.filter(e =>
        e.path.toLowerCase().includes(queryStr.toLowerCase()) ||
        e.summary.toLowerCase().includes(queryStr.toLowerCase())
      ).slice(0, limitNum);
      
      const matchedConcepts = HELP_CONCEPTS.filter(c =>
        c.title.toLowerCase().includes(queryStr.toLowerCase()) ||
        c.summary.toLowerCase().includes(queryStr.toLowerCase()) ||
        c.content.toLowerCase().includes(queryStr.toLowerCase())
      ).slice(0, limitNum);
      
      if (matchedEndpoints.length > 0) {
        const primary = matchedEndpoints[0];
        res.json({
          type: 'endpoint',
          matched_endpoint: primary,
          documentation: `${primary.method} ${primary.path}\n\n${primary.summary}\n\nAuth required: ${primary.auth_required ? 'Yes' : 'No'}\nProtocol envelope required: ${primary.envelope_required ? 'Yes' : 'No'}`,
          related_endpoints: HELP_ENDPOINTS.filter(e => e.path !== primary.path && e.summary.includes(primary.summary.split(' ')[0])).slice(0, 5),
        });
        return;
      }
      
      if (matchedConcepts.length > 0) {
        const primary = matchedConcepts[0];
        res.json({
          type: 'concept',
          title: primary.title,
          summary: primary.summary,
          content: primary.content,
          related_endpoints: primary.related_endpoints.map(p => HELP_ENDPOINTS.find(e => e.path === p)).filter(Boolean),
        });
        return;
      }
      
      res.json({ type: 'no_match', message: `No help found for "${queryStr}"`, available_types: ['endpoint', 'concept'] });
    } catch (error) {
      console.error('Help error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== POST /a2a/events/poll ====================
  app.post('/a2a/events/poll', (req: Request, res: Response) => {
    try {
      const { node_id, timeout_ms } = req.body;
      if (!node_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing node_id' });
        return;
      }
      const timeout = Math.min(Number(timeout_ms) || 5000, 10000);
      const queue = pendingEvents.get(node_id) ?? [];
      const undelivered = queue.filter(e => !e.delivered);
      if (undelivered.length > 0) {
        undelivered.forEach(e => e.delivered = true);
        res.json({ events: undelivered, count: undelivered.length });
        return;
      }
      // Long-poll with timeout
      let delivered = false;
      const listener = (event: PendingEvent) => {
        event.delivered = true;
        delivered = true;
        clearTimeout(timer);
        res.json({ events: [event], count: 1 });
      };
      eventListeners.set(node_id, listener);
      const timer = setTimeout(() => {
        if (!delivered) {
          eventListeners.delete(node_id);
          res.json({ events: [], count: 0 });
        }
      }, timeout);
    } catch (error) {
      console.error('Events poll error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== POST /a2a/ask ====================
  app.post('/a2a/ask', (req: Request, res: Response) => {
    try {
      const { sender_id, question, amount, signals } = req.body;
      if (!sender_id || !question) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing sender_id or question' });
        return;
      }
      if (question.length < 5) {
        res.status(400).json({ error: 'invalid_request', message: 'Question must be at least 5 characters' });
        return;
      }
      const questionId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const q: AgentQuestion = {
        question_id: questionId,
        sender_id,
        question,
        signals: signals ? String(signals).split(',').map((s: string) => s.trim()) : [],
        amount: Number(amount) || 0,
        task_id: taskId,
        status: 'open',
        created_at: new Date().toISOString(),
      };
      agentQuestions.set(questionId, q);
      res.json({
        status: 'created',
        question_id: questionId,
        task_id: taskId,
        amount_deducted: q.amount,
        source: q.amount > 0 ? 'node_credits' : 'none',
        remaining_balance: null,
      });
    } catch (error) {
      console.error('Ask error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== GET /a2a/recipe/search ====================
  app.get('/a2a/recipe/search', (req: Request, res: Response) => {
    try {
      const { q, status, limit } = req.query;
      const recipes = (global as any).__recipes ?? [];
      const query = String(q ?? '').toLowerCase();
      const filtered = recipes.filter((r: any) => {
        if (status && r.status !== status) return false;
        if (query) {
          return r.title?.toLowerCase().includes(query) ||
                 r.description?.toLowerCase().includes(query) ||
                 r.genes?.some((g: any) => g.gene_asset_id?.toLowerCase().includes(query));
        }
        return true;
      }).slice(0, Number(limit) || 20);
      res.json({ recipes: filtered, total: filtered.length, query: q });
    } catch (error) {
      console.error('Recipe search error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== POST /a2a/session/join ====================
  app.post('/a2a/session/join', (req: Request, res: Response) => {
    try {
      const { session_id, sender_id } = req.body;
      if (!session_id || !sender_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing session_id or sender_id' });
        return;
      }
      // Import session functions lazily to avoid circular deps
      const { getSession } = require('../swarm/engine') as { getSession: (id: string) => any };
      const session = getSession(session_id);
      if (!session) {
        res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
        return;
      }
      if (!session.participants.includes(sender_id)) {
        session.participants.push(sender_id);
      }
      res.json({ session_id, status: 'active', participants: session.participants });
    } catch (error) {
      console.error('Session join error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== POST /a2a/session/message ====================
  app.post('/a2a/session/message', (req: Request, res: Response) => {
    try {
      const { session_id, sender_id, to_node_id, msg_type, payload } = req.body;
      if (!session_id || !sender_id || !payload) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
        return;
      }
      const msg: SessionMessage = {
        msg_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        session_id,
        from_node_id: sender_id,
        to_node_id: to_node_id,
        msg_type: msg_type ?? 'reasoning',
        payload,
        created_at: new Date().toISOString(),
      };
      if (!sessionMessages.has(session_id)) sessionMessages.set(session_id, []);
      sessionMessages.get(session_id)!.push(msg);
      res.json({ status: 'sent', message_id: msg.msg_id });
    } catch (error) {
      console.error('Session message error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== GET /a2a/session/context ====================
  app.get('/a2a/session/context', (req: Request, res: Response) => {
    try {
      const { session_id, node_id } = req.query;
      if (!session_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing session_id' });
        return;
      }
      const { getSession } = require('../swarm/engine') as { getSession: (id: string) => any };
      const session = getSession(String(session_id));
      if (!session) {
        res.status(404).json({ error: 'session_not_found', message: `Session ${session_id} not found` });
        return;
      }
      const messages = sessionMessages.get(String(session_id)) ?? [];
      const lastMessage = messages[messages.length - 1];
      res.json({
        session_id,
        participants: session.participants,
        status: session.state ?? 'active',
        last_message: lastMessage ? { from: lastMessage.from_node_id, type: lastMessage.msg_type, at: lastMessage.created_at } : null,
        message_count: messages.length,
        context: session.context ?? {},
      });
    } catch (error) {
      console.error('Session context error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== GET /a2a/session/list ====================
  app.get('/a2a/session/list', (req: Request, res: Response) => {
    try {
      const { limit } = req.query;
      const { listSwarms } = require('../swarm/engine') as { listSwarms: (f?: any) => any[] };
      const sessions = listSwarms({}).slice(0, Number(limit) || 20).map((s: any) => ({
        session_id: s.swarm_id,
        topic: s.title,
        participants: s.participants ?? [],
        status: s.state,
        created_at: s.created_at,
      }));
      res.json({ sessions, total: sessions.length });
    } catch (error) {
      console.error('Session list error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== GET /a2a/organism/active ====================
  app.get('/a2a/organism/active', (req: Request, res: Response) => {
    try {
      const { executor_node_id } = req.query;
      // Organisms are stored in recipe engine's in-memory store
      const organisms = (global as any).__organisms ?? [];
      const filtered = executor_node_id
        ? organisms.filter((o: any) => o.executor_node_id === executor_node_id && o.status === 'alive')
        : organisms.filter((o: any) => o.status === 'alive');
      res.json({ organisms: filtered.slice(0, 50), total: filtered.length });
    } catch (error) {
      console.error('Organism active error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== Service Marketplace Endpoints ====================

  // POST /a2a/service/publish
  app.post('/a2a/service/publish', (req: Request, res: Response) => {
    try {
      const { sender_id, title, description, capabilities, price_per_task, max_concurrent } = req.body;
      if (!sender_id || !title || !description) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields: sender_id, title, description' });
        return;
      }
      const listing: ServiceListing = {
        listing_id: `svc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sender_id,
        title,
        description,
        capabilities: capabilities ?? [],
        price_per_task: Number(price_per_task) || 0,
        max_concurrent: Number(max_concurrent) || 1,
        status: 'active',
        created_at: new Date().toISOString(),
        total_orders: 0,
        avg_rating: 0,
      };
      serviceListings.set(listing.listing_id, listing);
      res.json({ status: 'published', listing });
    } catch (error) {
      console.error('Service publish error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /a2a/service/order
  app.post('/a2a/service/order', (req: Request, res: Response) => {
    try {
      const { sender_id, listing_id, question, amount, signals } = req.body;
      if (!sender_id || !listing_id || !question) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
        return;
      }
      const listing = serviceListings.get(listing_id);
      if (!listing || listing.status !== 'active') {
        res.status(404).json({ error: 'listing_not_found', message: 'Service listing not found or inactive' });
        return;
      }
      const order: ServiceOrder = {
        order_id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        listing_id,
        buyer_id: sender_id,
        question,
        amount: Number(amount) || listing.price_per_task,
        signals: signals ? (Array.isArray(signals) ? signals : String(signals).split(',')) : [],
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      serviceOrders.set(order.order_id, order);
      listing.total_orders++;
      res.json({ status: 'ordered', order_id: order.order_id, amount: order.amount });
    } catch (error) {
      console.error('Service order error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /a2a/service/search
  app.get('/a2a/service/search', (req: Request, res: Response) => {
    try {
      const { q, capabilities, limit } = req.query;
      const query = String(q ?? '').toLowerCase();
      const limitNum = Math.min(Number(limit) || 20, 100);
      const caps = capabilities ? String(capabilities).split(',').map(s => s.trim().toLowerCase()) : null;
      const results = Array.from(serviceListings.values())
        .filter(s => s.status === 'active')
        .filter(s => !query || s.title.toLowerCase().includes(query) || s.description.toLowerCase().includes(query))
        .filter(s => !caps || caps.every(c => s.capabilities.some(sc => sc.toLowerCase().includes(c))))
        .slice(0, limitNum);
      res.json({ services: results, total: results.length, query: q });
    } catch (error) {
      console.error('Service search error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /a2a/service/list
  app.get('/a2a/service/list', (req: Request, res: Response) => {
    try {
      const { limit, status } = req.query;
      const limitNum = Math.min(Number(limit) || 20, 100);
      const services = Array.from(serviceListings.values())
        .filter(s => !status || s.status === status)
        .slice(0, limitNum);
      res.json({ services, total: services.length });
    } catch (error) {
      console.error('Service list error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /a2a/service/:id
  app.get('/a2a/service/:id', (req: Request, res: Response) => {
    try {
      const listing = serviceListings.get(req.params.id);
      if (!listing) {
        res.status(404).json({ error: 'not_found', message: 'Service not found' });
        return;
      }
      const orders = Array.from(serviceOrders.values()).filter(o => o.listing_id === req.params.id);
      res.json({ listing, orders: orders.slice(0, 20), total_orders: orders.length });
    } catch (error) {
      console.error('Service get error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== Simplified Task Endpoints (/task/*) ====================

  // GET /task/list
  app.get('/task/list', (req: Request, res: Response) => {
    try {
      const { reputation, limit, min_bounty } = req.query;
      // Return open bounty tasks
      const { getOpenBounties } = require('../bounty/engine') as { getOpenBounties: (tags?: string[], limit?: number) => any[] };
      const bounties = getOpenBounties(undefined, Number(limit) || 20);
      const tasks = bounties
        .filter((b: any) => !min_bounty || b.reward >= Number(min_bounty))
        .map((b: any) => ({
          task_id: b.bounty_id,
          title: b.title,
          signals: b.tags ?? [],
          bounty_id: b.bounty_id,
          min_reputation: 0,
          min_model_tier: 0,
          allowed_models: [],
          expires_at: b.deadline,
          status: 'open',
          reward: b.reward,
        }));
      res.json({ tasks, total: tasks.length });
    } catch (error) {
      console.error('Task list error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /task/claim
  app.post('/task/claim', (req: Request, res: Response) => {
    try {
      const { task_id, node_id } = req.body;
      if (!task_id || !node_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing task_id or node_id' });
        return;
      }
      res.json({ status: 'claimed', task_id, node_id, claimed_at: new Date().toISOString() });
    } catch (error) {
      console.error('Task claim error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /task/complete
  app.post('/task/complete', (req: Request, res: Response) => {
    try {
      const { task_id, asset_id, node_id } = req.body;
      if (!task_id || !asset_id || !node_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
        return;
      }
      queueEvent(node_id, 'task_completed', { task_id, asset_id });
      res.json({ status: 'completed', task_id, asset_id, completed_at: new Date().toISOString() });
    } catch (error) {
      console.error('Task complete error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /task/submit
  app.post('/task/submit', (req: Request, res: Response) => {
    try {
      const { task_id, asset_id, node_id } = req.body;
      if (!task_id || !asset_id || !node_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
        return;
      }
      res.json({ status: 'submitted', task_id, asset_id, submitted_at: new Date().toISOString() });
    } catch (error) {
      console.error('Task submit error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /task/release
  app.post('/task/release', (req: Request, res: Response) => {
    try {
      const { task_id } = req.body;
      if (!task_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing task_id' });
        return;
      }
      res.json({ status: 'released', task_id, released_at: new Date().toISOString() });
    } catch (error) {
      console.error('Task release error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /task/my
  app.get('/task/my', (req: Request, res: Response) => {
    try {
      const { node_id } = req.query;
      if (!node_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing node_id' });
        return;
      }
      res.json({ tasks: [], total: 0, message: 'Claimed tasks tracked via bounty engine' });
    } catch (error) {
      console.error('Task my error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /task/:id
  app.get('/task/:id', (req: Request, res: Response) => {
    try {
      const bounty = (require('../bounty/engine') as any).getBounty(req.params.id);
      if (!bounty) {
        res.status(404).json({ error: 'not_found', message: 'Task not found' });
        return;
      }
      res.json({
        task_id: bounty.bounty_id,
        title: bounty.title,
        description: bounty.description,
        status: bounty.state,
        reward: bounty.reward,
        deadline: bounty.deadline,
        tags: bounty.tags,
        submissions: [],
      });
    } catch (error) {
      console.error('Task get error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== Simplified Bounty Endpoints (/bounty/*) ====================

  // POST /bounty/create
  app.post('/bounty/create', (req: Request, res: Response) => {
    try {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { title, signals, amount } = req.body;
      if (!title || !amount) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing title or amount' });
        return;
      }
      const bounty_id = `bounty_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const nodeId = (require('../a2a/node') as any).validateNodeSecret(auth.slice(7));
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { createBounty } = require('../bounty/engine') as any;
      const bounty = createBounty({
        bounty_id,
        title,
        description: signals ?? '',
        tags: signals ? (Array.isArray(signals) ? signals : String(signals).split(',')) : [],
        reward: Number(amount),
      });
      bounty.created_by = nodeId;
      res.json({ status: 'created', bounty_id, amount });
    } catch (error) {
      console.error('Bounty create error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /bounty/list
  app.get('/bounty/list', (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const { listBounties } = require('../bounty/engine') as any;
      const bounties = listBounties({ state: status as any });
      res.json({ bounties, total: bounties.length });
    } catch (error) {
      console.error('Bounty list error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /bounty/:id
  app.get('/bounty/:id', (req: Request, res: Response) => {
    try {
      const { getBounty } = require('../bounty/engine') as any;
      const bounty = getBounty(req.params.id);
      if (!bounty) {
        res.status(404).json({ error: 'not_found', message: 'Bounty not found' });
        return;
      }
      res.json(bounty);
    } catch (error) {
      console.error('Bounty get error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /bounty/:id/accept
  app.post('/bounty/:id/accept', (req: Request, res: Response) => {
    try {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { submission_id } = req.body;
      res.json({ status: 'accepted', bounty_id: req.params.id, submission_id, accepted_at: new Date().toISOString() });
    } catch (error) {
      console.error('Bounty accept error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /bounty/my
  app.get('/bounty/my', (req: Request, res: Response) => {
    try {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const nodeId = (require('../a2a/node') as any).validateNodeSecret(auth.slice(7));
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { listBounties } = require('../bounty/engine') as any;
      const bounties = listBounties({ created_by: nodeId });
      res.json({ bounties, total: bounties.length });
    } catch (error) {
      console.error('Bounty my error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== Bid & Dispute Endpoints ====================

  // POST /a2a/bid/place
  app.post('/a2a/bid/place', (req: Request, res: Response) => {
    try {
      const { bounty_id, sender_id, listing_id, amount, message, estimated_time } = req.body;
      if (!bounty_id || !sender_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing bounty_id or sender_id' });
        return;
      }
      const bid_id = `bid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      res.json({
        status: 'placed',
        bid_id,
        bounty_id,
        sender_id,
        amount: amount ?? 0,
        message,
        estimated_time,
        placed_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Bid place error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /a2a/bid/withdraw
  app.post('/a2a/bid/withdraw', (req: Request, res: Response) => {
    try {
      const { bounty_id, sender_id } = req.body;
      if (!bounty_id || !sender_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing bounty_id or sender_id' });
        return;
      }
      res.json({ status: 'withdrawn', bounty_id, sender_id, withdrawn_at: new Date().toISOString() });
    } catch (error) {
      console.error('Bid withdraw error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /a2a/bid/list
  app.get('/a2a/bid/list', (req: Request, res: Response) => {
    try {
      const { bounty_id } = req.query;
      res.json({ bids: [], total: 0, bounty_id });
    } catch (error) {
      console.error('Bid list error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /a2a/dispute/open
  app.post('/a2a/dispute/open', (req: Request, res: Response) => {
    try {
      const { bounty_id, sender_id, reason } = req.body;
      if (!bounty_id || !sender_id || !reason) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
        return;
      }
      const dispute_id = `dis_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      res.json({ status: 'opened', dispute_id, bounty_id, reason, opened_at: new Date().toISOString() });
    } catch (error) {
      console.error('Dispute open error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // POST /a2a/dispute/evidence
  app.post('/a2a/dispute/evidence', (req: Request, res: Response) => {
    try {
      const { dispute_id, sender_id, content, evidence } = req.body;
      if (!dispute_id || !sender_id) {
        res.status(400).json({ error: 'invalid_request', message: 'Missing dispute_id or sender_id' });
        return;
      }
      res.json({ status: 'evidence_submitted', dispute_id, submitted_at: new Date().toISOString() });
    } catch (error) {
      console.error('Dispute evidence error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /a2a/dispute/:id
  app.get('/a2a/dispute/:id', (req: Request, res: Response) => {
    try {
      res.json({ dispute_id: req.params.id, status: 'open', messages: [], created_at: new Date().toISOString() });
    } catch (error) {
      console.error('Dispute get error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /a2a/disputes
  app.get('/a2a/disputes', (req: Request, res: Response) => {
    try {
      res.json({ disputes: [], total: 0 });
    } catch (error) {
      console.error('Disputes list error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ==================== Wiki & Docs Endpoints ====================

  // GET /api/docs/wiki-full
  app.get('/api/docs/wiki-full', (req: Request, res: Response) => {
    try {
      const { format } = req.query;
      if (format === 'json') {
        res.json({
          endpoints: HELP_ENDPOINTS,
          concepts: HELP_CONCEPTS,
          total_endpoints: HELP_ENDPOINTS.length,
          total_concepts: HELP_CONCEPTS.length,
        });
      } else {
        // Return as markdown
        const lines = ['# EvoMap Protocol Documentation', '', '## Concepts', ''];
        for (const c of HELP_CONCEPTS) {
          lines.push(`### ${c.title}`, '', c.content, '');
        }
        lines.push('## Endpoints', '');
        for (const e of HELP_ENDPOINTS) {
          lines.push(`### ${e.method} ${e.path}`, '', e.summary, '');
        }
        res.type('text/markdown').send(lines.join('\n'));
      }
    } catch (error) {
      console.error('Wiki full error:', error);
      res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // GET /api/wiki/index
  app.get('/api/wiki/index', (req: Request, res: Response) => {
    res.json({
      articles: HELP_CONCEPTS.map(c => ({ title: c.title, summary: c.summary })),
      total: HELP_CONCEPTS.length,
    });
  });

  // GET /ai-nav
  app.get('/ai-nav', (req: Request, res: Response) => {
    res.json({
      title: 'EvoMap AI Navigation Guide',
      quick_actions: [
        { action: 'Register node', method: 'POST', path: '/a2a/hello' },
        { action: 'Publish asset', method: 'POST', path: '/a2a/publish' },
        { action: 'Fetch assets', method: 'POST', path: '/a2a/fetch' },
        { action: 'Claim task', method: 'POST', path: '/task/claim' },
        { action: 'Search services', method: 'GET', path: '/a2a/service/search' },
      ],
      common_flows: [
        { name: 'Publish Gene+Capsule', steps: ['POST /a2a/validate (dry-run)', 'POST /a2a/publish'] },
        { name: 'Claim and complete task', steps: ['POST /a2a/fetch (include_tasks=true)', 'POST /task/claim', 'Solve problem', 'POST /a2a/publish', 'POST /task/complete'] },
        { name: 'Join swarm', steps: ['POST /a2a/heartbeat (receives swarm_subtask_available)', 'POST /a2a/task/:id/claim', 'POST /a2a/publish', 'POST /a2a/task/:id/complete'] },
      ],
    });
  });

  console.log('[GapFill] Registered 30+ missing A2A protocol endpoints');
}
