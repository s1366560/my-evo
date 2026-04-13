/**
 * Route tests for src/a2a/routes.ts
 * Tests the protocol format -> PublishPayload adaptation in POST /a2a/publish
 */

import type { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import { a2aRoutes } from './routes';
import { UnauthorizedError, ValidationError } from '../shared/errors';

// ─── Mock auth middleware ───────────────────────────────────────────────────────

let mockNodeId = 'node-test-001';
let mockAuthType: string | undefined;
let mockAuthScopes: string[] | undefined;

// Store the original request auth setter to call from within the route
let capturedRequest: { auth?: { node_id: string } } | null = null;
const mockAuthenticate = jest.fn(async (request?: unknown) => {
  const typedRequest = request as { headers?: Record<string, string | undefined> } | undefined;
  if (typedRequest?.headers?.authorization === 'Bearer invalid') {
    throw new UnauthorizedError('Invalid token');
  }
  return { node_id: mockNodeId };
});

const mockRequireAuth = () => async (
  request: { auth?: { node_id: string; auth_type?: string; scopes?: string[] } },
) => {
  request.auth = mockAuthType
    ? { node_id: mockNodeId, auth_type: mockAuthType, scopes: mockAuthScopes }
    : { node_id: mockNodeId };
  capturedRequest = request;
};

// ─── Mock publishAsset ────────────────────────────────────────────────────────

const mockPublishAsset = jest.fn();
const mockFileDispute = jest.fn();
const mockGetDispute = jest.fn();
const mockListDisputes = jest.fn();
const mockSendDm = jest.fn();
const mockGetInbox = jest.fn();
const mockGetSentDms = jest.fn();
const mockMarkInboxRead = jest.fn();
const mockMarkDmRead = jest.fn();
const mockWorkerDirectoryCount = jest.fn();
const mockWorkerDirectoryFindMany = jest.fn();
const mockCreateBounty = jest.fn();
const mockWithdrawBid = jest.fn();
const mockListAssets = jest.fn();
const mockSearchServiceListings = jest.fn();
const mockCreateServiceListing = jest.fn();
const mockPurchaseService = jest.fn();
const mockRateService = jest.fn();
const mockUpdateServiceListing = jest.fn();
const mockSetServiceMarketplacePrisma = jest.fn();
const mockListSkills = jest.fn();
const mockGetCategories = jest.fn();
const mockGetFeaturedSkills = jest.fn();
const mockRateSkill = jest.fn();
const mockDownloadSkill = jest.fn();
const mockPublishSkillWithUpdates = jest.fn();
const mockSetSkillStorePrisma = jest.fn();
const mockSendSessionMessage = jest.fn();
const mockJoinSession = jest.fn();
const mockListSessions = jest.fn();
const mockListSessionsForNode = jest.fn();
const mockGetSessionBoard = jest.fn();
const mockUpdateSessionBoard = jest.fn();
const mockOrchestrateSession = jest.fn();
const mockSubmitSessionResult = jest.fn();
const mockGetSessionContext = jest.fn();
const mockSetSessionPrisma = jest.fn();
const mockSearchAssets = jest.fn();
const mockSetSearchPrisma = jest.fn();
const mockTaskListTasks = jest.fn();
const mockTaskGetTask = jest.fn();
const mockTaskClaimTask = jest.fn();
const mockTaskCompleteTask = jest.fn();
const mockTaskReleaseTask = jest.fn();
const mockTaskSubmitTaskAnswer = jest.fn();
const mockTaskAcceptSubmission = jest.fn();
const mockTaskGetSubmissions = jest.fn();
const mockTaskProposeTaskDecomposition = jest.fn();
const mockTaskSetTaskCommitment = jest.fn();
const mockTaskGetEligibleNodeCount = jest.fn();
const mockTaskGetAssetById = jest.fn();
const mockGetSwarm = jest.fn();
const mockForkRecipe = jest.fn();
const mockArchiveRecipe = jest.fn();
const mockGetAssetDetail = jest.fn();
const mockWorkTaskFindMany = jest.fn();
const mockWorkTaskCount = jest.fn();
const mockDisputeFindUnique = jest.fn();
const mockRecipeFindMany = jest.fn();
const mockRecipeCount = jest.fn();
const mockRecipeFindUnique = jest.fn();
const mockOrganismCreate = jest.fn();
const mockCollaborationSessionCreate = jest.fn();
let currentPrisma: unknown;
const freshTimestamp = () => new Date().toISOString();

jest.mock('../assets/service', () => ({
  ...jest.requireActual('../assets/service'),
  publishAsset: (...args: unknown[]) => mockPublishAsset(...args),
}));

jest.mock('../dispute/service', () => ({
  ...jest.requireActual('../dispute/service'),
  fileDispute: (...args: unknown[]) => mockFileDispute(...args),
  getDispute: (...args: unknown[]) => mockGetDispute(...args),
  listDisputes: (...args: unknown[]) => mockListDisputes(...args),
}));

jest.mock('../bounty/service', () => ({
  ...jest.requireActual('../bounty/service'),
  createBounty: (...args: unknown[]) => mockCreateBounty(...args),
  withdrawBid: (...args: unknown[]) => mockWithdrawBid(...args),
}));

jest.mock('../marketplace/service.marketplace', () => ({
  ...jest.requireActual('../marketplace/service.marketplace'),
  setPrisma: (...args: unknown[]) => mockSetServiceMarketplacePrisma(...args),
  searchServiceListings: (...args: unknown[]) => mockSearchServiceListings(...args),
  createServiceListing: (...args: unknown[]) => mockCreateServiceListing(...args),
  purchaseService: (...args: unknown[]) => mockPurchaseService(...args),
  rateService: (...args: unknown[]) => mockRateService(...args),
  updateServiceListing: (...args: unknown[]) => mockUpdateServiceListing(...args),
}));

jest.mock('../skill_store/service', () => ({
  ...jest.requireActual('../skill_store/service'),
  setPrisma: (...args: unknown[]) => mockSetSkillStorePrisma(...args),
  listSkills: (...args: unknown[]) => mockListSkills(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  getFeaturedSkills: (...args: unknown[]) => mockGetFeaturedSkills(...args),
  rateSkill: (...args: unknown[]) => mockRateSkill(...args),
  downloadSkill: (...args: unknown[]) => mockDownloadSkill(...args),
  publishSkillWithUpdates: (...args: unknown[]) => mockPublishSkillWithUpdates(...args),
}));

jest.mock('../session/service', () => ({
  ...jest.requireActual('../session/service'),
  setPrisma: (...args: unknown[]) => mockSetSessionPrisma(...args),
  sendMessage: (...args: unknown[]) => mockSendSessionMessage(...args),
  joinSession: (...args: unknown[]) => mockJoinSession(...args),
  listSessions: (...args: unknown[]) => mockListSessions(...args),
  listSessionsForNode: (...args: unknown[]) => mockListSessionsForNode(...args),
  getSessionBoard: (...args: unknown[]) => mockGetSessionBoard(...args),
  updateSessionBoard: (...args: unknown[]) => mockUpdateSessionBoard(...args),
  orchestrateSession: (...args: unknown[]) => mockOrchestrateSession(...args),
  submitSessionResult: (...args: unknown[]) => mockSubmitSessionResult(...args),
  getSessionContext: (...args: unknown[]) => mockGetSessionContext(...args),
}));

jest.mock('../search/service', () => ({
  ...jest.requireActual('../search/service'),
  setPrisma: (...args: unknown[]) => mockSetSearchPrisma(...args),
  search: (...args: unknown[]) => mockSearchAssets(...args),
}));

jest.mock('../task/service', () => ({
  ...jest.requireActual('../task/service'),
  listTasks: (...args: unknown[]) => mockTaskListTasks(...args),
  getTask: (...args: unknown[]) => mockTaskGetTask(...args),
  claimTask: (...args: unknown[]) => mockTaskClaimTask(...args),
  completeTask: (...args: unknown[]) => mockTaskCompleteTask(...args),
  releaseTask: (...args: unknown[]) => mockTaskReleaseTask(...args),
  submitTaskAnswer: (...args: unknown[]) => mockTaskSubmitTaskAnswer(...args),
  acceptSubmission: (...args: unknown[]) => mockTaskAcceptSubmission(...args),
  getSubmissions: (...args: unknown[]) => mockTaskGetSubmissions(...args),
  proposeTaskDecomposition: (...args: unknown[]) => mockTaskProposeTaskDecomposition(...args),
  setTaskCommitment: (...args: unknown[]) => mockTaskSetTaskCommitment(...args),
  getEligibleNodeCount: (...args: unknown[]) => mockTaskGetEligibleNodeCount(...args),
  getAssetById: (...args: unknown[]) => mockTaskGetAssetById(...args),
}));

jest.mock('../swarm/service', () => ({
  ...jest.requireActual('../swarm/service'),
  getSwarm: (...args: unknown[]) => mockGetSwarm(...args),
}));

jest.mock('../recipe/service', () => ({
  ...jest.requireActual('../recipe/service'),
  archiveRecipe: (...args: unknown[]) => mockArchiveRecipe(...args),
  forkRecipe: (...args: unknown[]) => mockForkRecipe(...args),
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  listAssets: (...args: unknown[]) => mockListAssets(...args),
  sendDm: (...args: unknown[]) => mockSendDm(...args),
  getInbox: (...args: unknown[]) => mockGetInbox(...args),
  getSentDms: (...args: unknown[]) => mockGetSentDms(...args),
  markInboxRead: (...args: unknown[]) => mockMarkInboxRead(...args),
  markDmRead: (...args: unknown[]) => mockMarkDmRead(...args),
}));

jest.mock('./assets_service', () => ({
  ...jest.requireActual('./assets_service'),
  getAssetDetail: (...args: unknown[]) => mockGetAssetDetail(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => mockRequireAuth(),
  authenticate: (request: unknown) => mockAuthenticate(request),
}));

// ─── App factory ───────────────────────────────────────────────────────────────

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  currentPrisma = {
    workerTask: {
      findMany: mockWorkTaskFindMany,
      count: mockWorkTaskCount,
    },
    worker: {
      count: mockWorkerDirectoryCount,
      findMany: mockWorkerDirectoryFindMany,
    },
    dispute: {
      findUnique: mockDisputeFindUnique,
    },
    recipe: {
      findMany: mockRecipeFindMany,
      count: mockRecipeCount,
      findUnique: mockRecipeFindUnique,
    },
    organism: {
      create: mockOrganismCreate,
    },
    collaborationSession: {
      create: mockCollaborationSessionCreate,
    },
  };
  app.decorate('prisma', currentPrisma as any);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /a2a/publish', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    // Register with the same prefix as app.ts production config
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 400 when protocol field is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('protocol');
  });

  it('should return 400 when protocol does not match the GEP-A2A protocol name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'not-gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_bad_protocol',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('protocol must');
  });

  it('should return 400 when protocol_version does not match the supported version', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '9.9.9',
        message_type: 'publish',
        message_id: 'msg_bad_version',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('protocol_version must');
  });

  it('should return 400 when message_type is not "publish"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_id: 'msg_invalid_type',
        message_type: 'validate',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('message_type');
  });

  it('should return 400 when message_id is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('message_id');
  });

  it('should return 400 when message_id format is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'bad id',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('message_id');
  });

  it('should return 403 when sender_id does not match the authenticated node', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_sender_mismatch',
        sender_id: 'node-spoofed',
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(403);
    expect(mockPublishAsset).not.toHaveBeenCalled();
  });

  it('should return 400 when timestamp is stale', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_stale',
        sender_id: mockNodeId,
        timestamp: '2020-01-15T08:31:40Z',
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(mockPublishAsset).not.toHaveBeenCalled();
  });

  it('should return 400 when timestamp is not a UTC ISO-8601 string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_bad_timestamp',
        sender_id: mockNodeId,
        timestamp: '2026-01-01 00:00:00',
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:test' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('UTC ISO-8601');
    expect(mockPublishAsset).not.toHaveBeenCalled();
  });

  it('should return 400 when payload is not an object', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_bad_payload',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: ['not-an-object'],
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('payload');
    expect(mockPublishAsset).not.toHaveBeenCalled();
  });

  it('should return 400 when payload.assets is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_missing_assets',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: {},
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('payload.assets');
  });

  it('should return 400 when payload.assets is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_empty_assets',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).message).toContain('payload.assets');
  });

  it('should return 400 when Gene asset is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_missing_gene',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Capsule', asset_id: 'sha256:capsule123' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('Gene');
  });

  it('should return 400 when Gene.asset_id does not start with sha256:', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_bad_asset',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'just-a-hash' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toContain('sha256');
  });

  it('should call publishAsset with correct PublishPayload mapping from Gene.summary', async () => {
    const mockResult = {
      status: 'ok' as const,
      asset_id: 'asset-created-001',
      asset_type: 'gene' as const,
      gdi_score: 60,
      carbon_cost: 5,
      similarity_check: [],
    };
    mockPublishAsset.mockResolvedValue(mockResult);

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_123',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: {
          assets: [
            {
              type: 'Gene',
              schema_version: '1.5.0',
              category: 'repair',
              signals_match: ['TimeoutError', 'NetworkError'],
              summary: 'Retry with exponential backoff on timeout errors',
              asset_id: 'sha256:abc123def456',
            },
            {
              type: 'Capsule',
              asset_id: 'sha256:capsule456',
              gene: 'sha256:abc123def456',
            },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.asset_id).toBe('asset-created-001');

    // Verify protocol format -> PublishPayload mapping
    expect(mockPublishAsset).toHaveBeenCalledTimes(1);
    const [nodeId, publishPayload] = mockPublishAsset.mock.calls[0]!;
    expect(nodeId).toBe(mockNodeId);
    expect(publishPayload.name).toBe('Retry with exponential backoff on timeout errors');
    expect(publishPayload.description).toBe('Retry with exponential backoff on timeout errors');
    expect(publishPayload.signals).toEqual(['repair', 'TimeoutError', 'NetworkError']);
    expect(publishPayload.gene_ids).toEqual(['sha256:abc123def456', 'sha256:capsule456']);
    expect(publishPayload.source_message_id).toBe('msg_123');
  });

  it('should use asset_id as fallback name when summary is missing', async () => {
    mockPublishAsset.mockResolvedValue({
      status: 'ok',
      asset_id: 'asset-001',
      asset_type: 'gene',
      gdi_score: 60,
      carbon_cost: 5,
      similarity_check: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_fallback_name',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:onlyid', category: 'test' }] },
      },
    });

    expect(res.statusCode).toBe(201);
    const [, publishPayload] = mockPublishAsset.mock.calls[0]!;
    expect(publishPayload.name).toBe('sha256:onlyid');
    expect(publishPayload.description).toBe('');
    expect(publishPayload.signals).toEqual(['test']);
  });

  it('should include validated_assets count in response', async () => {
    mockPublishAsset.mockResolvedValue({
      status: 'ok',
      asset_id: 'asset-001',
      asset_type: 'gene',
      gdi_score: 60,
      carbon_cost: 5,
      similarity_check: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_validated_assets',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: {
          assets: [
            { type: 'Gene', asset_id: 'sha256:gene1', summary: 'Gene 1' },
            { type: 'Capsule', asset_id: 'sha256:cap1' },
            { type: 'EvolutionEvent', asset_id: 'sha256:evt1' },
          ],
        },
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.validated_assets).toBe(3);
  });

  it('should pass through publishAsset errors', async () => {
    mockPublishAsset.mockRejectedValue(new ValidationError('Insufficient credits'));

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        message_type: 'publish',
        message_id: 'msg_publish_error',
        sender_id: mockNodeId,
        timestamp: freshTimestamp(),
        payload: { assets: [{ type: 'Gene', asset_id: 'sha256:gene1', summary: 'Test Gene' }] },
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.message).toBe('Insufficient credits');
  });
});

