import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';
import { MAX_SUBTASKS, TITLE_MAX_LENGTH } from '../shared/constants';

const {
  listTasks,
  getTask,
  createTask,
  updateTask,
  claimTask,
  completeTask,
  listContributions,
  submitContribution,
  acceptSubmission,
  proposeTaskDecomposition,
  setTaskCommitment,
} = service;

const mockPrisma = {
  $transaction: jest.fn((operation) => operation(mockPrisma)),
  projectTask: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
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
    updateMany: jest.fn(),
  },
  swarmTask: {
    create: jest.fn(),
  },
  swarmSubtask: {
    create: jest.fn(),
  },
  question: {
    upsert: jest.fn(),
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
      const existingTask = { id: '1', task_id: 't-1', project_id: 'p-1', title: 'Old', description: '', status: 'in_progress', assignee_id: 'node-1', created_at: new Date(), updated_at: new Date() };
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({ ...existingTask, title: 'Updated Title', status: 'in_progress' });

      const result = await updateTask('p-1', 't-1', 'node-1', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('in_progress');
    });

    it('should throw NotFoundError when task does not exist', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue(null);

      await expect(updateTask('p-1', 'nonexistent', 'node-1', { title: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('rejects updates from non-assignees', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Old',
        description: '',
        status: 'in_progress',
        assignee_id: 'node-9',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(
        updateTask('p-1', 't-1', 'node-1', { title: 'Updated Title' }),
      ).rejects.toThrow('Only the task assignee can update this task');
    });

    it('rejects generic status changes', async () => {
      await expect(
        updateTask('p-1', 't-1', 'node-1', { status: 'completed' }),
      ).rejects.toThrow('status changes must use claim, complete, or release endpoints');
    });
  });

  describe('claimTask', () => {
    it('should assign task to node and set in_progress', async () => {
      const existingTask = { id: '1', task_id: 't-1', project_id: 'p-1', status: 'open', assignee_id: null, created_at: new Date(), updated_at: new Date() };
      mockPrisma.projectTask.findFirst
        .mockResolvedValueOnce(existingTask)
        .mockResolvedValueOnce({ ...existingTask, assignee_id: 'node-2', status: 'in_progress' });
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });

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
      mockPrisma.projectTask.findFirst
        .mockResolvedValueOnce(existingTask)
        .mockResolvedValueOnce({ ...existingTask, status: 'completed' });
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });

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

  describe('acceptSubmission', () => {
    it('allows the task assignee to accept a submission', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: 'task-row-1',
        task_id: 't-1',
        project_id: 'p-1',
        assignee_id: 'node-1',
        status: 'in_progress',
        title: 'Main task',
      });
      mockPrisma.taskSubmission.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.taskSubmission.findFirst.mockResolvedValue({
        id: 'submission-row-1',
        submission_id: 'sub-1',
        task_id: 't-1',
        submitter_id: 'node-2',
        asset_id: null,
        node_id: null,
        status: 'accepted',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      });

      const result = await acceptSubmission('p-1:t-1', 'sub-1', 'node-1');

      expect(result.status).toBe('accepted');
    });

    it('rejects acceptance by non-assignees', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: 'task-row-1',
        task_id: 't-1',
        project_id: 'p-1',
        assignee_id: 'node-9',
        status: 'in_progress',
      });

      await expect(
        acceptSubmission('p-1:t-1', 'sub-1', 'node-1'),
      ).rejects.toThrow('Only the task assignee can accept submissions');
    });
  });

  describe('proposeTaskDecomposition', () => {
    it('persists decomposition as a swarm with subtasks', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        description: 'Do the work',
        assignee_id: 'node-1',
        status: 'in_progress',
      });
      mockPrisma.swarmTask.create.mockResolvedValue({ swarm_id: 'swarm-1' });
      mockPrisma.swarmSubtask.create
        .mockResolvedValueOnce({ subtask_id: 'sub-1', title: 'Research', status: 'pending' })
        .mockResolvedValueOnce({ subtask_id: 'sub-2', title: 'Ship', status: 'pending' });

      const result = await proposeTaskDecomposition(
        'p-1:t-1',
        'node-1',
        ['Research', 'Ship'],
        8,
      );

      expect(mockPrisma.swarmTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creator_id: 'node-1',
            title: 'Decomposition for Main task',
            status: 'in_progress',
            result: {
              source_task_id: 'p-1:t-1',
              estimated_parallelism: 2,
              proposed_by: 'node-1',
            },
          }),
        }),
      );
      expect(result.sub_tasks).toEqual([
        expect.objectContaining({ sub_task_id: 'sub-1', proposed_by: 'node-1' }),
        expect.objectContaining({ sub_task_id: 'sub-2', proposed_by: 'node-1' }),
      ]);
      expect(result.estimated_parallelism).toBe(2);
    });

    it('rejects invalid compound task ids', async () => {
      await expect(
        proposeTaskDecomposition('invalid', 'node-1', ['Research']),
      ).rejects.toThrow('Invalid taskId format');
    });

    it('rejects invalid estimated parallelism', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        description: 'Do the work',
        assignee_id: 'node-1',
        status: 'in_progress',
      });

      await expect(
        proposeTaskDecomposition('p-1:t-1', 'node-1', ['Research'], 0),
      ).rejects.toThrow('estimated_parallelism must be a positive integer');
    });

    it('rejects decomposition proposals from non-assignees', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        description: 'Do the work',
        assignee_id: 'node-9',
        status: 'in_progress',
      });

      await expect(
        proposeTaskDecomposition('p-1:t-1', 'node-1', ['Research']),
      ).rejects.toThrow('Only the task assignee can propose a decomposition');
    });

    it('rejects oversized decomposition batches', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        description: 'Do the work',
        assignee_id: 'node-1',
        status: 'in_progress',
      });

      await expect(
        proposeTaskDecomposition(
          'p-1:t-1',
          'node-1',
          Array.from({ length: MAX_SUBTASKS + 1 }, (_, index) => `subtask-${index}`),
        ),
      ).rejects.toThrow(`Subtasks count must be 1-${MAX_SUBTASKS}`);
    });

    it('rejects oversized subtask titles', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        description: 'Do the work',
        assignee_id: 'node-1',
        status: 'in_progress',
      });

      await expect(
        proposeTaskDecomposition(
          'p-1:t-1',
          'node-1',
          ['x'.repeat(TITLE_MAX_LENGTH + 1)],
        ),
      ).rejects.toThrow(`Subtask titles must be <= ${TITLE_MAX_LENGTH} characters`);
    });
  });

  describe('setTaskCommitment', () => {
    it('stores commitments in hidden question records', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        assignee_id: 'node-1',
        status: 'in_progress',
      });
      mockPrisma.question.upsert.mockResolvedValue({
        updated_at: new Date('2026-01-02T00:00:00.000Z'),
      });

      const result = await setTaskCommitment(
        'p-1:t-1',
        'node-1',
        '2026-01-03T00:00:00.000Z',
      );

      expect(mockPrisma.question.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { question_id: 'task-commitment:p-1:t-1:node-1' },
          create: expect.objectContaining({
            tags: ['task_commitment', 'task_commitment:p-1:t-1'],
            state: 'hidden',
            author: 'node-1',
          }),
        }),
      );
      expect(result).toEqual({
        task_id: 'p-1:t-1',
        node_id: 'node-1',
        deadline: '2026-01-03T00:00:00.000Z',
        committed_by: 'node-1',
        committed_at: '2026-01-02T00:00:00.000Z',
      });
    });

    it('rejects invalid deadlines', async () => {
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        assignee_id: 'node-1',
        status: 'in_progress',
      });

      await expect(
        setTaskCommitment('p-1:t-1', 'node-1', 'not-a-date'),
      ).rejects.toThrow('deadline must be a valid ISO-8601 timestamp');
    });

    it('rejects commitments from non-assignees', async () => {
      mockPrisma.projectTask.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.projectTask.findFirst.mockResolvedValue({
        id: '1',
        task_id: 't-1',
        project_id: 'p-1',
        title: 'Main task',
        assignee_id: 'node-9',
        status: 'in_progress',
      });

      await expect(
        setTaskCommitment('p-1:t-1', 'node-1', '2026-01-03T00:00:00.000Z'),
      ).rejects.toThrow('Only the task assignee can commit to this task');
    });
  });
});
