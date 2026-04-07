import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError, ForbiddenError } from '../shared/errors';

const {
  listSandboxes,
  getSandbox,
  createSandbox,
  updateSandbox,
  deleteSandbox,
  joinSandbox,
  leaveSandbox,
  listMembers,
  inviteMember,
  listAssets,
  addAsset,
  requestPromotion,
  listPromotions,
  approvePromotion,
  rejectPromotion,
} = service;

const mockPrisma = {
  $transaction: jest.fn(),
  evolutionSandbox: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  sandboxMember: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  sandboxInvite: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  sandboxAsset: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  promotionRequest: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
} as any;

describe('Sandbox Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listSandboxes', () => {
    it('should return paginated sandboxes', async () => {
      const items = [{ sandbox_id: 'sb-1', name: 'Test Sandbox' }];
      mockPrisma.evolutionSandbox.findMany.mockResolvedValue(items);
      mockPrisma.evolutionSandbox.count.mockResolvedValue(1);

      const result = await listSandboxes();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by state', async () => {
      mockPrisma.evolutionSandbox.findMany.mockResolvedValue([]);
      mockPrisma.evolutionSandbox.count.mockResolvedValue(0);

      await listSandboxes('active');

      expect(mockPrisma.evolutionSandbox.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { state: 'active' } }),
      );
    });

    it('should filter by isolation level', async () => {
      mockPrisma.evolutionSandbox.findMany.mockResolvedValue([]);
      mockPrisma.evolutionSandbox.count.mockResolvedValue(0);

      await listSandboxes(undefined, 'hard');

      expect(mockPrisma.evolutionSandbox.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isolation_level: 'hard' } }),
      );
    });
  });

  describe('getSandbox', () => {
    it('should return sandbox with members and assets', async () => {
      const mockSandbox = {
        sandbox_id: 'sb-1',
        name: 'Test',
        members: [{ node_id: 'node-1' }],
        assets: [{ asset_id: 'asset-1' }],
      };
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(mockSandbox);

      const result = await getSandbox('sb-1');

      expect(result.sandbox_id).toBe('sb-1');
      expect(result.members).toHaveLength(1);
      expect(result.assets).toHaveLength(1);
    });

    it('should throw NotFoundError when sandbox does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(getSandbox('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createSandbox', () => {
    it('should create a sandbox and add creator as owner', async () => {
      const mockSandbox = {
        sandbox_id: expect.any(String),
        name: 'My Sandbox',
        description: 'A test sandbox',
        isolation_level: 'soft',
        env: 'staging',
        state: 'active',
        created_by: 'node-1',
      };
      mockPrisma.evolutionSandbox.create.mockResolvedValue({ ...mockSandbox, sandbox_id: 'sb-1' });
      mockPrisma.sandboxMember.create.mockResolvedValue({ sandbox_id: 'sb-1', node_id: 'node-1', role: 'owner' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});

      const result = await createSandbox('node-1', 'My Sandbox', 'A test sandbox', 'soft', 'staging');

      expect(result.sandbox_id).toBeDefined();
      expect(mockPrisma.sandboxMember.create).toHaveBeenCalled();
    });
  });

  describe('updateSandbox', () => {
    it('should update sandbox fields', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', name: 'Old' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({ sandbox_id: 'sb-1', name: 'New Name' });

      const result = await updateSandbox('sb-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundError when sandbox does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(updateSandbox('nonexistent', { name: 'x' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteSandbox', () => {
    it('should allow creator to delete sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sandboxAsset.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.sandboxMember.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.sandboxInvite.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.evolutionSandbox.delete.mockResolvedValue({});

      await expect(deleteSandbox('sb-1', 'node-1')).resolves.not.toThrow();
    });

    it('should reject deletion by non-creator', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });

      await expect(deleteSandbox('sb-1', 'node-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('joinSandbox', () => {
    it('should add member to active sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', state: 'active' });
      mockPrisma.sandboxMember.upsert.mockResolvedValue({ sandbox_id: 'sb-1', node_id: 'node-2', role: 'participant' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});

      const result = await joinSandbox('sb-1', 'node-2');

      expect(result.role).toBe('participant');
    });

    it('should throw ValidationError when sandbox is not active', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', state: 'archived' });

      await expect(joinSandbox('sb-1', 'node-2')).rejects.toThrow(ValidationError);
    });
  });

  describe('leaveSandbox', () => {
    it('should allow member to leave', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', node_id: 'node-2' });
      mockPrisma.sandboxMember.delete.mockResolvedValue({});
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});

      await expect(leaveSandbox('sb-1', 'node-2')).resolves.not.toThrow();
    });

    it('should reject when creator tries to leave', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });

      await expect(leaveSandbox('sb-1', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('listMembers', () => {
    it('should return members of a sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1' });
      mockPrisma.sandboxMember.findMany.mockResolvedValue([
        { node_id: 'node-1', role: 'owner' },
        { node_id: 'node-2', role: 'participant' },
      ]);

      const result = await listMembers('sb-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('inviteMember', () => {
    it('should create an invite', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1' });
      mockPrisma.sandboxInvite.create.mockResolvedValue({
        invite_id: 'inv-1',
        sandbox_id: 'sb-1',
        invitee: 'node-3',
        status: 'pending',
      });

      const result = await inviteMember('sb-1', 'node-1', 'node-3');

      expect(result.status).toBe('pending');
    });
  });

  describe('addAsset', () => {
    it('should add an asset and increment counters', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1' });
      mockPrisma.sandboxAsset.create.mockResolvedValue({ asset_id: 'asset-1', sandbox_id: 'sb-1' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});
      mockPrisma.sandboxMember.updateMany.mockResolvedValue({});

      const result = await addAsset('sb-1', 'node-1', {
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test Gene',
        content: '// gene content',
      });

      expect(result.asset_id).toBe('asset-1');
    });
  });

  describe('requestPromotion', () => {
    it('should create a promotion request', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1' });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue({ asset_id: 'asset-1' });
      mockPrisma.promotionRequest.findFirst.mockResolvedValue(null);
      mockPrisma.promotionRequest.create.mockResolvedValue({
        request_id: 'req-1',
        sandbox_id: 'sb-1',
        asset_id: 'asset-1',
        status: 'pending',
      });

      const result = await requestPromotion('sb-1', 'node-1', 'asset-1');

      expect(result.status).toBe('pending');
    });

    it('should reject duplicate pending promotion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1' });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue({ asset_id: 'asset-1' });
      mockPrisma.promotionRequest.findFirst.mockResolvedValue({ request_id: 'existing' });

      await expect(requestPromotion('sb-1', 'node-1', 'asset-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('approvePromotion', () => {
    it('should approve and mark asset as promoted', async () => {
      const mockRequest = { request_id: 'req-1', sandbox_id: 'sb-1', asset_id: 'asset-1', requested_by: 'node-1', status: 'pending' };
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.$transaction.mockResolvedValue([{ ...mockRequest, status: 'approved' }, { asset_id: 'asset-1' }]);
      mockPrisma.sandboxAsset.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});
      mockPrisma.sandboxMember.updateMany.mockResolvedValue({});

      const result = await approvePromotion('sb-1', 'req-1', 'node-reviewer');

      expect(result.status).toBe('approved');
    });

    it('should reject non-pending request', async () => {
      mockPrisma.promotionRequest.findUnique.mockResolvedValue({ request_id: 'req-1', status: 'approved' });

      await expect(approvePromotion('sb-1', 'req-1', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('rejectPromotion', () => {
    it('should reject a promotion with a note', async () => {
      const mockRequest = { request_id: 'req-1', sandbox_id: 'sb-1', status: 'pending' };
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.promotionRequest.update.mockResolvedValue({ ...mockRequest, status: 'rejected', review_note: 'Insufficient quality' });

      const result = await rejectPromotion('sb-1', 'req-1', 'node-reviewer', 'Insufficient quality');

      expect(result.status).toBe('rejected');
    });
  });
});