describe('GET /a2a/assets', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects unauthenticated non-public asset listings', async () => {
    mockAuthenticate.mockRejectedValueOnce(new UnauthorizedError());

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets?status=draft',
    });

    expect(res.statusCode).toBe(401);
    expect(mockListAssets).not.toHaveBeenCalled();
  });

  it('scopes authenticated non-public asset listings to the caller even when author_id is provided', async () => {
    mockListAssets.mockResolvedValue({ assets: [], total: 0 });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets?status=draft&author_id=node-other',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockListAssets).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      author_id: mockNodeId,
      requester_node_id: mockNodeId,
    }));
  });
});

describe('A2A service marketplace routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should list services via marketplace search helper', async () => {
    mockSearchServiceListings.mockResolvedValue({
      items: [{ listing_id: 'svc-1', title: 'Review service' }],
      total: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/service/list?category=engineering&limit=5&offset=2',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ listing_id: 'svc-1', title: 'Review service' }]);
    expect(body.meta.total).toBe(1);
    expect(mockSearchServiceListings).toHaveBeenCalledWith({
      category: 'engineering',
      limit: 5,
      offset: 2,
    }, currentPrisma);
  });

  it('should support legacy GET service search with q', async () => {
    mockSearchServiceListings.mockResolvedValue({
      items: [{ listing_id: 'svc-legacy' }],
      total: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/service/search?q=review&category=engineering&limit=3&offset=1',
    });

    expect(res.statusCode).toBe(200);
    expect(mockSearchServiceListings).toHaveBeenCalledWith({
      query: 'review',
      category: 'engineering',
      limit: 3,
      offset: 1,
    }, currentPrisma);
  });

  it('should reject invalid service list pagination before calling the helper', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/a2a/service/list?limit=abc',
    });

    expect(res.statusCode).toBe(400);
    expect(mockSearchServiceListings).not.toHaveBeenCalled();
  });

  it('should publish a service via marketplace service', async () => {
    mockCreateServiceListing.mockResolvedValue({
      listing_id: 'svc-1',
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        title: 'Review service',
        description: 'I review code',
        price: 25,
        category: 'engineering',
        tags: ['typescript'],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.service_id).toBe('svc-1');
    expect(body.data.status).toBe('active');
    expect(mockCreateServiceListing).toHaveBeenCalledWith(mockNodeId, {
      title: 'Review service',
      description: 'I review code',
      category: 'engineering',
      tags: ['typescript'],
      price_type: 'one_time',
      price_credits: 25,
      license_type: 'open_source',
    }, currentPrisma);
  });

  it('should accept legacy publish payload aliases', async () => {
    mockCreateServiceListing.mockResolvedValue({
      listing_id: 'svc-legacy',
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: mockNodeId,
        title: 'Legacy service',
        description: 'Compat',
        price_per_task: 15,
        category: 'engineering',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockCreateServiceListing).toHaveBeenCalledWith(mockNodeId, {
      title: 'Legacy service',
      description: 'Compat',
      category: 'engineering',
      tags: [],
      price_type: 'one_time',
      price_credits: 15,
      license_type: 'open_source',
    }, currentPrisma);
  });

  it('should reject user-backed identities for marketplace publish', async () => {
    mockNodeId = 'user-123';

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/publish',
      headers: { authorization: 'Bearer test' },
      payload: {
        title: 'Review service',
        description: 'I review code',
        price: 25,
        category: 'engineering',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(mockCreateServiceListing).not.toHaveBeenCalled();
  });

  it('should order a service via marketplace service', async () => {
    mockPurchaseService.mockResolvedValue({
      purchase_id: 'pur-1',
      listing_id: 'svc-1',
      status: 'pending',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/order',
      headers: { authorization: 'Bearer test' },
      payload: {
        service_id: 'svc-1',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.order_id).toBe('pur-1');
    expect(body.data.service_id).toBe('svc-1');
    expect(body.data.status).toBe('pending');
    expect(mockPurchaseService).toHaveBeenCalledWith(mockNodeId, 'svc-1', currentPrisma);
  });

  it('should accept legacy listing_id on order requests', async () => {
    mockPurchaseService.mockResolvedValue({
      purchase_id: 'pur-legacy',
      listing_id: 'svc-legacy',
      status: 'pending',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/order',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: mockNodeId,
        listing_id: 'svc-legacy',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockPurchaseService).toHaveBeenCalledWith(mockNodeId, 'svc-legacy', currentPrisma);
  });

  it('should reject missing service_id on order requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/order',
      headers: { authorization: 'Bearer test' },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(mockPurchaseService).not.toHaveBeenCalled();
  });

  it('should reject bodyless order requests with a validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/order',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockPurchaseService).not.toHaveBeenCalled();
  });

  it('should rate a service via marketplace service', async () => {
    mockRateService.mockResolvedValue({
      review_id: 'srvrev-1',
      rating: 5,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/rate',
      headers: { authorization: 'Bearer test' },
      payload: {
        service_id: 'svc-1',
        rating: 5,
        review: 'Great',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.rated).toBe(true);
    expect(body.data.review_id).toBe('srvrev-1');
    expect(mockRateService).toHaveBeenCalledWith(mockNodeId, 'svc-1', 5, 'Great', currentPrisma);
  });

  it('should accept legacy comment and listing_id fields when rating', async () => {
    mockRateService.mockResolvedValue({
      review_id: 'srvrev-legacy',
      rating: 4,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/rate',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: mockNodeId,
        listing_id: 'svc-legacy',
        rating: 4,
        comment: 'Legacy review',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockRateService).toHaveBeenCalledWith(mockNodeId, 'svc-legacy', 4, 'Legacy review', currentPrisma);
  });

  it('should reject bodyless rating requests with a validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/rate',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockRateService).not.toHaveBeenCalled();
  });

  it('should update a service via marketplace service', async () => {
    mockUpdateServiceListing.mockResolvedValue({
      listing_id: 'svc-1',
      status: 'paused',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/update',
      headers: { authorization: 'Bearer test' },
      payload: {
        service_id: 'svc-1',
        title: 'Updated service',
        description: 'Updated desc',
        price: 10,
        status: 'paused',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.service_id).toBe('svc-1');
    expect(body.data.updated).toBe(true);
    expect(body.data.status).toBe('paused');
    expect(mockUpdateServiceListing).toHaveBeenCalledWith(mockNodeId, 'svc-1', {
      title: 'Updated service',
      description: 'Updated desc',
      price_credits: 10,
      status: 'paused',
    }, currentPrisma);
  });

  it('should accept legacy update aliases', async () => {
    mockUpdateServiceListing.mockResolvedValue({
      listing_id: 'svc-legacy',
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/update',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: mockNodeId,
        listing_id: 'svc-legacy',
        price_per_task: 20,
        status: 'active',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpdateServiceListing).toHaveBeenCalledWith(mockNodeId, 'svc-legacy', {
      title: undefined,
      description: undefined,
      price_credits: 20,
      status: 'active',
    }, currentPrisma);
  });

  it('should reject invalid update statuses before calling the service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/update',
      headers: { authorization: 'Bearer test' },
      payload: {
        service_id: 'svc-1',
        status: 'deleted',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(mockUpdateServiceListing).not.toHaveBeenCalled();
  });

  it('should reject bodyless update requests with a validation error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/service/update',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockUpdateServiceListing).not.toHaveBeenCalled();
  });
});

describe('A2A skill routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should search skills via GET and pass app prisma', async () => {
    mockListSkills.mockResolvedValue({
      items: [{ skill_id: 'skill-1', name: 'TypeScript review' }],
      total: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/skill/search?q=review&category=engineering&tags=typescript&limit=5&offset=2&sort=rating',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.total).toBe(1);
    expect(mockListSkills).toHaveBeenCalledWith(
      'engineering',
      ['typescript'],
      'review',
      5,
      2,
      'rating',
      currentPrisma,
    );
  });

  it('should search skills via POST and pass app prisma', async () => {
    mockListSkills.mockResolvedValue({
      items: [{ skill_id: 'skill-2', name: 'Refactor helper' }],
      total: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/skill/search',
      payload: {
        q: 'refactor',
        category: 'engineering',
        tags: ['cleanup'],
        limit: 3,
        offset: 1,
        sort: 'downloads',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockListSkills).toHaveBeenCalledWith(
      'engineering',
      ['cleanup'],
      'refactor',
      3,
      1,
      'downloads',
      currentPrisma,
    );
  });

  it('should list skill categories and featured skills with app prisma', async () => {
    mockGetCategories.mockResolvedValue([{ category: 'engineering', count: 2 }]);
    mockGetFeaturedSkills.mockResolvedValue([{ skill_id: 'skill-1' }]);

    const [categoriesRes, featuredRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/a2a/skill/categories',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/skill/featured?limit=4',
      }),
    ]);

    expect(categoriesRes.statusCode).toBe(200);
    expect(featuredRes.statusCode).toBe(200);
    expect(mockGetCategories).toHaveBeenCalledWith(currentPrisma);
    expect(mockGetFeaturedSkills).toHaveBeenCalledWith(4, currentPrisma);
  });

  it('should rate a skill via skill store service', async () => {
    mockRateSkill.mockResolvedValue({
      skill_id: 'skill-1',
      rater_id: mockNodeId,
      rating: 5,
      created_at: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/skill/skill-1/rate',
      headers: { authorization: 'Bearer test' },
      payload: { rating: 5 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.skill_id).toBe('skill-1');
    expect(body.data.rating).toBe(5);
    expect(mockRateSkill).toHaveBeenCalledWith('skill-1', mockNodeId, 5, currentPrisma);
  });

  it('should reject unsupported review text when rating a skill', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/skill/skill-1/rate',
      headers: { authorization: 'Bearer test' },
      payload: { rating: 5, review: 'Great' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockRateSkill).not.toHaveBeenCalled();
  });

  it('should download a skill via skill store service', async () => {
    mockDownloadSkill.mockResolvedValue({
      skill_id: 'skill-1',
      download_count: 7,
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/skill/skill-1/download',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.skill_id).toBe('skill-1');
    expect(body.data.download_count).toBe(7);
    expect(mockDownloadSkill).toHaveBeenCalledWith('skill-1', mockNodeId, currentPrisma);
  });

  it('should publish a skill via skill store service and apply optional metadata updates', async () => {
    mockPublishSkillWithUpdates.mockResolvedValue({
      skill_id: 'skill-1',
      status: 'published',
      category: 'engineering',
      price_credits: 25,
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/skill/skill-1/publish',
      headers: { authorization: 'Bearer test' },
      payload: { category: 'engineering', price: 25 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.skill_id).toBe('skill-1');
    expect(body.data.status).toBe('published');
    expect(mockPublishSkillWithUpdates).toHaveBeenCalledWith('skill-1', mockNodeId, {
      category: 'engineering',
      price_credits: 25,
    }, currentPrisma);
  });

  it('should reject fractional publish prices at the route boundary', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/skill/skill-1/publish',
      headers: { authorization: 'Bearer test' },
      payload: { category: 'engineering', price: 12.5 },
    });

    expect(res.statusCode).toBe(400);
    expect(mockPublishSkillWithUpdates).not.toHaveBeenCalled();
  });
});

describe('A2A session alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should fetch a session board via session service', async () => {
    mockGetSessionBoard.mockResolvedValue({
      session_id: 'session-1',
      board: { items: [{ id: 'item-1', type: 'note', content: 'hello' }], pinned: ['item-1'] },
      updated_at: '2026-01-01T00:00:00Z',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/session/board?session_id=session-1',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.session_id).toBe('session-1');
    expect(body.data.board.pinned).toEqual(['item-1']);
    expect(mockGetSessionBoard).toHaveBeenCalledWith('session-1', mockNodeId, currentPrisma);
  });

  it('should update a session board via session service', async () => {
    mockUpdateSessionBoard.mockResolvedValue({
      session_id: 'session-1',
      action: 'add',
      board: { items: [{ id: 'item-1', type: 'note', content: 'hello' }], pinned: [] },
      updated_by: mockNodeId,
      updated_at: '2026-01-01T00:00:00Z',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/session/board/update',
      headers: { authorization: 'Bearer test' },
      payload: {
        session_id: 'session-1',
        action: 'add',
        item: { id: 'item-1', type: 'note', content: 'hello' },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockUpdateSessionBoard).toHaveBeenCalledWith(
      'session-1',
      mockNodeId,
      'add',
      { id: 'item-1', type: 'note', content: 'hello' },
      undefined,
      currentPrisma,
    );
  });

  it('should orchestrate a session via session service', async () => {
    mockOrchestrateSession.mockResolvedValue({
      orchestration_id: 'orch-1',
      session_id: 'session-1',
      mode: 'parallel',
      status: 'started',
      started_by: mockNodeId,
      started_at: '2026-01-01T00:00:00Z',
      task_graph: [{ task_id: 'task-1' }],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/session/orchestrate',
      headers: { authorization: 'Bearer test' },
      payload: {
        session_id: 'session-1',
        sender_id: mockNodeId,
        mode: 'parallel',
        task_graph: [{ task_id: 'task-1' }],
        force_converge: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockOrchestrateSession).toHaveBeenCalledWith(
      'session-1',
      mockNodeId,
      {
        mode: 'parallel',
        task_graph: [{ task_id: 'task-1' }],
        reassign: undefined,
        force_converge: true,
        task_board_updates: undefined,
      },
      currentPrisma,
    );
  });

  it('should list sessions for the authenticated node only', async () => {
    mockListSessionsForNode.mockResolvedValue({
      sessions: [{ id: 'session-1' }],
      total: 1,
      limit: 10,
      offset: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/session/list?status=active&limit=10&offset=2',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockListSessionsForNode).toHaveBeenCalledWith(mockNodeId, {
      status: 'active',
      limit: 10,
      offset: 2,
    }, currentPrisma);
  });

  it('should submit a session result via session service', async () => {
    mockSubmitSessionResult.mockResolvedValue({
      submission_id: 'sub-1',
      session_id: 'session-1',
      task_id: 'task-1',
      result_asset_id: 'sha256:asset-1',
      submitted_by: mockNodeId,
      submitted_at: '2026-01-01T00:00:00Z',
      summary: 'done',
      result: { ok: true },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/session/submit',
      headers: { authorization: 'Bearer test' },
      payload: {
        session_id: 'session-1',
        sender_id: mockNodeId,
        task_id: 'task-1',
        result_asset_id: 'sha256:asset-1',
        result: { ok: true },
        summary: 'done',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSubmitSessionResult).toHaveBeenCalledWith(
      'session-1',
      mockNodeId,
      'task-1',
      'sha256:asset-1',
      { result: { ok: true }, summary: 'done' },
      currentPrisma,
    );
  });

  it('should reject empty session submit identifiers', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/session/submit',
      headers: { authorization: 'Bearer test' },
      payload: {
        session_id: 'session-1',
        sender_id: mockNodeId,
        task_id: '',
        result_asset_id: '',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(mockSubmitSessionResult).not.toHaveBeenCalled();
  });

  it('should fetch session context via session service', async () => {
    mockGetSessionContext.mockResolvedValue({
      session_id: 'session-1',
      messages: [{ id: 'msg-1' }],
      participants: [{ node_id: mockNodeId }],
      shared_state: { phase: 'active' },
      board: { items: [], pinned: [] },
      orchestrations: [],
      submissions: [],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/a2a/session/context?session_id=session-1&node_id=${mockNodeId}&limit=5`,
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetSessionContext).toHaveBeenCalledWith('session-1', mockNodeId, 5, currentPrisma);
  });
});

describe('A2A task alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists tasks through the A2A alias with status filtering and pagination', async () => {
    mockTaskListTasks.mockResolvedValue([
      {
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Open task 1',
        description: '',
        status: 'open',
        assignee_id: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        task_id: 't-2',
        project_id: 'p-1',
        title: 'Closed task',
        description: '',
        status: 'completed',
        assignee_id: 'node-2',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        task_id: 't-3',
        project_id: 'p-1',
        title: 'Open task 2',
        description: '',
        status: 'open',
        assignee_id: null,
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/task/list?status=open&limit=1&offset=1',
    });

    expect(res.statusCode).toBe(200);
    expect(mockTaskListTasks).toHaveBeenCalledWith('__all__');
    expect(JSON.parse(res.payload)).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          task_id: 't-3',
          status: 'open',
        }),
      ],
      meta: {
        total: 2,
        limit: 1,
        offset: 1,
      },
    });
  });

  it('claims tasks through the documented A2A alias and validates node ownership', async () => {
    mockTaskClaimTask.mockResolvedValue({
      task_id: 't-1',
      project_id: 'p-1',
      title: 'Claimed task',
      description: '',
      status: 'in_progress',
      assignee_id: mockNodeId,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const okRes = await app.inject({
      method: 'POST',
      url: '/a2a/task/claim',
      headers: { authorization: 'Bearer test' },
      payload: {
        task_id: 'p-1:t-1',
        node_id: mockNodeId,
      },
    });

    expect(okRes.statusCode).toBe(200);
    expect(mockTaskClaimTask).toHaveBeenCalledWith('p-1', 't-1', mockNodeId);

    const forbiddenRes = await app.inject({
      method: 'POST',
      url: '/a2a/task/claim',
      headers: { authorization: 'Bearer test' },
      payload: {
        task_id: 'p-1:t-1',
        node_id: 'node-other',
      },
    });

    expect(forbiddenRes.statusCode).toBe(403);
  });

  it('supports release and my-task aliases for authenticated nodes', async () => {
    mockTaskReleaseTask.mockResolvedValue({
      task_id: 't-1',
      project_id: 'p-1',
      title: 'Released task',
      description: '',
      status: 'open',
      assignee_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
    mockTaskListTasks.mockResolvedValue([
      {
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Mine',
        description: '',
        status: 'in_progress',
        assignee_id: mockNodeId,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        task_id: 't-2',
        project_id: 'p-1',
        title: 'Other',
        description: '',
        status: 'in_progress',
        assignee_id: 'node-2',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const [releaseRes, myRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/a2a/task/release',
        headers: { authorization: 'Bearer test' },
        payload: {
          task_id: 'p-1:t-1',
          node_id: mockNodeId,
        },
      }),
      app.inject({
        method: 'GET',
        url: `/a2a/task/my?node_id=${mockNodeId}&status=in_progress`,
        headers: { authorization: 'Bearer test' },
      }),
    ]);

    expect(releaseRes.statusCode).toBe(200);
    expect(myRes.statusCode).toBe(200);
    expect(mockTaskReleaseTask).toHaveBeenCalledWith('p-1', 't-1', mockNodeId);
    expect(JSON.parse(myRes.payload).data).toEqual([
      expect.objectContaining({
        task_id: 't-1',
        assignee_id: mockNodeId,
      }),
    ]);
  });

  it('submits task answers through the A2A alias and validates followup questions', async () => {
    mockTaskGetAssetById.mockResolvedValue({ asset_id: 'sha256:asset-1' });
    mockTaskSubmitTaskAnswer.mockResolvedValue({
      submission_id: 'sub-1',
      task_id: 'p-1:t-1',
      submitter_id: mockNodeId,
      asset_id: 'sha256:asset-1',
      node_id: mockNodeId,
      status: 'pending',
    });

    const okRes = await app.inject({
      method: 'POST',
      url: '/a2a/task/submit',
      headers: { authorization: 'Bearer test' },
      payload: {
        task_id: 'p-1:t-1',
        asset_id: 'sha256:asset-1',
        node_id: mockNodeId,
        followup_question: 'What evidence supports this conclusion?',
      },
    });

    expect(okRes.statusCode).toBe(201);
    expect(mockTaskSubmitTaskAnswer).toHaveBeenCalledWith('p-1:t-1', mockNodeId, 'sha256:asset-1', mockNodeId);

    const badRes = await app.inject({
      method: 'POST',
      url: '/a2a/task/submit',
      headers: { authorization: 'Bearer test' },
      payload: {
        task_id: 'p-1:t-1',
        node_id: mockNodeId,
        followup_question: 'no',
      },
    });

    expect(badRes.statusCode).toBe(400);
  });

  it('forwards task detail, submissions, acceptance, commitment, decomposition, swarm, and eligibility aliases', async () => {
    mockTaskGetTask.mockResolvedValue({
      task_id: 't-1',
      project_id: 'p-1',
      title: 'Alias task',
      description: '',
      status: 'in_progress',
      assignee_id: mockNodeId,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    mockTaskGetSubmissions.mockResolvedValue([{ submission_id: 'sub-1' }]);
    mockTaskAcceptSubmission.mockResolvedValue({ submission_id: 'sub-1', status: 'accepted' });
    mockTaskSetTaskCommitment.mockResolvedValue({
      task_id: 'p-1:t-1',
      node_id: mockNodeId,
      deadline: '2026-01-03T00:00:00.000Z',
      committed_by: mockNodeId,
      committed_at: '2026-01-02T00:00:00.000Z',
    });
    mockTaskProposeTaskDecomposition.mockResolvedValue({
      original_task_id: 'p-1:t-1',
      decomposition_id: 'swarm-1',
      sub_tasks: [],
      estimated_parallelism: 1,
      proposed_at: '2026-01-02T00:00:00.000Z',
    });
    mockTaskGetEligibleNodeCount.mockResolvedValue(4);
    mockGetSwarm.mockResolvedValue({
      swarm_id: 'swarm-1',
      creator_id: mockNodeId,
      subtasks: [],
    });

    const [detailRes, submissionsRes, acceptRes, commitmentRes, decomposeRes, swarmRes, eligibleRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/a2a/task/p-1:t-1',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/task/p-1:t-1/submissions',
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/task/accept-submission',
        headers: { authorization: 'Bearer test' },
        payload: {
          task_id: 'p-1:t-1',
          submission_id: 'sub-1',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/task/p-1:t-1/commitment',
        headers: { authorization: 'Bearer test' },
        payload: {
          node_id: mockNodeId,
          deadline: '2026-01-03T00:00:00.000Z',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/a2a/task/propose-decomposition',
        headers: { authorization: 'Bearer test' },
        payload: {
          task_id: 'p-1:t-1',
          sender_id: mockNodeId,
          subtasks: ['Research'],
        },
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/task/swarm/swarm-1',
        headers: { authorization: 'Bearer test' },
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/task/eligible-count?min_reputation=55',
      }),
    ]);

    expect(detailRes.statusCode).toBe(200);
    expect(submissionsRes.statusCode).toBe(200);
    expect(acceptRes.statusCode).toBe(200);
    expect(commitmentRes.statusCode).toBe(200);
    expect(decomposeRes.statusCode).toBe(201);
    expect(swarmRes.statusCode).toBe(200);
    expect(eligibleRes.statusCode).toBe(200);
    expect(mockTaskGetTask).toHaveBeenCalledWith('p-1', 't-1');
    expect(mockTaskGetSubmissions).toHaveBeenCalledWith('p-1:t-1');
    expect(mockTaskAcceptSubmission).toHaveBeenCalledWith('p-1:t-1', 'sub-1', mockNodeId);
    expect(mockTaskSetTaskCommitment).toHaveBeenCalledWith('p-1:t-1', mockNodeId, '2026-01-03T00:00:00.000Z');
    expect(mockTaskProposeTaskDecomposition).toHaveBeenCalledWith('p-1:t-1', mockNodeId, ['Research'], undefined);
    expect(mockTaskGetEligibleNodeCount).toHaveBeenCalledWith(55);
  });
});

describe('A2A bid routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should withdraw a bid via bounty service', async () => {
    mockWithdrawBid.mockResolvedValue({
      bid_id: 'bid-1',
      bidder_id: mockNodeId,
      status: 'withdrawn',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/bid/withdraw',
      headers: { authorization: 'Bearer test' },
      payload: { bid_id: 'bid-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.status).toBe('withdrawn');
    expect(mockWithdrawBid).toHaveBeenCalledWith('bid-1', mockNodeId);
  });

  it('should reject missing bid_id before calling bounty service', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/bid/withdraw',
      headers: { authorization: 'Bearer test' },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(mockWithdrawBid).not.toHaveBeenCalled();
  });

  it('should create a bid request without self-bidding', async () => {
    mockCreateBounty.mockResolvedValue({
      bounty_id: 'bounty-1',
      creator_id: mockNodeId,
      status: 'open',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/bid/place',
      headers: { authorization: 'Bearer test' },
      payload: {
        amount: 50,
        estimatedTime: '2h',
        approach: 'Implement the feature cleanly',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockCreateBounty).toHaveBeenCalledWith(
      mockNodeId,
      expect.stringContaining('Bid Request:'),
      'Implement the feature cleanly',
      [],
      50,
      expect.any(String),
    );
    expect(JSON.parse(res.payload).data.bid).toBeNull();
  });

  it('should reject bodyless bid placement requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/bid/place',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockCreateBounty).not.toHaveBeenCalled();
  });
});

describe('A2A direct message routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts recipient_id alias when sending a direct message', async () => {
    mockSendDm.mockResolvedValue({
      dm_id: 'dm-1',
      from_id: mockNodeId,
      to_id: 'node-target',
      created_at: freshTimestamp(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/dm',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: mockNodeId,
        recipient_id: 'node-target',
        content: 'Hello there',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSendDm).toHaveBeenCalledWith(mockNodeId, 'node-target', 'Hello there');
  });

  it('rejects a mismatched sender_id for direct messages', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/dm',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: 'node-spoofed',
        recipient_id: 'node-target',
        content: 'Hello there',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(mockSendDm).not.toHaveBeenCalled();
  });

  it('supports unread alias on inbox responses and returns unread meta', async () => {
    mockGetInbox.mockResolvedValue({
      messages: [{ dm_id: 'dm-1', from_id: 'node-2', content: 'Ping', read: false }],
      total: 3,
      unread: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/dm/inbox?unread=true&limit=4&offset=1',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetInbox).toHaveBeenCalledWith(mockNodeId, {
      read: false,
      limit: 4,
      offset: 1,
    });
    expect(JSON.parse(res.payload).meta).toEqual({
      total: 3,
      unread: 2,
    });
  });

  it('lists sent direct messages', async () => {
    mockGetSentDms.mockResolvedValue({
      messages: [{ dm_id: 'dm-2', to_id: 'node-target', content: 'Sent message', read: true }],
      total: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/dm/sent?limit=5&offset=2',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetSentDms).toHaveBeenCalledWith(mockNodeId, {
      limit: 5,
      offset: 2,
    });
  });

  it('marks a single direct message as read', async () => {
    mockMarkDmRead.mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/dm/dm-1/read',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockMarkDmRead).toHaveBeenCalledWith(mockNodeId, 'dm-1');
  });
});

describe('A2A directory routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns directory statistics from worker data', async () => {
    mockWorkerDirectoryCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockWorkerDirectoryFindMany.mockResolvedValue([
      { specialties: ['python', 'code_review'] },
      { specialties: ['python'] },
      { specialties: [] },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/directory/stats',
    });

    expect(res.statusCode).toBe(200);
    expect(mockWorkerDirectoryCount).toHaveBeenNthCalledWith(1);
    expect(mockWorkerDirectoryCount).toHaveBeenNthCalledWith(2, {
      where: { is_available: true },
    });
    expect(mockWorkerDirectoryFindMany).toHaveBeenCalledWith({
      select: { specialties: true },
    });
    expect(JSON.parse(res.payload).data).toEqual({
      total_agents: 3,
      online: 2,
      capabilities: {
        python: 2,
        code_review: 1,
      },
    });
  });
});

describe('A2A asset search routes', () => {
  let app: FastifyInstance;
  const mockAssetFindMany = jest.fn();
  const mockAssetCount = jest.fn();

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    (app as any).prisma.asset = {
      findMany: mockAssetFindMany,
      count: mockAssetCount,
    };
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should delegate published asset search to the search service', async () => {
    mockSearchAssets.mockResolvedValue({
      items: [{
        id: 'asset-1',
        type: 'gene',
        name: 'Retry Gene',
        description: 'desc',
        signals: ['retry'],
        tags: ['network'],
        author_id: 'node-1',
        gdi_score: 88,
        downloads: 12,
        rating: 4.5,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        metadata: { foo: 'bar' },
      }],
      total: 1,
      facets: { by_type: { gene: 1 }, by_signal: {} },
      query_time_ms: 3,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets/search?q=retry&type=gene&limit=5&offset=1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toEqual([{
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Retry Gene',
      description: 'desc',
      signals: ['retry'],
      tags: ['network'],
      author_id: 'node-1',
      gdi_score: 88,
      downloads: 12,
      rating: 4.5,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    }]);
    expect(body.data[0].metadata).toBeUndefined();
    expect(body.meta.total).toBe(1);
    expect(mockSearchAssets).toHaveBeenCalledWith({
      q: 'retry',
      type: 'gene',
      status: undefined,
      sort_by: undefined,
      limit: 5,
      offset: 1,
    }, currentPrisma);
  });

  it('should keep promoted asset searches on the public search path', async () => {
    mockSearchAssets.mockResolvedValue({
      items: [{
        id: 'asset-promoted',
        type: 'gene',
        name: 'Promoted Gene',
        description: 'desc',
        signals: ['retry'],
        tags: ['network'],
        author_id: 'node-1',
        gdi_score: 92,
        downloads: 20,
        rating: 4.8,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
        metadata: {},
      }],
      total: 1,
      facets: { by_type: { gene: 1 }, by_signal: {} },
      query_time_ms: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets/search?q=retry&status=promoted',
    });

    expect(res.statusCode).toBe(200);
    expect(mockSearchAssets).toHaveBeenCalledWith({
      q: 'retry',
      type: undefined,
      status: 'promoted',
      sort_by: undefined,
      limit: 20,
      offset: 0,
    }, currentPrisma);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('should scope non-published asset searches to the authenticated author and honor sort order', async () => {
    mockAssetFindMany.mockResolvedValue([{
      asset_id: 'asset-2',
      asset_type: 'gene',
      name: 'Draft Gene',
      description: 'private draft',
      signals: ['retry'],
      tags: ['draft'],
      author_id: mockNodeId,
      gdi_score: 61,
      downloads: 0,
      rating: 0,
      status: 'draft',
      content: 'secret body',
      config: { hidden: true },
      created_at: new Date('2026-01-03T00:00:00.000Z'),
      updated_at: new Date('2026-01-04T00:00:00.000Z'),
    }]);
    mockAssetCount.mockResolvedValue(1);

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets/search?q=retry&status=draft&type=gene&limit=5&offset=1&sort=rating',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toEqual([{
      asset_id: 'asset-2',
      asset_type: 'gene',
      name: 'Draft Gene',
      description: 'private draft',
      signals: ['retry'],
      tags: ['draft'],
      author_id: mockNodeId,
      gdi_score: 61,
      downloads: 0,
      rating: 0,
      created_at: '2026-01-03T00:00:00.000Z',
      updated_at: '2026-01-04T00:00:00.000Z',
    }]);
    expect(mockAssetFindMany).toHaveBeenCalledWith({
      where: {
        status: 'draft',
        author_id: mockNodeId,
        asset_type: 'gene',
        OR: [
          { name: { contains: 'retry', mode: 'insensitive' } },
          { description: { contains: 'retry', mode: 'insensitive' } },
          { author_id: { contains: 'retry', mode: 'insensitive' } },
          { signals: { has: 'retry' } },
          { tags: { has: 'retry' } },
        ],
      },
      orderBy: { rating: 'desc' },
      take: 5,
      skip: 1,
    });
    expect(mockAssetCount).toHaveBeenCalledWith({
      where: {
        status: 'draft',
        author_id: mockNodeId,
        asset_type: 'gene',
        OR: [
          { name: { contains: 'retry', mode: 'insensitive' } },
          { description: { contains: 'retry', mode: 'insensitive' } },
          { author_id: { contains: 'retry', mode: 'insensitive' } },
          { signals: { has: 'retry' } },
          { tags: { has: 'retry' } },
        ],
      },
    });
  });

  it('should reject unauthenticated non-published asset searches', async () => {
    mockAuthenticate.mockRejectedValueOnce(new UnauthorizedError());

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets/search?q=retry&status=draft',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('A2A dispute alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    mockAuthType = undefined;
    mockAuthScopes = undefined;
    mockFileDispute.mockResolvedValue({ dispute_id: 'dsp-1' });
    mockGetDispute.mockResolvedValue({
      dispute_id: 'dsp-1',
      plaintiff_id: mockNodeId,
      defendant_id: 'node-2',
      arbitrators: [],
    });
    mockListDisputes.mockResolvedValue({ items: [], total: 0 });
    mockDisputeFindUnique.mockResolvedValue({
      evidence: [{ evidence_id: 'evd-1' }, { evidence_id: 'evd-2' }],
    });

    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('forwards related_transaction_id without hard-coding filing fees', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/a2a/dispute/open',
      headers: { authorization: 'Bearer test' },
      payload: {
        type: 'transaction',
        defendant_id: 'node-2',
        title: 'Transaction dispute',
        description: 'The linked transaction failed.',
        related_transaction_id: 'txn-1',
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockFileDispute).toHaveBeenCalledWith(
      mockNodeId,
      expect.objectContaining({
        type: 'transaction',
        related_transaction_id: 'txn-1',
        filing_fee: undefined,
      }),
    );
  });

  it('rejects API keys from opening disputes', async () => {
    mockAuthType = 'api_key';

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/dispute/open',
      headers: { authorization: 'Bearer test' },
      payload: {
        type: 'transaction',
        defendant_id: 'node-2',
        title: 'Transaction dispute',
        description: 'The linked transaction failed.',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(mockFileDispute).not.toHaveBeenCalled();
  });

  it('caps /a2a/disputes limit to the canonical maximum', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/a2a/disputes?limit=999',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockListDisputes).toHaveBeenCalledWith(
      { node_id: mockNodeId },
      undefined,
      undefined,
      100,
      0,
    );
  });

  it('rejects malformed /a2a/disputes pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/a2a/disputes?limit=10abc',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockListDisputes).not.toHaveBeenCalled();
  });

  it('rejects excessive /a2a/disputes offsets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/a2a/disputes?offset=10001',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockListDisputes).not.toHaveBeenCalled();
  });

  it('rejects malformed dispute message pagination before dispute lookup', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/a2a/dispute/dsp-1/messages?offset=abc',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(400);
    expect(mockGetDispute).not.toHaveBeenCalled();
    expect(mockDisputeFindUnique).not.toHaveBeenCalled();
  });

  it('rejects dispute evidence access for non-participants', async () => {
    mockNodeId = 'node-outsider';
    mockGetDispute.mockResolvedValue({
      dispute_id: 'dsp-1',
      plaintiff_id: 'node-plaintiff',
      defendant_id: 'node-defendant',
      arbitrators: ['arb-1', 'arb-2', 'arb-3'],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/dispute/dsp-1/messages',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(403);
    expect(mockDisputeFindUnique).not.toHaveBeenCalled();
  });

  it('allows disputes:read:any api keys to access dispute evidence', async () => {
    mockNodeId = 'node-auditor';
    mockAuthType = 'api_key';
    mockAuthScopes = ['disputes:read:any'];
    mockGetDispute.mockResolvedValue({
      dispute_id: 'dsp-1',
      plaintiff_id: 'node-plaintiff',
      defendant_id: 'node-defendant',
      arbitrators: ['arb-1', 'arb-2', 'arb-3'],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/dispute/dsp-1/messages',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockDisputeFindUnique).toHaveBeenCalledWith({
      where: { dispute_id: 'dsp-1' },
      select: { evidence: true },
    });
  });
});

describe('A2A ranked asset routes', () => {
  let app: FastifyInstance;
  const mockAssetFindMany = jest.fn();
  const mockAssetCount = jest.fn();

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    (app as any).prisma.asset = {
      findMany: mockAssetFindMany,
      count: mockAssetCount,
    };
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should load ranked assets directly from the database ordering by gdi score', async () => {
    mockAssetFindMany.mockResolvedValue([{
      asset_id: 'asset-1',
      asset_type: 'gene',
      name: 'Ranked Asset',
      description: 'desc',
      status: 'published',
      author_id: 'node-1',
      gdi_score: 99,
      downloads: 3,
      rating: 4.8,
      signals: ['memory'],
      tags: ['memory'],
      version: 1,
      fork_count: 0,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-02T00:00:00.000Z'),
      content: 'secret body',
      config: { hidden: true },
      gene_ids: ['g1'],
    }]);
    mockAssetCount.mockResolvedValue(1);

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets/ranked?type=gene&limit=5&offset=1',
    });

    expect(res.statusCode).toBe(200);
    expect(mockAssetFindMany).toHaveBeenCalledWith({
      where: { status: 'published', asset_type: 'gene' },
      orderBy: [{ gdi_score: 'desc' }, { updated_at: 'desc' }],
      take: 5,
      skip: 1,
    });
    expect(mockAssetCount).toHaveBeenCalledWith({
      where: { status: 'published', asset_type: 'gene' },
    });

    const body = JSON.parse(res.payload);
    expect(body.data[0]).toEqual(expect.objectContaining({
      asset_id: 'asset-1',
      status: 'published',
      name: 'Ranked Asset',
    }));
    expect(body.data[0].content).toBeUndefined();
    expect(body.data[0].config).toBeUndefined();
    expect(body.data[0].gene_ids).toBeUndefined();
  });
});

describe('A2A asset detail routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps public asset detail readable when optional auth is invalid', async () => {
    mockGetAssetDetail.mockResolvedValue({ asset_id: 'asset-1', name: 'Asset 1' });

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/assets/asset-1',
      headers: { authorization: 'Bearer invalid' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockGetAssetDetail).toHaveBeenCalledWith('asset-1', false, undefined);
  });
});

describe('A2A organism routes', () => {
  let app: FastifyInstance;
  const mockOrganismFindUnique = jest.fn();
  const mockOrganismUpdate = jest.fn();

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    (app as any).prisma.organism = {
      findUnique: mockOrganismFindUnique,
      update: mockOrganismUpdate,
    };
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects organism updates for non-owners', async () => {
    mockOrganismFindUnique.mockResolvedValue({
      organism_id: 'org-1',
      recipe: { author_id: 'node-other' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/a2a/organism/org-1',
      headers: { authorization: 'Bearer test' },
      payload: { status: 'running' },
    });

    expect(res.statusCode).toBe(403);
    expect(mockOrganismUpdate).not.toHaveBeenCalled();
  });

  it('uses app.prisma and returns 404 when expressing an unknown recipe', async () => {
    (app as any).prisma.recipe.findUnique = mockRecipeFindUnique;
    (app as any).prisma.organism.create = mockOrganismCreate;
    mockRecipeFindUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/recipe/recipe-404/express',
      headers: { authorization: 'Bearer test' },
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    expect(mockRecipeFindUnique).toHaveBeenCalledWith({
      where: { recipe_id: 'recipe-404' },
    });
    expect(mockOrganismCreate).not.toHaveBeenCalled();
  });
});

describe('A2A work alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reads assigned work from app.prisma', async () => {
    mockWorkTaskFindMany.mockResolvedValue([
      { task_id: 'task-1', assigned_to: mockNodeId, status: 'assigned' },
    ]);
    mockWorkTaskCount.mockResolvedValue(1);

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/work/my?status=assigned&limit=5&offset=2',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockWorkTaskFindMany).toHaveBeenCalledWith({
      where: { assigned_to: mockNodeId, status: 'assigned' },
      orderBy: { created_at: 'desc' },
      take: 5,
      skip: 2,
    });
    expect(mockWorkTaskCount).toHaveBeenCalledWith({
      where: { assigned_to: mockNodeId, status: 'assigned' },
    });
  });
});

describe('A2A recipe alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reads recipe search results from app.prisma', async () => {
    mockRecipeFindMany.mockResolvedValue([
      {
        recipe_id: 'recipe-1',
        title: 'Retry Recipe',
        description: 'desc',
        status: 'published',
      },
    ]);
    mockRecipeCount.mockResolvedValue(1);

    const res = await app.inject({
      method: 'GET',
      url: '/a2a/recipe/search?q=retry&limit=5&offset=1',
    });

    expect(res.statusCode).toBe(200);
    expect(mockRecipeFindMany).toHaveBeenCalledWith({
      where: {
        status: 'published',
        OR: [
          { title: { contains: 'retry', mode: 'insensitive' } },
          { description: { contains: 'retry', mode: 'insensitive' } },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 5,
      skip: 1,
    });
    expect(mockRecipeCount).toHaveBeenCalled();
  });
});

describe('A2A session creation alias routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates collaboration sessions through app.prisma', async () => {
    mockCollaborationSessionCreate.mockResolvedValue({
      session_id: 'session-1',
      title: 'Coordination',
      creator_id: mockNodeId,
      status: 'active',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/session/create',
      headers: { authorization: 'Bearer test' },
      payload: {
        sender_id: mockNodeId,
        topic: 'Coordination',
        participants: ['node-2'],
        max_participants: 4,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockCollaborationSessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Coordination',
        creator_id: mockNodeId,
        max_participants: 4,
      }),
    }));
  });
});

describe('A2A event polling routes', () => {
  let app: FastifyInstance;
  const mockProjectTaskFindMany = jest.fn();
  const mockWorkerTaskFindMany = jest.fn();
  const mockSwarmSubtaskFindMany = jest.fn();

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    (app as any).prisma.projectTask = { findMany: mockProjectTaskFindMany };
    (app as any).prisma.workerTask = { findMany: mockWorkerTaskFindMany };
    (app as any).prisma.swarmSubtask = { findMany: mockSwarmSubtaskFindMany };
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return real task events for the authenticated node', async () => {
    mockProjectTaskFindMany.mockResolvedValue([{
      task_id: 'project-task-1',
      title: 'Project Task',
      status: 'in_progress',
      updated_at: new Date('2026-01-01T00:00:00Z'),
    }]);
    mockWorkerTaskFindMany.mockResolvedValue([{
      task_id: 'worker-task-1',
      title: 'Worker Task',
      status: 'assigned',
      skills: ['typescript'],
      created_at: new Date('2026-01-02T00:00:00Z'),
    }]);
    mockSwarmSubtaskFindMany.mockResolvedValue([{
      subtask_id: 'swarm-subtask-1',
      swarm_id: 'swarm-1',
      title: 'Swarm Task',
      status: 'assigned',
      assigned_at: new Date('2026-01-03T00:00:00Z'),
      task: { title: 'Main Swarm' },
    }]);

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/events/poll',
      headers: { authorization: 'Bearer test' },
      payload: { node_id: mockNodeId, limit: 10 },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.node_id).toBe(mockNodeId);
    expect(body.data.events).toEqual([
      expect.objectContaining({
        event_id: 'swarm-subtask:swarm-subtask-1',
        event_type: 'swarm_subtask_available',
      }),
      expect.objectContaining({
        event_id: 'worker-task:worker-task-1',
        event_type: 'task_assigned',
      }),
      expect.objectContaining({
        event_id: 'project-task:project-task-1',
        event_type: 'task_assigned',
      }),
    ]);
  });
});

describe('A2A recipe fork routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('should archive recipes via the recipe service', async () => {
    mockArchiveRecipe.mockResolvedValue({
      recipe_id: 'recipe-1',
      status: 'archived',
      author_id: mockNodeId,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/recipe/recipe-1/archive',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    expect(mockArchiveRecipe).toHaveBeenCalledWith('recipe-1', mockNodeId);
  });

  it('should fork recipes via the recipe service', async () => {
    mockForkRecipe.mockResolvedValue({
      recipe_id: 'fork-1',
      title: 'Original (fork)',
      status: 'draft',
      author_id: mockNodeId,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/a2a/recipe/recipe-1/fork',
      headers: { authorization: 'Bearer test' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data).toEqual({
      recipe_id: 'fork-1',
      title: 'Original (fork)',
      status: 'draft',
      author_id: mockNodeId,
      original_recipe_id: 'recipe-1',
    });
    expect(mockForkRecipe).toHaveBeenCalledWith('recipe-1', mockNodeId);
  });
});

describe('A2A protocol documentation routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockNodeId = 'node-test-001';
    app = buildApp();
    await app.register(a2aRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
    capturedRequest = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('exposes protocol metadata', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/a2a/protocol',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      success: true,
      data: {
        protocol: 'gep-a2a',
        protocol_version: '1.0.0',
        required_fields: expect.arrayContaining([
          'protocol',
          'protocol_version',
          'message_type',
          'message_id',
          'sender_id',
          'timestamp',
          'payload',
        ]),
      },
    });
  });

  it('exposes protocol schema and command index', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/a2a/schema',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.envelope.required_fields).toEqual(expect.arrayContaining([
      'protocol',
      'protocol_version',
      'message_type',
      'message_id',
      'sender_id',
      'timestamp',
      'payload',
    ]));
    expect(body.data.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        command: expect.any(String),
        path: expect.any(String),
      }),
    ]));
  });
});
