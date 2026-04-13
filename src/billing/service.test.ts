import { ValidationError } from '../shared/errors';
import { getEarnings } from './service';

const mockPrisma = {
  creditTransaction: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
} as any;

describe('billing service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when node_id is missing', async () => {
    await expect(getEarnings(mockPrisma, '')).rejects.toThrow(ValidationError);
    expect(mockPrisma.creditTransaction.findMany).not.toHaveBeenCalled();
  });

  it('computes all-time totals from aggregate queries while keeping recent transaction history', async () => {
    mockPrisma.creditTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-earn-1',
        type: 'marketplace_sale',
        amount: 40,
        description: 'Sold asset',
        balance_after: 140,
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'tx-earn-2',
        type: 'stake_release',
        amount: 5,
        description: 'Staking reward for stake-1',
        balance_after: 145,
        timestamp: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    mockPrisma.creditTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 240 } })
      .mockResolvedValueOnce({ _sum: { amount: 125 } });

    const result = await getEarnings(mockPrisma, 'node-1');

    expect(result.total_earned).toBe(240);
    expect(result.total_withdrawn).toBe(125);
    expect(result.transactions).toEqual([
      {
        id: 'tx-earn-1',
        type: 'marketplace_sale',
        amount: 40,
        source: 'Sold asset',
        balance_after: 140,
        timestamp: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'tx-earn-2',
        type: 'stake_release',
        amount: 5,
        source: 'Staking reward for stake-1',
        balance_after: 145,
        timestamp: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        node_id: 'node-1',
        amount: { gt: 0 },
        OR: expect.arrayContaining([
          expect.objectContaining({
            type: expect.objectContaining({
              in: expect.arrayContaining([
                'initial_grant',
                'heartbeat_reward',
                'promotion_reward',
                'ASSET_PROMOTED',
                'bounty_pay',
                'circle_prize',
                'swarm_reward',
                'marketplace_sale',
              ]),
            }),
          }),
          {
            type: 'stake_release',
            description: { startsWith: 'Staking reward' },
          },
        ]),
      }),
      take: 100,
    }));
    expect(mockPrisma.creditTransaction.aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        node_id: 'node-1',
        amount: { gt: 0 },
      }),
      _sum: { amount: true },
    }));
    expect(mockPrisma.creditTransaction.aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        node_id: 'node-1',
        amount: { gt: 0 },
        OR: [
          { type: { in: ['withdrawal', 'STAKE_WITHDRAWN'] } },
          {
            type: 'stake_release',
            NOT: { description: { startsWith: 'Staking reward' } },
          },
        ],
      },
      _sum: { amount: true },
    }));
  });
});
