import fastify, { type FastifyInstance } from 'fastify';
import { disputeRoutes } from './routes';

const mockFileDispute = jest.fn();
const mockListDisputes = jest.fn();
const mockGetDispute = jest.fn();
const mockAssignArbitrators = jest.fn();
const mockSelectAndAssignArbitrators = jest.fn();
const mockIssueRuling = jest.fn();
const mockAutoGenerateRuling = jest.fn();
const mockFileAppeal = jest.fn();
const mockListAppeals = jest.fn();
const mockReviewAppeal = jest.fn();
const mockProcessAppealDecision = jest.fn();
const mockEscalateDisputeToCouncil = jest.fn();
let mockAuth = { node_id: 'node-1', trust_level: 'trusted', auth_type: 'session' };

jest.mock('./service', () => ({
  fileDispute: (...args: unknown[]) => mockFileDispute(...args),
  listDisputes: (...args: unknown[]) => mockListDisputes(...args),
  getDispute: (...args: unknown[]) => mockGetDispute(...args),
  assignArbitrators: (...args: unknown[]) => mockAssignArbitrators(...args),
  selectAndAssignArbitrators: (...args: unknown[]) => mockSelectAndAssignArbitrators(...args),
  issueRuling: (...args: unknown[]) => mockIssueRuling(...args),
  autoGenerateRuling: (...args: unknown[]) => mockAutoGenerateRuling(...args),
  fileAppeal: (...args: unknown[]) => mockFileAppeal(...args),
  listAppeals: (...args: unknown[]) => mockListAppeals(...args),
  reviewAppeal: (...args: unknown[]) => mockReviewAppeal(...args),
  processAppealDecision: (...args: unknown[]) => mockProcessAppealDecision(...args),
  escalateDisputeToCouncil: (...args: unknown[]) => mockEscalateDisputeToCouncil(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: { auth?: { node_id: string; trust_level?: string; auth_type?: string } },
  ) => {
    request.auth = mockAuth;
  },
  requireTrustLevel: () => async (
    request: { auth?: { node_id: string; trust_level?: string; auth_type?: string } },
  ) => {
    request.auth = mockAuth;
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Dispute routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAuth = { node_id: 'node-1', trust_level: 'trusted', auth_type: 'session' };
    mockListDisputes.mockResolvedValue({ items: [], total: 0 });
    mockGetDispute.mockResolvedValue({ dispute_id: 'dsp-1' });
    mockAssignArbitrators.mockResolvedValue({ dispute_id: 'dsp-1', arbitrators: ['arb-1', 'arb-2', 'arb-3'] });
    mockSelectAndAssignArbitrators.mockResolvedValue(['arb-1', 'arb-2', 'arb-3']);
    mockIssueRuling.mockResolvedValue({ dispute_id: 'dsp-1', status: 'resolved' });
    mockAutoGenerateRuling.mockResolvedValue({ ruling_id: 'rul-1', dispute_id: 'dsp-1' });
    mockFileAppeal.mockResolvedValue({ appeal_id: 'apl-1', status: 'filed' });
    mockListAppeals.mockResolvedValue([{ appeal_id: 'apl-1' }]);
    mockReviewAppeal.mockResolvedValue({ appeal_id: 'apl-1', accepted: true, escalated: true });
    mockProcessAppealDecision.mockResolvedValue(undefined);
    mockEscalateDisputeToCouncil.mockResolvedValue({ council_session_id: 'cns-1' });

    app = buildApp();
    await app.register(disputeRoutes, { prefix: '/api/v2/disputes' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates disputes without hard-coding legacy filing fees', async () => {
    mockFileDispute.mockResolvedValue({ dispute_id: 'dsp-created' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes',
      payload: {
        type: 'transaction',
        defendant_id: 'node-2',
        title: 'Transaction dispute',
        description: 'The delivery was not completed and the credits were not refunded.',
        related_transaction_id: 'txn-1',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockFileDispute).toHaveBeenCalledWith('node-1', expect.objectContaining({
      related_transaction_id: 'txn-1',
      filing_fee: undefined,
    }));
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      dispute: { dispute_id: 'dsp-created' },
      data: { dispute_id: 'dsp-created' },
    });
  });

  it('rejects API keys from filing disputes', async () => {
    mockAuth = { node_id: 'node-1', trust_level: 'trusted', auth_type: 'api_key' };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes',
      payload: {
        type: 'transaction',
        defendant_id: 'node-2',
        title: 'Transaction dispute',
        description: 'The linked transaction failed.',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockFileDispute).not.toHaveBeenCalled();
  });

  it('caps dispute list limits to the safe maximum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/disputes?limit=999',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListDisputes).toHaveBeenCalledWith(
      { node_id: 'node-1', trust_level: 'trusted', auth_type: 'session' },
      undefined,
      undefined,
      100,
      0,
    );
  });

  it('passes auth scope to dispute detail lookups', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/disputes/dsp-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetDispute).toHaveBeenCalledWith(
      'dsp-1',
      { node_id: 'node-1', trust_level: 'trusted', auth_type: 'session' },
    );
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      dispute: { dispute_id: 'dsp-1' },
      data: { dispute_id: 'dsp-1' },
    });
  });

  it('passes auth scope to appeal list lookups', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/disputes/dsp-1/appeals',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListAppeals).toHaveBeenCalledWith(
      'dsp-1',
      { node_id: 'node-1', trust_level: 'trusted', auth_type: 'session' },
    );
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      appeals: [{ appeal_id: 'apl-1' }],
      total: 1,
      data: [{ appeal_id: 'apl-1' }],
    });
  });

  it('rejects malformed pagination values', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/disputes?limit=10abc',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListDisputes).not.toHaveBeenCalled();
  });

  it('rejects excessive pagination offsets', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/disputes?offset=10001',
    });

    expect(response.statusCode).toBe(400);
    expect(mockListDisputes).not.toHaveBeenCalled();
  });

  it('rejects malformed assignment payloads before reaching the service layer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/assign',
      payload: {
        arbitrators: 'arb-1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockAssignArbitrators).not.toHaveBeenCalled();
  });

  it('auto-assigns arbitrators through the service layer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/assign/auto',
    });

    expect(response.statusCode).toBe(200);
    expect(mockSelectAndAssignArbitrators).toHaveBeenCalledWith('dsp-1', 'node-1');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      dispute_id: 'dsp-1',
      arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      data: { dispute_id: 'dsp-1', arbitrators: ['arb-1', 'arb-2', 'arb-3'] },
    });
  });

  it('defaults manual rulings to resolved status when none is provided', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/ruling',
      payload: {
        ruling: { verdict: 'plaintiff_wins' },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockIssueRuling).toHaveBeenCalledWith('dsp-1', { verdict: 'plaintiff_wins' }, 'resolved', 'node-1');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      dispute: { dispute_id: 'dsp-1', status: 'resolved' },
      ruling: null,
      data: { dispute_id: 'dsp-1', status: 'resolved' },
    });
  });

  it('rejects non-object ruling payloads', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/ruling',
      payload: 'null',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockIssueRuling).not.toHaveBeenCalled();
  });

  it('rejects escalated as a manual ruling status', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/ruling',
      payload: {
        ruling: { verdict: 'plaintiff_wins' },
        status: 'escalated',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockIssueRuling).not.toHaveBeenCalled();
  });

  it('rejects non-object appeal payloads', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/appeal',
      payload: 'null',
      headers: {
        'content-type': 'application/json',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockFileAppeal).not.toHaveBeenCalled();
  });

  it('exposes appeal review and processing routes', async () => {
    const reviewResponse = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/appeals/apl-1/review',
    });
    const processResponse = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/appeals/apl-1/process',
    });

    expect(reviewResponse.statusCode).toBe(200);
    expect(processResponse.statusCode).toBe(200);
    expect(mockReviewAppeal).toHaveBeenCalledWith('apl-1', 'node-1');
    expect(mockProcessAppealDecision).toHaveBeenCalledWith('apl-1', 'node-1');
    expect(JSON.parse(reviewResponse.payload)).toEqual({
      success: true,
      appeal: { appeal_id: 'apl-1', accepted: true, escalated: true },
      data: { appeal_id: 'apl-1', accepted: true, escalated: true },
    });
    expect(JSON.parse(processResponse.payload)).toEqual({
      success: true,
      appeal_id: 'apl-1',
      processed: true,
      data: { appeal_id: 'apl-1', processed: true },
    });
  });

  it('rejects API keys from filing appeals', async () => {
    mockAuth = { node_id: 'node-1', trust_level: 'trusted', auth_type: 'api_key' };

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/appeal',
      payload: {
        grounds: 'New evidence',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockFileAppeal).not.toHaveBeenCalled();
  });

  it('exposes dispute escalation and auto-ruling routes', async () => {
    const escalateResponse = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/escalate',
    });
    const autoRulingResponse = await app.inject({
      method: 'POST',
      url: '/api/v2/disputes/dsp-1/ruling/auto',
    });

    expect(escalateResponse.statusCode).toBe(200);
    expect(autoRulingResponse.statusCode).toBe(200);
    expect(mockEscalateDisputeToCouncil).toHaveBeenCalledWith('dsp-1', 'node-1');
    expect(mockAutoGenerateRuling).toHaveBeenCalledWith('dsp-1', 'node-1');
    expect(JSON.parse(escalateResponse.payload)).toEqual({
      success: true,
      escalation: { council_session_id: 'cns-1' },
      data: { council_session_id: 'cns-1' },
    });
    expect(JSON.parse(autoRulingResponse.payload)).toEqual({
      success: true,
      ruling: { ruling_id: 'rul-1', dispute_id: 'dsp-1' },
      data: { ruling_id: 'rul-1', dispute_id: 'dsp-1' },
    });
  });

  it('exposes top-level dispute list aliases', async () => {
    mockListDisputes.mockResolvedValue({
      items: [{ dispute_id: 'dsp-1', status: 'filed' }],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/disputes',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      disputes: [{ dispute_id: 'dsp-1', status: 'filed' }],
      total: 1,
      data: {
        items: [{ dispute_id: 'dsp-1', status: 'filed' }],
        total: 1,
      },
    });
  });
});
