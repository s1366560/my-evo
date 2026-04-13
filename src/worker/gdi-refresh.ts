import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import {
  GDI_PROMOTION_THRESHOLD,
  GDI_INTRINSIC_MIN,
  GDI_CONFIDENCE_MIN,
  NODE_REPUTATION_MIN,
  PROMOTION_REWARD,
} from '../shared/constants';
import {
  ASSET_QUALITY_DISPUTE_TYPES,
  blocksAssetPromotion,
} from '../shared/dispute-consensus';

const DEFAULT_REDIS_URL = 'redis://localhost:6379';

let redis: IORedis | null = null;
let prisma: PrismaClient | null = null;
let ownsPrisma = false;
let activeWorker: Worker | null = null;
let workerStartup: Promise<Worker> | null = null;
let activeConsumers = 0;
type GDIRefreshWorkerStatus = 'stopped' | 'starting' | 'running' | 'degraded';
let workerStatus: GDIRefreshWorkerStatus = 'stopped';

interface LoggerLike {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

let logger: LoggerLike = console;

function resolveRedisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const isLocalRuntime = !process.env.NODE_ENV
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test';

  if (isLocalRuntime) {
    return DEFAULT_REDIS_URL;
  }

  throw new Error('REDIS_URL is required to start the GDI refresh worker');
}

