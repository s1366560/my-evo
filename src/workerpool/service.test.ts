import { PrismaClient } from '@prisma/client';
import * as service from './service';

const mockPrisma = {
  worker: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Worker Pool Service', () => {
  describe('registerWorker', () => {
    it('should register a new worker', async () => {
      const mockWorker = {
        node_id: 'node-1',
        specialties: ['coding', 'review'],
        max_concurrent: 3,
        current_tasks: 0,
        total_completed: 0,
        success_rate: 0,
        is_available: true,
      };

      mockPrisma.worker.findUnique.mockResolvedValue(null);
      mockPrisma.worker.create.mockResolvedValue(mockWorker);

      const result = await service.registerWorker('node-1', ['coding', 'review'], 3);

      expect(result.node_id).toBe('node-1');
      expect(result.specialties).toEqual(['coding', 'review']);
    });

    it('should reject duplicate worker registration', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'node-1',
        specialties: ['coding'],
      });

      await expect(
        service.registerWorker('node-1', ['coding'], 3),
      ).rejects.toThrow('already registered as a worker');
    });

    it('should reject empty specialties', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(
        service.registerWorker('node-1', [], 3),
      ).rejects.toThrow('at least one specialty');
    });

    it('should reject invalid maxConcurrent', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(
        service.registerWorker('node-1', ['coding'], 5),
      ).rejects.toThrow('maxConcurrent must be between 1 and 3');
    });
  });

  describe('updateHeartbeat', () => {
    it('should update worker heartbeat', async () => {
      const mockWorker = { node_id: 'node-1', is_available: true };
      mockPrisma.worker.findUnique.mockResolvedValue(mockWorker);
      mockPrisma.worker.update.mockResolvedValue({
        ...mockWorker,
        last_heartbeat: new Date(),
      });

      const result = await service.updateHeartbeat('node-1');
      expect(mockPrisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ is_available: true }),
        }),
      );
    });

    it('should throw NotFoundError for missing worker', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(
        service.updateHeartbeat('nonexistent'),
      ).rejects.toThrow('Worker not found');
    });
  });

  describe('findAvailableWorkers', () => {
    it('should find workers matching skills', async () => {
      const workers = [
        {
          node_id: 'w1',
          specialties: ['coding', 'testing'],
          max_concurrent: 3,
          current_tasks: 1,
          success_rate: 90,
          is_available: true,
          last_heartbeat: new Date(),
        },
        {
          node_id: 'w2',
          specialties: ['design'],
          max_concurrent: 3,
          current_tasks: 0,
          success_rate: 80,
          is_available: true,
          last_heartbeat: new Date(),
        },
      ];

      mockPrisma.worker.findMany.mockResolvedValue(workers);

      const result = await service.findAvailableWorkers(['coding'], 5);

      expect(result).toHaveLength(1);
      expect(result[0]!.node_id).toBe('w1');
    });

    it('should reject empty skills', async () => {
      await expect(
        service.findAvailableWorkers([], 5),
      ).rejects.toThrow('At least one skill is required');
    });

    it('should exclude workers with no capacity', async () => {
      const workers = [
        {
          node_id: 'w1',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 3,
          success_rate: 90,
          is_available: true,
          last_heartbeat: new Date(),
        },
      ];

      mockPrisma.worker.findMany.mockResolvedValue(workers);

      const result = await service.findAvailableWorkers(['coding'], 5);
      expect(result).toHaveLength(0);
    });

    it('should sort by capacity and success_rate', async () => {
      const workers = [
        {
          node_id: 'w1',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 2,
          success_rate: 80,
          is_available: true,
          last_heartbeat: new Date(),
        },
        {
          node_id: 'w2',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 0,
          success_rate: 90,
          is_available: true,
          last_heartbeat: new Date(),
        },
      ];

      mockPrisma.worker.findMany.mockResolvedValue(workers);

      const result = await service.findAvailableWorkers(['coding'], 5);
      expect(result[0]!.node_id).toBe('w2');
    });
  });

  describe('assignTask', () => {
    it('should increment current_tasks for a worker', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: true,
        max_concurrent: 3,
        current_tasks: 1,
      });
      mockPrisma.worker.update.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 2,
      });

      const result = await service.assignTask('w1', 'task-1');
      expect(mockPrisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { current_tasks: 2 },
        }),
      );
    });

    it('should reject unavailable worker', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: false,
        max_concurrent: 3,
        current_tasks: 0,
      });

      await expect(
        service.assignTask('w1', 'task-1'),
      ).rejects.toThrow('not available');
    });

    it('should reject worker at max capacity', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: true,
        max_concurrent: 3,
        current_tasks: 3,
      });

      await expect(
        service.assignTask('w1', 'task-1'),
      ).rejects.toThrow('max concurrent tasks');
    });
  });

  describe('completeTask', () => {
    it('should decrement current_tasks and update success_rate on success', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 2,
        total_completed: 10,
        success_rate: 80,
      });
      mockPrisma.worker.update.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 1,
        total_completed: 11,
        success_rate: 81.8,
      });

      const result = await service.completeTask('w1', 'task-1', true);
      expect(mockPrisma.worker.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ current_tasks: 1 }),
        }),
      );
    });

    it('should reject worker with no tasks', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 0,
        total_completed: 5,
        success_rate: 80,
      });

      await expect(
        service.completeTask('w1', 'task-1', true),
      ).rejects.toThrow('no tasks to complete');
    });
  });

  describe('deregisterWorker', () => {
    it('should deregister a worker with no active tasks', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 0,
      });
      mockPrisma.worker.delete.mockResolvedValue({ node_id: 'w1' });

      const result = await service.deregisterWorker('w1');
      expect(result.success).toBe(true);
      expect(mockPrisma.worker.delete).toHaveBeenCalled();
    });

    it('should reject deregistration with active tasks', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 2,
      });

      await expect(
        service.deregisterWorker('w1'),
      ).rejects.toThrow('active tasks');
    });
  });

  describe('getWorker', () => {
    it('should return worker info', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        specialties: ['coding'],
      });

      const result = await service.getWorker('w1');
      expect(result.node_id).toBe('w1');
    });

    it('should throw NotFoundError for missing worker', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(service.getWorker('nonexistent')).rejects.toThrow('Worker not found');
    });
  });

  describe('listWorkers', () => {
    it('should return paginated workers', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([{ node_id: 'w1' }]);
      mockPrisma.worker.count.mockResolvedValue(1);

      const result = await service.listWorkers({ limit: 10, offset: 0 });
      expect(result.workers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by skill and availability', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([]);
      mockPrisma.worker.count.mockResolvedValue(0);

      await service.listWorkers({ skill: 'coding', available: true, limit: 20, offset: 0 });

      expect(mockPrisma.worker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            is_available: true,
            specialties: { has: 'coding' },
          },
        }),
      );
    });
  });
});
