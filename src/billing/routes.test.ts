import fastify, { type FastifyInstance } from 'fastify';
import { billingRoutes, setPrisma } from './routes';

const mockGetEarnings = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  getEarnings: (...args: unknown[]) => mockGetEarnings(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

const mockPrisma = {
  $transaction: jest.fn(),
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  validatorStake: {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
} as any;

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Billing routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    setPrisma(mockPrisma);
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
    app = buildApp();
    await app.register(billingRoutes, { prefix: '/billing' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('scopes earnings lookups to the authenticated node', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/billing/earnings/node-2',
    });

    expect(response.statusCode).toBe(403);
    expect(mockGetEarnings).not.toHaveBeenCalled();
  });

  it('uses the authenticated node when staking without a request body', async () => {
    mockPrisma.node.findUnique
      .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 700 })
      .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 200 });
    mockPrisma.validatorStake.findUnique.mockResolvedValue(null);
    mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.creditTransaction.create.mockResolvedValue({});
    mockPrisma.validatorStake.create.mockResolvedValue({ amount: 500 });
    mockPrisma.validatorStake.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ amount: 500, status: 'active' });

    const response = await app.inject({
      method: 'POST',
      url: '/billing/stake',
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.node.findUnique).toHaveBeenCalledWith({ where: { node_id: 'node-1' } });
    expect(mockPrisma.node.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { node_id: 'node-1', credit_balance: { gte: 500 } },
    }));
    expect(mockPrisma.validatorStake.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ node_id: 'node-1', status: 'active' }),
    }));
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      isolationLevel: 'Serializable',
    }));
  });

  it('returns insufficient balance when the transactional debit cannot be applied', async () => {
    mockPrisma.node.findUnique
      .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 700 })
      .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 200 });
    mockPrisma.validatorStake.findUnique.mockResolvedValue(null);
    mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });

    const response = await app.inject({
      method: 'POST',
      url: '/billing/stake',
    });

    expect(response.statusCode).toBe(402);
    expect(mockPrisma.validatorStake.create).not.toHaveBeenCalled();
  });

  it('returns already staked when the node already has an active validator stake', async () => {
    mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1', credit_balance: 700 });
    mockPrisma.validatorStake.findUnique.mockResolvedValue({ node_id: 'node-1', amount: 500, status: 'active' });

    const response = await app.inject({
      method: 'POST',
      url: '/billing/stake',
    });

    expect(response.statusCode).toBe(409);
    expect(mockPrisma.node.updateMany).not.toHaveBeenCalled();
  });

  it('reactivates an inactive stake without using an upsert increment path', async () => {
    mockPrisma.node.findUnique
      .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 700 })
      .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 200 });
    mockPrisma.validatorStake.findUnique
      .mockResolvedValueOnce({ node_id: 'node-1', amount: 0, status: 'withdrawn' })
      .mockResolvedValueOnce({ node_id: 'node-1', amount: 500, status: 'active' });
    mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.validatorStake.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.creditTransaction.create.mockResolvedValue({});

    const response = await app.inject({
      method: 'POST',
      url: '/billing/stake',
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.validatorStake.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ node_id: 'node-1' }),
      data: expect.objectContaining({ status: 'active', amount: 500 }),
    }));
    expect(mockPrisma.validatorStake.upsert).not.toHaveBeenCalled();
  });

  it('rejects staking for a different node', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/billing/stake',
      payload: { node_id: 'node-2' },
    });

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.node.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unstaking for a different node', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/billing/unstake',
      payload: { node_id: 'node-2' },
    });

    expect(response.statusCode).toBe(403);
    expect(mockPrisma.validatorStake.findUnique).not.toHaveBeenCalled();
  });

  it('uses the authenticated node when unstaking without a request body', async () => {
    mockPrisma.validatorStake.findUnique.mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: '/billing/unstake',
    });

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.validatorStake.findUnique).toHaveBeenCalledWith({
      where: { node_id: 'node-1' },
    });
  });
});
