import { PrismaClient } from '@prisma/client';
import type {
  BatchJob, BatchError, BatchWarning, BatchProgress, BatchSchedule,
  BatchConstraints, BatchOperationType, BatchStatus,
} from './types';
import {
  BATCH_DEFAULT_CHUNK_SIZE, BATCH_MAX_JOB_SIZE, BATCH_MAX_CONCURRENT_JOBS,
  BATCH_DEFAULT_TIMEOUT_MS, BATCH_MAX_RETRY_ATTEMPTS, BATCH_RETRY_DELAY_MS,
  BATCH_ERROR_THRESHOLD_PERCENT, BATCH_OPERATION_PERMISSIONS, BATCH_ESTIMATED_DURATION_MS,
} from './constants';
import { ValidationError } from '../shared/errors';

let prisma = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }

// FIX: Use crypto.randomBytes for secure ID generation
function genId(prefix: string): string {
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return `${prefix}_${Date.now()}_${randomBytes(8).toString('hex')}`;
}

const jobs = new Map<string, BatchJob>();
const schedules = new Map<string, BatchSchedule>();

// Test helpers (not for production use)
export function _setJobStatus(jobId: string, status: BatchStatus): BatchJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const updated = { ...job, status };
  jobs.set(jobId, updated);
  return updated;
}
const defaultConstraints: BatchConstraints = {
  max_batch_size: BATCH_MAX_JOB_SIZE,
  max_concurrent_jobs: BATCH_MAX_CONCURRENT_JOBS,
  max_retry_attempts: BATCH_MAX_RETRY_ATTEMPTS,
  retry_delay_ms: BATCH_RETRY_DELAY_MS,
  timeout_per_item_ms: 5000,
  pause_on_error_threshold: BATCH_ERROR_THRESHOLD_PERCENT,
};

let activeJobCount = 0;

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function createBatchJob(
  params: {
    user_id: string; operation_type: BatchOperationType;
    item_ids: string[]; parameters?: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    notification_email?: string; webhook_url?: string;
  },
  client?: PrismaClient,
): Promise<BatchJob> {
  const db = client ?? prisma;
  if (params.item_ids.length === 0) throw new ValidationError('item_ids cannot be empty');
  if (params.item_ids.length > BATCH_MAX_JOB_SIZE) throw new ValidationError(`item_ids exceeds max size of ${BATCH_MAX_JOB_SIZE}`);
  if (activeJobCount >= defaultConstraints.max_concurrent_jobs) {
    throw new ValidationError(`Max concurrent jobs (${defaultConstraints.max_concurrent_jobs}) reached`);
  }
  const perItemMs = BATCH_ESTIMATED_DURATION_MS[params.operation_type] ?? 500;
  const job: BatchJob = {
    job_id: genId('bat'), user_id: params.user_id,
    operation_type: params.operation_type,
    status: 'pending',
    priority: params.priority ?? 'normal',
    concurrency: 'chunked',
    total_items: params.item_ids.length,
    processed_items: 0, success_count: 0, failure_count: 0, skipped_count: 0,
    item_ids: params.item_ids,
    parameters: params.parameters ?? {},
    created_at: new Date().toISOString(),
    error_log: [], warnings: [],
    can_rollback: false,
    notification_email: params.notification_email,
    webhook_url: params.webhook_url,
    estimated_duration_ms: params.item_ids.length * perItemMs,
  };
  jobs.set(job.job_id, job);
  return job;
}

export function getBatchJob(jobId: string): BatchJob | null { return jobs.get(jobId) ?? null; }
export function getUserBatchJobs(userId: string): BatchJob[] {
  return Array.from(jobs.values()).filter(j => j.user_id === userId);
}