function getRedisConnection() {
  if (!redis) {
    redis = new IORedis(resolveRedisUrl(), {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
    ownsPrisma = true;
  }

  return prisma;
}

async function shutdownWorkerRuntime(): Promise<void> {
  activeConsumers = 0;
  const worker = activeWorker;
  const connection = redis;
  const prismaClient = ownsPrisma ? prisma : null;
  const results = await Promise.allSettled([
    worker ? worker.close() : Promise.resolve(),
    connection ? connection.quit() : Promise.resolve(),
    prismaClient ? prismaClient.$disconnect() : Promise.resolve(),
  ]);

  if (results[0]?.status === 'fulfilled') {
    activeWorker = null;
  }
  if (results[1]?.status === 'fulfilled') {
    redis = null;
  }
  if (results[2]?.status === 'fulfilled') {
    prisma = null;
    ownsPrisma = false;
  }
  if (!worker && !connection && !prismaClient) {
    prisma = null;
    ownsPrisma = false;
  }

  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (rejected) {
    throw rejected.reason;
  }
}

function withStartupTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[GDI-Refresh] Worker startup timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function cleanupFailedStartup(worker: Worker): Promise<void> {
  const connection = redis;
  const results = await Promise.allSettled([
    worker.close(),
    connection ? connection.quit() : Promise.resolve(),
  ]);

  if (results[1]?.status === 'fulfilled') {
    redis = null;
  }

  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (rejected) {
    throw rejected.reason;
  }
}

export function getGDIRefreshWorkerStatus(): GDIRefreshWorkerStatus {
  return workerStatus;
}

export const GDI_REFRESH_QUEUE = 'gdi-refresh';

// ─── Hourly Worker ─────────────────────────────────────────────────────────

export async function startGDIRefreshWorker(options: {
  logger?: LoggerLike;
  startupTimeoutMs?: number;
} = {}): Promise<Worker> {
  if (activeWorker) {
    workerStatus = 'running';
    activeConsumers += 1;
    return activeWorker;
  }

  if (workerStartup) {
    const worker = await workerStartup;
    activeConsumers += 1;
    return worker;
  }

  const startupLogger = options.logger ?? logger;
  const startupTimeoutMs = options.startupTimeoutMs ?? Number(process.env.GDI_WORKER_STARTUP_TIMEOUT_MS ?? 5000);
  workerStatus = 'starting';
  let connection: IORedis;
  try {
    connection = getRedisConnection();
  } catch (error) {
    workerStatus = 'degraded';
    throw error;
  }
  let pendingWorker: Worker | null = null;

  workerStartup = (async () => {
    pendingWorker = new Worker(
      GDI_REFRESH_QUEUE,
      async (job: Job) => {
        const result = await refreshGDIScores();
        return { refreshedAt: new Date().toISOString(), ...result };
      },
      {
        connection,
        concurrency: 5,
        limiter: { max: 1, duration: 60 * 60 * 1000 }, // max 1 job per hour
      }
    );

    pendingWorker.on('completed', (job) => {
      workerStatus = 'running';
      startupLogger.info(`[GDI-Refresh] Completed job ${job.id} at ${new Date().toISOString()}`);
    });
    pendingWorker.on('failed', (job, err) => {
      workerStatus = 'degraded';
      startupLogger.error(`[GDI-Refresh] Job ${job?.id} failed:`, err.message);
    });
    pendingWorker.on('error', (err) => {
      workerStatus = 'degraded';
      startupLogger.error('[GDI-Refresh] Worker error:', err);
    });

    await withStartupTimeout(pendingWorker.waitUntilReady(), startupTimeoutMs);

    logger = startupLogger;
    activeWorker = pendingWorker;
    activeConsumers = 1;
    workerStatus = 'running';

    startupLogger.info('[GDI-Refresh] Worker started, listening for jobs on queue:', GDI_REFRESH_QUEUE);
    return pendingWorker;
  })();

  try {
    return await workerStartup;
  } catch (err) {
    workerStatus = 'degraded';
    if (pendingWorker) {
      try {
        await cleanupFailedStartup(pendingWorker);
      } catch (cleanupError) {
        startupLogger.error('[GDI-Refresh] Cleanup after failed startup also failed:', cleanupError);
      }
    }

    throw err;
  } finally {
    workerStartup = null;
  }
}

// ─── Core Refresh Logic ──────────────────────────────────────────────────────

/**
 * Iterates over all candidate (published / candidate-status) assets, recalculates
 * their GDI score using the existing `calculateGDI` service, and auto-promotes
 * assets that pass all five promotion gate conditions.
 */
export async function refreshGDIScores(): Promise<{ refreshed: number; promoted: number }> {
  const prismaClient = getPrismaClient();
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // ── Find all candidate assets that need a refresh ──
  const candidates = await prismaClient.asset.findMany({
    where: {
      status: { in: ['published', 'candidate'] },
    },
    select: {
      asset_id: true,
      author_id: true,
      confidence: true,
      execution_count: true,
      updated_at: true,
      created_at: true,
      last_verified_at: true,
    },
  });

  // Get last calculation time for each candidate in a single query
  const lastScoreMap = new Map<string, Date>();
  const lastScores = await prismaClient.gDIScoreRecord.findMany({
    where: { asset_id: { in: candidates.map((a) => a.asset_id) } },
    orderBy: { calculated_at: 'desc' },
    distinct: ['asset_id'],
    select: { asset_id: true, calculated_at: true },
  });
  for (const s of lastScores) {
    lastScoreMap.set(s.asset_id, s.calculated_at);
  }

  let refreshed = 0;
  let promoted = 0;

  for (const asset of candidates) {
    const lastCalc = lastScoreMap.get(asset.asset_id);
    if (lastCalc && lastCalc.getTime() > oneHourAgo.getTime()) {
      // Already refreshed recently — skip
      continue;
    }

    try {
      const { calculateGDI } = await import('../assets/service');
      const result = await calculateGDI(asset.asset_id);

      refreshed++;

      // ── Auto-promotion gate (all five conditions must pass) ──
      // 1. gdi_lower >= GDI_PROMOTION_THRESHOLD
      // 2. intrinsic >= GDI_INTRINSIC_MIN
      // 3. confidence >= GDI_CONFIDENCE_MIN
      // 4. node.reputation >= NODE_REPUTATION_MIN
      // 5. asset.status == 'published'  (already filtered, but explicit check)
      const passesGate =
        (result.gdi_lower ?? result.gdi_mean) >= GDI_PROMOTION_THRESHOLD &&
        result.dimensions.intrinsic >= GDI_INTRINSIC_MIN &&
        (asset.confidence ?? 1.0) >= GDI_CONFIDENCE_MIN;

      if (!passesGate) continue;

      const promotionApplied = await prismaClient.$transaction(async (tx) => {
        const node = await tx.node.findUnique({
          where: { node_id: asset.author_id },
          select: { reputation: true },
        });
        if (!node || node.reputation < NODE_REPUTATION_MIN) {
          return false;
        }

        const disputes = await tx.dispute.findMany({
          where: {
            type: { in: [...ASSET_QUALITY_DISPUTE_TYPES] },
            OR: [
              { related_asset_id: asset.asset_id },
              { target_id: asset.asset_id },
            ],
          },
          select: { status: true, ruling: true },
        });
        if (blocksAssetPromotion(disputes)) {
          return false;
        }

        const promotedAsset = await tx.asset.updateMany({
          where: {
            asset_id: asset.asset_id,
            status: { in: ['published', 'candidate'] },
          },
          data: { status: 'promoted' },
        });
        if (promotedAsset.count !== 1) {
          return false;
        }

        const updatedNode = await tx.node.update({
          where: { node_id: asset.author_id },
          data: {
            credit_balance: { increment: PROMOTION_REWARD },
            reputation: { increment: 50 },
          },
          select: { credit_balance: true },
        });

        await tx.evolutionEvent.create({
          data: {
            asset_id: asset.asset_id,
            event_type: 'auto_promoted',
            from_version: 1,
            to_version: 1,
            changes: 'Auto-promoted via hourly GDI refresh',
            actor_id: 'system',
            node_id: asset.author_id,
          },
        });
        await tx.creditTransaction.create({
          data: {
            node_id: asset.author_id,
            amount: PROMOTION_REWARD,
            type: 'ASSET_PROMOTED',
            description: `Asset ${asset.asset_id} auto-promoted via GDI refresh`,
            balance_after: updatedNode.credit_balance,
          },
        });

        return true;
      });

      if (!promotionApplied) continue;

      promoted++;
      logger.info(`[GDI-Refresh] Auto-promoted asset ${asset.asset_id} (GDI lower: ${result.gdi_lower?.toFixed(2) ?? 'n/a'})`);
    } catch (err) {
      logger.error(`[GDI-Refresh] Error refreshing ${asset.asset_id}:`, err);
    }
  }

  logger.info(`[GDI-Refresh] Done — refreshed: ${refreshed}, promoted: ${promoted}`);
  return { refreshed, promoted };
}

// ─── Cleanup on process exit ──────────────────────────────────────────────────

export async function closeGDIRefreshWorker(): Promise<void> {
  if (workerStartup) {
    try {
      await workerStartup;
    } catch {
      workerStatus = 'stopped';
      return;
    }
  }

  if (activeWorker && activeConsumers > 1) {
    activeConsumers -= 1;
    return;
  }

  await shutdownWorkerRuntime();
  workerStatus = 'stopped';
}
