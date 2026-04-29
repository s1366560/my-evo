import { setPrisma, _setJobStatus } from './service';
import * as batchService from './service';

// Mock Prisma
const mockPrisma = {
  asset: {
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  quarantineRecord: { create: jest.fn() },
};

beforeAll(() => setPrisma(mockPrisma as unknown as import('@prisma/client').PrismaClient));
afterEach(() => { jest.clearAllMocks(); batchService._resetTestState(); });

describe('Batch Service', () => {
  describe('createBatchJob', () => {
    it('creates a valid batch job', async () => {
      const job = await batchService.createBatchJob({
        user_id: 'user1', operation_type: 'asset_bulk_update',
        item_ids: ['a1', 'a2', 'a3'], parameters: { data: { status: 'published' } },
      });
      expect(job.job_id).toMatch(/^bat_/);
      expect(job.status).toBe('pending');
      expect(job.total_items).toBe(3);
      expect(job.operation_type).toBe('asset_bulk_update');
    });

    it('rejects empty item_ids', async () => {
      await expect(batchService.createBatchJob({
        user_id: 'user1', operation_type: 'asset_bulk_update', item_ids: [],
      })).rejects.toThrow('item_ids cannot be empty');
    });
  });

  describe('getBatchJobProgress', () => {
    it('returns correct progress percentage', async () => {
      const job = await batchService.createBatchJob({
        user_id: 'user1', operation_type: 'asset_bulk_update',
        item_ids: Array(100).fill('a').map((_, i) => `a${i}`),
      });
      // Manually update progress
      const progress = batchService.getBatchJobProgress(job.job_id);
      expect(progress?.percentage).toBe(0);
      expect(progress?.total_items).toBe(100);
    });
  });

  describe('pause / resume / cancel', () => {
    it('pauses a running job', async () => {
      const job = await batchService.createBatchJob({
        user_id: 'user1', operation_type: 'asset_bulk_update', item_ids: ['a1'],
      });
      _setJobStatus(job.job_id, 'running');
      const paused = batchService.pauseBatchJob(job.job_id);
      expect(paused?.status).toBe('paused');
    });

    it('resumes a paused job', async () => {
      const job = await batchService.createBatchJob({
        user_id: 'user1', operation_type: 'asset_bulk_update', item_ids: ['a1'],
      });
      _setJobStatus(job.job_id, 'running');
      batchService.pauseBatchJob(job.job_id);
      const resumed = batchService.resumeBatchJob(job.job_id);
      expect(resumed?.status).toBe('pending');
    });

    it('cancels a pending job', async () => {
      const job = await batchService.createBatchJob({
        user_id: 'user1', operation_type: 'asset_bulk_update', item_ids: ['a1'],
      });
      const cancelled = batchService.cancelBatchJob(job.job_id);
      expect(cancelled?.status).toBe('cancelled');
    });
  });

  describe('schedules', () => {
    it('creates and lists schedules', () => {
      const schedule = batchService.createBatchSchedule({
        user_id: 'user1', operation_type: 'asset_bulk_update',
        cron_expression: '0 0 * * *', parameters: {},
      });
      expect(schedule.schedule_id).toMatch(/^sch_/);
      const list = batchService.listBatchSchedules('user1');
      expect(list).toHaveLength(1);
      batchService.deleteBatchSchedule(schedule.schedule_id);
      expect(batchService.listBatchSchedules('user1')).toHaveLength(0);
    });
  });

  describe('listBatchJobs', () => {
    it('filters by status', async () => {
      const job1 = await batchService.createBatchJob({
        user_id: 'u1', operation_type: 'asset_bulk_update', item_ids: ['a1'],
      });
      const job2 = await batchService.createBatchJob({
        user_id: 'u1', operation_type: 'asset_bulk_publish', item_ids: ['a2'],
      });
      const { jobs } = batchService.listBatchJobs({ user_id: 'u1', operation_type: 'asset_bulk_update' });
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.operation_type).toBe('asset_bulk_update');
    });
  });
});
