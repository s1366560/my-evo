import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../shared/errors';
import type { QuarantineLevel, QuarantineReason, Violation } from '../shared/types';

const {
  quarantineNode,
  addViolation,
  checkQuarantineStatus,
  releaseNode,
  listHistory,
  submitAppeal,
  listAppeals,
  reviewAppeal,
  autoRelease,
  escalateQuarantine,
} = service;

const mockPrisma = {
  $transaction: jest.fn(),
  node: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  quarantineRecord: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  quarantineAppeal: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  reputationEvent: {
    create: jest.fn(),
  },
} as any;

const futureDate = new Date(Date.now() + 86_400_000 * 30);
const pastDate = new Date(Date.now() - 86_400_000);

describe('Quarantine Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  });

  describe('quarantineNode', () => {
    it('should quarantine a node at L1 level', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);
      mockPrisma.quarantineRecord.create.mockResolvedValue({
        node_id: 'node-1',
        level: 'L1',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await quarantineNode('node-1', 'L1', 'content_violation');

      expect(result.node_id).toBe('node-1');
      expect(result.level).toBe('L1');
      expect(result.reason).toBe('content_violation');
      expect(result.is_active).toBe(true);
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 55 },
        }),
      );
    });

    it('should quarantine a node at L2 level', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);
      mockPrisma.quarantineRecord.create.mockResolvedValue({
        node_id: 'node-1',
        level: 'L2',
        reason: 'similarity_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await quarantineNode('node-1', 'L2', 'similarity_violation');

      expect(result.level).toBe('L2');
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 45 },
        }),
      );
    });

    it('should quarantine a node at L3 level', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);
      mockPrisma.quarantineRecord.create.mockResolvedValue({
        node_id: 'node-1',
        level: 'L3',
        reason: 'report_threshold',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 30,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await quarantineNode('node-1', 'L3', 'report_threshold');

      expect(result.level).toBe('L3');
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 30 },
        }),
      );
    });

    it('should throw NotFoundError when node does not exist', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(quarantineNode('unknown', 'L1', 'manual')).rejects.toThrow(NotFoundError);
    });

    it('should escalate when node receives a new violation during active quarantine', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        is_active: true,
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await quarantineNode('node-1', 'L1', 'manual');

      expect(result.level).toBe('L2');
      expect(result.reason).toBe('manual');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw ValidationError when node is already at L3 quarantine', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({ id: 1, is_active: true, level: 'L3' });

      await expect(quarantineNode('node-1', 'L1', 'manual')).rejects.toThrow(ValidationError);
    });

    it('should not reduce reputation below 0', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 3 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);
      mockPrisma.quarantineRecord.create.mockResolvedValue({
        node_id: 'node-1',
        level: 'L3',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 30,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await quarantineNode('node-1', 'L3', 'manual');

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 0 },
        }),
      );
    });

    it('should create a reputation event for quarantine', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);
      mockPrisma.quarantineRecord.create.mockResolvedValue({
        node_id: 'node-1',
        level: 'L1',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      await quarantineNode('node-1', 'L1', 'content_violation');

      expect(mockPrisma.reputationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            delta: -5,
          }),
        }),
      );
    });
  });

  describe('addViolation', () => {
    it('should add a violation to an active quarantine record', async () => {
      const violation: Violation = {
        type: 'content_violation',
        severity: 'high',
        description: 'Spam content detected',
        detected_at: new Date().toISOString(),
      };

      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        violations: [],
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({});

      await addViolation('node-1', violation);

      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { violations: [violation] },
        }),
      );
    });

    it('should append violation to existing violations', async () => {
      const existingViolation: Violation = {
        type: 'similarity_violation',
        severity: 'medium',
        description: 'Similarity detected',
        detected_at: new Date().toISOString(),
      };
      const newViolation: Violation = {
        type: 'content_violation',
        severity: 'high',
        description: 'Spam content',
        detected_at: new Date().toISOString(),
      };

      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        violations: [existingViolation],
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({});

      await addViolation('node-1', newViolation);

      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { violations: [existingViolation, newViolation] },
        }),
      );
    });

    it('should throw NotFoundError when no active quarantine exists', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);

      const violation: Violation = {
        type: 'content_violation',
        severity: 'low',
        description: 'test',
        detected_at: new Date().toISOString(),
      };

      await expect(addViolation('node-1', violation)).rejects.toThrow(NotFoundError);
    });
  });

  describe('checkQuarantineStatus', () => {
    it('should return null when no active quarantine exists', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);

      const result = await checkQuarantineStatus('node-1');

      expect(result).toBeNull();
    });

    it('should return quarantine record when active and not expired', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });

      const result = await checkQuarantineStatus('node-1');

      expect(result).not.toBeNull();
      expect(result!.node_id).toBe('node-1');
      expect(result!.level).toBe('L1');
      expect(result!.is_active).toBe(true);
    });

    it('should auto-release and return null when quarantine has expired and reputation is sufficient', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: pastDate,
        auto_release_at: pastDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.update.mockResolvedValue({});

      const result = await checkQuarantineStatus('node-1');

      expect(result).toBeNull();
      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { is_active: false },
        }),
      );
    });

    it('should keep expired quarantine active when reputation is below auto-release threshold', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: pastDate,
        auto_release_at: pastDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 40 });

      const result = await checkQuarantineStatus('node-1');

      expect(result).not.toBeNull();
      expect(result!.is_active).toBe(true);
      expect(mockPrisma.quarantineRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('releaseNode', () => {
    it('should release a node from active quarantine', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: false,
        violations: [],
      });

      const result = await releaseNode('node-1');

      expect(result).not.toBeNull();
      expect(result!.is_active).toBe(false);
    });

    it('should return null when no active quarantine exists', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);

      const result = await releaseNode('node-1');

      expect(result).toBeNull();
    });
  });

  describe('listHistory', () => {
    it('should list quarantine history in descending order', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([
        {
          id: 2,
          node_id: 'node-1',
          level: 'L2',
          reason: 'manual',
          started_at: new Date('2026-01-02T00:00:00Z'),
          expires_at: futureDate,
          auto_release_at: futureDate,
          reputation_penalty: 15,
          is_active: false,
          violations: [],
        },
      ]);

      const result = await listHistory('node-1', 5);

      expect(mockPrisma.quarantineRecord.findMany).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        orderBy: { started_at: 'desc' },
        take: 5,
      });
      expect(result[0]!.level).toBe('L2');
    });
  });

  describe('submitAppeal', () => {
    it('should reject short appeal grounds', async () => {
      await expect(submitAppeal('node-1', 'node-1', 'too short'))
        .rejects.toThrow(ValidationError);
    });

    it('should create a quarantine appeal within the appeal window', async () => {
      const startedAt = new Date(Date.now() - 60 * 60 * 1000);
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 'record-1',
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: startedAt,
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.quarantineAppeal.findFirst.mockResolvedValue(null);
      mockPrisma.quarantineAppeal.create.mockResolvedValue({
        appeal_id: 'qap_1',
        node_id: 'node-1',
        quarantine_record_id: 'record-1',
        grounds: 'Need a human review for this quarantine',
        evidence: [{ source: 'audit-log' }],
        status: 'submitted',
        submitted_at: new Date(),
        reviewed_at: null,
        reviewed_by: null,
        resolution: null,
      });

      const result = await submitAppeal(
        'node-1',
        'node-1',
        'Need a human review for this quarantine',
        [{ source: 'audit-log' }],
      );

      expect(result.status).toBe('submitted');
      expect(mockPrisma.quarantineAppeal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            quarantine_record_id: 'record-1',
          }),
        }),
      );
    });

    it('should reject appeals for other nodes', async () => {
      await expect(
        submitAppeal('node-1', 'node-2', 'Need a human review for this quarantine'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject appeals after the appeal window closes', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 'record-1',
        node_id: 'node-1',
        level: 'L1',
        reason: 'manual',
        started_at: new Date(Date.now() - 2 * 86_400_000),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });

      await expect(
        submitAppeal('node-1', 'node-1', 'Need a human review for this quarantine'),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate pending appeals', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 'record-1',
        node_id: 'node-1',
        level: 'L1',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 5,
        is_active: true,
        violations: [],
      });
      mockPrisma.quarantineAppeal.findFirst.mockResolvedValue({
        appeal_id: 'qap_1',
        status: 'submitted',
      });

      await expect(
        submitAppeal('node-1', 'node-1', 'Need a human review for this quarantine'),
      ).rejects.toThrow(ConflictError);
    });

    it('should reject appeals when no quarantine record exists', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);

      await expect(
        submitAppeal('node-1', 'node-1', 'Need a human review for this quarantine'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('listAppeals', () => {
    it('should list appeals for a node', async () => {
      mockPrisma.quarantineAppeal.findMany.mockResolvedValue([
        {
          appeal_id: 'qap_1',
          node_id: 'node-1',
          quarantine_record_id: 'record-1',
          grounds: 'Need a human review for this quarantine',
          evidence: [],
          status: 'submitted',
          submitted_at: new Date(),
          reviewed_at: null,
          reviewed_by: null,
          resolution: null,
        },
      ]);

      const result = await listAppeals('node-1');

      expect(mockPrisma.quarantineAppeal.findMany).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        orderBy: { submitted_at: 'desc' },
      });
      expect(result[0]!.appeal_id).toBe('qap_1');
    });
  });

  describe('reviewAppeal', () => {
    it('should reject invalid review statuses', async () => {
      await expect(
        reviewAppeal('qap_1', 'reviewer-1', 'pending' as 'approved'),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject missing appeals', async () => {
      mockPrisma.quarantineAppeal.findUnique.mockResolvedValue(null);

      await expect(reviewAppeal('missing', 'reviewer-1', 'approved'))
        .rejects.toThrow(NotFoundError);
    });

    it('should approve an appeal, release the node, and restore reputation', async () => {
      mockPrisma.quarantineAppeal.findUnique.mockResolvedValue({
        appeal_id: 'qap_1',
        node_id: 'node-1',
        quarantine_record_id: 'record-1',
        status: 'submitted',
      });
      mockPrisma.quarantineAppeal.update.mockResolvedValue({
        appeal_id: 'qap_1',
        node_id: 'node-1',
        quarantine_record_id: 'record-1',
        grounds: 'Need a human review for this quarantine',
        evidence: [],
        status: 'approved',
        submitted_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: 'reviewer-1',
        resolution: 'Manual moderation error',
      });
      mockPrisma.quarantineRecord.findUnique.mockResolvedValue({
        id: 'record-1',
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.quarantineRecord.update.mockResolvedValue({});

      const result = await reviewAppeal(
        'qap_1',
        'reviewer-1',
        'approved',
        'Manual moderation error',
      );

      expect(result.status).toBe('approved');
      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: { is_active: false },
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { reputation: 75 },
      });
      expect(mockPrisma.reputationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            event_type: 'quarantine_appeal_approved',
            delta: 15,
          }),
        }),
      );
    });

    it('should reject already resolved appeals', async () => {
      mockPrisma.quarantineAppeal.findUnique.mockResolvedValue({
        appeal_id: 'qap_1',
        status: 'rejected',
      });

      await expect(reviewAppeal('qap_1', 'reviewer-1', 'approved'))
        .rejects.toThrow(ConflictError);
    });

    it('should allow non-approval review statuses without releasing the node', async () => {
      mockPrisma.quarantineAppeal.findUnique.mockResolvedValue({
        appeal_id: 'qap_1',
        node_id: 'node-1',
        quarantine_record_id: 'record-1',
        status: 'submitted',
      });
      mockPrisma.quarantineAppeal.update.mockResolvedValue({
        appeal_id: 'qap_1',
        node_id: 'node-1',
        quarantine_record_id: 'record-1',
        grounds: 'Need a human review for this quarantine',
        evidence: [],
        status: 'under_review',
        submitted_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: 'reviewer-1',
        resolution: 'Investigating',
      });

      const result = await reviewAppeal(
        'qap_1',
        'reviewer-1',
        'under_review',
        'Investigating',
      );

      expect(result.status).toBe('under_review');
      expect(mockPrisma.quarantineRecord.update).not.toHaveBeenCalled();
      expect(mockPrisma.node.update).not.toHaveBeenCalled();
    });
  });

  describe('autoRelease', () => {
    it('should release all expired quarantine records', async () => {
      const expiredRecords = [
        { id: 1, node_id: 'node-1', auto_release_at: pastDate },
        { id: 2, node_id: 'node-2', auto_release_at: pastDate },
      ];

      mockPrisma.quarantineRecord.findMany.mockResolvedValue(expiredRecords);
      mockPrisma.node.findFirst
        .mockResolvedValueOnce({ node_id: 'node-1', reputation: 60 })
        .mockResolvedValueOnce({ node_id: 'node-2', reputation: 60 });
      mockPrisma.quarantineRecord.update.mockResolvedValue({});

      const count = await autoRelease();

      expect(count).toBe(2);
      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no expired records exist', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);

      const count = await autoRelease();

      expect(count).toBe(0);
      expect(mockPrisma.quarantineRecord.update).not.toHaveBeenCalled();
    });

    it('should query only active records with auto_release_at in the past', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([]);

      await autoRelease();

      expect(mockPrisma.quarantineRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            is_active: true,
            auto_release_at: expect.any(Object),
          },
        }),
      );
    });

    it('should skip auto release when reputation is below the threshold', async () => {
      mockPrisma.quarantineRecord.findMany.mockResolvedValue([
        { id: 1, node_id: 'node-1', auto_release_at: pastDate },
      ]);
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 40 });

      const count = await autoRelease();

      expect(count).toBe(0);
      expect(mockPrisma.quarantineRecord.update).not.toHaveBeenCalled();
    });
  });

  describe('escalateQuarantine', () => {
    it('should escalate from L1 to L2', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        is_active: true,
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 50 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await escalateQuarantine('node-1');

      expect(result.level).toBe('L2');
      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ level: 'L2' }),
        }),
      );
    });

    it('should preserve the new violation reason when escalation is triggered from quarantineNode', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        is_active: true,
        reason: 'content_violation',
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 50 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await escalateQuarantine('node-1', 'manual');

      expect(result.reason).toBe('manual');
      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: 'manual' }),
        }),
      );
    });

    it('should escalate from L2 to L3', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        is_active: true,
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L3',
        reason: 'content_violation',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 30,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 50 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      const result = await escalateQuarantine('node-1');

      expect(result.level).toBe('L3');
    });

    it('should throw ValidationError when already at L3 (max level)', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L3',
        is_active: true,
      });

      await expect(escalateQuarantine('node-1')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when no active quarantine exists', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue(null);

      await expect(escalateQuarantine('node-1')).rejects.toThrow(NotFoundError);
    });

    it('should apply additional reputation penalty on escalation', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        is_active: true,
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 50 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      await escalateQuarantine('node-1');

      // L2 penalty (15) - L1 penalty (5) = 10 additional
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 40 },
        }),
      );
    });

    it('should create reputation event for escalation', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        is_active: true,
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 50 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});

      await escalateQuarantine('node-1');

      expect(mockPrisma.reputationEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            event_type: 'quarantine_escalated_L2',
          }),
        }),
      );
    });

    it('should handle node not found during escalation gracefully', async () => {
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L1',
        is_active: true,
      });
      mockPrisma.quarantineRecord.update.mockResolvedValue({
        id: 1,
        node_id: 'node-1',
        level: 'L2',
        reason: 'manual',
        started_at: new Date(),
        expires_at: futureDate,
        auto_release_at: futureDate,
        reputation_penalty: 15,
        is_active: true,
        violations: [],
      });
      mockPrisma.node.findFirst.mockResolvedValue(null);

      const result = await escalateQuarantine('node-1');

      expect(result.level).toBe('L2');
      expect(mockPrisma.node.update).not.toHaveBeenCalled();
    });
  });
});
