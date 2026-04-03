import * as service from './service';

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  swarmTask: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  swarmSubtask: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn((ops) => {
    if (Array.isArray(ops)) {
      return Promise.all(ops);
    }
    return ops(mockPrisma);
  }),
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Swarm Service', () => {
  describe('createSwarm', () => {
    it('should create a swarm and deduct credits', async () => {
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 500,
      };
      const mockSwarm = {
        swarm_id: 'swarm-1',
        title: 'Test Swarm',
        status: 'pending',
        creator_id: 'node-1',
        cost: 50,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ ...mockNode, credit_balance: 450 });
      mockPrisma.swarmTask.create.mockResolvedValue(mockSwarm);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.createSwarm('node-1', 'Test Swarm', 'desc', 50);

      expect(result).toEqual(mockSwarm);
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { credit_balance: 450 },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            amount: -50,
            type: 'swarm_cost',
          }),
        }),
      );
    });

    it('should throw NotFoundError if node not found', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(
        service.createSwarm('nonexistent', 'Title', 'desc', 50),
      ).rejects.toThrow('Node not found');
    });

    it('should throw InsufficientCreditsError if balance too low', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 10,
      });

      await expect(
        service.createSwarm('node-1', 'Title', 'desc', 50),
      ).rejects.toThrow('Insufficient credits');
    });
  });

  describe('decomposeTask', () => {
    it('should decompose a pending swarm into subtasks', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        status: 'pending',
      };

      mockPrisma.swarmTask.findUnique.mockResolvedValue(mockSwarm);
      mockPrisma.swarmTask.update.mockResolvedValue({ ...mockSwarm, status: 'decomposing' });

      const subtaskData = { subtask_id: 'st-1', swarm_id: 'swarm-1', title: 'Sub 1', status: 'pending' };
      mockPrisma.swarmSubtask.create.mockResolvedValue(subtaskData);

      const result = await service.decomposeTask('swarm-1', [
        { title: 'Sub 1', description: 'Desc 1' },
      ]);

      expect(result.subtasks).toHaveLength(1);
      expect(mockPrisma.swarmSubtask.create).toHaveBeenCalled();
    });

    it('should reject decomposition of non-pending swarm', async () => {
      mockPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        status: 'completed',
      });

      await expect(
        service.decomposeTask('swarm-1', [{ title: 'Sub 1', description: 'Desc 1' }]),
      ).rejects.toThrow('Swarm must be in pending status');
    });

    it('should reject empty subtasks', async () => {
      mockPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        status: 'pending',
      });

      await expect(
        service.decomposeTask('swarm-1', []),
      ).rejects.toThrow('Subtasks count must be 1-10');
    });

    it('should reject more than 10 subtasks', async () => {
      mockPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        status: 'pending',
      });

      const tooMany = Array.from({ length: 11 }, (_, i) => ({
        title: `Sub ${i}`,
        description: `Desc ${i}`,
      }));

      await expect(
        service.decomposeTask('swarm-1', tooMany),
      ).rejects.toThrow('Subtasks count must be 1-10');
    });
  });

  describe('assignSubtask', () => {
    it('should assign a subtask to a worker', async () => {
      const mockSubtask = {
        subtask_id: 'st-1',
        swarm_id: 'swarm-1',
        status: 'pending',
      };
      const mockSwarm = {
        swarm_id: 'swarm-1',
        workers: [],
      };

      mockPrisma.swarmSubtask.findUnique.mockResolvedValue(mockSubtask);
      mockPrisma.swarmTask.findUnique.mockResolvedValue(mockSwarm);
      mockPrisma.swarmSubtask.update.mockResolvedValue({
        ...mockSubtask,
        status: 'assigned',
        assigned_to: 'worker-1',
      });
      mockPrisma.swarmTask.update.mockResolvedValue({
        ...mockSwarm,
        workers: ['worker-1'],
      });

      const result = await service.assignSubtask('st-1', 'worker-1');

      expect(result.status).toBe('assigned');
      expect(result.assigned_to).toBe('worker-1');
    });

    it('should reject assigning a non-pending subtask', async () => {
      mockPrisma.swarmSubtask.findUnique.mockResolvedValue({
        subtask_id: 'st-1',
        status: 'completed',
      });

      await expect(
        service.assignSubtask('st-1', 'worker-1'),
      ).rejects.toThrow('Subtask must be in pending status');
    });
  });

  describe('submitSubtaskResult', () => {
    it('should submit result for an assigned subtask', async () => {
      mockPrisma.swarmSubtask.findUnique.mockResolvedValue({
        subtask_id: 'st-1',
        status: 'assigned',
      });
      mockPrisma.swarmSubtask.update.mockResolvedValue({
        subtask_id: 'st-1',
        status: 'completed',
        result: 'done',
      });

      const result = await service.submitSubtaskResult('st-1', 'done');
      expect(result.status).toBe('completed');
    });

    it('should reject result submission for non-assigned subtask', async () => {
      mockPrisma.swarmSubtask.findUnique.mockResolvedValue({
        subtask_id: 'st-1',
        status: 'pending',
      });

      await expect(
        service.submitSubtaskResult('st-1', 'done'),
      ).rejects.toThrow('Subtask must be assigned');
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate all completed subtasks', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        status: 'in_progress',
        subtasks: [
          { subtask_id: 'st-1', status: 'completed', result: 'r1', assigned_to: 'w1' },
          { subtask_id: 'st-2', status: 'completed', result: 'r2', assigned_to: 'w2' },
        ],
      };

      mockPrisma.swarmTask.findUnique.mockResolvedValue(mockSwarm);
      mockPrisma.swarmTask.update.mockResolvedValue({
        ...mockSwarm,
        status: 'completed',
      });

      const result = await service.aggregateResults('swarm-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.swarmTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('should reject aggregation if not all subtasks completed', async () => {
      mockPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        status: 'in_progress',
        subtasks: [
          { subtask_id: 'st-1', status: 'completed', result: 'r1', assigned_to: 'w1' },
          { subtask_id: 'st-2', status: 'pending', result: null, assigned_to: null },
        ],
      });

      await expect(
        service.aggregateResults('swarm-1'),
      ).rejects.toThrow('All subtasks must be completed');
    });
  });

  describe('failSwarm', () => {
    it('should fail a swarm and refund credits', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        status: 'in_progress',
        creator_id: 'node-1',
        cost: 50,
      };

      mockPrisma.swarmTask.findUnique.mockResolvedValue(mockSwarm);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 450,
      });
      mockPrisma.node.update.mockResolvedValue({ credit_balance: 500 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.swarmTask.update.mockResolvedValue({
        ...mockSwarm,
        status: 'failed',
      });

      const result = await service.failSwarm('swarm-1', 'timeout');
      expect(result.status).toBe('failed');
    });

    it('should reject failing an already-terminal swarm', async () => {
      mockPrisma.swarmTask.findUnique.mockResolvedValue({
        swarm_id: 'swarm-1',
        status: 'completed',
        creator_id: 'node-1',
        cost: 50,
      });

      await expect(
        service.failSwarm('swarm-1', 'already done'),
      ).rejects.toThrow('already in a terminal state');
    });
  });

  describe('getSwarm', () => {
    it('should return swarm with subtasks', async () => {
      const mockSwarm = {
        swarm_id: 'swarm-1',
        title: 'Test',
        subtasks: [],
      };

      mockPrisma.swarmTask.findUnique.mockResolvedValue(mockSwarm);

      const result = await service.getSwarm('swarm-1');
      expect(result.swarm_id).toBe('swarm-1');
    });

    it('should throw NotFoundError for missing swarm', async () => {
      mockPrisma.swarmTask.findUnique.mockResolvedValue(null);

      await expect(service.getSwarm('nonexistent')).rejects.toThrow('Swarm not found');
    });
  });

  describe('listSwarms', () => {
    it('should return paginated swarms', async () => {
      const mockSwarms = [{ swarm_id: 's1' }, { swarm_id: 's2' }];
      mockPrisma.swarmTask.findMany.mockResolvedValue(mockSwarms);
      mockPrisma.swarmTask.count.mockResolvedValue(2);

      const result = await service.listSwarms({ limit: 10, offset: 0 });

      expect(result.swarms).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockPrisma.swarmTask.findMany.mockResolvedValue([]);
      mockPrisma.swarmTask.count.mockResolvedValue(0);

      await service.listSwarms({ status: 'pending', limit: 20, offset: 0 });

      expect(mockPrisma.swarmTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
    });
  });
});
