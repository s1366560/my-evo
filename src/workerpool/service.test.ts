import { PrismaClient } from '@prisma/client';
import * as service from './service';

const mockPrisma = {
  node: {
    findMany: jest.fn(),
  },
  worker: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  workerTask: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  question: {
    upsert: jest.fn(),
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

  describe('setWorkerAvailability', () => {
    it('updates availability and heartbeat timestamp', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({ node_id: 'node-1', is_available: true });
      mockPrisma.worker.update.mockResolvedValue({ node_id: 'node-1', is_available: false });

      const result = await service.setWorkerAvailability('node-1', false);

      expect(result).toEqual({ node_id: 'node-1', is_available: false });
      expect(mockPrisma.worker.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { node_id: 'node-1' },
        data: expect.objectContaining({ is_available: false }),
      }));
    });

    it('throws for unknown workers', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(service.setWorkerAvailability('missing', true)).rejects.toThrow('Worker not found');
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

    it('should sort by success_rate when capacity is equal', async () => {
      // Both workers have same remaining capacity (max=3, tasks=1 => capacity=2)
      const workers = [
        {
          node_id: 'w_low',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 1,
          success_rate: 70,
          is_available: true,
          last_heartbeat: new Date(),
        },
        {
          node_id: 'w_high',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 1,
          success_rate: 95,
          is_available: true,
          last_heartbeat: new Date(),
        },
      ];

      mockPrisma.worker.findMany.mockResolvedValue(workers);

      const result = await service.findAvailableWorkers(['coding'], 5);
      // Higher success_rate should come first
      expect(result[0]!.node_id).toBe('w_high');
      expect(result[1]!.node_id).toBe('w_low');
    });
  });

  describe('public compatibility helpers', () => {
    it('maps worker catalog entries to the documented public shape', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([
        {
          node_id: 'worker-1',
          specialties: ['translation', 'summarization'],
          max_concurrent: 3,
          current_tasks: 1,
          total_completed: 10,
          success_rate: 95,
          is_available: true,
          last_heartbeat: new Date(),
        },
      ]);
      mockPrisma.worker.count.mockResolvedValue(1);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'worker-1', reputation: 88.5 },
      ]);

      const result = await service.listWorkersPublic({
        skill: 'translation',
        status: 'active',
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual({
        workers: [{
          worker_id: 'worker-1',
          node_id: 'worker-1',
          skills: ['translation', 'summarization'],
          reputation: 88.5,
          current_load: 1,
          max_load: 3,
          status: 'active',
        }],
        total: 1,
      });
    });

    it('maps busy workers when availability is false', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([
        {
          node_id: 'worker-2',
          specialties: ['security'],
          max_concurrent: 2,
          current_tasks: 2,
          total_completed: 20,
          success_rate: 80,
          is_available: false,
          last_heartbeat: new Date(),
        },
      ]);
      mockPrisma.worker.count.mockResolvedValue(1);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'worker-2', reputation: 91 },
      ]);

      const result = await service.listWorkersPublic({
        status: 'busy',
      });

      expect(result.workers[0]!.status).toBe('busy');
    });

    it('maps public worker detail with normalized success rate and assignments', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'worker-3',
        specialties: ['review'],
        max_concurrent: 3,
        current_tasks: 1,
        total_completed: 42,
        success_rate: 95,
        is_available: true,
        last_heartbeat: new Date(),
      });
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'worker-3', reputation: 77.7 },
      ]);
      mockPrisma.workerTask.findMany
        .mockResolvedValueOnce([
          { task_id: 'task-1', status: 'assigned', created_at: new Date('2026-01-01T00:00:00Z') },
        ])
        .mockResolvedValueOnce([
          { task_id: 'task-0', status: 'completed', created_at: new Date('2026-01-01T00:00:00Z'), completed_at: new Date('2026-01-01T02:00:00Z') },
        ]);
      mockPrisma.workerTask.count.mockResolvedValue(1);

      const result = await service.getWorkerPublic('worker-3');

      expect(result).toEqual({
        worker_id: 'worker-3',
        node_id: 'worker-3',
        skills: ['review'],
        reputation: 77.7,
        completed_tasks: 42,
        success_rate: 0.95,
        avg_completion_time_hours: 2,
        current_assignments: [{
          task_id: 'task-1',
          status: 'assigned',
          deadline: new Date('2026-01-01T00:00:00Z'),
        }],
      });
    });
  });

  describe('assignTask', () => {
    it('should increment current_tasks and assign the worker task', async () => {
      mockPrisma.worker.findUnique
        .mockResolvedValueOnce({
          node_id: 'w1',
          is_available: true,
          max_concurrent: 3,
          current_tasks: 1,
        })
        .mockResolvedValueOnce({
          node_id: 'w1',
          is_available: true,
          max_concurrent: 3,
          current_tasks: 2,
        });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        status: 'available',
        assigned_to: null,
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workerTask.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.assignTask('w1', 'task-1');
      expect(mockPrisma.worker.updateMany).toHaveBeenCalledWith({
        where: {
          node_id: 'w1',
          is_available: true,
          current_tasks: 1,
        },
        data: { current_tasks: { increment: 1 } },
      });
      expect(mockPrisma.workerTask.updateMany).toHaveBeenCalledWith({
        where: {
          task_id: 'task-1',
          status: 'available',
          assigned_to: null,
        },
        data: {
          assigned_to: 'w1',
          status: 'assigned',
        },
      });
      expect(result.current_tasks).toBe(2);
    });

    it('should reject unavailable worker', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: false,
        max_concurrent: 3,
        current_tasks: 0,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        status: 'available',
        assigned_to: null,
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
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        status: 'available',
        assigned_to: null,
      });

      await expect(
        service.assignTask('w1', 'task-1'),
      ).rejects.toThrow('max concurrent tasks');
    });

    it('should reject assigning unavailable tasks', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: true,
        max_concurrent: 3,
        current_tasks: 1,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        status: 'assigned',
        assigned_to: 'w2',
      });

      await expect(service.assignTask('w1', 'task-1')).rejects.toThrow('Task is not available');
      expect(mockPrisma.worker.updateMany).not.toHaveBeenCalled();
    });

    it('should reject raced worker updates with conflict', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: true,
        max_concurrent: 3,
        current_tasks: 1,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        status: 'available',
        assigned_to: null,
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.assignTask('w1', 'task-1')).rejects.toThrow('Worker state changed; retry');
    });

    it('should reject raced task updates with conflict', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        is_available: true,
        max_concurrent: 3,
        current_tasks: 1,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        status: 'available',
        assigned_to: null,
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workerTask.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.assignTask('w1', 'task-1')).rejects.toThrow('Task state changed; retry');
    });
  });

  describe('completeTask', () => {
    it('should decrement current_tasks, update success_rate, and complete the worker task', async () => {
      mockPrisma.worker.findUnique
        .mockResolvedValueOnce({
          node_id: 'w1',
          current_tasks: 2,
          total_completed: 10,
          success_rate: 80,
        })
        .mockResolvedValueOnce({
          node_id: 'w1',
          current_tasks: 1,
          total_completed: 11,
          success_rate: 81.8,
        });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        assigned_to: 'w1',
        status: 'assigned',
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workerTask.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.completeTask('w1', 'task-1', true);
      expect(mockPrisma.worker.updateMany).toHaveBeenCalledWith({
        where: {
          node_id: 'w1',
          current_tasks: 2,
          total_completed: 10,
        },
        data: {
          current_tasks: { decrement: 1 },
          total_completed: { increment: 1 },
          success_rate: 81.81818181818183,
        },
      });
      expect(mockPrisma.workerTask.updateMany).toHaveBeenCalledWith({
        where: { task_id: 'task-1', assigned_to: 'w1', status: 'assigned' },
        data: expect.objectContaining({ status: 'completed' }),
      });
      expect(result.current_tasks).toBe(1);
    });

    it('should reject worker with no tasks', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 0,
        total_completed: 5,
        success_rate: 80,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        assigned_to: 'w1',
        status: 'assigned',
      });

      await expect(
        service.completeTask('w1', 'task-1', true),
      ).rejects.toThrow('no tasks to complete');
    });

    it('should requeue the task on failed completion', async () => {
      mockPrisma.worker.findUnique
        .mockResolvedValueOnce({
          node_id: 'w1',
          current_tasks: 1,
          total_completed: 10,
          success_rate: 80,
        })
        .mockResolvedValueOnce({
          node_id: 'w1',
          current_tasks: 0,
          total_completed: 11,
          success_rate: 72.7,
        });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        assigned_to: 'w1',
        status: 'assigned',
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workerTask.updateMany.mockResolvedValue({ count: 1 });

      await service.completeTask('w1', 'task-1', false);

      expect(mockPrisma.workerTask.updateMany).toHaveBeenCalledWith({
        where: { task_id: 'task-1', assigned_to: 'w1', status: 'assigned' },
        data: {
          status: 'available',
          assigned_to: null,
          completed_at: null,
        },
      });
    });

    it('should reject completion for tasks assigned to another worker', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 1,
        total_completed: 10,
        success_rate: 80,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        assigned_to: 'w2',
        status: 'assigned',
      });

      await expect(service.completeTask('w1', 'task-1', true)).rejects.toThrow(
        'Task is not assigned to this worker',
      );
      expect(mockPrisma.worker.updateMany).not.toHaveBeenCalled();
    });

    it('should reject raced worker completions with conflict', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 1,
        total_completed: 10,
        success_rate: 80,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        assigned_to: 'w1',
        status: 'assigned',
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeTask('w1', 'task-1', true)).rejects.toThrow(
        'Worker state changed; retry',
      );
    });

    it('should reject raced task completions with conflict', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        current_tasks: 1,
        total_completed: 10,
        success_rate: 80,
      });
      mockPrisma.workerTask.findUnique.mockResolvedValue({
        task_id: 'task-1',
        assigned_to: 'w1',
        status: 'assigned',
      });
      mockPrisma.worker.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.workerTask.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.completeTask('w1', 'task-1', true)).rejects.toThrow(
        'Task state changed; retry',
      );
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

  // ==================================================================
  // Part 4: Specialist endpoints
  // ==================================================================

  describe('listSpecialists', () => {
    it('should return paginated specialists', async () => {
      const workers = [
        {
          node_id: 'w1',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 0,
          total_completed: 10,
          success_rate: 90,
          is_available: true,
          last_heartbeat: new Date('2024-01-01'),
        },
      ];
      mockPrisma.worker.findMany.mockResolvedValue(workers);
      mockPrisma.worker.count.mockResolvedValue(1);

      const result = await service.listSpecialists();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]).toHaveProperty('last_heartbeat');
      // last_heartbeat should be ISO string
      expect(typeof result.items[0]!.last_heartbeat).toBe('string');
    });

    it('should filter by availableOnly=true', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([]);
      mockPrisma.worker.count.mockResolvedValue(0);

      await service.listSpecialists(undefined, true);

      expect(mockPrisma.worker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_available: true }),
        }),
      );
    });

    it('should filter by availableOnly=false', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([]);
      mockPrisma.worker.count.mockResolvedValue(0);

      await service.listSpecialists(undefined, false);

      expect(mockPrisma.worker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_available: false }),
        }),
      );
    });

    it('should filter by specialty', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([]);
      mockPrisma.worker.count.mockResolvedValue(0);

      await service.listSpecialists('design');

      expect(mockPrisma.worker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ specialties: { has: 'design' } }),
        }),
      );
    });

    it('should filter by both specialty and availableOnly', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([]);
      mockPrisma.worker.count.mockResolvedValue(0);

      await service.listSpecialists('coding', true);

      expect(mockPrisma.worker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_available: true,
            specialties: { has: 'coding' },
          }),
        }),
      );
    });

    it('should apply limit and offset', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([{ node_id: 'w1', last_heartbeat: new Date() }]);
      mockPrisma.worker.count.mockResolvedValue(50);

      const result = await service.listSpecialists(undefined, undefined, 10, 20);

      expect(mockPrisma.worker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
      expect(result.total).toBe(50);
    });
  });

  describe('getSpecialist', () => {
    it('should return specialist info', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue({
        node_id: 'w1',
        specialties: ['coding'],
        max_concurrent: 3,
        current_tasks: 1,
        total_completed: 10,
        success_rate: 90,
        is_available: true,
        last_heartbeat: new Date('2024-01-01'),
      });

      const result = await service.getSpecialist('w1');

      expect(result.node_id).toBe('w1');
      expect(typeof result.last_heartbeat).toBe('string');
    });

    it('should throw NotFoundError for missing specialist', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(service.getSpecialist('nonexistent')).rejects.toThrow('Worker not found');
    });
  });

  describe('listSpecialistPools', () => {
    it('should group workers by specialty and average node reputation', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([
        {
          node_id: 'w1',
          specialties: ['coding', 'security'],
        },
        {
          node_id: 'w2',
          specialties: ['coding'],
        },
      ]);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'w1', reputation: 80 },
        { node_id: 'w2', reputation: 60 },
      ]);

      const result = await service.listSpecialistPools();

      expect(result).toEqual([
        { name: 'coding', worker_count: 2, avg_reputation: 70 },
        { name: 'security', worker_count: 1, avg_reputation: 80 },
      ]);
    });
  });

  describe('matchWorkers', () => {
    it('should score and rank workers against task signals', async () => {
      const now = new Date();
      mockPrisma.worker.findMany.mockResolvedValue([
        {
          node_id: 'w-best',
          specialties: ['coding', 'security'],
          max_concurrent: 4,
          current_tasks: 1,
          total_completed: 20,
          success_rate: 95,
          is_available: true,
          last_heartbeat: now,
        },
        {
          node_id: 'w-ok',
          specialties: ['coding'],
          max_concurrent: 4,
          current_tasks: 2,
          total_completed: 10,
          success_rate: 70,
          is_available: true,
          last_heartbeat: now,
        },
      ]);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'w-best', reputation: 90 },
        { node_id: 'w-ok', reputation: 75 },
      ]);

      const result = await service.matchWorkers(['coding', 'security'], 70, 10);

      expect(result).toHaveLength(2);
      expect(result[0]!.worker_id).toBe('w-best');
      expect(result[0]!.match_score).toBeGreaterThan(result[1]!.match_score);
      expect(result[0]).toEqual(expect.objectContaining({
        skill_match_score: 1,
        price: null,
      }));
    });

    it('should filter out workers below the reputation threshold or without signal overlap', async () => {
      mockPrisma.worker.findMany.mockResolvedValue([
        {
          node_id: 'w-low-rep',
          specialties: ['coding'],
          max_concurrent: 3,
          current_tasks: 0,
          total_completed: 5,
          success_rate: 80,
          is_available: true,
          last_heartbeat: new Date(),
        },
        {
          node_id: 'w-no-match',
          specialties: ['design'],
          max_concurrent: 3,
          current_tasks: 0,
          total_completed: 5,
          success_rate: 80,
          is_available: true,
          last_heartbeat: new Date(),
        },
      ]);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'w-low-rep', reputation: 60 },
        { node_id: 'w-no-match', reputation: 90 },
      ]);

      const result = await service.matchWorkers(['coding'], 70, 10);

      expect(result).toEqual([]);
    });

    it('should require at least one task signal', async () => {
      await expect(service.matchWorkers([], 0, 10)).rejects.toThrow('task_signals must contain at least one signal');
    });
  });

  describe('getWorkerPoolStats', () => {
    it('should summarize worker pool totals and readiness', async () => {
      const now = new Date();
      mockPrisma.worker.findMany.mockResolvedValue([
        {
          node_id: 'w1',
          specialties: ['coding', 'security'],
          max_concurrent: 4,
          current_tasks: 1,
          total_completed: 20,
          success_rate: 95,
          is_available: true,
          last_heartbeat: now,
        },
        {
          node_id: 'w2',
          specialties: ['design'],
          max_concurrent: 2,
          current_tasks: 2,
          total_completed: 10,
          success_rate: 80,
          is_available: false,
          last_heartbeat: now,
        },
      ]);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'w1', reputation: 90 },
        { node_id: 'w2', reputation: 70 },
      ]);

      const result = await service.getWorkerPoolStats();

      expect(result.total_workers).toBe(2);
      expect(result.active_workers).toBe(1);
      expect(result.total_tasks_completed).toBe(30);
      expect(result.specialist_pools).toBe(3);
      expect(result.avg_match_score).toBeGreaterThan(0);
    });
  });

  describe('rateSpecialist', () => {
    it('rejects ratings until worker tasks carry requester ownership', async () => {
      await expect(
        service.rateSpecialist('worker-1', 'task-1', 'rater-1', 3, 'Solid work'),
      ).rejects.toThrow(
        'Specialist ratings require requester-linked worker tasks and are not yet supported for current tasks',
      );
      expect(mockPrisma.question.upsert).not.toHaveBeenCalled();
    });

    it('still validates lower-bound ratings before rejecting unsupported persistence', async () => {
      await expect(service.rateSpecialist('worker-1', 'task-1', 'rater-1', 1)).rejects.toThrow(
        'Specialist ratings require requester-linked worker tasks and are not yet supported for current tasks',
      );
    });

    it('still validates upper-bound ratings before rejecting unsupported persistence', async () => {
      await expect(service.rateSpecialist('worker-1', 'task-1', 'rater-1', 5)).rejects.toThrow(
        'Specialist ratings require requester-linked worker tasks and are not yet supported for current tasks',
      );
    });

    it('should reject rating=0', async () => {
      await expect(service.rateSpecialist('worker-1', 'task-1', 'rater-1', 0)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
    });

    it('should reject rating=6', async () => {
      await expect(service.rateSpecialist('worker-1', 'task-1', 'rater-1', 6)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
    });

    it('should reject negative rating', async () => {
      await expect(service.rateSpecialist('worker-1', 'task-1', 'rater-1', -1)).rejects.toThrow(
        'Rating must be between 1 and 5',
      );
    });

    it('rejects ratings even when task ids look valid', async () => {
      await expect(
        service.rateSpecialist('worker-1', 'task-1', 'rater-1', 4),
      ).rejects.toThrow(
        'Specialist ratings require requester-linked worker tasks and are not yet supported for current tasks',
      );
    });
  });

  // ==================================================================
  // Additional coverage: edge cases for existing functions
  // ==================================================================

  describe('assignTask', () => {
    it('should throw NotFoundError when worker not found', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(service.assignTask('nonexistent', 'task-1')).rejects.toThrow('Worker not found');
    });
  });

  describe('completeTask', () => {
    it('should throw NotFoundError when worker not found', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(service.completeTask('nonexistent', 'task-1', true)).rejects.toThrow('Worker not found');
    });
  });

  describe('deregisterWorker', () => {
    it('should throw NotFoundError when worker not found', async () => {
      mockPrisma.worker.findUnique.mockResolvedValue(null);

      await expect(service.deregisterWorker('nonexistent')).rejects.toThrow('Worker not found');
    });
  });
});
