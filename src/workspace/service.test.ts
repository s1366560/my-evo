/**
 * Workspace Service Unit Tests
 */
import { PrismaClient } from '@prisma/client';
import * as service from './service';

const {
  createWorkspace,
  getWorkspaceStatus,
  updateWorkspaceStatus,
  createTask,
  getTask,
  workerReport,
  completeTask,
  matchWorkers,
  shouldMarkBlocked,
  updateWorkerHeartbeat,
  createHeartbeatExtension,
} = service;

// Helper: handles both callback-style (interactive tx) and array-style (sequential ops) $transaction
const createTransactionMock = (mockClient: any) => {
  return jest.fn().mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') {
      return fn(mockClient);
    }
    // Prisma sequential transaction: pass the array of PrismaPromise objects through directly.
    // Each promise is already bound to mockPrisma, so resolved values use the jest.fn() stubs.
    if (Array.isArray(fn)) {
      return Promise.all(fn as any[]);
    }
    return fn;
  });
};

const mockPrisma = {
  $transaction: createTransactionMock(null),
  workspace: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  workspaceLeader: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  workspaceTask: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  taskAttempt: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  preflightResult: { upsert: jest.fn(), findMany: jest.fn() },
  heartbeatExtension: { create: jest.fn(), findFirst: jest.fn() },
  workspaceWorker: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
} as any;

// Update transaction mock to use actual mockPrisma client
mockPrisma.$transaction = createTransactionMock(mockPrisma);

