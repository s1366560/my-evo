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
  attachExistingAssetToSandbox,
  modifySandboxAsset,
  runExperiment,
  completeSandbox,
  compareSandbox,
  getSandboxStats,
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
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  sandboxMember: {
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  sandboxInvite: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  asset: {
    findUnique: jest.fn(),
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
    updateMany: jest.fn(),
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
    mockPrisma.evolutionSandbox.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') {
        return operation(mockPrisma);
      }

      return operation;
    });
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
        expect.objectContaining({ where: { AND: [{ state: 'active' }] } }),
      );
    });

    it('should filter by isolation level', async () => {
      mockPrisma.evolutionSandbox.findMany.mockResolvedValue([]);
      mockPrisma.evolutionSandbox.count.mockResolvedValue(0);

      await listSandboxes(undefined, 'hard');

      expect(mockPrisma.evolutionSandbox.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { AND: [{ isolation_level: 'hard' }] } }),
      );
    });

    it('should scope sandbox listings to the caller when a node id is provided', async () => {
      mockPrisma.evolutionSandbox.findMany.mockResolvedValue([]);
      mockPrisma.evolutionSandbox.count.mockResolvedValue(0);

      await listSandboxes('active', undefined, 20, 0, 'node-1');

      expect(mockPrisma.evolutionSandbox.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { state: 'active' },
              {
                OR: [
                  { created_by: 'node-1' },
                  { members: { some: { node_id: 'node-1' } } },
                ],
              },
            ],
          },
        }),
      );
    });
  });

  describe('getSandbox', () => {
    it('should return sandbox with members and assets', async () => {
      const mockSandbox = {
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        name: 'Test',
        members: [{ node_id: 'node-1' }],
        assets: [{ asset_id: 'asset-1' }],
      };
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(mockSandbox);

      const result = await getSandbox('sb-1', 'node-1');

      expect(result.sandbox_id).toBe('sb-1');
      expect(result.members).toHaveLength(1);
      expect(result.assets).toHaveLength(1);
    });

    it('should throw NotFoundError when sandbox does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(getSandbox('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
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
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', name: 'Old', created_by: 'node-1' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({ sandbox_id: 'sb-1', name: 'New Name' });

      const result = await updateSandbox('sb-1', 'node-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
    });

    it('should throw NotFoundError when sandbox does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(updateSandbox('nonexistent', 'node-1', { name: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('should reject updates from non-owners', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-2' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue(null);

      await expect(updateSandbox('sb-1', 'node-1', { name: 'x' })).rejects.toThrow(ForbiddenError);
    });

    it('should reject updates after sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'completed',
      });

      await expect(updateSandbox('sb-1', 'node-1', { name: 'x' })).rejects.toThrow(ValidationError);
    });

    it('should require the dedicated completion flow for terminal states', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'active',
      });

      await expect(updateSandbox('sb-1', 'node-1', { state: 'completed' })).rejects.toThrow(ValidationError);
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

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(deleteSandbox('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should reject deletion after sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'completed',
      });

      await expect(deleteSandbox('sb-1', 'node-1')).rejects.toThrow(ValidationError);
    });

    it('should reject deletions that race with sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique
        .mockResolvedValueOnce({
          sandbox_id: 'sb-1',
          created_by: 'node-1',
          state: 'active',
        })
        .mockResolvedValueOnce({ state: 'completed' });
      mockPrisma.evolutionSandbox.updateMany.mockResolvedValue({ count: 0 });

      await expect(deleteSandbox('sb-1', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('joinSandbox', () => {
    it('should add member to active sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', state: 'active' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue(null);
      mockPrisma.sandboxInvite.findFirst.mockResolvedValue({ invite_id: 'inv-1', sandbox_id: 'sb-1', invitee: 'node-2', status: 'pending' });
      mockPrisma.sandboxMember.create.mockResolvedValue({ sandbox_id: 'sb-1', node_id: 'node-2', role: 'participant' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});
      mockPrisma.sandboxInvite.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
        if (typeof operation === 'function') {
          return operation(mockPrisma);
        }

        return operation;
      });

      const result = await joinSandbox('sb-1', 'node-2');

      expect(result.role).toBe('participant');
    });

    it('should not increment member_count when the member already exists', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', state: 'active' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', node_id: 'node-2' });
      mockPrisma.sandboxMember.update.mockResolvedValue({ sandbox_id: 'sb-1', node_id: 'node-2', role: 'participant' });
      mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
        if (typeof operation === 'function') {
          return operation(mockPrisma);
        }

        return operation;
      });

      await joinSandbox('sb-1', 'node-2');

      expect(mockPrisma.sandboxMember.update).toHaveBeenCalled();
      expect(mockPrisma.evolutionSandbox.update).not.toHaveBeenCalled();
    });

    it('should reject join attempts without a pending invite', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', state: 'active' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue(null);
      mockPrisma.sandboxInvite.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
        if (typeof operation === 'function') {
          return operation(mockPrisma);
        }

        return operation;
      });

      await expect(joinSandbox('sb-1', 'node-2')).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError when sandbox is not active', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', state: 'archived' });

      await expect(joinSandbox('sb-1', 'node-2')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(joinSandbox('nonexistent', 'node-2')).rejects.toThrow(NotFoundError);
    });

    it('should reject joins that race with sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique
        .mockResolvedValueOnce({ sandbox_id: 'sb-1', state: 'active' })
        .mockResolvedValueOnce({ state: 'completed' });
      mockPrisma.evolutionSandbox.updateMany.mockResolvedValue({ count: 0 });

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

    it('should reject leaving after sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'completed',
      });

      await expect(leaveSandbox('sb-1', 'node-2')).rejects.toThrow(ValidationError);
    });
  });

  describe('listMembers', () => {
    it('should return members of a sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxMember.findMany.mockResolvedValue([
        { node_id: 'node-1', role: 'owner' },
        { node_id: 'node-2', role: 'participant' },
      ]);

      const result = await listMembers('sb-1', 'node-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('inviteMember', () => {
    it('should create an invite', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
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
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
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

    it('should reject new assets after sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'completed',
      });

      await expect(addAsset('sb-1', 'node-1', {
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test Gene',
        content: '// gene content',
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('attachExistingAssetToSandbox', () => {
    it('should attach an existing asset to the sandbox and report the new count', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Catalog Gene',
        description: 'Catalog description',
        content: 'gene content',
        signals: ['optimize'],
        tags: ['catalog'],
        author_id: 'node-1',
        status: 'draft',
      });
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        members: [],
        assets: [
          { asset_id: 'asset-1' },
          { asset_id: 'asset-2' },
        ],
      });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue(null);
      mockPrisma.sandboxAsset.findMany.mockResolvedValue([
        { asset_id: 'asset-1' },
        { asset_id: 'asset-2' },
      ]);
      mockPrisma.sandboxAsset.create.mockResolvedValue({ asset_id: 'asset-1', sandbox_id: 'sb-1' });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});
      mockPrisma.sandboxMember.updateMany.mockResolvedValue({});

      const result = await attachExistingAssetToSandbox('sb-1', 'node-1', 'asset-1');

      expect(result).toEqual({ status: 'ok', sandbox_asset_count: 2 });
    });

    it('should throw when the source asset does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(attachExistingAssetToSandbox('sb-1', 'node-1', 'missing')).rejects.toThrow(NotFoundError);
    });

    it('should be idempotent when the asset is already attached', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        members: [],
        assets: [
          { asset_id: 'asset-1' },
          { asset_id: 'asset-2' },
        ],
      });
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Catalog Gene',
        description: 'Catalog description',
        content: 'gene content',
        signals: ['optimize'],
        tags: ['catalog'],
        author_id: 'node-1',
        status: 'draft',
      });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue({ asset_id: 'asset-1', sandbox_id: 'sb-1' });
      mockPrisma.sandboxAsset.findMany.mockResolvedValue([
        { asset_id: 'asset-1' },
        { asset_id: 'asset-2' },
      ]);

      const result = await attachExistingAssetToSandbox('sb-1', 'node-1', 'asset-1');

      expect(result).toEqual({ status: 'ok', sandbox_asset_count: 2 });
      expect(mockPrisma.sandboxAsset.create).not.toHaveBeenCalled();
      expect(mockPrisma.evolutionSandbox.update).not.toHaveBeenCalled();
    });

    it('should hide non-public assets owned by another node', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.asset.findUnique.mockResolvedValue({
        asset_id: 'asset-1',
        author_id: 'node-2',
        status: 'draft',
      });

      await expect(attachExistingAssetToSandbox('sb-1', 'node-1', 'asset-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('modifySandboxAsset', () => {
    it('should update a sandbox asset and return the modified asset id', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue({
        sandbox_id: 'sb-1',
        asset_id: 'asset-1',
        content: 'old content',
      });
      mockPrisma.sandboxAsset.updateMany.mockResolvedValue({ count: 1 });

      const result = await modifySandboxAsset('sb-1', 'node-1', 'asset-1', {
        code: 'new content',
        version: '1.1.0',
      });

      expect(result).toEqual({ status: 'ok', modified: 'asset-1' });
      expect(mockPrisma.sandboxAsset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sandbox_id: 'sb-1', asset_id: 'asset-1' },
          data: expect.objectContaining({ content: 'new content' }),
        }),
      );
    });

    it('should throw when the sandbox asset does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue(null);

      await expect(modifySandboxAsset('sb-1', 'node-1', 'missing', {})).rejects.toThrow(NotFoundError);
    });

    it('should reject modifications from non-members', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-2' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue(null);

      await expect(modifySandboxAsset('sb-1', 'node-1', 'asset-1', {})).rejects.toThrow(ForbiddenError);
    });
  });

  describe('runExperiment', () => {
    it('should append experiment metadata and return a running experiment payload', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        metadata: { experiments: [] },
      });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});

      const result = await runExperiment('sb-1', 'node-1', {
        experiment_type: 'mutation',
        target_gene: 'gene-1',
      });

      expect(result.status).toBe('running');
      expect(mockPrisma.evolutionSandbox.update).toHaveBeenCalled();
    });

    it('should throw when the sandbox does not exist', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(runExperiment('missing', 'node-1', { experiment_type: 'mutation' })).rejects.toThrow(NotFoundError);
    });

    it('should reject experiments from non-members', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-2',
        metadata: { experiments: [] },
      });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue(null);

      await expect(runExperiment('sb-1', 'node-1', { experiment_type: 'mutation' })).rejects.toThrow(ForbiddenError);
    });
  });

  describe('completeSandbox', () => {
    it('should complete a sandbox and mark promoted assets', async () => {
      mockPrisma.evolutionSandbox.findUnique
        .mockResolvedValueOnce({
          sandbox_id: 'sb-1',
          created_by: 'node-1',
          metadata: {},
        })
        .mockResolvedValueOnce({
          metadata: {
            experiments: [{ id: 'exp-1' }],
          },
        });
      mockPrisma.sandboxAsset.findMany.mockResolvedValue([
        { asset_id: 'asset-1', promoted: false },
      ]);
      mockPrisma.sandboxAsset.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
        if (typeof operation === 'function') {
          return operation(mockPrisma);
        }

        return operation;
      });

      const result = await completeSandbox('sb-1', 'node-1', {
        promote_assets: ['asset-1'],
        summary: 'Improved accuracy',
      });

      expect(result).toEqual({
        status: 'completed',
        promoted_to_mainnet: ['asset-1'],
        sandbox_archived: false,
      });
      expect(mockPrisma.evolutionSandbox.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { sandbox_id: 'sb-1' },
        data: expect.objectContaining({
          state: 'completed',
          metadata: expect.objectContaining({
            experiments: [{ id: 'exp-1' }],
            completion_summary: 'Improved accuracy',
          }),
        }),
      }));
    });

    it('should reject completion by a non-creator', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        metadata: {},
      });

      await expect(completeSandbox('sb-1', 'node-2')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('compareSandbox', () => {
    it('should summarize sandbox comparison data', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'active',
        isolation_level: 'soft',
        metadata: { experiments: [{ id: 'exp-1' }] },
        members: [{ node_id: 'node-1' }],
        assets: [{ asset_id: 'asset-1', asset_type: 'gene', promoted: true, gdi_score: 70 }],
      });

      const result = await compareSandbox('sb-1', 'node-1');

      expect(result.promoted_assets).toEqual(['asset-1']);
      expect(result.experiments).toEqual([{ id: 'exp-1' }]);
    });
  });

  describe('getSandboxStats', () => {
    it('should summarize sandbox counts and promotion rate', async () => {
      mockPrisma.evolutionSandbox.findMany.mockResolvedValue([
        { state: 'active', total_assets: 2, total_promoted: 1, metadata: { experiments: [{ id: 'exp-1' }] } },
        { state: 'completed', total_assets: 2, total_promoted: 1, metadata: { experiments: [{ id: 'exp-2' }, { id: 'exp-3' }] } },
      ]);

      const result = await getSandboxStats();

      expect(result).toEqual({
        total_sandboxes: 2,
        active: 1,
        completed: 1,
        total_experiments: 3,
        promotion_rate: 0.5,
      });
    });
  });

  describe('requestPromotion', () => {
    it('should create a promotion request', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
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
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue({ asset_id: 'asset-1' });
      mockPrisma.promotionRequest.findFirst.mockResolvedValue({ request_id: 'existing' });

      await expect(requestPromotion('sb-1', 'node-1', 'asset-1')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(requestPromotion('nonexistent', 'node-1', 'asset-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxAsset.findFirst.mockResolvedValue(null);

      await expect(requestPromotion('sb-1', 'node-1', 'nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should reject promotion requests after sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-1',
        state: 'completed',
      });

      await expect(requestPromotion('sb-1', 'node-1', 'asset-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('approvePromotion', () => {
    it('should approve and mark asset as promoted', async () => {
      const mockRequest = { request_id: 'req-1', sandbox_id: 'sb-1', asset_id: 'asset-1', requested_by: 'node-1', status: 'pending' };
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-reviewer' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.promotionRequest.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.sandboxAsset.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.evolutionSandbox.update.mockResolvedValue({ count: 1 });
      mockPrisma.sandboxMember.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
        if (typeof operation === 'function') {
          mockPrisma.promotionRequest.findUnique.mockResolvedValueOnce({
            ...mockRequest,
            status: 'approved',
          });
          return operation(mockPrisma);
        }

        return operation;
      });

      const result = await approvePromotion('sb-1', 'req-1', 'node-reviewer');

      expect(result.status).toBe('approved');
    });

    it('should reject non-pending request', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue({ request_id: 'req-1', status: 'approved' });

      await expect(approvePromotion('sb-1', 'req-1', 'node-1')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when request not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(null);

      await expect(approvePromotion('sb-1', 'nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should reject approvals after sandbox completion', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({
        sandbox_id: 'sb-1',
        created_by: 'node-reviewer',
        state: 'completed',
      });

      await expect(approvePromotion('sb-1', 'req-1', 'node-reviewer')).rejects.toThrow(ValidationError);
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

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(leaveSandbox('nonexistent', 'node-2')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when member not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxMember.findUnique.mockResolvedValue(null);

      await expect(leaveSandbox('sb-1', 'node-2')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listMembers', () => {
    it('should return members of a sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxMember.findMany.mockResolvedValue([
        { node_id: 'node-1', role: 'owner' },
        { node_id: 'node-2', role: 'participant' },
      ]);

      const result = await listMembers('sb-1', 'node-1');
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(listMembers('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('inviteMember', () => {
    it('should create an invite', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxInvite.create.mockResolvedValue({
        invite_id: 'inv-1',
        sandbox_id: 'sb-1',
        invitee: 'node-3',
        status: 'pending',
      });

      const result = await inviteMember('sb-1', 'node-1', 'node-3');

      expect(result.status).toBe('pending');
    });

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(inviteMember('nonexistent', 'node-1', 'node-3')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listAssets', () => {
    it('should return assets of a sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.sandboxAsset.findMany.mockResolvedValue([
        { asset_id: 'asset-1', name: 'Test Asset' },
      ]);

      const result = await listAssets('sb-1', 'node-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.asset_id).toBe('asset-1');
    });

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(listAssets('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('addAsset', () => {
    it('should add an asset and increment counters', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
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

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(addAsset('nonexistent', 'node-1', {
        asset_id: 'asset-1',
        asset_type: 'gene',
        name: 'Test',
        content: 'content',
      })).rejects.toThrow(NotFoundError);
    });
  });

  describe('listPromotions', () => {
    it('should return promotions for a sandbox', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.findMany.mockResolvedValue([
        { request_id: 'req-1', status: 'pending' },
      ]);

      const result = await listPromotions('sb-1', 'node-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.request_id).toBe('req-1');
    });

    it('should throw NotFoundError when sandbox not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue(null);

      await expect(listPromotions('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('rejectPromotion', () => {
    it('should reject a promotion with a note', async () => {
      const mockRequest = { request_id: 'req-1', sandbox_id: 'sb-1', status: 'pending' };
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-reviewer' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrisma.promotionRequest.update.mockResolvedValue({ ...mockRequest, status: 'rejected', review_note: 'Insufficient quality' });

      const result = await rejectPromotion('sb-1', 'req-1', 'node-reviewer', 'Insufficient quality');

      expect(result.status).toBe('rejected');
    });

    it('should throw NotFoundError when request not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(null);

      await expect(rejectPromotion('sb-1', 'nonexistent', 'node-1', 'note')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when request is not pending', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue({ request_id: 'req-1', sandbox_id: 'sb-1', status: 'approved' });

      await expect(rejectPromotion('sb-1', 'req-1', 'node-1', 'note')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when request not found', async () => {
      mockPrisma.evolutionSandbox.findUnique.mockResolvedValue({ sandbox_id: 'sb-1', created_by: 'node-1' });
      mockPrisma.promotionRequest.findUnique.mockResolvedValue(null);

      await expect(rejectPromotion('sb-1', 'nonexistent', 'node-1', 'note')).rejects.toThrow(NotFoundError);
    });
  });
});
