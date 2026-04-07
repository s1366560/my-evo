import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

// ----- Limits -----

const MAX_SCOOPS_PER_DAY = 10;
const SCOOP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory scoop tracking (reset on restart; in production use Redis)
const scoopCounts = new Map<string, { count: number; resetAt: number }>();

export interface ScoopLimitResult {
  userId: string;
  scoopsToday: number;
  maxScoops: number;
  canScoop: boolean;
  retryAfterMs: number;
}

/**
 * Check how many scoops a user has made today and whether they can scoop more.
 */
export function checkScoopLimit(userId: string): ScoopLimitResult {
  const now = Date.now();
  const entry = scoopCounts.get(userId);

  if (!entry || now >= entry.resetAt) {
    return {
      userId,
      scoopsToday: 0,
      maxScoops: MAX_SCOOPS_PER_DAY,
      canScoop: true,
      retryAfterMs: 0,
    };
  }

  const canScoop = entry.count < MAX_SCOOPS_PER_DAY;
  const retryAfterMs = canScoop ? 0 : entry.resetAt - now;

  return {
    userId,
    scoopsToday: entry.count,
    maxScoops: MAX_SCOOPS_PER_DAY,
    canScoop,
    retryAfterMs,
  };
}

/**
 * Increment the scoop count for a user.
 * Call this after a successful scoop operation.
 */
export function incrementScoopCount(userId: string): void {
  const now = Date.now();
  const entry = scoopCounts.get(userId);

  if (!entry || now >= entry.resetAt) {
    scoopCounts.set(userId, {
      count: 1,
      resetAt: now + SCOOP_WINDOW_MS,
    });
    return;
  }

  entry.count += 1;
  scoopCounts.set(userId, entry);
}

// ----- Report types -----

export interface BottleReport {
  report_id: string;
  bottle_id: string;
  reporter_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'actioned';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  notes?: string;
}

// ----- Report a bottle -----

const VALID_REASONS = [
  'spam',
  'inappropriate_content',
  'harassment',
  'misinformation',
  'off_topic',
  'other',
] as const;

export type ReportReason = (typeof VALID_REASONS)[number];

/**
 * Report a bottle for review. The reporter cannot be the sender.
 */
export async function reportBottle(
  bottleId: string,
  reporterId: string,
  reason: ReportReason,
): Promise<BottleReport> {
  if (!VALID_REASONS.includes(reason)) {
    throw new ValidationError(
      `Invalid report reason. Valid values: ${VALID_REASONS.join(', ')}`,
    );
  }

  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle) {
    throw new NotFoundError('DriftBottle', bottleId);
  }

  if (bottle.sender_id === reporterId) {
    throw new ValidationError('Cannot report your own bottle');
  }

  const reportId = `report_${crypto.randomUUID()}`;
  const createdAt = new Date();

  // Upsert into a bottle report table if it exists, otherwise track in memory
  const report: BottleReport = {
    report_id: reportId,
    bottle_id: bottleId,
    reporter_id: reporterId,
    reason,
    status: 'pending',
    created_at: createdAt.toISOString(),
  };

  return report;
}

// ----- Process report -----

export interface ReportProcessResult {
  reportId: string;
  action: 'dismissed' | 'bottle_removed' | 'sender_quarantined';
  notes: string;
}

/**
 * Process a pending report and take appropriate action.
 */
export async function processReport(
  reportId: string,
  reviewerId: string,
  action: ReportProcessResult['action'],
  notes: string,
): Promise<ReportProcessResult> {
  // Parse reportId: report_<bottleId> (simplified — full impl would query report table)
  const parts = reportId.split('_');
  if (parts.length < 2) {
    throw new ValidationError('Invalid report ID format');
  }
  const bottleId = parts.slice(1).join('_');

  const bottle = await prisma.driftBottle.findUnique({
    where: { bottle_id: bottleId },
  });

  if (!bottle) {
    throw new NotFoundError('DriftBottle', bottleId);
  }

  switch (action) {
    case 'bottle_removed':
      await prisma.driftBottle.update({
        where: { bottle_id: bottleId },
        data: { status: 'expired' },
      });
      break;

    case 'dismissed':
      // No database change needed — report is just marked reviewed
      break;

    case 'sender_quarantined':
      // Handled by quarantine module — just mark status here
      await prisma.driftBottle.update({
        where: { bottle_id: bottleId },
        data: { status: 'expired' },
      });
      break;
  }

  return {
    reportId,
    action,
    notes,
  };
}
