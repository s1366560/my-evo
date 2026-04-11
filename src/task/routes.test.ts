import fastify, { type FastifyInstance } from 'fastify';
import { taskRoutes } from './routes';

const mockProposeTaskDecomposition = jest.fn();
const mockSetTaskCommitment = jest.fn();
const mockUpdateTask = jest.fn();
const mockAcceptSubmission = jest.fn();
const mockGetSwarm = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  proposeTaskDecomposition: (...args: unknown[]) => mockProposeTaskDecomposition(...args),
  setTaskCommitment: (...args: unknown[]) => mockSetTaskCommitment(...args),
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  acceptSubmission: (...args: unknown[]) => mockAcceptSubmission(...args),
}));

jest.mock('../swarm/service', () => ({
  ...jest.requireActual('../swarm/service'),
  getSwarm: (...args: unknown[]) => mockGetSwarm(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Task routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(taskRoutes, { prefix: '/api/v2' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('persists proposed decompositions through the task service', async () => {
    mockProposeTaskDecomposition.mockResolvedValue({
      original_task_id: 'p-1:t-1',
      decomposition_id: 'swarm-1',
      sub_tasks: [],
      estimated_parallelism: 1,
      proposed_at: '2026-01-01T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/task/propose-decomposition',
      payload: {
        task_id: 'p-1:t-1',
        sub_task_titles: ['Research'],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockProposeTaskDecomposition).toHaveBeenCalledWith(
      'p-1:t-1',
      'node-1',
      ['Research'],
      undefined,
    );
  });

  it('stores task commitments through the task service', async () => {
    mockSetTaskCommitment.mockResolvedValue({
      task_id: 'p-1:t-1',
      node_id: 'node-1',
      deadline: '2026-01-03T00:00:00.000Z',
      committed_by: 'node-1',
      committed_at: '2026-01-02T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/task/p-1:t-1/commitment',
      payload: {
        node_id: 'node-1',
        deadline: '2026-01-03T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockSetTaskCommitment).toHaveBeenCalledWith(
      'p-1:t-1',
      'node-1',
      '2026-01-03T00:00:00.000Z',
    );
  });

  it('passes the authenticated actor into task updates', async () => {
    mockUpdateTask.mockResolvedValue({
      task_id: 't-1',
      project_id: 'p-1',
      title: 'Updated',
      description: '',
      status: 'in_progress',
      assignee_id: 'node-1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'PUT',
      url: '/api/v2/projects/p-1/tasks/t-1',
      payload: {
        title: 'Updated',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockUpdateTask).toHaveBeenCalledWith(
      'p-1',
      't-1',
      'node-1',
      { title: 'Updated' },
    );
  });

  it('passes the authenticated actor into submission acceptance', async () => {
    mockAcceptSubmission.mockResolvedValue({
      submission_id: 'sub-1',
      task_id: 't-1',
      status: 'accepted',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/task/accept-submission',
      payload: {
        task_id: 'p-1:t-1',
        submission_id: 'sub-1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAcceptSubmission).toHaveBeenCalledWith(
      'p-1:t-1',
      'sub-1',
      'node-1',
    );
  });

  it('hides swarm state from unrelated authenticated users', async () => {
    mockGetSwarm.mockResolvedValue({
      swarm_id: 'swarm-1',
      creator_id: 'node-2',
      subtasks: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/task/swarm/swarm-1',
    });

    expect(response.statusCode).toBe(404);
  });
});
