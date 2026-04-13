import { Prisma } from '@prisma/client';
import * as service from './service';
import * as arbitratorPool from './arbitrator-pool';
import * as evidenceChain from './evidence-chain';
import * as autoRuling from './auto-ruling';
import * as appealModule from './appeal';
import {
  ConflictError,
  ForbiddenError,
  InsufficientCreditsError,
  ValidationError,
} from '../shared/errors';

const mockPrisma = {
  $transaction: jest.fn(),
  dispute: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  appeal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  asset: {
    findUnique: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    aggregate: jest.fn(),
  },
  node: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
} as any;

const validAppealEvidence = [
  {
    evidence_id: 'evd_1',
    type: 'screenshot',
    content: 'Screenshot of new evidence',
    hash: 'sha256:abc123',
    submitted_by: 'node-1',
    submitted_at: '2026-01-01T00:00:00.000Z',
    verified: false,
  },
];

const validAppealEvidencePair = [
  ...validAppealEvidence,
  {
    evidence_id: 'evd_2',
    type: 'log',
    content: 'System log proving the appeal claim',
    hash: 'sha256:def456',
    submitted_by: 'node-1',
    submitted_at: '2026-01-01T01:00:00.000Z',
    verified: true,
  },
];

const trustedViewer = {
  node_id: 'moderator-1',
  trust_level: 'trusted',
  auth_type: 'session',
} as const;

const privilegedViewer = {
  node_id: 'moderator-1',
  trust_level: 'trusted',
  auth_type: 'api_key',
  scopes: ['disputes:read:any'],
} as const;

const regularViewer = {
  node_id: 'node-plaintiff',
  trust_level: 'verified',
  auth_type: 'session',
} as const;

const unscopedApiViewer = {
  node_id: 'node-plaintiff',
  trust_level: 'trusted',
  auth_type: 'api_key',
  scopes: [],
} as const;

beforeAll(() => {
  service.setPrisma(mockPrisma as any);
  arbitratorPool.setPrisma(mockPrisma as any);
  evidenceChain.setPrisma(mockPrisma as any);
  autoRuling.setPrisma(mockPrisma as any);
  appealModule.setPrisma(mockPrisma as any);
});

beforeEach(() => {
  jest.clearAllMocks();
  arbitratorPool.resetArbitratorWorkload();
  mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
  mockPrisma.node.findUnique.mockImplementation(async ({ where }: { where: { node_id: string } }) => ({
    node_id: where.node_id,
    credit_balance: 1000,
  }));
  mockPrisma.node.update.mockResolvedValue({ credit_balance: 975 });
  mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.dispute.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.appeal.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.asset.findUnique.mockResolvedValue({ author_id: 'node-defendant' });
  mockPrisma.creditTransaction.create.mockResolvedValue({});
});

// ─── Dispute CRUD ───────────────────────────────────────────────────────────────

