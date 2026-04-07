import * as service from './service';

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
  },
  project: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  projectTask: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  projectContribution: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Project Service', () => {
  describe('proposeProject', () => {
    it('should create a project with a generated repo_name when not provided', async () => {
      const mockNode = { node_id: 'node-1' };
      const mockProject = {
        id: 'proj-1',
        title: 'Test Project',
        description: 'A test project',
        repo_name: 'project-abc12345',
        status: 'proposed',
        proposer_id: 'node-1',
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.project.create.mockResolvedValue(mockProject);

      const result = await service.proposeProject(
        'node-1',
        'Test Project',
        'A test project',
      );

      expect(result.title).toBe('Test Project');
      expect(result.status).toBe('proposed');
      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Test Project',
            description: 'A test project',
            proposer_id: 'node-1',
            status: 'proposed',
          }),
        }),
      );
    });

    it('should use provided repo_name when given', async () => {
      const mockNode = { node_id: 'node-1' };
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.project.create.mockResolvedValue({
        id: 'proj-1',
        title: 'Test',
        repo_name: 'my-custom-repo',
        status: 'proposed',
      });

      await service.proposeProject('node-1', 'Test', 'desc', 'my-custom-repo');

      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            repo_name: 'my-custom-repo',
          }),
        }),
      );
    });

    it('should throw NotFoundError if sender node does not exist', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(
        service.proposeProject('nonexistent', 'Title', 'desc'),
      ).rejects.toThrow('Node not found');
    });
  });

  describe('getProject', () => {
    it('should return project with tasks and contributions', async () => {
      const mockProject = {
        id: 'proj-1',
        title: 'Test Project',
        ProjectTask: [],
        ProjectContribution: [],
      };

      mockPrisma.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.getProject('proj-1');
      expect(result.id).toBe('proj-1');
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getProject('nonexistent')).rejects.toThrow('Project not found');
    });
  });

  describe('listProjects', () => {
    it('should return paginated projects', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: 'proj-1' }]);
      mockPrisma.project.count.mockResolvedValue(1);

      const result = await service.listProjects({ limit: 10, offset: 0 });
      expect(result.projects).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockPrisma.project.findMany.mockResolvedValue([{ id: 'proj-1', status: 'active' }]);
      mockPrisma.project.count.mockResolvedValue(1);

      await service.listProjects({ status: 'active', limit: 20, offset: 0 });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        }),
      );
    });

    it('should use default limit and offset', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);
      mockPrisma.project.count.mockResolvedValue(0);

      const result = await service.listProjects({});
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });
  });

  describe('getProjectTasks', () => {
    it('should return tasks for a project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.projectTask.findMany.mockResolvedValue([
        { task_id: 'task-1', title: 'Task 1' },
      ]);

      const result = await service.getProjectTasks('proj-1');
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectTasks('nonexistent')).rejects.toThrow('Project not found');
    });
  });

  describe('getProjectContributions', () => {
    it('should return contributions for a project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.projectContribution.findMany.mockResolvedValue([
        { contribution_id: 'contrib-1' },
      ]);

      const result = await service.getProjectContributions('proj-1');
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.getProjectContributions('nonexistent')).rejects.toThrow('Project not found');
    });
  });

  describe('submitContribution', () => {
    it('should create a contribution', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'active' });
      mockPrisma.projectContribution.create.mockResolvedValue({
        contribution_id: 'contrib-1',
        project_id: 'proj-1',
        status: 'pending',
      });

      const result = await service.submitContribution(
        'proj-1',
        'node-1',
        [{ path: 'src/index.ts', content: 'hello', action: 'create' }],
        undefined,
        'Initial commit',
      );

      expect(result.status).toBe('pending');
    });

    it('should throw ValidationError for archived project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'archived' });

      await expect(
        service.submitContribution('proj-1', 'node-1', [{ path: 'x', content: 'y', action: 'create' }]),
      ).rejects.toThrow('archived or completed');
    });

    it('should throw ValidationError for completed project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'completed' });

      await expect(
        service.submitContribution('proj-1', 'node-1', [{ path: 'x', content: 'y', action: 'create' }]),
      ).rejects.toThrow('archived or completed');
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.submitContribution('nonexistent', 'node-1', [{ path: 'x', content: 'y', action: 'create' }]),
      ).rejects.toThrow('Project not found');
    });

    it('should throw ValidationError for task from different project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'active' });
      mockPrisma.projectTask.findUnique.mockResolvedValue({ task_id: 'task-1', project_id: 'proj-2' });

      await expect(
        service.submitContribution('proj-1', 'node-1', [{ path: 'x', content: 'y', action: 'create' }], 'task-1'),
      ).rejects.toThrow('Task does not belong to this project');
    });

    it('should throw NotFoundError for missing task', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', status: 'active' });
      mockPrisma.projectTask.findUnique.mockResolvedValue(null);

      await expect(
        service.submitContribution('proj-1', 'node-1', [{ path: 'x', content: 'y', action: 'create' }], 'nonexistent'),
      ).rejects.toThrow('ProjectTask not found');
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request for a valid contribution', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', repo_name: 'test/repo' });
      mockPrisma.projectContribution.findUnique.mockResolvedValue({
        contribution_id: 'contrib-1',
        project_id: 'proj-1',
      });

      const result = await service.createPullRequest('proj-1', 'node-1', 'contrib-1');
      expect(result.project_id).toBe('proj-1');
      expect(result.contribution_id).toBe('contrib-1');
      expect(result.status).toBe('open');
      expect(result.url).toContain('/pull/');
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.createPullRequest('nonexistent', 'node-1', 'contrib-1'),
      ).rejects.toThrow('Project not found');
    });

    it('should throw NotFoundError for missing contribution', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.projectContribution.findUnique.mockResolvedValue(null);

      await expect(
        service.createPullRequest('proj-1', 'node-1', 'nonexistent'),
      ).rejects.toThrow('ProjectContribution not found');
    });

    it('should throw ValidationError for contribution from different project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });
      mockPrisma.projectContribution.findUnique.mockResolvedValue({
        contribution_id: 'contrib-1',
        project_id: 'proj-2',
      });

      await expect(
        service.createPullRequest('proj-1', 'node-1', 'contrib-1'),
      ).rejects.toThrow('Contribution does not belong to this project');
    });
  });

  describe('requestReview', () => {
    it('should create a review request', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1' });

      const result = await service.requestReview('proj-1', 'node-1', 42);
      expect(result.pr_number).toBe(42);
      expect(result.status).toBe('review_requested');
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.requestReview('nonexistent', 'node-1', 1),
      ).rejects.toThrow('Project not found');
    });
  });

  describe('mergePullRequest', () => {
    it('should merge a pull request when called by proposer', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', proposer_id: 'node-1' });

      const result = await service.mergePullRequest('proj-1', 'node-1', 42);
      expect(result.pr_number).toBe(42);
      expect(result.status).toBe('merged');
    });

    it('should throw ForbiddenError when called by non-proposer', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', proposer_id: 'node-1' });

      await expect(
        service.mergePullRequest('proj-1', 'node-2', 42),
      ).rejects.toThrow('Only the project proposer can merge');
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.mergePullRequest('nonexistent', 'node-1', 1),
      ).rejects.toThrow('Project not found');
    });
  });

  describe('decomposeIntoTasks', () => {
    it('should create tasks from plan lines', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', proposer_id: 'node-1' });
      mockPrisma.projectTask.create
        .mockResolvedValueOnce({ task_id: 'task-1', title: 'Task A' })
        .mockResolvedValueOnce({ task_id: 'task-2', title: 'Task B' });

      const result = await service.decomposeIntoTasks(
        'proj-1',
        'node-1',
        'Task A: Description for A\nTask B: Description for B',
      );

      expect(result).toHaveLength(2);
      expect(mockPrisma.projectTask.create).toHaveBeenCalledTimes(2);
    });

    it('should create a task from a plan line without colon', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', proposer_id: 'node-1' });
      mockPrisma.projectTask.create.mockResolvedValue({ task_id: 'task-1', title: 'Single Task' });

      const result = await service.decomposeIntoTasks('proj-1', 'node-1', 'Single Task');

      expect(result).toHaveLength(1);
    });

    it('should throw ForbiddenError when called by non-proposer', async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', proposer_id: 'node-1' });

      await expect(
        service.decomposeIntoTasks('proj-1', 'node-2', 'Task A'),
      ).rejects.toThrow('Only the project proposer can decompose');
    });

    it('should throw NotFoundError for missing project', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.decomposeIntoTasks('nonexistent', 'node-1', 'Task A'),
      ).rejects.toThrow('Project not found');
    });
  });
});
