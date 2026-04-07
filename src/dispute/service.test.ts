import * as service from './service';
import * as arbitratorPool from './arbitrator-pool';
import * as evidenceChain from './evidence-chain';
import * as autoRuling from './auto-ruling';
import * as appealModule from './appeal';

const mockPrisma = {
  dispute: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  appeal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  node: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma as any);
  arbitratorPool.setPrisma(mockPrisma as any);
  evidenceChain.setPrisma(mockPrisma as any);
  autoRuling.setPrisma(mockPrisma as any);
  appealModule.setPrisma(mockPrisma as any);
});

beforeEach(() => {
  jest.clearAllMocks();
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

      const result = await service.listDisputes();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { filed_at: 'desc' }, take: 20, skip: 0 }),
      );
    });

    it('should filter disputes by status', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes('resolved');

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'resolved' } }),
      );
    });

    it('should filter disputes by type', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes(undefined, 'governance');

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'governance' } }),
      );
    });

    it('should apply pagination parameters', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      mockPrisma.dispute.count.mockResolvedValue(0);

      await service.listDisputes(undefined, undefined, 10, 5);

      expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
    });
  });

  describe('getDispute', () => {
    it('should return a dispute by id', async () => {
      const mockDispute = {
        dispute_id: 'dsp_test',
        type: 'asset_quality',
        status: 'filed',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

      const result = await service.getDispute('dsp_test');

      expect(result.dispute_id).toBe('dsp_test');
      expect(mockPrisma.dispute.findUnique).toHaveBeenCalledWith({
        where: { dispute_id: 'dsp_test' },
      });
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.getDispute('unknown')).rejects.toThrow('not found');
    });
  });

  describe('fileDispute', () => {
    it('should create a dispute with auto-assigned severity', async () => {
      const mockDispute = {
        dispute_id: 'dsp_test123',
        type: 'asset_quality',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        title: 'Asset mismatch',
        description: 'The asset does not match description',
        status: 'filed',
        severity: 'medium',
        filing_fee: 50,
      };

      mockPrisma.dispute.create.mockResolvedValue(mockDispute);

      const result = await service.fileDispute('node-plaintiff', {
        type: 'asset_quality',
        defendant_id: 'node-defendant',
        title: 'Asset mismatch',
        description: 'The asset does not match description',
      });

      expect(result.status).toBe('filed');
      expect(result.severity).toBe('medium');
      expect(mockPrisma.dispute.create).toHaveBeenCalled();
    });

    it('should set severity to low when no asset is related', async () => {
      const mockDispute = {
        dispute_id: 'dsp_nw',
        severity: 'low',
      };

      mockPrisma.dispute.create.mockResolvedValue(mockDispute);

      const result = await service.fileDispute('node-plaintiff', {
        type: 'transaction',
        defendant_id: 'node-defendant',
        title: 'Bounty not delivered',
        description: 'Worker did not deliver',
        filing_fee: 25,
      });

      expect(result.severity).toBe('low');
    });
  });

  describe('assignArbitrators', () => {
    it('should assign arbitrators and update status to review', async () => {
      const mockDispute = {
        dispute_id: 'dsp_arb',
        arbitrators: [],
        status: 'filed',
      };

      const updatedDispute = {
        ...mockDispute,
        arbitrators: ['arb-1', 'arb-2', 'arb-3'],
        status: 'review',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue(updatedDispute);

      const result = await service.assignArbitrators('dsp_arb', ['arb-1', 'arb-2', 'arb-3']);

      expect(result.arbitrators).toHaveLength(3);
      expect(result.status).toBe('review');
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.assignArbitrators('unknown', ['arb-1'])).rejects.toThrow('not found');
    });
  });

  describe('autoGenerateRuling', () => {
    it('should generate and persist a ruling', async () => {
      const mockDispute = {
        dispute_id: 'dsp_ruling',
        type: 'transaction',
        plaintiff_id: 'node-plaintiff',
        defendant_id: 'node-defendant',
        evidence: [],
        severity: 'high',
        filing_fee: 50,
        escrow_amount: 100,
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.findFirst.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({ ...mockDispute, status: 'resolved' });

      const result = await service.autoGenerateRuling('dsp_ruling');

      expect(result.ruling_id).toMatch(/^rul_/);
      expect(result.dispute_id).toBe('dsp_ruling');
      expect(result.verdict).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.penalties).toBeDefined();
      expect(result.compensations).toBeDefined();
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.autoGenerateRuling('unknown')).rejects.toThrow('not found');
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
      mockPrisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        arbitrators: ['arb-node-0', 'arb-node-1', 'arb-node-2', 'arb-node-3', 'arb-node-4'],
        status: 'under_review',
      });

      const result = await service.selectAndAssignArbitrators('dsp_sel');

      expect(result).toHaveLength(5);
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dispute_id: 'dsp_sel' },
          data: expect.objectContaining({ status: 'under_review' }),
        }),
      );
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.selectAndAssignArbitrators('unknown')).rejects.toThrow('not found');
    });
  });

  describe('issueRuling', () => {
    it('should issue a ruling and set resolved_at when status is resolved', async () => {
      const mockDispute = {
        dispute_id: 'dsp_issue',
        status: 'under_review',
        hearing_started_at: new Date(),
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: 'resolved',
        ruling: { verdict: 'plaintiff_wins' },
      });

      const result = await service.issueRuling('dsp_issue', { verdict: 'plaintiff_wins' }, 'resolved');

      expect(result.status).toBe('resolved');
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resolved_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should issue a ruling without resolved_at when status is not resolved', async () => {
      const mockDispute = {
        dispute_id: 'dsp_issue2',
        status: 'under_review',
        hearing_started_at: null,
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({
        ...mockDispute,
        status: 'under_review',
        ruling: { verdict: 'in_progress' },
      });

      const result = await service.issueRuling('dsp_issue2', { verdict: 'in_progress' }, 'under_review');

      expect(result.status).toBe('under_review');
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.issueRuling('unknown', {}, 'resolved')).rejects.toThrow('not found');
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
        { appeal_id: 'apl_1', original_dispute_id: 'dsp_1', status: 'filed' },
        { appeal_id: 'apl_2', original_dispute_id: 'dsp_1', status: 'accepted' },
      ];
      mockPrisma.appeal.findMany.mockResolvedValue(appeals);

      const result = await service.listAppeals('dsp_1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.appeal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { original_dispute_id: 'dsp_1' } }),
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
        new_evidence: [{ test: 'ev' }],
      };
      const mockDispute = {
        dispute_id: 'dsp_proc',
        plaintiff_id: 'p',
        defendant_id: 'd',
        severity: 'medium',
      };

      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({ ...mockDispute, status: 'under_review' });
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'arb-1', reputation: 80, trust_level: 'trusted', status: 'registered' },
        { node_id: 'arb-2', reputation: 75, trust_level: 'trusted', status: 'registered' },
      ]);

      await expect(service.processAppealDecision('apl_proc')).resolves.not.toThrow();
      expect(mockPrisma.dispute.update).toHaveBeenCalled();
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

      await expect(service.processAppealDecision('apl_rej')).resolves.not.toThrow();
      expect(mockPrisma.dispute.update).not.toHaveBeenCalled();
    });

    it('should throw when appeal not found', async () => {
      mockPrisma.appeal.findUnique.mockResolvedValue(null);

      await expect(service.processAppealDecision('unknown')).rejects.toThrow('not found');
    });
  });

  describe('escalateDisputeToCouncil', () => {
    it('should escalate dispute and return council session id', async () => {
      const mockDispute = { dispute_id: 'dsp_esc', status: 'hearing' };
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({ ...mockDispute, status: 'escalated' });

      const result = await service.escalateDisputeToCouncil('dsp_esc');

      expect(result.council_session_id).toMatch(/^cns_/);
    });

    it('should throw NotFoundError for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.escalateDisputeToCouncil('unknown')).rejects.toThrow('not found');
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
      expect(result.votes).toEqual([]);
      expect(result.appeal_deadline).toBeDefined();
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
        filing_fee: 50,
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
        [{ evidence_id: 'evd_new', type: 'screenshot', content: 'Screenshot of new evidence' }],
      );

      expect(result.appeal_id).toBe('apl_test');
      expect(result.status).toBe('filed');
    });

    it('should reject appeal when max appeals reached', async () => {
      const mockDispute = {
        dispute_id: 'dsp_max',
        resolved_at: new Date(),
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(1); // already at max

      await expect(
        appealModule.fileAppeal('dsp_max', 'node-app', 'Grounds', 100, [{ test: 'ev' }]),
      ).rejects.toThrow('Maximum appeals');
    });

    it('should require new evidence when filing appeal', async () => {
      const mockDispute = {
        dispute_id: 'dsp_noev',
        resolved_at: new Date(),
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
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.count.mockResolvedValue(0);

      await expect(
        appealModule.fileAppeal('dsp_expired', 'node-app', 'Grounds', 100, [{ test: 'ev' }]),
      ).rejects.toThrow('Appeal window has expired');
    });
  });

  describe('reviewAppeal', () => {
    it('should accept appeal with substantial new evidence', async () => {
      const mockAppeal = {
        appeal_id: 'apl_review',
        original_dispute_id: 'dsp_review',
        appellant_id: 'node-appellant',
        grounds: 'Significant new evidence that changes the outcome significantly',
        new_evidence: [{ test: 'ev1' }, { test: 'ev2' }],
        status: 'filed',
      };

      const mockDispute = {
        dispute_id: 'dsp_review',
        status: 'resolved',
      };

      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.update.mockResolvedValue({ ...mockAppeal, status: 'accepted' });
      mockPrisma.dispute.update.mockResolvedValue({ ...mockDispute, status: 'escalated' });

      const result = await appealModule.reviewAppeal('apl_review');

      expect(result.accepted).toBe(true);
      expect(result.escalated).toBe(true);
      expect(result.council_session_id).toMatch(/^cns_/);
    });

    it('should reject appeal lacking substantial evidence', async () => {
      const mockAppeal = {
        appeal_id: 'apl_reject',
        original_dispute_id: 'dsp_reject',
        appellant_id: 'node-appellant',
        grounds: 'Brief grounds',
        new_evidence: [{ test: 'ev' }],
        status: 'filed',
      };

      const mockDispute = {
        dispute_id: 'dsp_reject',
      };

      mockPrisma.appeal.findUnique.mockResolvedValue(mockAppeal);
      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.appeal.update.mockResolvedValue({ ...mockAppeal, status: 'rejected' });

      const result = await appealModule.reviewAppeal('apl_reject');

      expect(result.accepted).toBe(false);
      expect(result.escalated).toBe(false);
    });
  });

  describe('escalateToCouncil', () => {
    it('should escalate dispute and return council session id', async () => {
      const mockDispute = {
        dispute_id: 'dsp_esc',
        status: 'hearing',
      };

      mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);
      mockPrisma.dispute.update.mockResolvedValue({ ...mockDispute, status: 'escalated' });

      const result = await appealModule.escalateToCouncil('dsp_esc');

      expect(result.council_session_id).toMatch(/^cns_/);
      expect(mockPrisma.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'escalated' }),
        }),
      );
    });

    it('should throw for unknown dispute', async () => {
      mockPrisma.dispute.findUnique.mockResolvedValue(null);

      await expect(appealModule.escalateToCouncil('unknown')).rejects.toThrow('not found');
    });
  });
});
