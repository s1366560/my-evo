import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
  TrustLevelError,
} from '../shared/errors';
import type { TrustLevel } from '../shared/types';

const {
  stake,
  release,
  slash,
  claimReward,
  verifyNode,
  failVerification,
  getTrustLevel,
  getStats,
  listAttestations,
  listPendingStakes,
} = service;

const mockPrisma = {
  $transaction: jest.fn(),
  node: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  validatorStake: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  trustAttestation: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as any;

describe('Verifiable Trust Service', () => {
  beforeAll(() => {
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) => callback(mockPrisma));
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.validatorStake.count.mockResolvedValue(0);
    mockPrisma.validatorStake.findMany.mockResolvedValue([]);
    mockPrisma.trustAttestation.create.mockResolvedValue({ attestation_id: 'att-default' });
    mockPrisma.trustAttestation.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.trustAttestation.findMany.mockResolvedValue([]);
  });

  describe('stake', () => {
    it('should create a stake with valid parameters', async () => {
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'validator-1',
        credit_balance: 500,
        trust_level: 'trusted',
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.create.mockResolvedValue({
        stake_id: 'stake-1',
        node_id: 'node-1',
        validator_id: 'validator-1',
        amount: 100,
        staked_at: new Date(),
        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active',
      });

      const result = await stake('node-1', 'validator-1', 100);

      expect(result.stake_id).toBe('stake-1');
      expect(result.node_id).toBe('node-1');
      expect(result.validator_id).toBe('validator-1');
      expect(result.amount).toBe(100);
      expect(result.status).toBe('active');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError when amount is below minimum', async () => {
      await expect(stake('node-1', 'validator-1', 50)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when validator not found', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(stake('node-1', 'validator-1', 100)).rejects.toThrow(NotFoundError);
    });

    it('should reject duplicate active stakes from the same validator to the same node', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({
          node_id: 'validator-1',
          credit_balance: 500,
          trust_level: 'trusted',
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 500,
          trust_level: 'unverified',
          reputation: 60,
        });
      mockPrisma.validatorStake.findMany.mockResolvedValueOnce([
        {
          stake_id: 'stake-existing',
          node_id: 'node-1',
          validator_id: 'validator-1',
          amount: 100,
          staked_at: new Date(),
          locked_until: new Date(),
          status: 'active',
        },
      ]);

      await expect(stake('node-1', 'validator-1', 100)).rejects.toThrow(ValidationError);
      expect(mockPrisma.node.updateMany).not.toHaveBeenCalled();
    });

    it('should reject non-trusted validators before reserving stake credits', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'validator-1',
        credit_balance: 500,
        trust_level: 'verified',
      });

      await expect(stake('node-1', 'validator-1', 100)).rejects.toThrow(TrustLevelError);
      expect(mockPrisma.node.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.validatorStake.create).not.toHaveBeenCalled();
    });

    it('should throw InsufficientCreditsError when validator has insufficient balance', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({
          node_id: 'validator-1',
          credit_balance: 50,
          trust_level: 'trusted',
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 500,
          trust_level: 'unverified',
        });
      mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });

      await expect(stake('node-1', 'validator-1', 100)).rejects.toThrow(InsufficientCreditsError);
    });

    it('should decrement validator credit balance', async () => {
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'validator-1',
        credit_balance: 500,
        trust_level: 'trusted',
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.create.mockResolvedValue({
        stake_id: 'stake-1',
        node_id: 'node-1',
        validator_id: 'validator-1',
        amount: 200,
        staked_at: new Date(),
        locked_until: new Date(),
        status: 'active',
      });

      await stake('node-1', 'validator-1', 200);

      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith({
        where: {
          node_id: 'validator-1',
          credit_balance: { gte: 200 },
        },
        data: { credit_balance: { decrement: 200 } },
      });
    });

    it('should create a credit transaction', async () => {
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'validator-1',
        credit_balance: 500,
        trust_level: 'trusted',
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.create.mockResolvedValue({
        stake_id: 'stake-1',
        node_id: 'node-1',
        validator_id: 'validator-1',
        amount: 100,
        staked_at: new Date(),
        locked_until: new Date(),
        status: 'active',
      });

      await stake('node-1', 'validator-1', 100);

      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'validator-1',
            amount: -100,
            type: 'stake_lock',
          }),
        }),
      );
    });

    it('should set the target trust level to verified while issuing a verified attestation', async () => {
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({
          node_id: 'validator-1',
          credit_balance: 500,
          trust_level: 'trusted',
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 500,
          trust_level: 'trusted',
          reputation: 70,
        });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.create.mockResolvedValue({
        stake_id: 'stake-1',
        node_id: 'node-1',
        validator_id: 'validator-1',
        amount: 100,
        staked_at: new Date(),
        locked_until: new Date(),
        status: 'active',
      });
      mockPrisma.trustAttestation.create.mockResolvedValue({});

      await stake('node-1', 'validator-1', 100);

      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { trust_level: 'verified' },
      });
      expect(mockPrisma.trustAttestation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trust_level: 'verified',
          }),
        }),
      );
    });

    it('should keep stake-issued attestations at verified even with enough active stakes for trusted', async () => {
      mockPrisma.validatorStake.count.mockResolvedValue(3);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({
          node_id: 'validator-1',
          credit_balance: 500,
          trust_level: 'trusted',
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 500,
          trust_level: 'verified',
          reputation: 85,
        });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.create.mockResolvedValue({
        stake_id: 'stake-3',
        node_id: 'node-1',
        validator_id: 'validator-1',
        amount: 100,
        staked_at: new Date(),
        locked_until: new Date(),
        status: 'active',
      });
      mockPrisma.trustAttestation.create.mockResolvedValue({ attestation_id: 'att-3' });

      const result = await stake('node-1', 'validator-1', 100);

      expect(result.trust_level).toBe('verified');
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { trust_level: 'verified' },
      });
      expect(mockPrisma.trustAttestation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          trust_level: 'verified',
        }),
      }));
    });

    it('should reject stakes when the transactional debit cannot reserve enough credits', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({
          node_id: 'validator-1',
          credit_balance: 100,
          trust_level: 'trusted',
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 500,
          trust_level: 'unverified',
        });
      mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });

      await expect(stake('node-1', 'validator-1', 100)).rejects.toThrow(InsufficientCreditsError);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    const unlockedStake = {
      stake_id: 'stake-1',
      node_id: 'node-1',
      validator_id: 'validator-1',
      amount: 100,
      staked_at: new Date(),
      locked_until: new Date(Date.now() - 24 * 60 * 60 * 1000), // past
      status: 'active',
    };

    it('should release an unlocked stake', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'validator-1', credit_balance: 400 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      const result = await release('stake-1', 'validator-1');

      expect(result.status).toBe('released');
      expect(result.amount_returned).toBe(90);
      expect(result.penalty).toBe(10);
      expect(result.trust_level).toBe('unverified');
      expect(mockPrisma.validatorStake.findUnique).toHaveBeenCalledWith({
        where: { stake_id: 'stake-1' },
      });
      expect(mockPrisma.validatorStake.update).toHaveBeenCalledWith({
        where: { stake_id: 'stake-1' },
        data: { status: 'released' },
      });
    });

    it('should throw NotFoundError when stake not found', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(null);

      await expect(release('nonexistent', 'validator-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when stake is not active', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      await expect(release('stake-1', 'validator-1')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when stake is still locked', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue({
        ...unlockedStake,
        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // future
      });

      await expect(release('stake-1', 'validator-1')).rejects.toThrow(ValidationError);
    });

    it('should apply release penalty and return remaining amount', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'validator-1', credit_balance: 400 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      await release('stake-1', 'validator-1');

      // penalty = ceil(100 * 0.10) = 10, returnAmount = 100 - 10 = 90
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { credit_balance: { increment: 90 } },
        }),
      );
    });

    it('should recalculate the target trust level after release based on remaining stakes', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 400 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'trusted', reputation: 85 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });
      mockPrisma.validatorStake.count.mockResolvedValue(1);

      const result = await release('stake-1', 'validator-1');

      expect(result.trust_level).toBe('verified');
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { trust_level: 'verified' },
      });
    });

    it('should create a credit transaction on release', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'validator-1', credit_balance: 400 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      await release('stake-1', 'validator-1');

      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'stake_release',
          }),
        }),
      );
      expect(mockPrisma.trustAttestation.deleteMany).toHaveBeenCalledWith({
        where: {
          node_id: 'node-1',
          validator_id: 'validator-1',
        },
      });
    });

    it('should handle target node not found gracefully', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue(null);
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      const result = await release('stake-1', 'validator-1');

      expect(result.status).toBe('released');
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should reject release by another validator', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);

      await expect(release('stake-1', 'validator-2')).rejects.toThrow('Only the staking validator can release this stake');
    });
  });

  describe('slash', () => {
    const activeStake = {
      stake_id: 'stake-1',
      node_id: 'node-1',
      validator_id: 'validator-1',
      amount: 100,
      staked_at: new Date(),
      locked_until: new Date(),
      status: 'active',
    };

    it('should slash an active stake', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(activeStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'verified' });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...activeStake,
        status: 'slashed',
      });

      const result = await slash('stake-1');

      expect(result.status).toBe('slashed');
      expect(mockPrisma.validatorStake.findUnique).toHaveBeenCalledWith({
        where: { stake_id: 'stake-1' },
      });
      expect(mockPrisma.validatorStake.update).toHaveBeenCalledWith({
        where: { stake_id: 'stake-1' },
        data: { status: 'slashed' },
      });
    });

    it('should throw NotFoundError when stake not found', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(null);

      await expect(slash('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when stake is not active', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue({
        ...activeStake,
        status: 'released',
      });

      await expect(slash('stake-1')).rejects.toThrow(ValidationError);
    });

    it('should downgrade trust level from verified to unverified', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(activeStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'verified' });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...activeStake,
        status: 'slashed',
      });

      await slash('stake-1');

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { trust_level: 'unverified' },
        }),
      );
    });

    it('should downgrade trust level from trusted to unverified', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(activeStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'trusted' });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...activeStake,
        status: 'slashed',
      });

      await slash('stake-1');

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { trust_level: 'unverified' },
        }),
      );
    });

    it('should not downgrade when trust level is already unverified', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(activeStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'unverified' });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...activeStake,
        status: 'slashed',
      });

      await slash('stake-1');

      // Should not write a trust downgrade when already unverified
      const updateCalls = mockPrisma.node.update.mock.calls;
      const trustUpdateCalls = updateCalls.filter(
        (call: any[]) => call[0]?.data?.trust_level !== undefined,
      );
      expect(trustUpdateCalls).toHaveLength(1);
      expect(trustUpdateCalls[0][0]).toMatchObject({
        data: { trust_level: 'unverified' },
      });
    });

    it('should return remaining amount (minus slash) to validator', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(activeStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'verified' });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...activeStake,
        status: 'slashed',
      });

      await slash('stake-1');

      // slashAmount = ceil(100 * 0.10) = 10, returnAmount = 100 - 10 = 90
      const creditUpdateCall = mockPrisma.node.update.mock.calls.find(
        (call: any[]) => call[0]?.data?.credit_balance?.increment !== undefined,
      );
      expect(creditUpdateCall).toBeDefined();
      expect(creditUpdateCall![0].data.credit_balance.increment).toBe(90);
    });

    it('should not return credits when slash amount equals stake amount', async () => {
      // With a stake of 1 and 10% slash = ceil(0.1) = 1, return = 0
      const smallStake = { ...activeStake, amount: 1 };
      mockPrisma.validatorStake.findUnique.mockResolvedValue(smallStake);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'node-1', trust_level: 'unverified' });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...smallStake,
        status: 'slashed',
      });

      await slash('stake-1');

      // returnAmount = 1 - 1 = 0, so no credit update for validator
      const creditUpdateCall = mockPrisma.node.update.mock.calls.find(
        (call: any[]) => call[0]?.data?.credit_balance !== undefined,
      );
      expect(creditUpdateCall).toBeUndefined();
    });
  });

  describe('claimReward', () => {
    const unlockedStake = {
      stake_id: 'stake-1',
      node_id: 'node-1',
      validator_id: 'validator-1',
      amount: 100,
      staked_at: new Date(),
      locked_until: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'active',
    };

    it('should claim reward for an unlocked stake', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'validator-1', credit_balance: 400 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      const result = await claimReward('stake-1', 'validator-1');

      // reward = ceil(100 * 0.05) = 5
      expect(result.reward).toBe(5);
      expect(result.stake_amount).toBe(100);
      expect(result.total_received).toBe(105);
      expect(result.validator_reputation_bonus).toBe(2);
      expect(result.stake.stake_id).toBe('stake-1');
      expect(result.stake.status).toBe('released');
      expect(mockPrisma.validatorStake.findUnique).toHaveBeenCalledWith({
        where: { stake_id: 'stake-1' },
      });
    });

    it('should throw NotFoundError when stake not found', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(null);

      await expect(claimReward('nonexistent', 'validator-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when stake is not active', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      await expect(claimReward('stake-1', 'validator-1')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when lock period has not ended', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue({
        ...unlockedStake,
        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      await expect(claimReward('stake-1', 'validator-1')).rejects.toThrow(ValidationError);
    });

    it('should credit reward to validator', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'validator-1', credit_balance: 400 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      await claimReward('stake-1', 'validator-1');

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            credit_balance: { increment: 105 },
            reputation: { increment: 2 },
          },
        }),
      );
    });

    it('should handle target node not found gracefully', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue(null);
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      const result = await claimReward('stake-1', 'validator-1');

      expect(result.reward).toBe(5);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should mark the stake released without revoking the attestation after reward claim', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'validator-1', credit_balance: 400 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        ...unlockedStake,
        status: 'released',
      });

      const result = await claimReward('stake-1', 'validator-1');

      expect(result.stake.status).toBe('released');
      expect(mockPrisma.trustAttestation.deleteMany).not.toHaveBeenCalled();
    });

    it('should reject reward claims by another validator', async () => {
      mockPrisma.validatorStake.findUnique.mockResolvedValue(unlockedStake);

      await expect(claimReward('stake-1', 'validator-2')).rejects.toThrow(
        'Only the staking validator can claim rewards for this stake',
      );
    });
  });

  describe('verifyNode', () => {
    it('should verify a target node with a trusted validator', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted' })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'unverified', reputation: 60 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([
        { amount: 100 },
      ]);
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.trustAttestation.create.mockResolvedValue({
        attestation_id: 'att-1',
        validator_id: 'validator-1',
        node_id: 'target-1',
        trust_level: 'verified',
        stake_amount: 100,
        verified_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        signature: 'abc123',
      });

      const result = await verifyNode('validator-1', 'target-1', 'Good node');

      expect(result.attestation_id).toBe('att-1');
      expect(result.validator_id).toBe('validator-1');
      expect(result.node_id).toBe('target-1');
      expect(result.trust_level).toBe('verified');
    });

    it('should assign trusted level when the target has three active stakes and enough reputation', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted' })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'verified', reputation: 80 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([
        { amount: 100 },
      ]);
      mockPrisma.validatorStake.count.mockResolvedValue(3);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.trustAttestation.create.mockResolvedValue({
        attestation_id: 'att-2',
        validator_id: 'validator-1',
        node_id: 'target-1',
        trust_level: 'trusted',
        stake_amount: 100,
        verified_at: new Date(),
        expires_at: new Date(),
        signature: 'def456',
      });

      const result = await verifyNode('validator-1', 'target-1', 'High stake');

      expect(result.trust_level).toBe('trusted');
    });

    it('should downgrade a trusted target when it no longer meets the trusted threshold', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted' })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'trusted', reputation: 90 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([{ amount: 100 }]);
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.trustAttestation.create.mockResolvedValue({
        attestation_id: 'att-keep-trusted',
        validator_id: 'validator-1',
        node_id: 'target-1',
        trust_level: 'verified',
        stake_amount: 100,
        verified_at: new Date(),
        expires_at: new Date(),
        signature: 'trusted-sig',
      });

      const result = await verifyNode('validator-1', 'target-1', 'Keep trusted');

      expect(result.trust_level).toBe('verified');
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'target-1' },
        data: { trust_level: 'verified' },
      });
    });

    it('should throw NotFoundError when validator not found', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(verifyNode('validator-1', 'target-1', 'notes')).rejects.toThrow(NotFoundError);
    });

    it('should throw TrustLevelError when validator is not trusted', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'validator-1',
        trust_level: 'verified',
      });

      await expect(verifyNode('validator-1', 'target-1', 'notes')).rejects.toThrow(TrustLevelError);
    });

    it('should throw NotFoundError when target node not found', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted' })
        .mockResolvedValueOnce(null);

      await expect(verifyNode('validator-1', 'target-1', 'notes')).rejects.toThrow(NotFoundError);
    });

    it('should create attestation with signature', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted' })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'unverified', reputation: 40 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([{ amount: 100 }]);
      mockPrisma.validatorStake.count.mockResolvedValue(1);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.trustAttestation.create.mockResolvedValue({
        attestation_id: 'att-3',
        validator_id: 'validator-1',
        node_id: 'target-1',
        trust_level: 'verified',
        stake_amount: 100,
        verified_at: new Date(),
        expires_at: new Date(),
        signature: 'signed-hash',
      });

      await verifyNode('validator-1', 'target-1', 'test notes');

      expect(mockPrisma.trustAttestation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            validator_id: 'validator-1',
            node_id: 'target-1',
            stake_amount: 100,
            signature: expect.any(String),
          }),
        }),
      );
    });

    it('should reject verification when the validator has no active stake on the target', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted' })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'unverified', reputation: 40 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([]);

      await expect(verifyNode('validator-1', 'target-1', 'notes')).rejects.toThrow(ValidationError);
    });
  });

  describe('failVerification', () => {
    it('should slash the validator stake when verification fails', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted', reputation: 90 })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'verified', reputation: 60 })
        .mockResolvedValueOnce({ node_id: 'validator-1', credit_balance: 300 })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'unverified', reputation: 60 })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'unverified', reputation: 60 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([
        {
          stake_id: 'stake-1',
          node_id: 'target-1',
          validator_id: 'validator-1',
          amount: 100,
          staked_at: new Date(),
          locked_until: new Date(),
          status: 'active',
        },
      ]);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.validatorStake.update.mockResolvedValue({
        stake_id: 'stake-1',
        node_id: 'target-1',
        validator_id: 'validator-1',
        amount: 100,
        staked_at: new Date(),
        locked_until: new Date(),
        status: 'slashed',
      });
      mockPrisma.validatorStake.count.mockResolvedValue(0);

      const result = await failVerification('validator-1', 'target-1');

      expect(result).toMatchObject({
        status: 'slashed',
        stake_id: 'stake-1',
        amount_returned: 90,
        penalty: 10,
        trust_level: 'unverified',
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'validator-1' },
        data: { reputation: { decrement: 5 } },
      });
    });

    it('should throw when the validator has no active stake on the target', async () => {
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'validator-1', trust_level: 'trusted', reputation: 90 })
        .mockResolvedValueOnce({ node_id: 'target-1', trust_level: 'verified', reputation: 60 });
      mockPrisma.validatorStake.findMany.mockResolvedValue([]);

      await expect(failVerification('validator-1', 'target-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getTrustLevel', () => {
    it('should return trust level for an existing node', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'node-1',
        trust_level: 'verified',
      });

      const result = await getTrustLevel('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.trust_level).toBe('verified');
      expect(result.attestations).toEqual([]);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(getTrustLevel('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should return unverified for new nodes', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'node-new',
        trust_level: 'unverified',
      });

      const result = await getTrustLevel('node-new');

      expect(result.trust_level).toBe('unverified');
      expect(result.attestations).toEqual([]);
    });

    it('should return trusted for fully verified nodes', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'node-trusted',
        trust_level: 'trusted',
      });

      const result = await getTrustLevel('node-trusted');

      expect(result.trust_level).toBe('trusted');
      expect(result.attestations).toEqual([]);
    });

    it('should include attestations for the requested node', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        node_id: 'node-1',
        trust_level: 'verified',
      });
      mockPrisma.trustAttestation.findMany.mockResolvedValue([
        {
          attestation_id: 'att-1',
          validator_id: 'validator-1',
          node_id: 'node-1',
          trust_level: 'verified',
          stake_amount: 100,
          verified_at: new Date('2026-04-01T00:00:00Z'),
          expires_at: new Date('2026-05-01T00:00:00Z'),
          signature: 'sig-1',
        },
      ]);

      const result = await getTrustLevel('node-1');

      expect(result.attestations).toEqual([
        {
          attestation_id: 'att-1',
          validator_id: 'validator-1',
          node_id: 'node-1',
          trust_level: 'verified',
          stake_amount: 100,
          verified_at: '2026-04-01T00:00:00.000Z',
          expires_at: '2026-05-01T00:00:00.000Z',
          signature: 'sig-1',
        },
      ]);
    });
  });

  describe('getStats', () => {
    it('should return trust statistics', async () => {
      mockPrisma.validatorStake.count
        .mockResolvedValueOnce(10)  // total stakes
        .mockResolvedValueOnce(7); // active stakes
      mockPrisma.trustAttestation.count.mockResolvedValue(5);
      mockPrisma.validatorStake.findMany
        .mockResolvedValueOnce([
          { amount: 100 },
          { amount: 200 },
          { amount: 150 },
        ])
        .mockResolvedValueOnce([
          { amount: 100 },
        ]);
      mockPrisma.creditTransaction.findMany.mockResolvedValue([
        { amount: 5, type: 'stake_release', description: 'Staking reward for stake-1' },
        { amount: 10, type: 'stake_reward', description: 'Migrated reward transaction' },
      ]);
      mockPrisma.node.findMany.mockResolvedValue([
        { trust_level: 'unverified' },
        { trust_level: 'verified' },
        { trust_level: 'verified' },
        { trust_level: 'trusted' },
      ]);

      const result = await getStats();

      expect(result.total_stakes).toBe(10);
      expect(result.active_stakes).toBe(7);
      expect(result.total_attestations).toBe(5);
      expect(result.total_staked_amount).toBe(450);
      expect(result.total_staked).toBe(450);
      expect(result.total_staked_credits).toBe(450);
      expect(result.total_slashed).toBe(10);
      expect(result.total_rewards_paid).toBe(15);
      expect(result.verified_nodes).toBe(2);
      expect(result.trusted_validators).toBe(1);
    });

    it('should compute trust distribution', async () => {
      mockPrisma.validatorStake.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.trustAttestation.count.mockResolvedValue(0);
      mockPrisma.validatorStake.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.creditTransaction.findMany.mockResolvedValue([]);
      mockPrisma.node.findMany.mockResolvedValue([
        { trust_level: 'unverified' },
        { trust_level: 'unverified' },
        { trust_level: 'verified' },
        { trust_level: 'trusted' },
      ]);

      const result = await getStats();

      expect(result.trust_distribution['unverified']).toBe(2);
      expect(result.trust_distribution['verified']).toBe(1);
      expect(result.trust_distribution['trusted']).toBe(1);
    });

    it('should return zeroed stats when no data exists', async () => {
      mockPrisma.validatorStake.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.trustAttestation.count.mockResolvedValue(0);
      mockPrisma.validatorStake.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.creditTransaction.findMany.mockResolvedValue([]);
      mockPrisma.node.findMany.mockResolvedValue([]);

      const result = await getStats();

      expect(result.total_stakes).toBe(0);
      expect(result.total_staked_amount).toBe(0);
      expect(result.total_staked).toBe(0);
      expect(result.total_staked_credits).toBe(0);
      expect(result.active_stakes).toBe(0);
      expect(result.total_attestations).toBe(0);
      expect(result.verified_nodes).toBe(0);
      expect(result.trusted_validators).toBe(0);
      expect(result.total_slashed).toBe(0);
      expect(result.total_rewards_paid).toBe(0);
      expect(Object.keys(result.trust_distribution)).toHaveLength(0);
    });
  });

  describe('listAttestations', () => {
    it('should return attestations for a specific node', async () => {
      mockPrisma.trustAttestation.findMany.mockResolvedValue([
        {
          attestation_id: 'att-1',
          validator_id: 'validator-1',
          node_id: 'node-1',
          trust_level: 'verified',
          stake_amount: 100,
          verified_at: new Date('2025-01-01'),
          expires_at: new Date('2025-01-31'),
          signature: 'sig1',
        },
      ]);

      const result = await listAttestations('node-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.attestation_id).toBe('att-1');
      expect(result[0]!.node_id).toBe('node-1');
    });

    it('should return all attestations when no nodeId provided', async () => {
      mockPrisma.trustAttestation.findMany.mockResolvedValue([
        {
          attestation_id: 'att-1',
          validator_id: 'validator-1',
          node_id: 'node-1',
          trust_level: 'verified',
          stake_amount: 100,
          verified_at: new Date(),
          expires_at: new Date(),
          signature: 'sig1',
        },
        {
          attestation_id: 'att-2',
          validator_id: 'validator-2',
          node_id: 'node-2',
          trust_level: 'trusted',
          stake_amount: 500,
          verified_at: new Date(),
          expires_at: new Date(),
          signature: 'sig2',
        },
      ]);

      const result = await listAttestations();

      expect(result).toHaveLength(2);
      expect(mockPrisma.trustAttestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('should filter by nodeId when provided', async () => {
      mockPrisma.trustAttestation.findMany.mockResolvedValue([]);

      await listAttestations('node-1');

      expect(mockPrisma.trustAttestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { node_id: 'node-1' },
        }),
      );
    });

    it('should order by verified_at descending', async () => {
      mockPrisma.trustAttestation.findMany.mockResolvedValue([]);

      await listAttestations();

      expect(mockPrisma.trustAttestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { verified_at: 'desc' },
        }),
      );
    });

    it('should limit results to 50', async () => {
      mockPrisma.trustAttestation.findMany.mockResolvedValue([]);

      await listAttestations();

      expect(mockPrisma.trustAttestation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should convert dates to ISO strings', async () => {
      const verifiedAt = new Date('2025-03-15T10:00:00Z');
      const expiresAt = new Date('2025-04-15T10:00:00Z');
      mockPrisma.trustAttestation.findMany.mockResolvedValue([
        {
          attestation_id: 'att-1',
          validator_id: 'v-1',
          node_id: 'n-1',
          trust_level: 'verified',
          stake_amount: 100,
          verified_at: verifiedAt,
          expires_at: expiresAt,
          signature: 'sig',
        },
      ]);

      const result = await listAttestations('n-1');

      expect(result[0]!.verified_at).toBe(verifiedAt.toISOString());
      expect(result[0]!.expires_at).toBe(expiresAt.toISOString());
    });
  });

  describe('listPendingStakes', () => {
    it('should return active stakes ordered by staked_at', async () => {
      mockPrisma.validatorStake.findMany.mockResolvedValue([
        {
          stake_id: 'stake-1',
          node_id: 'node-1',
          validator_id: 'validator-1',
          amount: 100,
          staked_at: new Date('2026-01-01T00:00:00.000Z'),
          locked_until: new Date('2026-01-08T00:00:00.000Z'),
          status: 'active',
        },
      ]);

      const result = await listPendingStakes();

      expect(result).toEqual([
        {
          stake_id: 'stake-1',
          node_id: 'node-1',
          validator_id: 'validator-1',
          amount: 100,
          staked_at: '2026-01-01T00:00:00.000Z',
          locked_until: '2026-01-08T00:00:00.000Z',
          status: 'active',
        },
      ]);
      expect(mockPrisma.validatorStake.findMany).toHaveBeenCalledWith({
        where: { status: 'active' },
        orderBy: { staked_at: 'asc' },
        take: 50,
      });
    });
  });
});