describe('Workspace Service', () => {
  beforeAll(() => { service.setPrisma(mockPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('createWorkspace', () => {
    it('should create workspace with leader', async () => {
      mockPrisma.workspace.create.mockResolvedValue({ workspace_id: 'ws_1', name: 'Test', status: 'forming', created_at: new Date(), updated_at: new Date() });
      mockPrisma.workspaceLeader.create.mockResolvedValue({ leader_id: 'ldr_1', workspace_id: 'ws_1', root_goal_id: 'goal_1', status: 'forming', team_size: 3 });
      const result = await createWorkspace({ name: 'Test', description: 'D', root_goal: 'G', leader_config: { auto_form_team: true, team_size: 3, roles: ['builder'] } }, 'owner1');
      expect(result.workspace_id).toBe('ws_1');
      expect(result.leader_id).toBe('ldr_1');
    });
  });

  describe('getWorkspaceStatus', () => {
    it('should return null for non-existent workspace', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      expect(await getWorkspaceStatus('nonexistent')).toBeNull();
    });

    it('should return status with correct task stats', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        workspace_id: 'ws_1', name: 'T', description: 'D', root_goal: 'G', status: 'active',
        created_at: new Date(), updated_at: new Date(),
        tasks: [
          { task_id: 't1', title: 'T1', status: 'completed', progress_pct: 100 },
          { task_id: 't2', title: 'T2', status: 'in_progress', progress_pct: 50 },
        ],
        leaders: [{ leader_id: 'ldr_1', root_goal_id: 'goal_1', status: 'active', team_size: 2, team_members: [] }],
      });
      const result = await getWorkspaceStatus('ws_1');
      expect(result!.stats.total_tasks).toBe(2);
      expect(result!.stats.completed).toBe(1);
      expect(result!.stats.in_progress).toBe(1);
    });

    it('should handle workspace without leader', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        workspace_id: 'ws_2', name: 'N', description: null, root_goal: 'G', status: 'forming',
        created_at: new Date(), updated_at: new Date(), tasks: [], leaders: [],
      });
      const result = await getWorkspaceStatus('ws_2');
      expect(result!.leader.leader_id).toBe('');
    });
  });

  describe('updateWorkspaceStatus', () => {
    it('should update workspace and leader status', async () => {
      mockPrisma.workspace.update.mockResolvedValue({});
      mockPrisma.workspaceLeader.updateMany.mockResolvedValue({ count: 1 });
      await updateWorkspaceStatus('ws_1', 'active');
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({ where: { workspace_id: 'ws_1' }, data: { status: 'active' } });
      expect(mockPrisma.workspaceLeader.updateMany).toHaveBeenCalledWith({ where: { workspace_id: 'ws_1' }, data: { status: 'active' } });
    });
  });

  describe('createTask', () => {
    it('should create pending task without worker', async () => {
      mockPrisma.workspaceTask.create.mockResolvedValue({ task_id: 'wst_1', workspace_id: 'ws_1', status: 'pending', assigned_worker_id: null });
      const result = await createTask('ws_1', { title: 'T', description: 'D' }, 'ldr_1');
      expect(result.status).toBe('pending');
      expect(mockPrisma.taskAttempt.create).not.toHaveBeenCalled();
    });

    it('should create assigned task with worker and attempt', async () => {
      mockPrisma.workspaceTask.create.mockResolvedValue({ task_id: 'wst_2', workspace_id: 'ws_1', status: 'assigned', assigned_worker_id: 'wrk_1' });
      mockPrisma.taskAttempt.create.mockResolvedValue({});
      const result = await createTask('ws_1', { title: 'T', description: 'D', assigned_worker_id: 'wrk_1' }, 'ldr_1');
      expect(result.status).toBe('assigned');
      expect(mockPrisma.taskAttempt.create).toHaveBeenCalled();
    });
  });

  describe('getTask', () => {
    it('should return null for non-existent task', async () => {
      mockPrisma.workspaceTask.findUnique.mockResolvedValue(null);
      expect(await getTask('nonexistent')).toBeNull();
    });

    it('should return task with attempts and preflight results', async () => {
      mockPrisma.workspaceTask.findUnique.mockResolvedValue({
        task_id: 'wst_1', title: 'T', description: 'D', status: 'in_progress', role: 'builder',
        assigned_worker_id: 'wrk_1', progress_pct: 50, current_step: 'Step 2',
        deadline: null, created_at: new Date(), updated_at: new Date(), dependencies: [],
        attempts: [{ attempt_id: 'att_1', status: 'running' }],
        preflight_results: [{ check_id: 'git', kind: 'git_status', status: 'passed', evidence: 'clean', captured_at: new Date() }],
      });
      const result = await getTask('wst_1');
      expect(result!.task_id).toBe('wst_1');
      expect(result!.progress_pct).toBe(50);
      expect(result!.current_attempt?.attempt_id).toBe('att_1');
    });
  });

  describe('workerReport', () => {
    it('should acknowledge report and update task', async () => {
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      const result = await workerReport('wst_1', 'wrk_1', { status: 'in_progress', progress_pct: 60, current_step: 'Step 3' });
      expect(result.acknowledged).toBe(true);
      expect(result.task_status).toBe('in_progress');
      expect(result.extension_granted).toBe(false);
    });

    it('should grant heartbeat extension when requested', async () => {
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      mockPrisma.heartbeatExtension.create.mockResolvedValue({});
      const result = await workerReport('wst_1', 'wrk_1', { status: 'in_progress', progress_pct: 75, current_step: 'Step 4', heartbeat_extension: { reason: 'compile', estimated_duration_ms: 60000 } });
      expect(result.acknowledged).toBe(true);
      expect(result.extension_granted).toBe(true);
    });
  });

  describe('completeTask', () => {
    it('should complete task with all checks passed', async () => {
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      mockPrisma.taskAttempt.findFirst.mockResolvedValue({ id: 1, attempt_id: 'att_1', status: 'running' });
      mockPrisma.taskAttempt.update.mockResolvedValue({});
      mockPrisma.preflightResult.findMany.mockResolvedValue([{ check_id: 'build', status: 'passed' }, { check_id: 'test', status: 'passed' }]);
      const result = await completeTask('wst_1', 'wrk_1', { summary: 'Done', artifacts: ['file.ts'], verifications: [], preflight_checklist: [{ check_id: 'build', kind: 'build_status', status: 'passed', required: true, command: null, evidence: null, completed_at: null }] });
      expect(result.status).toBe('completed');
      expect(result.verification_results.find((r: any) => r.dimension === 'preflight')?.passed).toBe(true);
    });

    it('should fail preflight when any check fails', async () => {
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      mockPrisma.taskAttempt.findFirst.mockResolvedValue({ id: 1, attempt_id: 'att_1', status: 'running' });
      mockPrisma.taskAttempt.update.mockResolvedValue({});
      mockPrisma.preflightResult.findMany.mockResolvedValue([{ check_id: 'build', status: 'passed' }, { check_id: 'test', status: 'failed' }]);
      const result = await completeTask('wst_1', 'wrk_1', { summary: 'Done', artifacts: [], verifications: [], preflight_checklist: [] });
      expect(result.verification_results.find((r: any) => r.dimension === 'preflight')?.passed).toBe(false);
    });
  });

  describe('matchWorkers', () => {
    it('should return workers sorted by score', async () => {
      mockPrisma.workspaceWorker.findMany.mockResolvedValue([
        { worker_id: 'wrk_1', capabilities: [{ category: 'builder', skills: ['typescript'] }], max_concurrent_tasks: 3, current_tasks: [] },
        { worker_id: 'wrk_2', capabilities: [{ category: 'builder', skills: ['python'] }], max_concurrent_tasks: 2, current_tasks: ['t1'] },
      ]);
      const result = await matchWorkers({ roles: ['builder'], skills: ['typescript'] }, 2);
      expect(result).toHaveLength(2);
      expect(result[0]!.worker_id).toBe('wrk_1');
      expect(result[0]!.final_score).toBeGreaterThan(0);
    });

    it('should return empty when no workers available', async () => {
      mockPrisma.workspaceWorker.findMany.mockResolvedValue([]);
      const result = await matchWorkers({ roles: ['builder'] });
      expect(result).toHaveLength(0);
    });
  });

  describe('shouldMarkBlocked', () => {
    it('should return true when worker not found', async () => {
      mockPrisma.workspaceWorker.findUnique.mockResolvedValue(null);
      expect(await shouldMarkBlocked('nonexistent')).toBe(true);
    });

    it('should return false when heartbeat is recent', async () => {
      mockPrisma.workspaceWorker.findUnique.mockResolvedValue({ worker_id: 'wrk_1', last_heartbeat: new Date() });
      mockPrisma.heartbeatExtension.findFirst.mockResolvedValue(null);
      expect(await shouldMarkBlocked('wrk_1')).toBe(false);
    });

    it('should return false when extension is active', async () => {
      mockPrisma.workspaceWorker.findUnique.mockResolvedValue({ worker_id: 'wrk_1', last_heartbeat: new Date(Date.now() - 600000) });
      mockPrisma.heartbeatExtension.findFirst.mockResolvedValue({ extended_until: new Date(Date.now() + 300000) });
      expect(await shouldMarkBlocked('wrk_1')).toBe(false);
    });

    it('should return true when heartbeat is stale', async () => {
      mockPrisma.workspaceWorker.findUnique.mockResolvedValue({ worker_id: 'wrk_1', last_heartbeat: new Date(Date.now() - 900000) });
      mockPrisma.heartbeatExtension.findFirst.mockResolvedValue(null);
      expect(await shouldMarkBlocked('wrk_1')).toBe(true);
    });
  });

  describe('updateWorkerHeartbeat', () => {
    it('should update heartbeat with in_progress status when task provided', async () => {
      mockPrisma.workspaceWorker.update.mockResolvedValue({});
      await updateWorkerHeartbeat('wrk_1', 'wst_1');
      expect(mockPrisma.workspaceWorker.update).toHaveBeenCalledWith({
        where: { worker_id: 'wrk_1' },
        data: expect.objectContaining({ status: 'in_progress' }),
      });
    });

    it('should update heartbeat with idle status when no task', async () => {
      mockPrisma.workspaceWorker.update.mockResolvedValue({});
      await updateWorkerHeartbeat('wrk_1');
      expect(mockPrisma.workspaceWorker.update).toHaveBeenCalledWith({
        where: { worker_id: 'wrk_1' },
        data: expect.objectContaining({ status: 'idle' }),
      });
    });
  });

  describe('createHeartbeatExtension', () => {
    it('should create heartbeat extension', async () => {
      mockPrisma.heartbeatExtension.create.mockResolvedValue({
        task_id: 'wst_1', worker_id: 'wrk_1', reason: 'compile', estimated_duration_ms: 300000, extended_until: new Date(),
      });
      const result = await createHeartbeatExtension('wst_1', 'wrk_1', 'compile', 300000);
      expect(result.task_id).toBe('wst_1');
      expect(result.estimated_duration_ms).toBe(300000);
    });
  });
});
