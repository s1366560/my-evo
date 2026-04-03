import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';
import type { QuarantineLevel, QuarantineReason, Violation } from '../shared/types';

const {
  quarantineNode,
  addViolation,
  checkQuarantineStatus,
  releaseNode,
  autoRelease,
  escalateQuarantine,
} = service;

const mockPrisma = {
  node: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  quarantineRecord: {
    findFirst: jest.fn(),
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

    it('should throw ValidationError when node is already quarantined', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({ node_id: 'node-1', reputation: 60 });
      mockPrisma.quarantineRecord.findFirst.mockResolvedValue({ id: 1, is_active: true });

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

    it('should auto-release and return null when quarantine has expired', async () => {
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
      mockPrisma.quarantineRecord.update.mockResolvedValue({});

      const result = await checkQuarantineStatus('node-1');

      expect(result).toBeNull();
      expect(mockPrisma.quarantineRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { is_active: false },
        }),
      );
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

  describe('autoRelease', () => {
    it('should release all expired quarantine records', async () => {
      const expiredRecords = [
        { id: 1, node_id: 'node-1', auto_release_at: pastDate },
        { id: 2, node_id: 'node-2', auto_release_at: pastDate },
      ];

      mockPrisma.quarantineRecord.findMany.mockResolvedValue(expiredRecords);
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
        reason: 'content_violation',
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