describe('Dispute Service', () => {
  describe('listDisputes', () => {
    it('should list disputes with default pagination', async () => {
      const mockDisputes = [
        { dispute_id: 'dsp_1', type: 'asset_quality', status: 'filed' },
        { dispute_id: 'dsp_2', type: 'transaction', status: 'resolved' },
      ];

      mockPrisma.dispute.findMany.mockResolvedValue(mockDisputes);
      mockPrisma.dispute.count.mockResolvedValue(2);

      const result = await service.listDisputes(privilegedViewer);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { filed_at: 'desc' },
          take: 20,
          skip: 0,
          select: expect.any(Object),
        }),
      );
    });

    it('should reject api keys without dispute read scope', async () => {
      await expect(service.listDisputes(unscopedApiViewer)).rejects.toThrow(ForbiddenError);
      expect(mockPrisma.dispute.findMany).not.toHaveBeenCalled();
    });

    it('should filter disputes by status', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes(privilegedViewer, 'resolved');

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'resolved' } }),
      );
    });

    it('should filter disputes by type', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes(privilegedViewer, undefined, 'governance');

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'governance' } }),
      );
    });

    it('should apply pagination parameters', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes(privilegedViewer, undefined, undefined, 10, 5);

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
    });

    it('should keep unscoped trusted session viewers actor-scoped', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes(trustedViewer);

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { plaintiff_id: 'moderator-1' },
              { defendant_id: 'moderator-1' },
              { arbitrators: { has: 'moderator-1' } },
            ],
          },
        }),
      );
    });
  });

  describe('getDispute', () => {
    it('should return a dispute by id', async () => {
      const mockDispute = {
        dispute_id: 'dsp_test',
        type: 'asset_quality',
        severity: 'medium',
        status: 'resolved',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        title: 'Test dispute',
        description: 'The dispute description',
        related_asset_id: null,
        related_bounty_id: null,
        related_transaction_id: null,
        filing_fee: 25,
        escrow_amount: 50,
        filed_at: new Date('2026-01-01T00:00:00.000Z'),
        review_started_at: null,
        hearing_started_at: null,
        resolved_at: new Date('2026-01-02T00:00:00.000Z'),
        deadline: new Date('2026-01-03T00:00:00.000Z'),
        evidence: [{ evidence_id: 'evd-1' }],
        ruling: { verdict: 'plaintiff_wins' },
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await service.getDispute('dsp_test', regularViewer);

      expect(result.dispute_id).toBe('dsp_test');
      expect(result.evidence_count).toBe(1);
      expect(result.ruling).toEqual({ verdict: 'plaintiff_wins' });
      expect(result).not.toHaveProperty('evidence');
      expect(mockPrisma.dispute.findUnique).toHaveBeenCalledWith({
        where: { dispute_id: 'dsp_test' },
        select: expect.any(Object),
      });
    });

    it('should reject api keys without dispute read scope on detail reads', async () => {
      await expect(service.getDispute('dsp_test', unscopedApiViewer)).rejects.toThrow(ForbiddenError);
      expect(mockPrisma.dispute.findUnique).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.getDispute('unknown', regularViewer)).rejects.toThrow('not found');
    });

    it('should reject viewers who are not involved in the dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_hidden',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(
        service.getDispute('dsp_hidden', {
          node_id: 'node-outsider',
          trust_level: 'verified',
          auth_type: 'session',
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('fileDispute', () => {
    it('should create an asset-quality dispute with spec-aligned defaults', async () => {
      const mockDispute = {
        dispute_id: 'dsp_test123',
        type: 'asset_quality',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        title: 'Asset mismatch',
        description: 'The asset does not match description',
        status: 'filed',
        severity: 'medium',
        filing_fee: 25,
        escrow_amount: 50,
      };

      mockPrisma.dispute.create.mockResolvedValue(mockDispute);

      const result = await service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Asset mismatch',
        description: 'The asset does not match description',
        related_asset_id: 'asset-1',
      });

      expect(result.status).toBe('filed');
      expect(result.severity).toBe('medium');
      expect(result.evidence_count).toBe(0);
      expect(result).not.toHaveProperty('evidence');
      expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith({
        where: { asset_id: 'asset-1' },
        select: { author_id: true },
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-plaintiff' },
        data: { credit_balance: { decrement: 25 } },
        select: { credit_balance: true },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          node_id: 'node-plaintiff',
          amount: -25,
          type: 'dispute_filing_fee',
        }),
      }));
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          severity: 'medium',
          filing_fee: 25,
          escrow_amount: 50,
          related_asset_id: 'asset-1',
          target_id: 'asset-1',
          deadline: expect.any(Date),
        }),
      }));
    });

    it('should derive high severity for transaction disputes', async () => {
      const mockDispute = {
        dispute_id: 'dsp_nw',
        severity: 'high',
        filing_fee: 50,
      };

      mockPrisma.dispute.create.mockResolvedValue(mockDispute);

      const result = await service.fileDispute('node-plaintiff', {
        type: 'transaction',
        defendant_id: 'node-defendant',
        title: 'Bounty not delivered',
        description: 'Worker did not deliver',
      });

      expect(result.severity).toBe('high');
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          severity: 'high',
          filing_fee: 50,
          escrow_amount: 100,
        }),
      }));
    });

    it('should reject unsupported dispute types', async () => {
      await expect(service.fileDispute('node-plaintiff', {
        type: 'unsupported',
        defendant_id: 'node-defendant',
        title: 'Valid title',
        description: 'This description is long enough to pass validation.',
      })).rejects.toThrow('type must be one of');
    });

    it('should derive critical severity for governance disputes', async () => {
      mockPrisma.dispute.create.mockResolvedValue({
        dispute_id: 'dsp_governance',
        severity: 'critical',
        filing_fee: 100,
        escrow_amount: 200,
      });

      const result = await service.fileDispute('node-plaintiff', {
        type: 'governance',
        defendant_id: 'node-defendant',
        title: 'Governance dispute',
        description: 'Council execution diverged from the approved governance proposal.',
      });

      expect(result.severity).toBe('critical');
      expect(mockPrisma.dispute.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          severity: 'critical',
          filing_fee: 100,
          escrow_amount: 200,
        }),
      }));
    });

    it('should reject self-filed disputes', async () => {
      await expect(service.fileDispute('node-same', {
        type: 'asset_quality',
        defendant_id: 'node-same',
        title: 'Valid title',
        description: 'This description is long enough to pass validation.',
      })).rejects.toThrow('plaintiff_id and defendant_id must be different');
    });

    it('should reject non-array evidence payloads', async () => {
      await expect(service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Valid title',
        description: 'This description is long enough to pass validation.',
        evidence: 'not-an-array' as unknown as unknown[],
      })).rejects.toThrow('evidence must be an array of valid evidence objects');
    });

    it('should reject malformed evidence objects when filing a dispute', async () => {
      await expect(service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Valid title',
        description: 'This description is long enough to pass validation.',
        evidence: [{
          ...validAppealEvidence[0]!,
          type: 'unknown-evidence-type',
        }],
      })).rejects.toThrow('evidence must be an array of valid evidence objects');
    });

    it('should reject titles that are too short', async () => {
      await expect(service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'bad',
        description: 'This description is long enough to pass validation.',
      })).rejects.toThrow('title must be between 5 and 200 characters');
    });

    it('should require related_asset_id for asset-quality disputes', async () => {
      await expect(service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Valid asset dispute',
        description: 'This description is long enough to pass validation.',
      })).rejects.toThrow('related_asset_id is required for asset_quality disputes');
    });

    it('should reject asset-quality disputes when the asset does not exist', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Valid asset dispute',
        description: 'This description is long enough to pass validation.',
        related_asset_id: 'asset-missing',
      })).rejects.toThrow('Asset not found');
    });

    it('should reject asset-quality disputes when defendant does not own the asset', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({ author_id: 'node-other' });

      await expect(service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Valid asset dispute',
        description: 'This description is long enough to pass validation.',
        related_asset_id: 'asset-1',
      })).rejects.toThrow('defendant_id must match the asset author');
    });

    it('should reject filing when plaintiff cannot afford the filing fee', async () => {
      mockPrisma.node.findUnique.mockImplementation(async ({ where }: { where: { node_id: string } }) => {
        if (where.node_id === 'node-plaintiff') {
          return { node_id: 'node-plaintiff', credit_balance: 10 };
        }

        return { node_id: where.node_id, credit_balance: 1000 };
      });

      await expect(service.fileDispute('node-plaintiff', {
        type: 'transaction',
        defendant_id: 'node-defendant',
        title: 'Bounty not delivered',
        description: 'Worker did not deliver and the credits were not refunded.',
      })).rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe('assignArbitrators', () => {
    it('should assign arbitrators and update status to under_review', async () => {
      const mockDispute = {
        dispute_id: 'dsp_arb',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        status: 'filed',
        severity: 'medium',
        evidence: [{ evidence_id: 'evd-hidden' }],
      };

      const updatedDispute = {
        ...mockDispute,
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        status: 'under_review',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'arb-1' },
        { node_id: 'arb-2' },
        { node_id: 'arb-3' },
      ]);

      const result = await service.assignArbitrators('dsp_arb', ['arb-1', 'arb-2', 'arb-3'], 'moderator-1');

      expect(result.arbitrators).toHaveLength(3);
      expect(result.status).toBe('under_review');
      expect(result).not.toHaveProperty('evidence');
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          dispute_id: 'dsp_arb',
          status: 'filed',
          arbitrators: { equals: [] },
        }),
        data: expect.objectContaining({
          arbitrators: ['arb-1', 'arb-2', 'arb-3'],
          status: 'under_review',
        }),
      }));
    });

    it('should reject arbitrator counts that do not match dispute severity', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_bad_count',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        status: 'filed',
        severity: 'critical',
      });

      await expect(
        service.assignArbitrators('dsp_bad_count', ['arb-1', 'arb-2', 'arb-3'], 'moderator-1'),
      ).rejects.toThrow('require exactly 5 arbitrators');
    });

    it('should reject invalid status transitions when reassigning arbitrators', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_resolved',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        status: 'resolved',
        severity: 'medium',
      });

      await expect(
        service.assignArbitrators('dsp_resolved', ['arb-1', 'arb-2', 'arb-3'], 'moderator-1'),
      ).rejects.toThrow('Cannot move dispute from resolved to under_review');
    });

    it('should reject manual assignment for escalated disputes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_escalated_assign',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        status: 'escalated',
        severity: 'medium',
      });

      await expect(
        service.assignArbitrators('dsp_escalated_assign', ['arb-4', 'arb-5', 'arb-6'], 'moderator-1'),
      ).rejects.toThrow('Escalated disputes must be reopened via appeal processing');
    });

    it('should reject manual assignment when dispute state changes before persistence', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_assign_race',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        status: 'filed',
        severity: 'medium',
      });
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'arb-1' },
        { node_id: 'arb-2' },
        { node_id: 'arb-3' },
      ]);
      mockPrisma.dispute.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.assignArbitrators('dsp_assign_race', ['arb-1', 'arb-2', 'arb-3'], 'moderator-1'),
      ).rejects.toThrow('Dispute state changed during arbitrator assignment');

      expect(arbitratorPool.getArbitratorWorkload('arb-1')).toBe(0);
      expect(arbitratorPool.getArbitratorWorkload('arb-2')).toBe(0);
      expect(arbitratorPool.getArbitratorWorkload('arb-3')).toBe(0);
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.assignArbitrators('unknown', ['arb-1'], 'moderator-1')).rejects.toThrow('not found');
    });

    it('should reject dispute parties from assigning arbitrators', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_party_assign',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        status: 'filed',
        severity: 'medium',
      });

      await expect(
        service.assignArbitrators('dsp_party_assign', ['arb-1', 'arb-2', 'arb-3'], 'node-plaintiff'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject assigning the acting moderator as an arbitrator', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_self_assign',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        status: 'filed',
        severity: 'medium',
      });

      await expect(
        service.assignArbitrators('dsp_self_assign', ['moderator-1', 'arb-2', 'arb-3'], 'moderator-1'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject arbitrators that are not eligible trusted nodes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_ineligible_arb',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: [],
        status: 'filed',
        severity: 'medium',
      });
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'arb-1' },
        { node_id: 'arb-2' },
      ]);

      await expect(
        service.assignArbitrators('dsp_ineligible_arb', ['arb-1', 'arb-2', 'arb-3'], 'moderator-1'),
      ).rejects.toThrow(ValidationError);
    });

    it('should reject replacing an active arbitrator panel after review has started', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_locked_panel',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        status: 'under_review',
        severity: 'medium',
      });

      await expect(
        service.assignArbitrators('dsp_locked_panel', ['arb-4', 'arb-5', 'arb-6'], 'moderator-1'),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('autoGenerateRuling', () => {
    it('should generate and persist a ruling', async () => {
      const mockDispute = {
        dispute_id: 'dsp_ruling',
        type: 'transaction',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        evidence: [],
        severity: 'high',
        filing_fee: 50,
        escrow_amount: 100,
        status: 'under_review',
        hearing_started_at: null,
        review_started_at: new Date(),
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.findFirst.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({ ...mockDispute, status: 'resolved' });

      const result = await service.autoGenerateRuling('dsp_ruling', 'arb-1');

      expect(result.ruling_id).toMatch(/^rul_/);
      expect(result.dispute_id).toBe('dsp_ruling');
      expect(result.verdict).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.penalties).toBeDefined();
      expect(result.compensations).toBeDefined();
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.autoGenerateRuling('unknown', 'arb-1')).rejects.toThrow('not found');
    });

    it('should reject auto-generated rulings from non-arbitrators', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_ruling',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(service.autoGenerateRuling('dsp_ruling', 'node-outsider'))
        .rejects.toThrow(ForbiddenError);
    });

    it('should reject auto-generated rulings from invalid dispute states', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_dismissed',
        status: 'dismissed',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(service.autoGenerateRuling('dsp_dismissed', 'arb-1'))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('selectAndAssignArbitrators', () => {
    it('should select and assign arbitrators to dispute', async () => {
      const mockDispute = {
        dispute_id: 'dsp_sel',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'high',
        arbitrators: [],
        status: 'filed',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          node_id: `arb-node-${i}`,
          reputation: 80,
          trust_level: 'trusted',
          status: 'registered',
        })),
      );
      const result = await service.selectAndAssignArbitrators('dsp_sel', 'moderator-1');

      expect(result).toHaveLength(5);
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dispute_id: 'dsp_sel',
            status: 'filed',
            arbitrators: { equals: [] },
          }),
          data: expect.objectContaining({ status: 'under_review' }),
        }),
      );
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.selectAndAssignArbitrators('unknown', 'moderator-1')).rejects.toThrow('not found');
    });

    it('should fall back to medium severity rules when dispute severity is unknown', async () => {
      const mockDispute = {
        dispute_id: 'dsp_unknown_severity',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'mystery',
        arbitrators: [],
        status: 'filed',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue(
        Array.from({ length: 3 }, (_, index) => ({
          node_id: `arb-node-${index}`,
          reputation: 80,
          trust_level: 'trusted',
          status: 'registered',
        })),
      );
      const result = await service.selectAndAssignArbitrators('dsp_unknown_severity', 'moderator-1');

      expect(result).toHaveLength(3);
    });

    it('should fail when no eligible arbitrators are available', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_none_available',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'medium',
        arbitrators: [],
        status: 'filed',
      });
      mockPrisma.node.findMany.mockResolvedValue([]);

      await expect(
        service.selectAndAssignArbitrators('dsp_none_available', 'moderator-1'),
      ).rejects.toThrow('Need exactly 3 eligible arbitrators, found 0');
    });

    it('should fail when only a partial arbitrator panel is available', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_partial_panel',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'high',
        arbitrators: [],
        status: 'filed',
      });
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'arb-1', reputation: 90, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-2', reputation: 85, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-3', reputation: 80, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-4', reputation: 78, trust_level: 'trusted', status: 'registered' },
      ]);

      await expect(
        service.selectAndAssignArbitrators('dsp_partial_panel', 'moderator-1'),
      ).rejects.toThrow('Need exactly 5 eligible arbitrators, found 4');
      expect(arbitratorPool.getArbitratorWorkload('arb-1')).toBe(0);
      expect(arbitratorPool.getArbitratorWorkload('arb-2')).toBe(0);
    });

    it('should reject dispute parties from auto-assigning arbitrators', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_party_auto_assign',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        severity: 'medium',
        arbitrators: [],
        status: 'filed',
      });

      await expect(
        service.selectAndAssignArbitrators('dsp_party_auto_assign', 'node-defendant'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject auto-assignment for escalated disputes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_escalated_auto_assign',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        severity: 'medium',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        status: 'escalated',
      });

      await expect(
        service.selectAndAssignArbitrators('dsp_escalated_auto_assign', 'moderator-1'),
      ).rejects.toThrow('Escalated disputes must be reopened via appeal processing');
    });

    it('should exclude the acting moderator from auto-assignment', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_actor_excluded',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        severity: 'medium',
        arbitrators: [],
        status: 'filed',
      });
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'moderator-1', reputation: 95, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-1', reputation: 90, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-2', reputation: 85, trust_level: 'trusted', status: 'registered' },
      ]);

      await expect(
        service.selectAndAssignArbitrators('dsp_actor_excluded', 'moderator-1'),
      ).rejects.toThrow('Need exactly 3 eligible arbitrators, found 2');
    });
  });

  describe('issueRuling', () => {
    it('should issue a ruling and set resolved_at when status is resolved', async () => {
      const mockDispute = {
        dispute_id: 'dsp_issue',
        status: 'under_review',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        hearing_started_at: new Date(),
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: 'resolved',
        ruling: { verdict: 'plaintiff_wins' },
        evidence: [{ evidence_id: 'evd-hidden' }],
      });

      const result = await service.issueRuling('dsp_issue', { verdict: 'plaintiff_wins' }, 'resolved', 'arb-1');

      expect(result.status).toBe('resolved');
      expect(result.ruling).toEqual({ verdict: 'plaintiff_wins' });
      expect(result).not.toHaveProperty('evidence');
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resolved_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should reject rulings while a dispute is escalated', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_escalated_blocked',
        status: 'escalated',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(
        service.issueRuling('dsp_escalated_blocked', { verdict: 'plaintiff_wins' }, 'under_review', 'arb-1'),
      ).rejects.toThrow('Escalated disputes must be reopened via appeal processing');

      expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
    });

    it('should release arbitrator workload when a dispute is resolved', async () => {
      arbitratorPool.reserveArbitrators(['arb-1', 'arb-2', 'arb-3']);
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_release_workload',
        status: 'under_review',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        hearing_started_at: new Date(),
      });
      mockPrisma.dispute.update.mockResolvedValue({
        dispute_id: 'dsp_release_workload',
        status: 'resolved',
        ruling: { verdict: 'defendant_wins' },
      });

      await service.issueRuling(
        'dsp_release_workload',
        { verdict: 'defendant_wins' },
        'resolved',
        'arb-1',
      );

      expect(arbitratorPool.getArbitratorWorkload('arb-1')).toBe(0);
      expect(arbitratorPool.getArbitratorWorkload('arb-2')).toBe(0);
      expect(arbitratorPool.getArbitratorWorkload('arb-3')).toBe(0);
    });

    it('should issue a ruling without resolved_at when status is not resolved', async () => {
      const mockDispute = {
        dispute_id: 'dsp_issue2',
        status: 'under_review',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        hearing_started_at: null,
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: 'under_review',
        ruling: { verdict: 'in_progress' },
      });

      const result = await service.issueRuling('dsp_issue2', { verdict: 'in_progress' }, 'under_review', 'arb-1');

      expect(result.status).toBe('under_review');
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.issueRuling('unknown', {}, 'resolved', 'arb-1')).rejects.toThrow('not found');
    });

    it('should reject invalid ruling statuses', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_invalid_status',
        status: 'under_review',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        hearing_started_at: null,
        review_started_at: new Date(),
      });

      await expect(
        service.issueRuling('dsp_invalid_status', { verdict: 'plaintiff_wins' }, 'filed', 'arb-1'),
      ).rejects.toThrow('status must be one of');
    });

    it('should reject non-object rulings', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_non_object',
        status: 'under_review',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        hearing_started_at: null,
        review_started_at: new Date(),
      });

      await expect(
        service.issueRuling('dsp_non_object', [] as unknown as object, 'resolved', 'arb-1'),
      ).rejects.toThrow('ruling must be an object');
    });

    it('should reject escalated as a ruling status', async () => {
      await expect(
        service.issueRuling('dsp_escalated', { verdict: 'plaintiff_wins' }, 'escalated', 'arb-1'),
      ).rejects.toThrow(ValidationError);

      expect(mockPrisma.dispute.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
    });

    it('should reject rulings from non-assigned arbitrators', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_unassigned',
        status: 'under_review',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        hearing_started_at: null,
        review_started_at: new Date(),
      });

      await expect(
        service.issueRuling('dsp_unassigned', { verdict: 'plaintiff_wins' }, 'resolved', 'node-outsider'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('validateEvidence', () => {
    it('should return valid=false for missing evidence', async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue(null);

      const result = await service.validateEvidence('evd_unknown');

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Evidence record not found');
    });
  });

  describe('scoreEvidence', () => {
    it('should return 0 for dispute with no evidence', async () => {
      const mockDispute = { dispute_id: 'dsp_noev', evidence: [] };
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await service.scoreEvidence('dsp_noev');

      expect(result).toBe(0);
    });

    it('should calculate score from evidence', async () => {
      const mockDispute = {
        dispute_id: 'dsp_ev',
        evidence: [
          {
            evidence_id: 'evd_1',
            type: 'transaction_record',
            content: 'Transfer confirmed',
            hash: 'sha256:abc123',
            verified: true,
            submitted_at: new Date().toISOString(),
            submitted_by: 'node-1',
          },
        ],
      };
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.findFirst.mockResolvedValue(mockDispute);

      const result = await service.scoreEvidence('dsp_ev');

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should return 0 for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      const result = await service.scoreEvidence('unknown');

      expect(result).toBe(0);
    });
  });

  describe('detectEvidenceTampering', () => {
    it('should throw NotFoundError when no dispute with evidence exists', async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue(null);

      await expect(service.detectEvidenceTampering('evd_any')).rejects.toThrow('not found');
    });

    it('should throw NotFoundError when evidence not found in dispute', async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue({
        dispute_id: 'dsp_found',
        evidence: [
          {
            evidence_id: 'evd_other',
            type: 'screenshot',
            content: 'Some content',
            hash: 'sha256:abc',
            verified: false,
            submitted_at: new Date().toISOString(),
            submitted_by: 'node-1',
          },
        ],
      });

      await expect(service.detectEvidenceTampering('evd_missing')).rejects.toThrow('not found');
    });

    it('should detect tampering when hash mismatches', async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue({
        dispute_id: 'dsp_found',
        evidence: [
          {
            evidence_id: 'evd_tampered',
            type: 'screenshot',
            content: 'Original content here',
            hash: 'sha256:wronghash',
            verified: false,
            submitted_at: new Date().toISOString(),
            submitted_by: 'node-1',
          },
        ],
      });

      const result = await service.detectEvidenceTampering('evd_tampered');

      expect(result.tampered).toBe(true);
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('listAppeals', () => {
    it('should return appeals for a dispute', async () => {
      const appeals = [
        {
          appeal_id: 'apl_1',
          original_dispute_id: 'dsp_1',
          appellant_id: 'node-plaintiff',
          grounds: 'New evidence',
          appeal_fee: 25,
          status: 'filed',
          filed_at: new Date('2026-01-01T00:00:00.000Z'),
          new_evidence: [{ evidence_id: 'evd-1' }],
        },
        {
          appeal_id: 'apl_2',
          original_dispute_id: 'dsp_1',
          appellant_id: 'node-defendant',
          grounds: 'Process issue',
          appeal_fee: 25,
          status: 'accepted',
          filed_at: new Date('2026-01-02T00:00:00.000Z'),
          new_evidence: [],
        },
      ];
      mockPrisma.appeal.findMany.mockResolvedValue(appeals);

      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_1',
        type: 'transaction',
        severity: 'high',
        status: 'resolved',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
        title: 'Resolved dispute',
        description: 'desc',
        related_asset_id: null,
        related_bounty_id: null,
        related_transaction_id: null,
        filing_fee: 50,
        escrow_amount: 100,
        filed_at: new Date('2026-01-01T00:00:00.000Z'),
        review_started_at: null,
        hearing_started_at: null,
        resolved_at: new Date('2026-01-03T00:00:00.000Z'),
        deadline: new Date('2026-01-04T00:00:00.000Z'),
        evidence: [],
        ruling: { verdict: 'plaintiff_wins' },
      });

      const result = await service.listAppeals('dsp_1', privilegedViewer);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        appeal_id: 'apl_1',
        new_evidence_count: 1,
      });
      expect(result[0]).not.toHaveProperty('new_evidence');
      expect(mockPrisma.appeal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { original_dispute_id: 'dsp_1' },
          select: expect.any(Object),
        }),
      );
    });
  });

  describe('processAppealDecision', () => {
    it('should process accepted appeal and re-select arbitrators', async () => {
      const mockAppeal = {
        appeal_id: 'apl_proc',
        original_dispute_id: 'dsp_proc',
        appellant_id: 'node-app',
        grounds: 'New evidence',
        status: 'accepted',
        new_evidence: validAppealEvidence,
      };
      const mockDispute = {
        dispute_id: 'dsp_proc',
        plaintiff_id: 'p',
        defendant_id: 'd',
        severity: 'medium',
        status: 'escalated',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      };

      mockPrisma.appeal.findUnique
        .mockResolvedValueOnce(mockAppeal)
        .mockResolvedValueOnce({ ...mockAppeal, status: 'accepted_processing' });
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'moderator-1', reputation: 95, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-2', reputation: 75, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-3', reputation: 74, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-4', reputation: 82, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-5', reputation: 81, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-6', reputation: 80, trust_level: 'trusted', status: 'registered' },
      ]);

      await expect(service.processAppealDecision('apl_proc', 'moderator-1')).resolves.not.toThrow();
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalled();
      const updatedPanel = mockPrisma.dispute.updateMany.mock.calls[0]?.[0]?.data?.arbitrators as string[];
      expect(updatedPanel).toEqual(expect.arrayContaining(['arb-4', 'arb-5', 'arb-6']));
      expect(updatedPanel).not.toContain('moderator-1');
      expect(updatedPanel).not.toContain('arb-2');
      expect(updatedPanel).not.toContain('arb-3');
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'under_review',
          hearing_started_at: null,
          resolved_at: null,
          ruling: Prisma.DbNull,
          council_session_id: null,
        }),
      }));
      expect(mockPrisma.appeal.update).toHaveBeenCalledWith({
        where: { appeal_id: 'apl_proc' },
        data: { status: 'accepted_processed' },
      });
    });

    it('should restore accepted appeals when arbitrator selection fails after claiming processing', async () => {
      const mockAppeal = {
        appeal_id: 'apl_proc_fail',
        original_dispute_id: 'dsp_proc_fail',
        appellant_id: 'node-app',
        grounds: 'New evidence',
        status: 'accepted',
        new_evidence: validAppealEvidence,
      };
      const mockDispute = {
        dispute_id: 'dsp_proc_fail',
        plaintiff_id: 'p',
        defendant_id: 'd',
        severity: 'medium',
        status: 'escalated',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      };

      const selectorSpy = jest.spyOn(arbitratorPool, 'selectAndReserveArbitrators')
        .mockRejectedValueOnce(new Error('selector failed'));
      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      await expect(
        service.processAppealDecision('apl_proc_fail', 'moderator-1'),
      ).rejects.toThrow('selector failed');

      expect(mockPrisma.appeal.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          appeal_id: 'apl_proc_fail',
          status: 'accepted',
        },
        data: { status: 'accepted_processing' },
      });
      expect(mockPrisma.appeal.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          appeal_id: 'apl_proc_fail',
          status: 'accepted_processing',
        },
        data: { status: 'accepted' },
      });
      selectorSpy.mockRestore();
    });

    it('should process rejected appeal without changing dispute', async () => {
      const mockAppeal = {
        appeal_id: 'apl_rej',
        original_dispute_id: 'dsp_rej',
        appellant_id: 'node-app',
        grounds: 'Short',
        status: 'rejected',
        new_evidence: [],
      };

      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_rej',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      });

      await expect(service.processAppealDecision('apl_rej', 'moderator-1')).resolves.not.toThrow();
      expect(mockPrisma.dispute.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.appeal.updateMany).toHaveBeenCalledWith({
        where: {
          appeal_id: 'apl_rej',
          status: 'rejected',
        },
        data: { status: 'rejected_processed' },
      });
    });

    it('should throw when appeal not found', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue(null);

      await expect(service.processAppealDecision('unknown', 'moderator-1')).rejects.toThrow('not found');
    });

    it('should reject dispute parties from processing appeals', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue({
        appeal_id: 'apl_party_process',
        original_dispute_id: 'dsp_party_process',
        status: 'rejected',
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_party_process',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
      });

      await expect(
        service.processAppealDecision('apl_party_process', 'node-plaintiff'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject non-arbitrators from processing appeals', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue({
        appeal_id: 'apl_outsider_process',
        original_dispute_id: 'dsp_outsider_process',
        status: 'rejected',
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_outsider_process',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(
        service.processAppealDecision('apl_outsider_process', 'node-outsider'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject accepted appeals that were already processed', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue({
        appeal_id: 'apl_processed',
        original_dispute_id: 'dsp_processed',
        status: 'accepted_processed',
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_processed',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      });

      await expect(
        service.processAppealDecision('apl_processed', 'moderator-1'),
      ).rejects.toThrow(ConflictError);
    });

    it.each(['filed', 'accepted_blocked'])(
      'should reject processing appeals in %s status',
      async (status) => {
        mockPrisma.appeal.findUnique.mockResolvedValue({
          appeal_id: `apl_${status}`,
          original_dispute_id: `dsp_${status}`,
          status,
        });
        mockPrisma.dispute.findUnique.mockResolvedValue({
          dispute_id: `dsp_${status}`,
          plaintiff_id: 'node-plaintiff',
          defendant_id: 'node-defendant',
          arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
        });

        await expect(
          service.processAppealDecision(`apl_${status}`, 'moderator-1'),
        ).rejects.toThrow(`Appeal decision cannot be processed from status: ${status}`);

        expect(mockPrisma.appeal.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.dispute.updateMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('escalateDisputeToCouncil', () => {
    it('should escalate dispute and return council session id', async () => {
      const mockDispute = {
        dispute_id: 'dsp_esc',
        status: 'hearing',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      };
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await service.escalateDisputeToCouncil('dsp_esc', 'moderator-1');

      expect(result.council_session_id).toMatch(/^cns_/);
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          dispute_id: 'dsp_esc',
          status: { in: ['filed', 'under_review', 'hearing'] },
        }),
        data: expect.objectContaining({ status: 'escalated' }),
      }));
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.escalateDisputeToCouncil('unknown', 'moderator-1')).rejects.toThrow('not found');
    });

    it('should reject dispute parties from escalating disputes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_esc_party',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
      });

      await expect(
        service.escalateDisputeToCouncil('dsp_esc_party', 'node-defendant'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject non-arbitrators from escalating disputes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_esc_outsider',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(
        service.escalateDisputeToCouncil('dsp_esc_outsider', 'node-outsider'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject finalized disputes from escalating to council', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_esc_final',
        status: 'resolved',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      });

      await expect(
        service.escalateDisputeToCouncil('dsp_esc_final', 'moderator-1'),
      ).rejects.toThrow(ConflictError);

      expect(mockPrisma.dispute.updateMany).not.toHaveBeenCalled();
    });
  });
});