export function getBatchJobProgress(jobId: string): BatchProgress | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  const pct = job.total_items > 0 ? Math.round((job.processed_items / job.total_items) * 100) : 0;
  const elapsed = job.started_at ? Date.now() - new Date(job.started_at).getTime() : 0;
  const remaining = job.estimated_duration_ms ? Math.max(0, job.estimated_duration_ms - elapsed) : undefined;
  return {
    job_id: job.job_id, status: job.status,
    total_items: job.total_items, processed_items: job.processed_items,
    success_count: job.success_count, failure_count: job.failure_count,
    skipped_count: job.skipped_count, percentage: pct,
    total_chunks: Math.ceil(job.total_items / BATCH_DEFAULT_CHUNK_SIZE),
    current_phase: `${job.processed_items}/${job.total_items}`,
    estimated_seconds_remaining: remaining ? Math.round(remaining / 1000) : undefined,
    started_at: job.started_at ?? job.created_at,
    elapsed_ms: elapsed,
  };
}

export async function runBatchJob(jobId: string, client?: PrismaClient): Promise<BatchJob> {
  const db = client ?? prisma;
  const job = jobs.get(jobId);
  if (!job) throw new ValidationError('Batch job not found');
  if (!['pending', 'paused'].includes(job.status)) {
    throw new ValidationError(`Cannot run job in status: ${job.status}`);
  }

  jobs.set(jobId, { ...job, status: 'running', started_at: new Date().toISOString() });
  activeJobCount++;
  const updated = jobs.get(jobId)!;
  const chunks = chunkItems(job.item_ids, BATCH_DEFAULT_CHUNK_SIZE);
  const perChunkMs = BATCH_ESTIMATED_DURATION_MS[job.operation_type] ?? 500;
  updated.estimated_duration_ms = chunks.length * perChunkMs;

  try {
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci]!;
      for (const itemId of chunk) {
        try {
          // Execute based on operation type
          await executeBatchOperation(job.operation_type, itemId, job.parameters, db);
          updated.success_count++;
        } catch (err) {
          const error: BatchError = {
            item_id: itemId, error_code: 'EXECUTION_ERROR',
            error_message: String(err), timestamp: new Date().toISOString(), retryable: true,
          };
          updated.error_log.push(error);
          updated.failure_count++;
          const errPct = updated.failure_count / updated.total_items;
          if (errPct >= defaultConstraints.pause_on_error_threshold) {
            jobs.set(jobId, { ...updated, status: 'paused' });
            updated.warnings.push({
              warning_code: 'HIGH_ERROR_RATE',
              warning_message: `Error rate ${(errPct * 100).toFixed(1)}% exceeds threshold`,
              timestamp: new Date().toISOString(),
            });
            activeJobCount--;
            return jobs.get(jobId)!;
          }
        }
        updated.processed_items++;
      }
    }
    updated.status = 'completed';
    updated.completed_at = new Date().toISOString();
    updated.actual_duration_ms = updated.started_at
      ? Date.now() - new Date(updated.started_at).getTime() : 0;
    updated.result_summary = {
      operation_type: updated.operation_type, total_processed: updated.processed_items,
      success_count: updated.success_count, failure_count: updated.failure_count,
      skipped_count: updated.skipped_count, affected_records: updated.success_count,
      execution_time_ms: updated.actual_duration_ms ?? 0, rollback_available: updated.can_rollback,
    };
  } catch (err) {
    updated.status = 'failed';
    updated.error_log.push({ item_id: 'SYSTEM', error_code: 'RUN_FAILED', error_message: String(err), timestamp: new Date().toISOString(), retryable: false });
  }
  activeJobCount--;
  jobs.set(jobId, updated);
  return updated;
}

