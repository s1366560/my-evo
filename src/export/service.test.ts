import { setPrisma } from './service';
import * as exportService from './service';

// Mock Prisma
const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue({ _count: { _all: 5 } }),
  },
  node: {
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue({ _count: { _all: 3 } }),
  },
};

beforeAll(() => setPrisma(mockPrisma as unknown as import('@prisma/client').PrismaClient));
afterEach(() => { jest.clearAllMocks(); exportService._resetTestState(); });

describe('Export Service', () => {
  describe('createExportJob', () => {
    it('creates a valid export job', async () => {
      const job = await exportService.createExportJob({
        user_id: 'user1', entity_type: 'asset', format: 'csv',
      });
      expect(job.job_id).toMatch(/^exp_/);
      expect(job.status).toBe('pending');
      expect(job.entity_type).toBe('asset');
      expect(job.format).toBe('csv');
    });

    it('rejects invalid format', async () => {
      await expect(exportService.createExportJob({
        user_id: 'user1', entity_type: 'asset', format: 'pdf',
      })).rejects.toThrow('format must be one of');
    });

    it('rejects invalid entity_type', async () => {
      await expect(exportService.createExportJob({
        user_id: 'user1', entity_type: 'unknown', format: 'csv',
      })).rejects.toThrow('entity_type must be one of');
    });
  });

  describe('getExportJob / updateExportJob', () => {
    it('retrieves and updates an export job', async () => {
      const job = await exportService.createExportJob({
        user_id: 'user1', entity_type: 'asset', format: 'json',
      });
      expect(exportService.getExportJob(job.job_id)?.job_id).toBe(job.job_id);
      const updated = exportService.updateExportJob(job.job_id, { status: 'completed', record_count: 100 });
      expect(updated?.status).toBe('completed');
      expect(updated?.record_count).toBe(100);
    });

    it('returns null for unknown job', () => {
      expect(exportService.getExportJob('unknown')).toBeNull();
    });
  });

  describe('listExportJobs', () => {
    it('paginates export jobs', async () => {
      for (let i = 0; i < 5; i++) {
        await exportService.createExportJob({ user_id: 'user1', entity_type: 'asset', format: 'csv' });
      }
      const { jobs, total } = exportService.listExportJobs({ user_id: 'user1' }, { page: 1, page_size: 2 });
      expect(jobs.length).toBe(2);
      expect(total).toBe(5);
    });
  });

  describe('generateCsv', () => {
    it('generates valid CSV', () => {
      const records = [{ asset_id: 'a1', name: 'Test', gdi_score: 85 }];
      const columns = [
        { field: 'asset_id', header: 'ID', type: 'string' as const },
        { field: 'name', header: 'Name', type: 'string' as const },
        { field: 'gdi_score', header: 'GDI', type: 'number' as const },
      ];
      const csv = exportService.generateCsv(records, columns);
      expect(csv).toContain('"ID"');
      expect(csv).toContain('"a1"');
      expect(csv).toContain('"Test"');
    });
  });

  describe('generateJson', () => {
    it('generates valid JSON', () => {
      const records = [{ asset_id: 'a1', name: 'Test', gdi_score: 85 }];
      const columns = [{ field: 'asset_id', header: 'ID', type: 'string' as const }];
      const json = exportService.generateJson(records, columns);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].asset_id).toBe('a1');
    });
  });

  describe('generateXml', () => {
    it('generates valid XML', () => {
      const records = [{ asset_id: 'a1', name: 'Test' }];
      const columns = [
        { field: 'asset_id', header: 'ID', type: 'string' as const },
        { field: 'name', header: 'Name', type: 'string' as const },
      ];
      const xml = exportService.generateXml(records, columns, 'asset');
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<asset>');
      expect(xml).toContain('<asset_id>a1</asset_id>');
    });
  });

  describe('cancelExportJob', () => {
    it('cancels a pending job', async () => {
      const job = await exportService.createExportJob({ user_id: 'u1', entity_type: 'asset', format: 'csv' });
      const cancelled = await exportService.cancelExportJob(job.job_id);
      expect(cancelled.status).toBe('cancelled');
    });

    it('throws when cancelling completed job', async () => {
      const job = await exportService.createExportJob({ user_id: 'u1', entity_type: 'asset', format: 'csv' });
      exportService.updateExportJob(job.job_id, { status: 'completed' });
      await expect(exportService.cancelExportJob(job.job_id)).rejects.toThrow('Cannot cancel');
    });
  });
});