// ─── Arbitrator Pool ───────────────────────────────────────────────────────────

describe('Arbitrator Pool', () => {
  describe('selectArbitrator', () => {
    it('should select correct number of arbitrators by severity', async () => {
      const mockDispute = {
        dispute_id: 'dsp_select',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'high',
      };

      const mockNodes = Array.from({ length: 10 }, (_, i) => ({
        node_id: `arb-node-${i}`,
        reputation: 80,
        trust_level: 'trusted',
        status: 'registered',
      }));

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue(mockNodes);

      const result = await arbitratorPool.selectArbitrator('dsp_select', 'high');

      // high severity requires 5 arbitrators
      expect(result).toHaveLength(5);
      // All selected should be from mockNodes
      result.forEach((arb) => {
        expect(arb).toMatch(/^arb-node-/);
      });
    });

    it('should exclude parties from selection', async () => {
      const mockDispute = {
        dispute_id: 'dsp_exclude',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'medium',
      };

      const mockNodes = [
        { node_id: 'plaintiff-1', reputation: 80, trust_level: 'trusted', status: 'registered' },
        { node_id: 'defendant-1', reputation: 85, trust_level: 'trusted', status: 'registered' },
        { node_id: 'neutral-1', reputation: 75, trust_level: 'trusted', status: 'registered' },
        { node_id: 'neutral-2', reputation: 78, trust_level: 'trusted', status: 'registered' },
      ];

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue(mockNodes);

      const result = await arbitratorPool.selectArbitrator('dsp_exclude', 'medium');

      expect(result).not.toContain('plaintiff-1');
      expect(result).not.toContain('defendant-1');
    });

    it('should return empty array for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      const result = await arbitratorPool.selectArbitrator('unknown');

      expect(result).toEqual([]);
    });

    it('should handle insufficient candidates gracefully', async () => {
      const mockDispute = {
        dispute_id: 'dsp_sparse',
        plaintiff_id: 'plaintiff-1',
        defendant_id: 'defendant-1',
        severity: 'critical',
      };

      const mockNodes = [
        { node_id: 'arb-1', reputation: 80, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-2', reputation: 75, trust_level: 'trusted', status: 'registered' },
      ];

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.node.findMany.mockResolvedValue(mockNodes);

      const result = await arbitratorPool.selectArbitrator('dsp_sparse', 'critical');

      // Only 2 available (5 needed for critical), should return as many as possible
      expect(result).toHaveLength(2);
    });
  });

  describe('getAvailableArbitrators', () => {
    it('should return available arbitrators with correct availability flag', async () => {
      const mockNodes = [
        { node_id: 'arb-1', reputation: 80, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-2', reputation: 55, trust_level: 'unverified', status: 'registered' },
      ];

      // The function filters by reputation >= 70 AND trust_level in ['trusted','verified']
      // So only arb-1 matches — configure mock to reflect what DB would return after filters
      mockPrisma.node.findMany.mockResolvedValue([mockNodes[0]]);

      const result = await arbitratorPool.getAvailableArbitrators();

      expect(result).toHaveLength(1);
      expect(result[0]!.node_id).toBe('arb-1');
      expect(result[0]!.is_available).toBe(true);
    });
  });
});

// ─── Evidence Chain ────────────────────────────────────────────────────────────

describe('Evidence Chain', () => {
  describe('calculateEvidenceScore', () => {
    it('should return 0 for dispute with no evidence', async () => {
      const mockDispute = {
        dispute_id: 'dsp_noev',
        evidence: [],
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await evidenceChain.calculateEvidenceScore('dsp_noev');

      expect(result).toBe(0);
    });

    it('should calculate score from evidence', async () => {
      const mockDispute = {
        dispute_id: 'dsp_ev',
        evidence: [
          {
            evidence_id: 'evd_1',
            type: 'transaction_record',
            content: 'Transfer of 100 credits confirmed',
            hash: 'sha256:abc123',
            verified: true,
            submitted_at: new Date().toISOString(),
            submitted_by: 'node-1',
          },
        ],
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.findFirst.mockResolvedValue(mockDispute);

      const result = await evidenceChain.calculateEvidenceScore('dsp_ev');

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should return 0 for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      const result = await evidenceChain.calculateEvidenceScore('unknown');

      expect(result).toBe(0);
    });
  });

  describe('validateEvidenceIntegrity', () => {
    it('should return invalid for missing evidence', async () => {
      mockPrisma.dispute.findFirst.mockResolvedValue(null);

      const result = await evidenceChain.validateEvidenceIntegrity('evd_unknown');

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Evidence record not found');
    });
  });

  describe('detectTampering', () => {
    it('should detect tampering when hash mismatches', async () => {
      const evidence = {
        evidence_id: 'evd_tampered',
        type: 'screenshot' as const,
        content: 'Original content here',
        hash: 'sha256:wronghashvalue1234567890abcdef',
        submitted_by: 'node-1',
        submitted_at: new Date().toISOString(),
        verified: false,
      };

      const result = await evidenceChain.detectTampering(evidence);

      expect(result.tampered).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it('should pass when hash matches', async () => {
      const content = 'test content for hash';
      // compute a matching hash
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const hex = Math.abs(hash).toString(16).padStart(16, '0');
      const computedHash = `sha256:${hex}${'0'.repeat(48 - hex.length)}`;

      const evidence = {
        evidence_id: 'evd_ok',
        type: 'log' as const,
        content,
        hash: computedHash,
        submitted_by: 'node-1',
        submitted_at: new Date().toISOString(),
        verified: false,
      };

      const result = await evidenceChain.detectTampering(evidence);

      expect(result.tampered).toBe(false);
      expect(result.confidence).toBe(0.95);
    });
  });
});

// ─── Auto Ruling ──────────────────────────────────────────────────────────────

describe('Auto Ruling', () => {
  describe('determineRulingType', () => {
    it('should return plaintiff_wins when plaintiff score is higher', () => {
      const scores = {
        plaintiff_score: 0.8,
        defendant_score: 0.3,
        compromise_ratio: 0,
        evidence_weight: 0.7,
      };

      const result = autoRuling.determineRulingType(scores);

      expect(result).toBe('plaintiff_wins');
    });

    it('should return defendant_wins when defendant score is higher', () => {
      const scores = {
        plaintiff_score: 0.2,
        defendant_score: 0.7,
        compromise_ratio: 0,
        evidence_weight: 0.6,
      };

      const result = autoRuling.determineRulingType(scores);

      expect(result).toBe('defendant_wins');
    });

    it('should return compromise when scores are close', () => {
      const scores = {
        plaintiff_score: 0.52,
        defendant_score: 0.48,
        compromise_ratio: 1,
        evidence_weight: 0.5,
      };

      const result = autoRuling.determineRulingType(scores);

      expect(result).toBe('compromise');
    });

    it('should return no_fault when diff is within threshold', () => {
      const scores = {
        plaintiff_score: 0.53,
        defendant_score: 0.47,
        compromise_ratio: 0,
        evidence_weight: 0.5,
      };

      const result = autoRuling.determineRulingType(scores);

      expect(result).toBe('no_fault');
    });
  });

  describe('scoreClaim', () => {
    it('should score claim based on supporting evidence', async () => {
      const claim = {
        id: 'claim-1',
        content: 'The asset was plagiarized from another source',
      };

      const evidence = [
        {
          content: 'The asset was plagiarized from another source and copied verbatim',
          type: 'testimony',
        },
        {
          content: 'Original asset has identical code structure',
          type: 'asset_hash',
        },
      ];

      const result = await autoRuling.scoreClaim(claim, evidence);

      expect(result.score).toBeGreaterThan(0);
      expect(result.supporting_evidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should score a claim with supporting evidence higher than without', async () => {
      // Claim with zero overlap to any evidence
      const claimSupported = {
        id: 'claim-s',
        content: 'Plagiarism detected copied verbatim from original source code',
      };
      const evidenceSupported = [
        {
          content: 'Plagiarism detected copied verbatim from original source code and confirmed by hash comparison',
          type: 'testimony',
        },
      ];

      // Claim with little to no overlap
      const claimAlone = {
        id: 'claim-a',
        content: 'zztop123 claim alone xyz999',
      };
      const evidenceAlone = [
        {
          content: 'completely unrelated material that has no bearing on the dispute abcdefghijk',
          type: 'screenshot',
        },
      ];

      const [resultSupported, resultAlone] = await Promise.all([
        autoRuling.scoreClaim(claimSupported, evidenceSupported),
        autoRuling.scoreClaim(claimAlone, evidenceAlone),
      ]);

      // Supporting evidence should yield a higher score
      expect(resultSupported.score).toBeGreaterThan(resultAlone.score);
      expect(resultSupported.supporting_evidence).toBeGreaterThan(resultAlone.supporting_evidence);
    });
  });

  describe('generateRuling', () => {
    it('should generate a complete ruling structure', async () => {
      const mockDispute = {
        dispute_id: 'dsp_genrul',
        type: 'asset_quality',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        title: 'Asset quality dispute',
        description: 'Asset does not meet spec',
        evidence: [],
        severity: 'medium',
        filing_fee: 25,
        escrow_amount: 50,
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.findFirst.mockResolvedValue(mockDispute);

      const result = await autoRuling.generateRuling('dsp_genrul');

      expect(result.ruling_id).toMatch(/^rul_/);
      expect(result.dispute_id).toBe('dsp_genrul');
      expect(result.verdict).toBeDefined();
      expect(result.reasoning).toContain('Asset Quality Dispute');
      expect(result.penalties).toBeDefined();
      expect(result.compensations).toBeDefined();
      expect(result.votes).toHaveLength(3);
      expect(result.votes[0]).toEqual({
        arbitrator_id: 'arb-1',
        vote: 'defendant',
        reasoning: expect.stringContaining('favor the defendant'),
      });
      expect(result.appeal_deadline).toBeDefined();
    });

    it('should throw when the dispute does not exist', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(autoRuling.generateRuling('missing-dispute')).rejects.toThrow('Dispute not found');
    });
  });
});

// ─── Appeal ────────────────────────────────────────────────────────────────────

describe('Appeal Module', () => {
  describe('fileAppeal', () => {
    it('should create an appeal with new evidence', async () => {
      const mockDispute = {
        dispute_id: 'dsp_appeal',
        resolved_at: new Date(),
        status: 'resolved',
        filing_fee: 50,
        plaintiff_id: 'node-appellant',
        defendant_id: 'node-defendant',
      };

      const createdAppeal = {
        appeal_id: 'apl_test',
        original_dispute_id: 'dsp_appeal',
        appellant_id: 'node-appellant',
        grounds: 'New evidence was discovered after ruling',
        status: 'filed',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(0);
      mockPrisma.appeal.create.mockResolvedValue(createdAppeal);

      const result = await appealModule.fileAppeal(
        'dsp_appeal',
        'node-appellant',
        'New evidence was discovered after ruling',
        100,
        [{
          ...validAppealEvidence[0]!,
          evidence_id: 'evd_new',
        }],
      );

      expect(result.appeal_id).toBe('apl_test');
      expect(result.status).toBe('filed');
      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith({
        where: {
          node_id: 'node-appellant',
          credit_balance: { gte: 100 },
        },
        data: { credit_balance: { decrement: 100 } },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          node_id: 'node-appellant',
          amount: -100,
          type: 'appeal_fee',
        }),
      }));
    });

    it('should derive the appeal fee from the original filing fee when omitted', async () => {
      const mockDispute = {
        dispute_id: 'dsp_default_fee',
        resolved_at: new Date(),
        filing_fee: 25,
        status: 'resolved',
        plaintiff_id: 'node-appellant',
        defendant_id: 'node-defendant',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(0);
      mockPrisma.appeal.create.mockResolvedValue({
        appeal_id: 'apl_default_fee',
        status: 'filed',
      });

      await appealModule.fileAppeal(
        'dsp_default_fee',
        'node-appellant',
        'New evidence was discovered after ruling',
        undefined,
        [{
          ...validAppealEvidence[0]!,
          evidence_id: 'evd_new',
        }],
      );

      expect(mockPrisma.appeal.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          appeal_fee: 50,
        }),
      }));
    });

    it('should reject appeal when max appeals reached', async () => {
      const mockDispute = {
        dispute_id: 'dsp_max',
        resolved_at: new Date(),
        status: 'resolved',
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(1); // already at max

      await expect(
        appealModule.fileAppeal('dsp_max', 'node-app', 'Grounds', 100, validAppealEvidence),
      ).rejects.toThrow('Maximum appeals');
    });

    it('should require new evidence when filing appeal', async () => {
      const mockDispute = {
        dispute_id: 'dsp_noev',
        resolved_at: new Date(),
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(0);

      await expect(
        appealModule.fileAppeal('dsp_noev', 'node-app', 'Some grounds here that is long enough', 100),
      ).rejects.toThrow('New evidence is required');
    });

    it('should reject appeal after window expires', async () => {
      const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const mockDispute = {
        dispute_id: 'dsp_expired',
        resolved_at: oldDate,
        status: 'resolved',
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(0);

      await expect(
        appealModule.fileAppeal('dsp_expired', 'node-app', 'Grounds', 100, validAppealEvidence),
      ).rejects.toThrow('Appeal window has expired');
    });

    it('should reject appeals for unresolved disputes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_unresolved',
        resolved_at: null,
        status: 'under_review',
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      });

      await expect(
        appealModule.fileAppeal('dsp_unresolved', 'node-app', 'Grounds', 100, validAppealEvidence),
      ).rejects.toThrow('Only resolved disputes can be appealed');
    });

    it('should reject appeals when only a stale resolved_at remains on an active dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_stale_resolution',
        resolved_at: new Date(),
        status: 'under_review',
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      });

      await expect(
        appealModule.fileAppeal(
          'dsp_stale_resolution',
          'node-app',
          'Grounds detailed enough for appeal review',
          100,
          validAppealEvidence,
        ),
      ).rejects.toThrow('Only resolved disputes can be appealed');
    });

    it('should reject non-array new evidence payloads', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_bad_evidence',
        resolved_at: new Date(),
        status: 'resolved',
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      });

      await expect(
        appealModule.fileAppeal(
          'dsp_bad_evidence',
          'node-app',
          'Grounds',
          100,
          'bad-evidence' as unknown as unknown[],
        ),
      ).rejects.toThrow('new_evidence must be an array of valid evidence objects');
    });

    it('should reject malformed new evidence objects', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_bad_evidence_shape',
        resolved_at: new Date(),
        status: 'resolved',
        filing_fee: 50,
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      });
      mockPrisma.appeal.count.mockResolvedValue(0);

      await expect(
        appealModule.fileAppeal(
          'dsp_bad_evidence_shape',
          'node-app',
          'Grounds are detailed enough to justify an appeal review.',
          100,
          [{
            ...validAppealEvidence[0]!,
            submitted_at: 'not-a-real-date',
          }],
        ),
      ).rejects.toThrow('new_evidence must be an array of valid evidence objects');
    });

    it('should reject appeals from non-parties', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_non_party',
        resolved_at: new Date(),
        status: 'resolved',
        filing_fee: 50,
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
      });

      await expect(
        appealModule.fileAppeal('dsp_non_party', 'node-outsider', 'Grounds', 100, validAppealEvidence),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject appeals when the appellant cannot cover the fee', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_low_balance',
        resolved_at: new Date(),
        status: 'resolved',
        filing_fee: 50,
        plaintiff_id: 'node-app',
        defendant_id: 'node-defendant',
      });
      mockPrisma.appeal.count.mockResolvedValue(0);
      mockPrisma.node.findUnique.mockResolvedValueOnce({ credit_balance: 20 });
      mockPrisma.node.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        appealModule.fileAppeal('dsp_low_balance', 'node-app', 'Grounds', 100, validAppealEvidence),
      ).rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe('reviewAppeal', () => {
    it('should accept appeal with substantial new evidence', async () => {
      const mockAppeal = {
        appeal_id: 'apl_review',
        original_dispute_id: 'dsp_review',
        appellant_id: 'node-appellant',
        grounds: 'Significant new evidence that changes the outcome significantly',
        new_evidence: validAppealEvidencePair,
        status: 'filed',
      };

      const mockDispute = {
        dispute_id: 'dsp_review',
        status: 'resolved',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      };

      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await appealModule.reviewAppeal('apl_review', 'moderator-1');

      expect(result.accepted).toBe(true);
      expect(result.escalated).toBe(true);
      expect(result.council_session_id).toMatch(/^cns_/);
      expect(mockPrisma.appeal.updateMany).toHaveBeenCalledWith({
        where: {
          appeal_id: 'apl_review',
          status: 'filed',
        },
        data: { status: 'accepted' },
      });
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          dispute_id: 'dsp_review',
          status: 'resolved',
        }),
        data: expect.objectContaining({ status: 'escalated' }),
      }));
    });

    it('should reject appeal lacking substantial evidence', async () => {
      const mockAppeal = {
        appeal_id: 'apl_reject',
        original_dispute_id: 'dsp_reject',
        appellant_id: 'node-appellant',
        grounds: 'Brief grounds',
        new_evidence: validAppealEvidence,
        status: 'filed',
      };

      const mockDispute = {
        dispute_id: 'dsp_reject',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      };

      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await appealModule.reviewAppeal('apl_reject', 'moderator-1');

      expect(result.accepted).toBe(false);
      expect(result.escalated).toBe(false);
      expect(mockPrisma.appeal.updateMany).toHaveBeenCalledWith({
        where: {
          appeal_id: 'apl_reject',
          status: 'filed',
        },
        data: { status: 'rejected' },
      });
    });

    it('should reject dispute parties from reviewing appeals', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue({
        appeal_id: 'apl_party_review',
        original_dispute_id: 'dsp_party_review',
        appellant_id: 'node-plaintiff',
        grounds: 'Significant new evidence that changes the outcome significantly',
        new_evidence: validAppealEvidencePair,
        status: 'filed',
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_party_review',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      });

      await expect(
        appealModule.reviewAppeal('apl_party_review', 'node-defendant'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject non-arbitrators from reviewing appeals', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue({
        appeal_id: 'apl_outsider_review',
        original_dispute_id: 'dsp_outsider_review',
        appellant_id: 'node-plaintiff',
        grounds: 'Significant new evidence that changes the outcome significantly',
        new_evidence: validAppealEvidencePair,
        status: 'filed',
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_outsider_review',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
      });

      await expect(
        appealModule.reviewAppeal('apl_outsider_review', 'node-outsider'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject appeals that were already reviewed', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue({
        appeal_id: 'apl_reviewed',
        original_dispute_id: 'dsp_reviewed',
        appellant_id: 'node-appellant',
        grounds: 'Significant new evidence that changes the outcome significantly',
        new_evidence: validAppealEvidencePair,
        status: 'accepted',
      });
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_reviewed',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      });

      await expect(
        appealModule.reviewAppeal('apl_reviewed', 'moderator-1'),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('escalateToCouncil', () => {
    it('should escalate dispute and return council session id', async () => {
      const mockDispute = {
        dispute_id: 'dsp_esc',
        status: 'hearing',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await appealModule.escalateToCouncil('dsp_esc', 'moderator-1');

      expect(result.council_session_id).toMatch(/^cns_/);
      expect(mockPrisma.dispute.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dispute_id: 'dsp_esc',
            status: { in: ['filed', 'under_review', 'hearing'] },
          }),
          data: expect.objectContaining({ status: 'escalated' }),
        }),
      );
    });

    it('should throw for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(appealModule.escalateToCouncil('unknown', 'moderator-1')).rejects.toThrow('not found');
    });

    it('should reject finalized disputes', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue({
        dispute_id: 'dsp_esc_final',
        status: 'dismissed',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        arbitrators: ['moderator-1', 'arb-2', 'arb-3'],
      });

      await expect(
        appealModule.escalateToCouncil('dsp_esc_final', 'moderator-1'),
      ).rejects.toThrow(ConflictError);

      expect(mockPrisma.dispute.updateMany).not.toHaveBeenCalled();
    });
  });
});

