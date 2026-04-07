import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  claimTask,
  completeTask,
  listContributions,
  submitContribution,
} = service;

const mockPrisma = {
  projectTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  projectContribution: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  taskSubmission: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  asset: {
    findUnique: jest.fn(),
  },
} as any;

describe('Task Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listTasks', () => {
    it('should return tasks for a project', async () => {
      const tasks = [
        { id: '1', task_id: 't-1', project_id: 'p-1', title: 'Task 1', status: 'open', assignee_id: null, created_at: new Date(), updated_at: new Date() },
        { id: '2', task_id: 't-2', project_id: 'p-1', title: 'Task 2', status: 'in_progress', assignee_id: 'node-1', created_at: new Date(), updated_at: new Date() },
      ];
      mockPrisma.projectTask.findMany.mockResolvedValue(tasks);

      const result = await listTasks('p-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.task_id).toBe('t-1');
      expect(result[1]!.status).toBe('in_progress');
    });
  });

  describe('getTask', () => {
    it('should return a task by id', async () => {
      const task = { id: '1', task_id: 't-1', project_id: 'p-1', title: 'Find me', status: 'open', assignee_id: null, created_at: new Date(), updated_at: new Date() };
      mockPrisma.projectTask.findFirst.mockResolvedValue(task);

      const result = await getTask('p-1', 't-1');

      expect(result?.task_id).toBe('t-1');
    });

    it('should return null when task not found', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue(null);

      const result = await getTask('p-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('createTask', () => {
    it('should create a task with open status', async () => {
      const mockTask = {
        id: '1',
        task_id: expect.any(String),
        project_id: 'p-1',
        title: 'New Task',
        description: 'Description',
        status: 'open',
        assignee_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrisma.projectTask.create.mockResolvedValue(mockTask);

      const result = await createTask('p-1', 'New Task', 'Description', 'node-1');

      expect(result.status).toBe('open');
      expect(result.assignee_id).toBeNull();
    });

    it('should reject empty title', async () => {
      await expect(createTask('p-1', '', 'desc', 'node-1')).rejects.toThrow(ValidationError);
      await expect(createTask('p-1', '   ', 'desc', 'node-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateTask', () => {
    it('should update task fields', async () => {
      const existingTask = { id: '1', task_id: 't-1', project_id: 'p-1', title: 'Old', description: '', status: 'open', assignee_id: null, created_at: new Date(), updated_at: new Date() };
      mockPrisma.projectTask.findFirst.mockResolvedValue(existingTask);
      mockPrisma.projectTask.update.mockResolvedValue({ ...existingTask, title: 'Updated Title', status: 'in_progress' });

      const result = await updateTask('p-1', 't-1', { title: 'Updated Title', status: 'in_progress' });

      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('in_progress');
    });

    it('should throw NotFoundError when task does not exist', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue(null);

      await expect(updateTask('p-1', 'nonexistent', { title: 'x' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('claimTask', () => {
    it('should assign task to node and set in_progress', async () => {
      const existingTask = { id: '1', task_id: 't-1', project_id: 'p-1', status: 'open', assignee_id: null, created_at: new Date(), updated_at: new Date() };
      mockPrisma.projectTask.findFirst.mockResolvedValue(existingTask);
      mockPrisma.projectTask.update.mockResolvedValue({ ...existingTask, assignee_id: 'node-2', status: 'in_progress' });

      const result = await claimTask('p-1', 't-1', 'node-2');

      expect(result.assignee_id).toBe('node-2');
      expect(result.status).toBe('in_progress');
    });

    it('should reject when task already assigned', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue({ id: '1', task_id: 't-1', assignee_id: 'node-1' });

      await expect(claimTask('p-1', 't-1', 'node-2')).rejects.toThrow(ValidationError);
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed by assignee', async () => {
      const existingTask = { id: '1', task_id: 't-1', project_id: 'p-1', status: 'in_progress', assignee_id: 'node-1', created_at: new Date(), updated_at: new Date() };
      mockPrisma.projectTask.findFirst.mockResolvedValue(existingTask);
      mockPrisma.projectTask.update.mockResolvedValue({ ...existingTask, status: 'completed' });

      const result = await completeTask('p-1', 't-1', 'node-1');

      expect(result.status).toBe('completed');
    });

    it('should reject completion by non-assignee', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue({ id: '1', task_id: 't-1', assignee_id: 'node-1' });

      await expect(completeTask('p-1', 't-1', 'node-2')).rejects.toThrow(ValidationError);
    });
  });

  describe('listContributions', () => {
    it('should return contributions for a project sorted by newest', async () => {
      const contributions = [
        { id: '1', contribution_id: 'c-1', project_id: 'p-1', status: 'pending', created_at: new Date() },
      ];
      mockPrisma.projectContribution.findMany.mockResolvedValue(contributions);

      const result = await listContributions('p-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.projectContribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { created_at: 'desc' } }),
      );
    });
  });

  describe('submitContribution', () => {
    it('should create a pending contribution', async () => {
      const mockContribution = {
        id: '1',
        contribution_id: expect.any(String),
        project_id: 'p-1',
        contributor_id: 'node-1',
        files: [],
        commit_message: 'feat: add new capability',
        status: 'pending',
        reviewed_by: null,
        created_at: new Date(),
        reviewed_at: null,
      };
      mockPrisma.projectContribution.create.mockResolvedValue(mockContribution);

      const result = await submitContribution('p-1', 'node-1', [], 'feat: add new capability');

      expect(result.status).toBe('pending');
    });

    it('should reject empty commit message', async () => {
      await expect(submitContribution('p-1', 'node-1', [], '')).rejects.toThrow(ValidationError);
    });
  });
});
