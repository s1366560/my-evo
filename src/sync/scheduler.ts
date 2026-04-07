import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import {
  SYNC_INTERVAL_MS,
  SYNC_MAX_RETRIES,
  SYNC_RETRY_DELAY_MS,
} from '../shared/constants';
import type {
  SyncJobData,
  SyncJobResult,
  ScheduledSync,
  SyncPriority,
} from './types';

const SYNC_QUEUE_NAME = 'sync:periodic';

let redis: Redis | null = null;
let queue: Queue<SyncJobData> | null = null;
let schedulerWorker: Worker<SyncJobData, SyncJobResult> | null = null;

function getRedisConnection(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  }
  return redis;
}

export async function initializeScheduler(): Promise<void> {
  const connection = getRedisConnection();

  queue = new Queue<SyncJobData>(SYNC_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });

  schedulerWorker = new Worker<SyncJobData, SyncJobResult>(
    SYNC_QUEUE_NAME,
    async (job: Job<SyncJobData, SyncJobResult>) => {
      return executeSyncJob(job.data);
    },
    {
      connection,
      concurrency: 10,
    },
  );

  schedulerWorker.on('completed', (job) => {
    console.log(`[SyncScheduler] Job ${job.id} completed for node ${job.data.node_id}`);
  });

  schedulerWorker.on('failed', (job, err) => {
    console.error(`[SyncScheduler] Job ${job?.id} failed:`, err.message);
  });

  console.log('[SyncScheduler] Initialized successfully');
}

async function executeSyncJob(data: SyncJobData): Promise<SyncJobResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    const { triggerPeriodicSync } = await import('./service');
    const result = await triggerPeriodicSync(data.node_id);
    return {
      success: true,
      sync_id: result.sync_id,
      items_synced: 0,
      errors: [],
      duration_ms: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);
    return {
      success: false,
      sync_id: data.job_id,
      items_synced: 0,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }
}

export async function scheduleSync(
  nodeId: string,
  intervalMs: number = SYNC_INTERVAL_MS,
  priority: SyncPriority = 'normal',
): Promise<ScheduledSync> {
  if (!queue) {
    throw new Error('Scheduler not initialized. Call initializeScheduler() first.');
  }

  const jobId = `sync:${nodeId}:${Date.now()}`;
  const repeatIntervalMs = Math.max(intervalMs, 60_000);

  const existingJobs = await queue.getJobs();
  const existingJob = existingJobs.find(
    (j) => j.data.node_id === nodeId && j.attemptsMade === 0,
  );
  if (existingJob) {
    return {
      job_id: String(existingJob.id || jobId),
      node_id: nodeId,
      interval_ms: repeatIntervalMs,
      next_run_at: new Date(Date.now() + repeatIntervalMs).toISOString(),
      is_active: true,
    };
  }

  const job = await queue.add(
    `sync:${nodeId}`,
    {
      node_id: nodeId,
      job_id: jobId,
      priority,
    },
    {
      jobId,
      repeat: {
        every: repeatIntervalMs,
      },
      attempts: SYNC_MAX_RETRIES,
      backoff: {
        type: 'exponential',
        delay: SYNC_RETRY_DELAY_MS,
      },
    },
  );

  return {
    job_id: String(job.id || jobId),
    node_id: nodeId,
    interval_ms: repeatIntervalMs,
    next_run_at: new Date(Date.now() + repeatIntervalMs).toISOString(),
    is_active: true,
  };
}

export async function cancelScheduledSync(jobId: string): Promise<boolean> {
  if (!queue) {
    throw new Error('Scheduler not initialized');
  }

  const job = await queue.getJob(jobId);
  if (!job) return false;

  const removed = await job.remove();
  return removed !== undefined;
}

export async function getScheduledJobs(): Promise<ScheduledSync[]> {
  if (!queue) {
    return [];
  }

  await queue.getJobs();
  const repeatableJobs = await queue.getRepeatableJobs();

  const scheduled: ScheduledSync[] = repeatableJobs.map((rj) => {
    const idParts = String(rj.id).split(':');
    const nodeIdPart = idParts.length > 1 ? (idParts[1] || '') : '';
    const intervalVal = typeof rj.every === 'number' ? rj.every : SYNC_INTERVAL_MS;
    const nextVal = typeof rj.next === 'number' ? rj.next : Date.now();
    const nextDate = new Date(nextVal);

    return {
      job_id: rj.key,
      node_id: nodeIdPart,
      interval_ms: intervalVal,
      next_run_at: nextDate.toISOString(),
      is_active: true,
    };
  });

  return scheduled;
}

export async function getSchedulerStats(): Promise<{
  queue_name: string;
  waiting_count: number;
  active_count: number;
  completed_count: number;
  failed_count: number;
  delayed_count: number;
}> {
  if (!queue) {
    return {
      queue_name: SYNC_QUEUE_NAME,
      waiting_count: 0,
      active_count: 0,
      completed_count: 0,
      failed_count: 0,
      delayed_count: 0,
    };
  }

  const counts = await queue.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
  );

  return {
    queue_name: SYNC_QUEUE_NAME,
    waiting_count: counts.waiting || 0,
    active_count: counts.active || 0,
    completed_count: counts.completed || 0,
    failed_count: counts.failed || 0,
    delayed_count: counts.delayed || 0,
  };
}

export async function shutdownScheduler(): Promise<void> {
  if (schedulerWorker) {
    await schedulerWorker.close();
    schedulerWorker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export { queue, schedulerWorker };