async function executeBatchOperation(
  operationType: BatchOperationType, itemId: string,
  params: Record<string, unknown>, db: PrismaClient,
): Promise<void> {
  const m = db.asset;
  switch (operationType) {
    case 'asset_bulk_update': {
      await m.update({ where: { asset_id: itemId }, data: params.data as Record<string, unknown> });
      break;
    }
    case 'asset_bulk_delete': {
      await m.delete({ where: { asset_id: itemId } });
      break;
    }
    case 'asset_bulk_publish': {
      await m.update({ where: { asset_id: itemId }, data: { status: 'published' } });
      break;
    }
    case 'asset_bulk_archive': {
      await m.update({ where: { asset_id: itemId }, data: { status: 'archived' } });
      break;
    }
    case 'asset_bulk_tag': {
      const { tags, action } = params as { tags: string[]; action: 'add' | 'remove' };
      const asset = await m.findUnique({ where: { asset_id: itemId } });
      if (!asset) throw new Error('Asset not found');
      const currentTags: string[] = (asset.tags as string[]) ?? [];
      const newTags = action === 'add'
        ? [...new Set([...currentTags, ...tags])]
        : currentTags.filter(t => !tags.includes(t));
      await m.update({ where: { asset_id: itemId }, data: { tags: newTags } });
      break;
    }
    case 'asset_bulk_signal': {
      const { signals } = params as { signals: string[] };
      const asset = await m.findUnique({ where: { asset_id: itemId } });
      if (!asset) throw new Error('Asset not found');
      const currentSignals: string[] = (asset.signals as string[]) ?? [];
      await m.update({ where: { asset_id: itemId }, data: { signals: [...new Set([...currentSignals, ...signals])] } });
      break;
    }
    case 'node_bulk_quarantine': {
      const { level, reason } = params as { level: string; reason: string };
      await db.quarantineRecord.create({ data: { node_id: itemId, level, reason, expires_at: new Date(), auto_release_at: new Date() } });
      break;
    }
    case 'gdi_bulk_recalculate': {
      const asset = await m.findUnique({ where: { asset_id: itemId } });
      if (asset) {
        // Recalculate GDI score (simplified)
        const newScore = Math.min(100, Math.max(0, (asset.downloads * 2) + (asset.rating * 10)));
        await m.update({ where: { asset_id: itemId }, data: { gdi_score: newScore } });
      }
      break;
    }
    default:
      throw new Error(`Unsupported batch operation: ${operationType}`);
  }
}

export function pauseBatchJob(jobId: string): BatchJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status !== 'running') throw new ValidationError('Job is not running');
  const updated = { ...job, status: 'paused' as BatchStatus };
  jobs.set(jobId, updated);
  return updated;
}

export function resumeBatchJob(jobId: string): BatchJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status !== 'paused') throw new ValidationError('Job is not paused');
  const updated = { ...job, status: 'pending' as BatchStatus };
  jobs.set(jobId, updated);
  return updated;
}

export function cancelBatchJob(jobId: string): BatchJob | null {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (!['pending', 'running', 'paused'].includes(job.status)) throw new ValidationError('Cannot cancel');
  const updated = { ...job, status: 'cancelled' as BatchStatus };
  jobs.set(jobId, updated);
  activeJobCount = Math.max(0, activeJobCount - 1);
  return updated;
}

export function listBatchJobs(
  filters?: { user_id?: string; status?: string; operation_type?: string },
  pagination?: { page: number; page_size: number },
): { jobs: BatchJob[]; total: number } {
  let all = Array.from(jobs.values());
  if (filters?.user_id) all = all.filter(j => j.user_id === filters.user_id);
  if (filters?.status) all = all.filter(j => j.status === filters.status);
  if (filters?.operation_type) all = all.filter(j => j.operation_type === filters.operation_type);
  all.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = all.length;
  const page = pagination?.page ?? 1;
  const size = pagination?.page_size ?? 20;
  return { jobs: all.slice((page - 1) * size, page * size), total };
}

// ===== Scheduled Batch Jobs =====
export function createBatchSchedule(params: {
  user_id: string; operation_type: BatchOperationType;
  cron_expression: string; parameters: Record<string, unknown>;
}): BatchSchedule {
  const schedule: BatchSchedule = {
    schedule_id: genId('sch'), user_id: params.user_id,
    operation_type: params.operation_type,
    cron_expression: params.cron_expression,
    parameters: params.parameters,
    is_enabled: true,
    total_runs: 0, success_runs: 0, failure_runs: 0,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  schedules.set(schedule.schedule_id, schedule);
  return schedule;
}

export function getBatchSchedule(scheduleId: string): BatchSchedule | null {
  return schedules.get(scheduleId) ?? null;
}

export function listBatchSchedules(userId?: string): BatchSchedule[] {
  const all = Array.from(schedules.values());
  return userId ? all.filter(s => s.user_id === userId) : all;
}

export function deleteBatchSchedule(scheduleId: string): boolean {
  return schedules.delete(scheduleId);
}

export function _resetTestState(): void { jobs.clear(); schedules.clear(); activeJobCount = 0; }
