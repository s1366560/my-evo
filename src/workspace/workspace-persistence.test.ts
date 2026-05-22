/**
 * Workspace Session Persistence Tests
 *
 * Verifies that the workspace can recover from an interrupted agent session,
 * that task state is durable across worker disconnects, and that
 * heartbeat/stale-recovery mechanisms allow resumption.
 */
import { PrismaClient } from '@prisma/client';
import * as service from './service';

const {
  createTask,
  getTask,
  workerReport,
  completeTask,
  shouldMarkBlocked,
  updateWorkerHeartbeat,
  createHeartbeatExtension,
} = service;

const createTransactionMock = (mockClient: any) => {
  return jest.fn().mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') return fn(mockClient);
    if (Array.isArray(fn)) return Promise.all(fn as any[]);
    return fn;
  });
};

const mockPrisma = {
  $transaction: createTransactionMock(null),
  workspaceTask: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  taskAttempt: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
  preflightResult: { upsert: jest.fn(), findMany: jest.fn() },
  heartbeatExtension: { create: jest.fn(), findFirst: jest.fn() },
  workspaceWorker: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
} as any;

mockPrisma.$transaction = createTransactionMock(mockPrisma);

describe('Workspace Session Persistence', () => {
  beforeAll(() => { service.setPrisma(mockPrisma as unknown as PrismaClient); });
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Task state durability across session interruptions', () => {
    it('should persist task progress when worker disconnects mid-task', async () => {
      const taskId = 'wst_persist_1';
      const workerId = 'wrk_persist_1';
      mockPrisma.workspaceTask.update.mockResolvedValue({
        task_id: taskId, status: 'in_progress', progress_pct: 55,
        current_step: 'compiling sources', updated_at: new Date(),
      });
      const report = await workerReport(taskId, workerId, {
        status: 'in_progress',
        progress_pct: 55,
        current_step: 'compiling sources',
      });
      expect(report.acknowledged).toBe(true);
      expect(report.task_status).toBe('in_progress');
      expect(mockPrisma.workspaceTask.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { task_id: taskId } }),
      );
    });

    it('should recover task with latest attempt after interruption', async () => {
      const taskId = 'wst_recover_1';
      mockPrisma.workspaceTask.findUnique.mockResolvedValue({
        task_id: taskId, title: 'Build API', description: 'D',
        status: 'in_progress', role: 'builder',
        assigned_worker_id: 'wrk_1', progress_pct: 65,
        current_step: 'running tests',
        deadline: null,
        created_at: new Date(), updated_at: new Date(),
        attempts: [{ attempt_id: 'att_recover_1', status: 'running', started_at: new Date() }],
        preflight_results: [],
        dependencies: [],
      });
      const task = await getTask(taskId);
      expect(task).not.toBeNull();
      expect(task!.status).toBe('in_progress');
      expect(task!.progress_pct).toBe(65);
      expect(task!.current_attempt?.attempt_id).toBe('att_recover_1');
    });

    it('should complete task after recovery with durable artifacts', async () => {
      const taskId = 'wst_complete_1';
      mockPrisma.workspaceTask.update.mockResolvedValue({
        task_id: taskId, status: 'completed', progress_pct: 100,
      });
      mockPrisma.taskAttempt.findFirst.mockResolvedValue({
        id: 1, attempt_id: 'att_final_1', status: 'running',
      });
      mockPrisma.taskAttempt.update.mockResolvedValue({});
      mockPrisma.preflightResult.findMany.mockResolvedValue([
        { status: 'passed', check_id: 'read-progress' },
        { status: 'passed', check_id: 'git-status' },
      ]);
      const result = await completeTask(taskId, 'wrk_1', {
        summary: 'Recovered and completed',
        artifacts: ['src/main.ts'],
        verifications: ['preflight:read-progress', 'preflight:git-status'],
        execution_metrics: { duration_ms: 5000 },
        preflight_checklist: [],
      });
      expect(result.status).toBe('completed');
      expect(result.artifacts).toContain('src/main.ts');
      expect(result.verification_results[0].dimension).toBe('preflight');
      expect(result.verification_results[0].passed).toBe(true);
    });
  });

  describe('Heartbeat-based stale worker detection and recovery', () => {
    it('should detect stale worker when heartbeat exceeds threshold', async () => {
      mockPrisma.workspaceWorker.findUnique.mockResolvedValue({
        worker_id: 'wrk_stale', last_heartbeat: new Date(Date.now() - 900000),
      });
      mockPrisma.heartbeatExtension.findFirst.mockResolvedValue(null);
      const blocked = await shouldMarkBlocked('wrk_stale');
      expect(blocked).toBe(true);
    });

    it('should not block worker with active heartbeat extension', async () => {
      mockPrisma.workspaceWorker.findUnique.mockResolvedValue({
        worker_id: 'wrk_ext', last_heartbeat: new Date(Date.now() - 700000),
      });
      mockPrisma.heartbeatExtension.findFirst.mockResolvedValue({
        extended_until: new Date(Date.now() + 300000),
      });
      const blocked = await shouldMarkBlocked('wrk_ext');
      expect(blocked).toBe(false);
    });

    it('should allow worker to resume by updating heartbeat after disconnect', async () => {
      mockPrisma.workspaceWorker.update.mockResolvedValue({});
      await updateWorkerHeartbeat('wrk_resume', 'wst_resuming');
      expect(mockPrisma.workspaceWorker.update).toHaveBeenCalledWith({
        where: { worker_id: 'wrk_resume' },
        data: expect.objectContaining({ status: 'in_progress' }),
      });
    });

    it('should create heartbeat extension for long-running compile', async () => {
      mockPrisma.heartbeatExtension.create.mockResolvedValue({
        task_id: 'wst_ext', worker_id: 'wrk_ext',
        reason: 'compile', estimated_duration_ms: 300000,
        extended_until: new Date(Date.now() + 300000),
      });
      const ext = await createHeartbeatExtension('wst_ext', 'wrk_ext', 'compile', 300000);
      expect(ext.task_id).toBe('wst_ext');
      expect(ext.reason).toBe('compile');
      expect(ext.estimated_duration_ms).toBe(300000);
    });
  });

  describe('Worker report with preflight evidence persistence', () => {
    it('should persist preflight evidence across session boundaries', async () => {
      const taskId = 'wst_preflight_1';
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      mockPrisma.workspaceTask.findUnique.mockResolvedValue({
        task_id: taskId, attempts: [{ attempt_id: 'att_pf_1' }],
      });
      mockPrisma.preflightResult.upsert.mockResolvedValue({});
      const report = await workerReport(taskId, 'wrk_pf', {
        status: 'in_progress',
        progress_pct: 80,
        current_step: 'running checks',
        preflight_evidence: [
          { evidence_id: 'ev_1', task_id: taskId, worker_id: 'wrk_pf', check_id: 'read-progress', check_kind: 'read_progress', evidence_type: 'log', evidence_content: 'progress file read', captured_at: new Date().toISOString(), capture_method: 'command', verified: true },
          { evidence_id: 'ev_2', task_id: taskId, worker_id: 'wrk_pf', check_id: 'git-status', check_kind: 'git_status', evidence_type: 'log', evidence_content: 'clean tree', captured_at: new Date().toISOString(), capture_method: 'command', verified: true },
        ],
      });
      expect(report.acknowledged).toBe(true);
      expect(mockPrisma.preflightResult.upsert).toHaveBeenCalledTimes(2);
    });

    it('should handle worker report without preflight evidence', async () => {
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      const report = await workerReport('wst_nopf', 'wrk_nopf', {
        status: 'in_progress', progress_pct: 30, current_step: 'building',
      });
      expect(report.acknowledged).toBe(true);
      expect(mockPrisma.preflightResult.upsert).not.toHaveBeenCalled();
    });

    it('should grant heartbeat extension during long report', async () => {
      mockPrisma.workspaceTask.update.mockResolvedValue({});
      mockPrisma.heartbeatExtension.create.mockResolvedValue({});
      const report = await workerReport('wst_hbext', 'wrk_hbext', {
        status: 'in_progress', progress_pct: 40, current_step: 'compiling',
        heartbeat_extension: { reason: 'compile', estimated_duration_ms: 120000 },
      });
      expect(report.extension_granted).toBe(true);
      expect(report.extension_expires_at).toBeDefined();
    });
  });

  describe('Task attempt lifecycle across interruptions', () => {
    it('should create new attempt when task is reassigned after worker failure', async () => {
      const taskId = 'wst_reassign';
      mockPrisma.workspaceTask.create.mockResolvedValue({
        task_id: taskId, workspace_id: 'ws_1', leader_id: 'ldr_1',
        title: 'Reassigned task', description: 'D', status: 'assigned',
        assigned_worker_id: 'wrk_new', role: 'builder',
        preflight_config: null, deadline: null, dependencies: [],
      });
      mockPrisma.taskAttempt.create.mockResolvedValue({
        attempt_id: 'att_reassign_1', task_id: taskId, worker_id: 'wrk_new', status: 'created',
      });
      const result = await createTask('ws_1', {
        title: 'Reassigned task', description: 'D',
        assigned_worker_id: 'wrk_new', role: 'builder',
      }, 'ldr_1');
      expect(result.status).toBe('assigned');
      expect(result.assigned_worker_id).toBe('wrk_new');
      expect(mockPrisma.taskAttempt.create).toHaveBeenCalled();
    });
  });
});