describe('Dispute service facade wrappers', () => {
  it('delegates fileAppeal through the service facade', async () => {
    const spy = jest.spyOn(appealModule, 'fileAppeal').mockResolvedValueOnce({
      appeal_id: 'apl_facade',
      status: 'filed',
    });

    const result = await service.fileAppeal(
      'dsp_facade',
      'node-appellant',
      'Grounds',
      100,
      validAppealEvidence,
    );

    expect(result.appeal_id).toBe('apl_facade');
    expect(spy).toHaveBeenCalledWith(
      'dsp_facade',
      'node-appellant',
      'Grounds',
      100,
      validAppealEvidence,
    );
    spy.mockRestore();
  });

  it('delegates reviewAppeal through the service facade', async () => {
    const spy = jest.spyOn(appealModule, 'reviewAppeal').mockResolvedValueOnce({
      appeal_id: 'apl_review',
      status: 'accepted',
      accepted: true,
      reasoning: 'ok',
      escalated: true,
    });

    const result = await service.reviewAppeal('apl_review', 'moderator-1');

    expect(result.accepted).toBe(true);
    expect(spy).toHaveBeenCalledWith('apl_review', 'moderator-1');
    spy.mockRestore();
  });
});

describe('Arbitrator pool helpers', () => {
  it('does not double-count workload when assigning the same arbitrator twice', async () => {
    mockPrisma.dispute.findUnique
      .mockResolvedValueOnce({
        dispute_id: 'dsp_repeat_assignment',
        arbitrators: [],
      })
      .mockResolvedValueOnce({
        dispute_id: 'dsp_repeat_assignment',
        arbitrators: ['arb-1'],
      });
    mockPrisma.dispute.update.mockResolvedValue({
      dispute_id: 'dsp_repeat_assignment',
      arbitrators: ['arb-1'],
    });

    await arbitratorPool.assignDispute('dsp_repeat_assignment', 'arb-1');
    await arbitratorPool.assignDispute('dsp_repeat_assignment', 'arb-1');

    expect(mockPrisma.dispute.update).toHaveBeenCalledTimes(1);
    expect(arbitratorPool.getArbitratorWorkload('arb-1')).toBe(1);
  });

  it('makes reserved arbitrators unavailable to the next auto-selection', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    mockPrisma.dispute.findUnique.mockResolvedValue({
      dispute_id: 'dsp_auto_reserve',
      plaintiff_id: 'plaintiff-1',
      defendant_id: 'defendant-1',
    });
    mockPrisma.node.findMany.mockResolvedValue([
      { node_id: 'arb-1', reputation: 99, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-2', reputation: 98, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-3', reputation: 97, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-4', reputation: 96, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-5', reputation: 95, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-6', reputation: 94, trust_level: 'trusted', status: 'registered' },
    ]);
    arbitratorPool.reserveArbitrators(['arb-1', 'arb-2', 'arb-3']);
    arbitratorPool.reserveArbitrators(['arb-1', 'arb-2', 'arb-3']);

    const firstPanel = await arbitratorPool.selectAndReserveArbitrators('dsp_auto_reserve', 'medium');
    const secondPanel = await arbitratorPool.selectArbitrator('dsp_auto_reserve', 'medium');

    expect(firstPanel).toEqual(['arb-1', 'arb-2', 'arb-3']);
    expect(secondPanel).toEqual(['arb-4', 'arb-5', 'arb-6']);

    randomSpy.mockRestore();
  });

  it('rolls back reserved workload when auto-assignment persistence fails', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    mockPrisma.dispute.findUnique.mockResolvedValue({
      dispute_id: 'dsp_auto_rollback',
      plaintiff_id: 'plaintiff-1',
      defendant_id: 'defendant-1',
      severity: 'medium',
      arbitrators: [],
      status: 'filed',
    });
    mockPrisma.node.findMany.mockResolvedValue([
      { node_id: 'arb-1', reputation: 99, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-2', reputation: 98, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-3', reputation: 97, trust_level: 'trusted', status: 'registered' },
    ]);
    mockPrisma.dispute.updateMany.mockRejectedValue(new Error('db write failed'));

    await expect(service.selectAndAssignArbitrators('dsp_auto_rollback', 'moderator-1')).rejects.toThrow('db write failed');
    expect(arbitratorPool.getArbitratorWorkload('arb-1')).toBe(0);
    expect(arbitratorPool.getArbitratorWorkload('arb-2')).toBe(0);
    expect(arbitratorPool.getArbitratorWorkload('arb-3')).toBe(0);

    randomSpy.mockRestore();
  });

  it('rolls back reserved workload when auto-assignment loses the compare-and-swap', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    mockPrisma.dispute.findUnique.mockResolvedValue({
      dispute_id: 'dsp_auto_cas',
      plaintiff_id: 'plaintiff-1',
      defendant_id: 'defendant-1',
      severity: 'medium',
      arbitrators: [],
      status: 'filed',
    });
    mockPrisma.node.findMany.mockResolvedValue([
      { node_id: 'arb-1', reputation: 99, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-2', reputation: 98, trust_level: 'trusted', status: 'registered' },
      { node_id: 'arb-3', reputation: 97, trust_level: 'trusted', status: 'registered' },
    ]);
    mockPrisma.dispute.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.selectAndAssignArbitrators('dsp_auto_cas', 'moderator-1'),
    ).rejects.toThrow('Dispute state changed during arbitrator assignment');
    expect(arbitratorPool.getArbitratorWorkload('arb-1')).toBe(0);
    expect(arbitratorPool.getArbitratorWorkload('arb-2')).toBe(0);
    expect(arbitratorPool.getArbitratorWorkload('arb-3')).toBe(0);

    randomSpy.mockRestore();
  });
});
