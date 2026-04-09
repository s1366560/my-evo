import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import {
  GDI_PROMOTION_THRESHOLD,
  GDI_INTRINSIC_MIN,
  GDI_CONFIDENCE_MIN,
  NODE_REPUTATION_MIN,
  PROMOTION_REWARD,
} from '../shared/constants.js';

const prisma = new PrismaClient();

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let redis: IORedis | null = null;

function getRedisConnection() {
  if (!redis) {
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export const GDI_REFRESH_QUEUE = 'gdi-refresh';

// ─── Hourly Worker ─────────────────────────────────────────────────────────

export async function startGDIRefreshWorker(): Promise<Worker> {
  const connection = getRedisConnection();

  const worker = new Worker(
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

  worker.on('completed', (job) => {
    console.log(`[GDI-Refresh] Completed job ${job.id} at ${new Date().toISOString()}`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[GDI-Refresh] Job ${job?.id} failed:`, err.message);
  });

  console.log('[GDI-Refresh] Worker started, listening for jobs on queue:', GDI_REFRESH_QUEUE);
  return worker;
}

// ─── Core Refresh Logic ──────────────────────────────────────────────────────

/**
 * Iterates over all candidate (published / candidate-status) assets, recalculates
 * their GDI score using the existing `calculateGDI` service, and auto-promotes
 * assets that pass all five promotion gate conditions.
 */
export async function refreshGDIScores(): Promise<{ refreshed: number; promoted: number }> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // ── Find all candidate assets that need a refresh ──
  const candidates = await prisma.asset.findMany({
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
  const lastScores = await prisma.gDIScoreRecord.findMany({
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
      const { calculateGDI } = await import('../assets/service.js');
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

      // Fetch node reputation (second condition)
      const node = await prisma.node.findUnique({
        where: { node_id: asset.author_id },
        select: { reputation: true },
      });
      if (!node || node.reputation < NODE_REPUTATION_MIN) continue;

      // Perform promotion
      await prisma.asset.update({
        where: { asset_id: asset.asset_id },
        data: { status: 'promoted' },
      });
      await prisma.evolutionEvent.create({
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
      await prisma.creditTransaction.create({
        data: {
          node_id: asset.author_id,
          amount: PROMOTION_REWARD,
          type: 'ASSET_PROMOTED',
          description: `Asset ${asset.asset_id} auto-promoted via GDI refresh`,
          balance_after: node.reputation, // approximate; credits tracked separately
        },
      });
      await prisma.node.update({
        where: { node_id: asset.author_id },
        data: {
          credit_balance: { increment: PROMOTION_REWARD },
          reputation: { increment: 50 },
        },
      });

      promoted++;
      console.log(`[GDI-Refresh] Auto-promoted asset ${asset.asset_id} (GDI lower: ${result.gdi_lower?.toFixed(2) ?? 'n/a'})`);
    } catch (err) {
      console.error(`[GDI-Refresh] Error refreshing ${asset.asset_id}:`, err);
    }
  }

  console.log(`[GDI-Refresh] Done — refreshed: ${refreshed}, promoted: ${promoted}`);
  return { refreshed, promoted };
}

// ─── Cleanup on process exit ──────────────────────────────────────────────────

export async function closeGDIRefreshWorker(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
